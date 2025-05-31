import os
import io
import requests
from typing import List, Dict, Optional
from datetime import datetime
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
    description="FastAPI backend for the SynthesisTalk research assistant with web search",
    version="1.1.0",
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

class DocumentContext(BaseModel):
    filename: str
    content: str
    upload_time: str

class LLMRequest(BaseModel):
    prompt: str
    conversation_id: str = "default"
    context: List[Message] = []
    include_search: bool = False
    document_context: Optional[str] = None

class LLMResponse(BaseModel):
    response: str
    conversation_id: str
    updated_context: List[Message]
    search_results: Optional[List[SearchResult]] = None
    document_used: Optional[str] = None

class DocumentResponse(BaseModel):
    filename: str
    text: str

# ==================== DATA STORAGE ====================

conversations: Dict[str, List[Message]] = {}
document_contexts: Dict[str, DocumentContext] = {}

# ==================== TOOLS ====================

class WebSearchTool:
    def __init__(self):
        self.api_key = BRAVE_API_KEY
        self.base_url = "https://api.search.brave.com/res/v1/web/search"
    
    def search(self, query: str, max_results: int = 5) -> List[SearchResult]:
        """Search the web using Brave Search API"""
        if not self.api_key:
            raise Exception("Brave API key not configured")
        
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
            
            return results
        
        except Exception as e:
            raise Exception(f"Web search failed: {str(e)}")

class LLMTool:
    def __init__(self):
        self.client = groq_client
        self.search_tool = WebSearchTool() if BRAVE_API_KEY else None
    
    def call(self, prompt: str, context: List[Message] = None, include_search: bool = False, document_context: str = None) -> tuple[str, Optional[List[SearchResult]], Optional[str]]:
        try:
            search_results = None
            document_used = None
            
            # Perform web search if requested and available
            if include_search and self.search_tool:
                try:
                    search_results = self.search_tool.search(prompt, max_results=3)
                except Exception as e:
                    print(f"Search failed: {e}")
            
            # Build messages array with context
            messages = []
            
            # Enhanced system message
            system_message = """You are SynthesisTalk, an intelligent research assistant. You help users explore complex topics through conversation. Maintain context from previous messages and provide thoughtful, well-reasoned responses. If you reference previous parts of the conversation, be explicit about what you're referring to."""
            
            # Add document context if provided
            if document_context:
                document_used = "Document content integrated"
                system_message += f"\n\nYou have access to the following document content for reference:\n\n--- DOCUMENT CONTENT ---\n{document_context}\n--- END DOCUMENT ---\n\nUse this document content to provide more informed responses when relevant. Always indicate when you're referencing the uploaded document."
            
            # Add search results if available
            if search_results:
                search_context = "\n\nWeb search results for your reference:\n"
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
            
            return chat_completion.choices[0].message.content, search_results, document_used
            
        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

# ==================== HELPER FUNCTIONS ====================

def get_conversation_context(conversation_id: str, max_messages: int = 10) -> List[Message]:
    """Get the last N messages from a conversation for context"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    return conversations[conversation_id][-max_messages:]

def update_conversation(conversation_id: str, user_message: str, assistant_response: str):
    """Add new messages to conversation history"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    conversations[conversation_id].extend([
        Message(role="user", content=user_message),
        Message(role="assistant", content=assistant_response)
    ])

# ==================== API ENDPOINTS ====================

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "SynthesisTalk Backend",
        "version": "1.1.0",
        "features": {
            "web_search": BRAVE_API_KEY is not None
        }
    }

# Web Search endpoint
@app.post("/api/search", response_model=SearchResponse)
async def search_endpoint(req: SearchRequest):
    """Standalone web search endpoint"""
    try:
        if not BRAVE_API_KEY:
            raise HTTPException(status_code=503, detail="Web search not configured")
        
        search_tool = WebSearchTool()
        results = search_tool.search(req.query, req.max_results)
        
        return SearchResponse(
            query=req.query,
            results=results
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# LLM endpoint with search and document support
@app.post("/api/llm", response_model=LLMResponse)
async def llm_endpoint(req: LLMRequest):
    try:
        # Get conversation context
        context = get_conversation_context(req.conversation_id)
        
        # Override with provided context if given
        if req.context:
            context = req.context
        
        # Call LLM with context, optional search, and optional document
        tool = LLMTool()
        answer, search_results, document_used = tool.call(
            req.prompt, 
            context, 
            req.include_search,
            req.document_context
        )
        
        # Update conversation history
        update_conversation(req.conversation_id, req.prompt, answer)
        
        # Get updated context to return
        updated_context = get_conversation_context(req.conversation_id)
        
        return LLMResponse(
            response=answer,
            conversation_id=req.conversation_id,
            updated_context=updated_context,
            search_results=search_results,
            document_used=document_used
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Document upload and extraction
@app.post("/api/documents", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...)):
    """Accepts a PDF or plain-text file, extracts its text, stores it, and returns it."""
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

        # Store document context with timestamp
        doc_id = f"doc_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        document_contexts[doc_id] = DocumentContext(
            filename=file.filename,
            content=text,
            upload_time=datetime.now().isoformat()
        )

        return DocumentResponse(filename=file.filename, text=text)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")

# Get list of uploaded documents
@app.get("/api/documents")
async def list_documents():
    """Get list of uploaded documents"""
    return {
        "documents": [
            {
                "id": doc_id,
                "filename": doc.filename,
                "upload_time": doc.upload_time,
                "content_length": len(doc.content)
            }
            for doc_id, doc in document_contexts.items()
        ]
    }

# Get specific document content
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
        "upload_time": doc.upload_time
    }

# Get conversation history
@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get full conversation history"""
    context = get_conversation_context(conversation_id, max_messages=50)
    return {
        "conversation_id": conversation_id,
        "messages": context,
        "message_count": len(context)
    }

# Clear conversation
@app.delete("/api/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str):
    """Clear conversation history"""
    if conversation_id in conversations:
        del conversations[conversation_id]
    return {"message": f"Conversation {conversation_id} cleared"}

# List all conversations
@app.get("/api/conversations")
async def list_conversations():
    """Get list of all conversation IDs and their message counts"""
    return {
        "conversations": [
            {
                "id": conv_id,
                "message_count": len(messages),
                "last_message": messages[-1].content[:100] + "..." if messages else "No messages"
            }
            for conv_id, messages in conversations.items()
        ]
    }

# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)