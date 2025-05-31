import os
import io
import json
import hashlib
import requests
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from groq import Groq
from PyPDF2 import PdfReader

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title="SynthesisTalk Backend",
    description="FastAPI backend for the SynthesisTalk research assistant with enhanced features",
    version="1.2.0",
)

# Environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

# Validation
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")

if not BRAVE_API_KEY:
    print("Warning: BRAVE_API_KEY not found. Web search will be disabled.")

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# ==================== PYDANTIC MODELS ====================

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[str] = None
    sources: Optional[List[str]] = None  # NEW: Source attribution

class SearchResult(BaseModel):
    title: str
    url: str
    description: str

class SearchRequest(BaseModel):
    query: str
    max_results: int = 5

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    cached: bool = False  # NEW: Cache indicator

class DocumentChunk(BaseModel):  # NEW: For document chunking
    chunk_id: str
    content: str
    chunk_index: int
    total_chunks: int

class DocumentContext(BaseModel):
    filename: str
    content: str
    upload_time: str
    chunks: Optional[List[DocumentChunk]] = None  # NEW: Chunked content
    content_length: int = 0

class LLMRequest(BaseModel):
    prompt: str
    conversation_id: str = "default"
    context: List[Message] = []
    include_search: bool = False
    document_context: Optional[str] = None
    enable_source_attribution: bool = True  # NEW: Source attribution toggle

class LLMResponse(BaseModel):
    response: str
    conversation_id: str
    updated_context: List[Message]
    search_results: Optional[List[SearchResult]] = None
    document_used: Optional[str] = None
    sources_used: Optional[List[str]] = None  # NEW: Source attribution
    response_metadata: Optional[Dict] = None  # NEW: Additional metadata

class DocumentResponse(BaseModel):
    filename: str
    text: str
    chunks: Optional[List[DocumentChunk]] = None  # NEW: Chunked content
    chunked: bool = False

class ConversationExport(BaseModel):  # NEW: For conversation export
    conversation_id: str
    messages: List[Message]
    export_time: str
    metadata: Dict

# ==================== DATA STORAGE ====================

conversations: Dict[str, List[Message]] = {}
document_contexts: Dict[str, DocumentContext] = {}
search_cache: Dict[str, Tuple[List[SearchResult], datetime]] = {}  # NEW: Search cache

# ==================== UTILITY FUNCTIONS ====================

def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> List[DocumentChunk]:
    """Split text into overlapping chunks for better processing"""
    if len(text) <= chunk_size:
        return [DocumentChunk(
            chunk_id="chunk_0",
            content=text,
            chunk_index=0,
            total_chunks=1
        )]
    
    chunks = []
    start = 0
    chunk_index = 0
    
    while start < len(text):
        end = min(start + chunk_size, len(text))
        
        # Try to break at sentence boundaries
        if end < len(text):
            last_period = text.rfind('.', start, end)
            last_newline = text.rfind('\n', start, end)
            break_point = max(last_period, last_newline)
            
            if break_point > start + chunk_size // 2:  # Only use if reasonable
                end = break_point + 1
        
        chunk_content = text[start:end].strip()
        if chunk_content:
            chunks.append(DocumentChunk(
                chunk_id=f"chunk_{chunk_index}",
                content=chunk_content,
                chunk_index=chunk_index,
                total_chunks=0  # Will be updated after all chunks are created
            ))
            chunk_index += 1
        
        start = max(start + chunk_size - overlap, end)
    
    # Update total_chunks for all chunks
    total_chunks = len(chunks)
    for chunk in chunks:
        chunk.total_chunks = total_chunks
    
    return chunks

def get_cache_key(query: str, max_results: int = 5) -> str:
    """Generate cache key for search queries"""
    return hashlib.md5(f"{query}_{max_results}".encode()).hexdigest()

def is_cache_valid(cache_time: datetime, max_age_hours: int = 24) -> bool:
    """Check if cached search result is still valid"""
    return datetime.now() - cache_time < timedelta(hours=max_age_hours)

def extract_sources_from_response(response: str, search_results: List[SearchResult] = None, 
                                document_used: str = None) -> List[str]:
    """Extract and categorize sources used in the response"""
    sources = []
    
    if document_used:
        sources.append(f"Document: {document_used}")
    
    if search_results:
        # Simple heuristic: if response mentions terms from search results
        response_lower = response.lower()
        for result in search_results:
            title_words = result.title.lower().split()
            if any(word in response_lower for word in title_words if len(word) > 4):
                sources.append(f"Web: {result.title} ({result.url})")
    
    if not sources:
        sources.append("LLM Knowledge Base")
    
    return sources

# ==================== TOOLS ====================

class WebSearchTool:
    def __init__(self):
        self.api_key = BRAVE_API_KEY
        self.base_url = "https://api.search.brave.com/res/v1/web/search"
    
    def search(self, query: str, max_results: int = 5, use_cache: bool = True) -> Tuple[List[SearchResult], bool]:
        """Search the web using Brave Search API with caching"""
        if not self.api_key:
            raise Exception("Brave API key not configured")
        
        # Check cache first
        cache_key = get_cache_key(query, max_results)
        if use_cache and cache_key in search_cache:
            cached_results, cache_time = search_cache[cache_key]
            if is_cache_valid(cache_time):
                return cached_results, True
        
        try:
            headers = {
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": self.api_key
            }
            
            params = {
                "q": query,
                "count": max_results,
                "search_lang": "en",
                "country": "us",
                "safesearch": "moderate",
                "freshness": "pm"
            }
            
            response = requests.get(self.base_url, headers=headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            results = []
            
            if "web" in data and "results" in data["web"]:
                for item in data["web"]["results"]:
                    results.append(SearchResult(
                        title=item.get("title", ""),
                        url=item.get("url", ""),
                        description=item.get("description", "")
                    ))
            
            # Cache the results
            if use_cache:
                search_cache[cache_key] = (results, datetime.now())
            
            return results, False
        
        except Exception as e:
            raise Exception(f"Web search failed: {str(e)}")

class LLMTool:
    def __init__(self):
        self.client = groq_client
        self.search_tool = WebSearchTool() if BRAVE_API_KEY else None
    
    def call(self, prompt: str, context: List[Message] = None, include_search: bool = False, 
             document_context: str = None, enable_source_attribution: bool = True) -> tuple[str, Optional[List[SearchResult]], Optional[str], Optional[List[str]], Dict]:
        try:
            search_results = None
            search_cached = False
            document_used = None
            sources_used = []
            metadata = {}
            
            # Perform web search if requested and available
            if include_search and self.search_tool:
                try:
                    search_results, search_cached = self.search_tool.search(prompt, max_results=3)
                    metadata['search_cached'] = search_cached
                except Exception as e:
                    print(f"Search failed: {e}")
            
            # Build messages array with context
            messages = []
            
            # Enhanced system message with source attribution
            system_message = """You are SynthesisTalk, an intelligent research assistant. You help users explore complex topics through conversation. Maintain context from previous messages and provide thoughtful, well-reasoned responses."""
            
            if enable_source_attribution:
                system_message += """
                
IMPORTANT: When referencing information, clearly indicate your sources:
- For document content, use: [Document: filename]
- For web search results, use: [Web: source title]
- For your training knowledge, use: [Knowledge Base]
- When combining sources, list all relevant ones

Example: "According to the uploaded document [Document: research.pdf], the study shows... Additionally, recent web sources [Web: Latest Research Findings] indicate..."
"""
            
            # Add document context if provided
            if document_context:
                document_used = "Document content integrated"
                system_message += f"\n\nYou have access to the following document content for reference:\n\n--- DOCUMENT CONTENT ---\n{document_context}\n--- END DOCUMENT ---\n\nUse this document content to provide more informed responses when relevant."
            
            # Add search results if available
            if search_results:
                search_context = f"\n\nWeb search results for your reference (Cached: {search_cached}):\n"
                for i, result in enumerate(search_results, 1):
                    search_context += f"{i}. {result.title}\n   {result.description}\n   Source: {result.url}\n\n"
                
                system_message += search_context + "Use these search results to provide more current and comprehensive information when relevant."
            
            messages.append({
                "role": "system",
                "content": system_message
            })
            
            # Add conversation context
            if context:
                for msg in context:
                    messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
            
            # Add current prompt
            messages.append({
                "role": "user",
                "content": prompt
            })
            
            chat_completion = self.client.chat.completions.create(
                messages=messages,
                model="llama3-8b-8192",
                temperature=0.7,
                max_tokens=1000
            )
            
            response_content = chat_completion.choices[0].message.content
            
            # Extract sources if attribution is enabled
            if enable_source_attribution:
                sources_used = extract_sources_from_response(
                    response_content, search_results, document_used
                )
            
            metadata.update({
                'model_used': 'llama3-8b-8192',
                'temperature': 0.7,
                'max_tokens': 1000,
                'source_attribution_enabled': enable_source_attribution
            })
            
            return response_content, search_results, document_used, sources_used, metadata
            
        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

# ==================== HELPER FUNCTIONS ====================

def get_conversation_context(conversation_id: str, max_messages: int = 10) -> List[Message]:
    """Get the last N messages from a conversation for context"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    return conversations[conversation_id][-max_messages:]

def update_conversation(conversation_id: str, user_message: str, assistant_response: str, sources: List[str] = None):
    """Add new messages to conversation history with source attribution"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    timestamp = datetime.now().isoformat()
    
    conversations[conversation_id].extend([
        Message(role="user", content=user_message, timestamp=timestamp),
        Message(role="assistant", content=assistant_response, timestamp=timestamp, sources=sources)
    ])

# ==================== API ENDPOINTS ====================

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "SynthesisTalk Backend",
        "version": "1.2.0",
        "features": {
            "web_search": BRAVE_API_KEY is not None,
            "search_caching": True,
            "document_chunking": True,
            "source_attribution": True,
            "conversation_export": True
        }
    }

# Web Search endpoint with caching
@app.post("/api/search", response_model=SearchResponse)
async def search_endpoint(req: SearchRequest):
    """Standalone web search endpoint with caching"""
    try:
        if not BRAVE_API_KEY:
            raise HTTPException(status_code=503, detail="Web search not configured")
        
        search_tool = WebSearchTool()
        results, cached = search_tool.search(req.query, req.max_results)
        
        return SearchResponse(
            query=req.query,
            results=results,
            cached=cached
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Enhanced LLM endpoint
@app.post("/api/llm", response_model=LLMResponse)
async def llm_endpoint(req: LLMRequest):
    try:
        # Get conversation context
        context = get_conversation_context(req.conversation_id)
        
        # Override with provided context if given
        if req.context:
            context = req.context
        
        # Call LLM with enhanced features
        tool = LLMTool()
        answer, search_results, document_used, sources_used, metadata = tool.call(
            req.prompt, 
            context, 
            req.include_search,
            req.document_context,
            req.enable_source_attribution
        )
        
        # Update conversation history with sources
        update_conversation(req.conversation_id, req.prompt, answer, sources_used)
        
        # Get updated context to return
        updated_context = get_conversation_context(req.conversation_id)
        
        return LLMResponse(
            response=answer,
            conversation_id=req.conversation_id,
            updated_context=updated_context,
            search_results=search_results,
            document_used=document_used,
            sources_used=sources_used,
            response_metadata=metadata
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Enhanced document upload with chunking
@app.post("/api/documents", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), enable_chunking: bool = True, chunk_size: int = 2000):
    """Upload and process documents with optional chunking"""
    try:
        content = await file.read()
        if file.content_type == "application/pdf":
            reader = PdfReader(io.BytesIO(content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
        elif file.content_type.startswith("text/"):
            text = content.decode(errors="ignore")
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type")

        # Chunk the document if enabled and it's large enough
        chunks = None
        chunked = False
        if enable_chunking and len(text) > chunk_size:
            chunks = chunk_text(text, chunk_size)
            chunked = True

        # Store document context with timestamp and chunks
        doc_id = f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        document_contexts[doc_id] = DocumentContext(
            filename=file.filename,
            content=text,
            upload_time=datetime.now().isoformat(),
            chunks=chunks,
            content_length=len(text)
        )

        return DocumentResponse(
            filename=file.filename, 
            text=text, 
            chunks=chunks,
            chunked=chunked
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")

# Export conversation
@app.get("/api/conversations/{conversation_id}/export")
async def export_conversation(conversation_id: str):
    """Export conversation history as JSON"""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    export_data = ConversationExport(
        conversation_id=conversation_id,
        messages=conversations[conversation_id],
        export_time=datetime.now().isoformat(),
        metadata={
            "total_messages": len(conversations[conversation_id]),
            "export_version": "1.2.0"
        }
    )
    
    return export_data

# Import conversation
@app.post("/api/conversations/import")
async def import_conversation(conversation_data: ConversationExport):
    """Import conversation history from JSON"""
    try:
        conversations[conversation_data.conversation_id] = conversation_data.messages
        return {
            "message": f"Conversation {conversation_data.conversation_id} imported successfully",
            "messages_imported": len(conversation_data.messages)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import conversation: {e}")

# Clear search cache
@app.delete("/api/cache/search")
async def clear_search_cache():
    """Clear the search results cache"""
    global search_cache
    cache_size = len(search_cache)
    search_cache.clear()
    return {"message": f"Search cache cleared. Removed {cache_size} cached entries."}

# Get cache stats
@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get search cache statistics"""
    total_entries = len(search_cache)
    valid_entries = sum(1 for _, (_, cache_time) in search_cache.items() if is_cache_valid(cache_time))
    
    return {
        "total_cached_searches": total_entries,
        "valid_cached_searches": valid_entries,
        "expired_cached_searches": total_entries - valid_entries
    }

# All existing endpoints remain unchanged...
# (keeping the existing endpoints for backward compatibility)

@app.get("/api/documents")
async def list_documents():
    """Get list of uploaded documents"""
    return {
        "documents": [
            {
                "id": doc_id,
                "filename": doc.filename,
                "upload_time": doc.upload_time,
                "content_length": doc.content_length,
                "chunked": doc.chunks is not None,
                "total_chunks": len(doc.chunks) if doc.chunks else 0
            }
            for doc_id, doc in document_contexts.items()
        ]
    }

@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get specific document content"""
    if doc_id not in document_contexts:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc = document_contexts[doc_id]
    return {
        "id": doc_id,
        "filename": doc.filename,
        "content": doc.content,
        "upload_time": doc.upload_time,
        "content_length": doc.content_length,
        "chunks": doc.chunks,
        "chunked": doc.chunks is not None
    }

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get full conversation history"""
    context = get_conversation_context(conversation_id, max_messages=50)
    return {
        "conversation_id": conversation_id,
        "messages": context,
        "message_count": len(context)
    }

@app.delete("/api/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str):
    """Clear conversation history"""
    if conversation_id in conversations:
        del conversations[conversation_id]
    return {"message": f"Conversation {conversation_id} cleared"}

@app.get("/api/conversations")
async def list_conversations():
    """Get list of all conversation IDs and their message counts"""
    return {
        "conversations": [
            {
                "id": conv_id,
                "message_count": len(messages),
                "last_message": messages[-1].content[:100] + "..." if messages else "No messages",
                "last_updated": messages[-1].timestamp if messages and messages[-1].timestamp else "Unknown"
            }
            for conv_id, messages in conversations.items()
        ]
    }

# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)