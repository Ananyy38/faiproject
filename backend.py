import os
import io
import json
import hashlib
import requests
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from PyPDF2 import PdfReader

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title="SynthesisTalk Backend",
    description="FastAPI backend for the SynthesisTalk research assistant with enhanced features",
    version="1.3.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    sources: Optional[List[str]] = None
    reasoning_steps: Optional[List[str]] = None  # NEW: Chain of Thought steps

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
    cached: bool = False

class DocumentChunk(BaseModel):
    chunk_id: str
    content: str
    chunk_index: int
    total_chunks: int

class DocumentContext(BaseModel):
    filename: str
    content: str
    upload_time: str
    chunks: Optional[List[DocumentChunk]] = None
    content_length: int = 0

class ReasoningStep(BaseModel):  # NEW: For Chain of Thought
    step_number: int
    description: str
    action: str  # "analyze", "search", "synthesize", "conclude"
    content: str
    sources_used: Optional[List[str]] = None

class LLMRequest(BaseModel):
    prompt: str
    conversation_id: str = "default"
    context: List[Message] = []
    include_search: bool = False
    document_context: Optional[str] = None
    enable_source_attribution: bool = True
    enable_chain_of_thought: bool = False  # NEW: CoT toggle
    reasoning_depth: int = 3  # NEW: How many reasoning steps

class LLMResponse(BaseModel):
    response: str
    conversation_id: str
    updated_context: List[Message]
    search_results: Optional[List[SearchResult]] = None
    document_used: Optional[str] = None
    sources_used: Optional[List[str]] = None
    response_metadata: Optional[Dict] = None
    reasoning_steps: Optional[List[ReasoningStep]] = None  # NEW: CoT steps

class DocumentResponse(BaseModel):
    filename: str
    text: str
    chunks: Optional[List[DocumentChunk]] = None
    chunked: bool = False

class ConversationExport(BaseModel):
    conversation_id: str
    messages: List[Message]
    export_time: str
    metadata: Dict

# ==================== DATA STORAGE ====================

conversations: Dict[str, List[Message]] = {}
document_contexts: Dict[str, DocumentContext] = {}
search_cache: Dict[str, Tuple[List[SearchResult], datetime]] = {}

# ==================== CHAIN OF THOUGHT REASONING SYSTEM ====================

class ChainOfThoughtReasoner:
    """Implements Chain of Thought reasoning for complex queries"""
    
    def __init__(self, llm_client, search_tool=None):
        self.llm_client = llm_client
        self.search_tool = search_tool
    
    def analyze_query_complexity(self, query: str) -> Dict[str, any]:
        """Analyze if query needs multi-step reasoning"""
        complexity_indicators = [
            "compare", "analyze", "explain why", "what causes", "how does",
            "relationship between", "impact of", "differences", "similarities",
            "pros and cons", "advantages", "disadvantages", "evaluate",
            "synthesize", "summarize", "research", "investigate"
        ]
        
        query_lower = query.lower()
        complexity_score = sum(1 for indicator in complexity_indicators if indicator in query_lower)
        
        needs_search = any(term in query_lower for term in [
            "recent", "current", "latest", "new", "today", "2024", "2025", "now"
        ])
        
        needs_analysis = any(term in query_lower for term in [
            "analyze", "compare", "evaluate", "synthesize", "explain"
        ])
        
        return {
            "complexity_score": complexity_score,
            "needs_multi_step": complexity_score >= 2,
            "needs_search": needs_search,
            "needs_analysis": needs_analysis,
            "query_type": self.classify_query_type(query_lower)
        }
    
    def classify_query_type(self, query: str) -> str:
        """Classify the type of query for appropriate reasoning"""
        if any(word in query for word in ["compare", "vs", "versus", "difference"]):
            return "comparison"
        elif any(word in query for word in ["analyze", "analysis", "examine"]):
            return "analysis"
        elif any(word in query for word in ["explain", "why", "how", "what causes"]):
            return "explanation"
        elif any(word in query for word in ["synthesize", "combine", "integrate"]):
            return "synthesis"
        elif any(word in query for word in ["research", "investigate", "find out"]):
            return "research"
        else:
            return "general"
    
    def generate_reasoning_plan(self, query: str, context: List[Message], 
                              document_context: str = None, max_steps: int = 3) -> List[Dict]:
        """Generate a step-by-step reasoning plan"""
        analysis = self.analyze_query_complexity(query)
        query_type = analysis["query_type"]
        
        plan = []
        
        if query_type == "comparison":
            plan = [
                {"step": 1, "action": "identify", "description": "Identify the subjects to compare"},
                {"step": 2, "action": "analyze", "description": "Analyze each subject individually"},
                {"step": 3, "action": "compare", "description": "Compare and contrast the subjects"},
                {"step": 4, "action": "conclude", "description": "Draw conclusions from the comparison"}
            ]
        elif query_type == "analysis":
            plan = [
                {"step": 1, "action": "break_down", "description": "Break down the topic into components"},
                {"step": 2, "action": "examine", "description": "Examine each component in detail"},
                {"step": 3, "action": "synthesize", "description": "Synthesize findings into insights"}
            ]
        elif query_type == "explanation":
            plan = [
                {"step": 1, "action": "understand", "description": "Understand the core question"},
                {"step": 2, "action": "research", "description": "Gather relevant information"},
                {"step": 3, "action": "explain", "description": "Provide clear explanation with examples"}
            ]
        elif query_type == "research":
            plan = [
                {"step": 1, "action": "search", "description": "Search for current information"},
                {"step": 2, "action": "analyze", "description": "Analyze and verify information"},
                {"step": 3, "action": "summarize", "description": "Summarize key findings"}
            ]
        else:  # general
            plan = [
                {"step": 1, "action": "understand", "description": "Understand the question"},
                {"step": 2, "action": "process", "description": "Process available information"},
                {"step": 3, "action": "respond", "description": "Formulate comprehensive response"}
            ]
        
        return plan[:max_steps]
    
    def execute_reasoning_step(self, step_plan: Dict, query: str, context: List[Message],
                             document_context: str = None, search_results: List[SearchResult] = None) -> ReasoningStep:
        """Execute a single reasoning step"""
        step_number = step_plan["step"]
        action = step_plan["action"]
        description = step_plan["description"]
        
        # Build context for this step
        step_context = f"""
You are working on step {step_number} of a multi-step reasoning process.

Original Query: {query}
Current Step: {description}
Action: {action}

Instructions for this step:
"""
        
        if action == "identify":
            step_context += "Identify the key subjects, concepts, or elements mentioned in the query."
        elif action == "analyze":
            step_context += "Analyze the identified elements in detail, considering their properties and characteristics."
        elif action == "compare":
            step_context += "Compare and contrast the analyzed elements, highlighting similarities and differences."
        elif action == "break_down":
            step_context += "Break down the topic into its main components or aspects."
        elif action == "examine":
            step_context += "Examine each component in detail, using available information sources."
        elif action == "synthesize":
            step_context += "Synthesize the examined information into coherent insights."
        elif action == "understand":
            step_context += "Understand and clarify what exactly is being asked."
        elif action == "research":
            step_context += "Research and gather relevant information from available sources."
        elif action == "search":
            step_context += "Focus on searching for current, relevant information."
        elif action == "explain":
            step_context += "Provide a clear, detailed explanation with examples if possible."
        elif action == "conclude":
            step_context += "Draw final conclusions based on all previous analysis."
        elif action == "summarize":
            step_context += "Summarize the key findings and insights."
        else:  # process, respond
            step_context += "Process the information and work toward a comprehensive response."
        
        # Add available information
        if document_context:
            step_context += f"\n\nDocument Content Available:\n{document_context[:1000]}..."
        
        if search_results:
            step_context += f"\n\nWeb Search Results Available:\n"
            for i, result in enumerate(search_results[:3], 1):
                step_context += f"{i}. {result.title}: {result.description}\n"
        
        step_context += f"\n\nProvide your analysis for this step only. Be specific and detailed."
        
        # Execute the reasoning step
        try:
            messages = [
                {"role": "system", "content": "You are an expert research assistant performing step-by-step reasoning."},
                {"role": "user", "content": step_context}
            ]
            
            response = self.llm_client.chat.completions.create(
                messages=messages,
                model="llama3-8b-8192",
                temperature=0.3,  # Lower temperature for more focused reasoning
                max_tokens=500
            )
            
            step_content = response.choices[0].message.content
            
            # Determine sources used in this step
            sources_used = []
            if document_context and any(word in step_content.lower() for word in ["document", "text", "content"]):
                sources_used.append("Document content")
            if search_results and any(word in step_content.lower() for word in ["search", "web", "recent"]):
                sources_used.append("Web search results")
            if not sources_used:
                sources_used.append("Knowledge base")
            
            return ReasoningStep(
                step_number=step_number,
                description=description,
                action=action,
                content=step_content,
                sources_used=sources_used
            )
            
        except Exception as e:
            return ReasoningStep(
                step_number=step_number,
                description=description,
                action=action,
                content=f"Error in reasoning step: {str(e)}",
                sources_used=["Error"]
            )
    
    def synthesize_final_response(self, query: str, reasoning_steps: List[ReasoningStep],
                                context: List[Message]) -> str:
        """Synthesize all reasoning steps into final response"""
        synthesis_prompt = f"""
Based on the step-by-step reasoning below, provide a comprehensive final answer to the original query.

Original Query: {query}

Reasoning Steps:
"""
        
        for step in reasoning_steps:
            synthesis_prompt += f"""
Step {step.step_number} ({step.action}): {step.description}
Analysis: {step.content}
Sources: {', '.join(step.sources_used)}
---
"""
        
        synthesis_prompt += """
Now provide a comprehensive, well-structured final answer that incorporates insights from all reasoning steps. 
Make sure to:
1. Directly answer the original query
2. Reference key insights from your step-by-step analysis
3. Maintain logical flow and coherence
4. Include relevant examples or evidence where appropriate
"""
        
        try:
            messages = [
                {"role": "system", "content": "You are synthesizing multi-step reasoning into a comprehensive response."},
                {"role": "user", "content": synthesis_prompt}
            ]
            
            response = self.llm_client.chat.completions.create(
                messages=messages,
                model="llama3-8b-8192",
                temperature=0.5,
                max_tokens=800
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            return f"Error synthesizing response: {str(e)}"

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
            
            if break_point > start + chunk_size // 2:
                end = break_point + 1
        
        chunk_content = text[start:end].strip()
        if chunk_content:
            chunks.append(DocumentChunk(
                chunk_id=f"chunk_{chunk_index}",
                content=chunk_content,
                chunk_index=chunk_index,
                total_chunks=0
            ))
            chunk_index += 1
        
        start = max(start + chunk_size - overlap, end)
    
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
            
            if use_cache:
                search_cache[cache_key] = (results, datetime.now())
            
            return results, False
        
        except Exception as e:
            raise Exception(f"Web search failed: {str(e)}")

class LLMTool:
    def __init__(self):
        self.client = groq_client
        self.search_tool = WebSearchTool() if BRAVE_API_KEY else None
        self.reasoner = ChainOfThoughtReasoner(groq_client, self.search_tool)  # NEW
    
    def call(self, prompt: str, context: List[Message] = None, include_search: bool = False, 
             document_context: str = None, enable_source_attribution: bool = True,
             enable_chain_of_thought: bool = False, reasoning_depth: int = 3) -> tuple:
        try:
            search_results = None
            search_cached = False
            document_used = None
            sources_used = []
            reasoning_steps = []
            metadata = {}
            
            # Perform web search if requested and available
            if include_search and self.search_tool:
                try:
                    search_results, search_cached = self.search_tool.search(prompt, max_results=3)
                    metadata['search_cached'] = search_cached
                except Exception as e:
                    print(f"Search failed: {e}")
            
            # NEW: Chain of Thought Reasoning
            if enable_chain_of_thought:
                print(f"Executing Chain of Thought reasoning with {reasoning_depth} steps...")
                
                # Generate reasoning plan
                reasoning_plan = self.reasoner.generate_reasoning_plan(
                    prompt, context or [], document_context, reasoning_depth
                )
                
                # Execute each reasoning step
                for step_plan in reasoning_plan:
                    reasoning_step = self.reasoner.execute_reasoning_step(
                        step_plan, prompt, context or [], document_context, search_results
                    )
                    reasoning_steps.append(reasoning_step)
                
                # Synthesize final response from reasoning steps
                response_content = self.reasoner.synthesize_final_response(
                    prompt, reasoning_steps, context or []
                )
                
                metadata['reasoning_enabled'] = True
                metadata['reasoning_steps_count'] = len(reasoning_steps)
                
            else:
                # Original single-step processing
                messages = []
                
                system_message = """You are SynthesisTalk, an intelligent research assistant. You help users explore complex topics through conversation. Maintain context from previous messages and provide thoughtful, well-reasoned responses."""
                
                if enable_source_attribution:
                    system_message += """
                    
IMPORTANT: When referencing information, clearly indicate your sources:
- For document content, use: [Document: filename]
- For web search results, use: [Web: source title]
- For your training knowledge, use: [Knowledge Base]
"""
                
                if document_context:
                    document_used = "Document content integrated"
                    system_message += f"\n\nYou have access to the following document content for reference:\n\n--- DOCUMENT CONTENT ---\n{document_context}\n--- END DOCUMENT ---\n\nUse this document content to provide more informed responses when relevant."
                
                if search_results:
                    search_context = f"\n\nWeb search results for your reference (Cached: {search_cached}):\n"
                    for i, result in enumerate(search_results, 1):
                        search_context += f"{i}. {result.title}\n   {result.description}\n   Source: {result.url}\n\n"
                    
                    system_message += search_context + "Use these search results to provide more current and comprehensive information when relevant."
                
                messages.append({"role": "system", "content": system_message})
                
                if context:
                    for msg in context:
                        messages.append({"role": msg.role, "content": msg.content})
                
                messages.append({"role": "user", "content": prompt})
                
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
                'temperature': 0.7 if not enable_chain_of_thought else 0.3,
                'source_attribution_enabled': enable_source_attribution,
                'chain_of_thought_enabled': enable_chain_of_thought
            })
            
            return response_content, search_results, document_used, sources_used, metadata, reasoning_steps
            
        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

# ==================== HELPER FUNCTIONS ====================

def get_conversation_context(conversation_id: str, max_messages: int = 10) -> List[Message]:
    """Get the last N messages from a conversation for context"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    return conversations[conversation_id][-max_messages:]

def update_conversation(conversation_id: str, user_message: str, assistant_response: str, 
                       sources: List[str] = None, reasoning_steps: List[ReasoningStep] = None):
    """Add new messages to conversation history with source attribution and reasoning"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    timestamp = datetime.now().isoformat()
    
    # Convert reasoning steps to list of strings for storage
    reasoning_step_strings = []
    if reasoning_steps:
        for step in reasoning_steps:
            reasoning_step_strings.append(f"Step {step.step_number}: {step.description} - {step.content[:100]}...")
    
    conversations[conversation_id].extend([
        Message(role="user", content=user_message, timestamp=timestamp),
        Message(
            role="assistant", 
            content=assistant_response, 
            timestamp=timestamp, 
            sources=sources,
            reasoning_steps=reasoning_step_strings
        )
    ])

# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "SynthesisTalk Backend v1.3.0", "status": "running"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "SynthesisTalk Backend",
        "version": "1.3.0",
        "features": {
            "web_search": BRAVE_API_KEY is not None,
            "search_caching": True,
            "document_chunking": True,
            "source_attribution": True,
            "conversation_export": True,
            "chain_of_thought_reasoning": True  # NEW
        }
    }

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

@app.post("/api/llm", response_model=LLMResponse)
async def llm_endpoint(req: LLMRequest):
    try:
        context = get_conversation_context(req.conversation_id)
        
        if req.context:
            context = req.context
        
        # Enhanced LLM call with Chain of Thought
        tool = LLMTool()
        answer, search_results, document_used, sources_used, metadata, reasoning_steps = tool.call(
            req.prompt, 
            context, 
            req.include_search,
            req.document_context,
            req.enable_source_attribution,
            req.enable_chain_of_thought,  # NEW
            req.reasoning_depth  # NEW
        )
        
        # Update conversation history with reasoning steps
        update_conversation(req.conversation_id, req.prompt, answer, sources_used, reasoning_steps)
        
        updated_context = get_conversation_context(req.conversation_id)
        
        return LLMResponse(
            response=answer,
            conversation_id=req.conversation_id,
            updated_context=updated_context,
            search_results=search_results,
            document_used=document_used,
            sources_used=sources_used,
            response_metadata=metadata,
            reasoning_steps=reasoning_steps  # NEW
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

        chunks = None
        chunked = False
        if enable_chunking and len(text) > chunk_size:
            chunks = chunk_text(text, chunk_size)
            chunked = True

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
            "export_version": "1.3.0",
            "features_used": {
                "chain_of_thought": any(msg.reasoning_steps for msg in conversations[conversation_id]),
                "source_attribution": any(msg.sources for msg in conversations[conversation_id])
            }
        }
    )
    
    return export_data

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

@app.delete("/api/cache/search")
async def clear_search_cache():
    """Clear the search results cache"""
    global search_cache
    cache_size = len(search_cache)
    search_cache.clear()
    return {
        "message": f"Search cache cleared successfully",
        "items_cleared": cache_size
    }

@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get cache statistics"""
    valid_entries = 0
    expired_entries = 0
    
    for cache_key, (results, cache_time) in search_cache.items():
        if is_cache_valid(cache_time):
            valid_entries += 1
        else:
            expired_entries += 1
    
    return {
        "total_entries": len(search_cache),
        "valid_entries": valid_entries,
        "expired_entries": expired_entries,
        "cache_hit_potential": f"{(valid_entries / max(1, len(search_cache))) * 100:.1f}%"
    }

@app.get("/api/conversations")
async def list_conversations():
    """List all conversation IDs"""
    return {
        "conversations": list(conversations.keys()),
        "total_conversations": len(conversations),
        "total_messages": sum(len(msgs) for msgs in conversations.values())
    }

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get a specific conversation"""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "conversation_id": conversation_id,
        "messages": conversations[conversation_id],
        "message_count": len(conversations[conversation_id])
    }

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a specific conversation"""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    message_count = len(conversations[conversation_id])
    del conversations[conversation_id]
    
    return {
        "message": f"Conversation {conversation_id} deleted successfully",
        "messages_deleted": message_count
    }

@app.get("/api/documents")
async def list_documents():
    """List all uploaded documents"""
    docs_info = []
    for doc_id, doc_context in document_contexts.items():
        docs_info.append({
            "document_id": doc_id,
            "filename": doc_context.filename,
            "upload_time": doc_context.upload_time,
            "content_length": doc_context.content_length,
            "chunked": doc_context.chunks is not None,
            "chunk_count": len(doc_context.chunks) if doc_context.chunks else 0
        })
    
    return {
        "documents": docs_info,
        "total_documents": len(document_contexts)
    }

@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get a specific document"""
    if doc_id not in document_contexts:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document_contexts[doc_id]

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a specific document"""
    if doc_id not in document_contexts:
        raise HTTPException(status_code=404, detail="Document not found")
    
    filename = document_contexts[doc_id].filename
    del document_contexts[doc_id]
    
    return {
        "message": f"Document {filename} deleted successfully"
    }

# ==================== ADVANCED ENDPOINTS ====================

@app.post("/api/llm/batch")
async def batch_llm_requests(requests: List[LLMRequest]):
    """Process multiple LLM requests in batch"""
    if len(requests) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 requests per batch")
    
    results = []
    tool = LLMTool()
    
    for req in requests:
        try:
            context = get_conversation_context(req.conversation_id)
            if req.context:
                context = req.context
            
            answer, search_results, document_used, sources_used, metadata, reasoning_steps = tool.call(
                req.prompt, 
                context, 
                req.include_search,
                req.document_context,
                req.enable_source_attribution,
                req.enable_chain_of_thought,
                req.reasoning_depth
            )
            
            update_conversation(req.conversation_id, req.prompt, answer, sources_used, reasoning_steps)
            updated_context = get_conversation_context(req.conversation_id)
            
            results.append({
                "success": True,
                "response": LLMResponse(
                    response=answer,
                    conversation_id=req.conversation_id,
                    updated_context=updated_context,
                    search_results=search_results,
                    document_used=document_used,
                    sources_used=sources_used,
                    response_metadata=metadata,
                    reasoning_steps=reasoning_steps
                )
            })
            
        except Exception as e:
            results.append({
                "success": False,
                "error": str(e),
                "conversation_id": req.conversation_id
            })
    
    return {"results": results, "processed_count": len(results)}

@app.get("/api/analytics")
async def get_analytics():
    """Get usage analytics"""
    total_messages = sum(len(msgs) for msgs in conversations.values())
    total_user_messages = sum(1 for msgs in conversations.values() for msg in msgs if msg.role == "user")
    total_assistant_messages = sum(1 for msgs in conversations.values() for msg in msgs if msg.role == "assistant")
    
    messages_with_sources = sum(1 for msgs in conversations.values() for msg in msgs if msg.sources)
    messages_with_reasoning = sum(1 for msgs in conversations.values() for msg in msgs if msg.reasoning_steps)
    
    return {
        "conversations": {
            "total_conversations": len(conversations),
            "total_messages": total_messages,
            "user_messages": total_user_messages,
            "assistant_messages": total_assistant_messages
        },
        "features": {
            "messages_with_sources": messages_with_sources,
            "messages_with_reasoning": messages_with_reasoning,
            "source_attribution_usage": f"{(messages_with_sources / max(1, total_assistant_messages)) * 100:.1f}%",
            "reasoning_usage": f"{(messages_with_reasoning / max(1, total_assistant_messages)) * 100:.1f}%"
        },
        "documents": {
            "total_documents": len(document_contexts),
            "total_content_length": sum(doc.content_length for doc in document_contexts.values())
        },
        "cache": {
            "search_cache_size": len(search_cache),
            "cache_hit_rate": "N/A"  # Would need tracking for actual hit rate
        }
    }

# ==================== STARTUP AND SHUTDOWN ====================

@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup"""
    print("🚀 SynthesisTalk Backend v1.3.0 starting up...")
    print(f"📊 Web search enabled: {BRAVE_API_KEY is not None}")
    print(f"🧠 Chain of Thought reasoning: Enabled")
    print(f"📚 Document processing: Enabled")
    print(f"🔍 Source attribution: Enabled")
    print("✅ Backend ready!")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    print("🛑 SynthesisTalk Backend shutting down...")
    print("✅ Shutdown complete!")

# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend:app",
        host="0.0.0.0", 
        port=8000,
        reload=True,
        log_level="info"
    )