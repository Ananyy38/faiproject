import os
from typing import List
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile  # Added File and UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Import our organized modules
from models import (
    Message,
    SearchRequest, SearchResponse,
    LLMRequest, LLMResponse,
    DocumentResponse,
    ConversationExport,  # <-- New Pydantic model for export
    SummaryRequest, SummaryResponse,
    VisualizationRequest, VisualizationResponse
)
from services import (
    WebSearchTool, LLMTool, SummaryGenerator, VisualizationGenerator,
    conversations, document_contexts, search_cache,
    get_conversation_context, update_conversation, process_document
)

# Import database functions
from database import (
    init_database, get_db, migrate_in_memory_data,
    create_conversation, get_conversation, get_conversations, delete_conversation,
    update_conversation_title, add_message, get_conversation_messages,
    create_document, get_document, get_documents, delete_document,
    conversation_to_dict, message_to_dict, document_to_dict
)

# Load environment variables
load_dotenv()

# Environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

# Validation
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")

if not BRAVE_API_KEY:
    print("Warning: BRAVE_API_KEY not found. Web search will be disabled.")

# ==================== FASTAPI APPLICATION SETUP ====================

app = FastAPI(
    title="SynthesisTalk Backend",
    description="FastAPI backend for the SynthesisTalk research assistant with database persistence",
    version="1.4.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://localhost:3001",
        "http://127.0.0.1:3000", "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== BASIC ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "SynthesisTalk Backend v1.4.0", "status": "running"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "SynthesisTalk Backend",
        "version": "1.4.0",
        "features": {
            "web_search": BRAVE_API_KEY is not None,
            "search_caching": True,
            "document_chunking": True,
            "source_attribution": True,
            "conversation_export": True,
            "chain_of_thought_reasoning": True,
            "database_persistence": True
        }
    }

# ==================== CORE API ENDPOINTS ====================

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
async def llm_endpoint(req: LLMRequest, db: Session = Depends(get_db)):
    """Main LLM endpoint with Chain of Thought reasoning and database persistence"""
    try:
        # Ensure conversation exists (create if it doesn't)
        conversation = get_conversation(db, req.conversation_id)
        if not conversation:
            conversation = create_conversation(db, req.conversation_id)
            print(f"Created new conversation: {req.conversation_id}")
        
        # Get conversation context from database
        messages = get_conversation_messages(db, req.conversation_id)
        context = [
            Message(
                role=msg.role,
                content=msg.content,
                timestamp=msg.timestamp.isoformat(),
                sources=msg.sources or [],
                reasoning_steps=msg.reasoning_steps or []
            )
            for msg in messages
        ]
        
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
            req.enable_chain_of_thought,
            req.reasoning_depth
        )
        
        # Save user message to database
        add_message(db, req.conversation_id, "user", req.prompt)
        
        # Convert ReasoningStep objects to dictionaries for database storage
        reasoning_steps_dict = None
        if reasoning_steps:
            reasoning_steps_dict = [step.dict() for step in reasoning_steps]
        
        # Save assistant message to database
        add_message(
            db,
            req.conversation_id,
            "assistant",
            answer,
            sources_used,
            reasoning_steps_dict
        )
        
        # Get updated context
        updated_messages = get_conversation_messages(db, req.conversation_id)
        updated_context = [
            Message(
                role=msg.role,
                content=msg.content,
                timestamp=msg.timestamp.isoformat(),
                sources=msg.sources or [],
                reasoning_steps=msg.reasoning_steps or []
            )
            for msg in updated_messages
        ]
        
        return LLMResponse(
            response=answer,
            conversation_id=req.conversation_id,
            updated_context=updated_context,
            search_results=search_results,
            document_used=document_used,
            sources_used=sources_used,
            response_metadata=metadata,
            reasoning_steps=reasoning_steps
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/documents", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), enable_chunking: bool = True, 
                         chunk_size: int = 2000, db: Session = Depends(get_db)):
    """Upload and process documents with database persistence"""
    try:
        # Process the document using existing service
        doc_response = await process_document(file, enable_chunking, chunk_size)
        
        # Get the document context from the in-memory store
        original_doc_id = doc_response.document_id
        doc_context = document_contexts.get(original_doc_id)

        if doc_context:
            # Save to database
            chunks_data = [chunk.__dict__ for chunk in doc_context.chunks] if doc_context.chunks else None
            db_document = create_document(
                db, doc_context.filename, doc_context.content, chunks_data
            )
            
            # Update the response with database ID
            doc_response.document_id = db_document.id
            
            # Remove from in-memory store using the original ID
            del document_contexts[original_doc_id]
        
        return doc_response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")

# ==================== CONVERSATION MANAGEMENT ====================

@app.get("/api/conversations")
async def list_conversations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all conversations"""
    conversations = get_conversations(db, skip, limit)
    return {
        "conversations": [conversation_to_dict(conv) for conv in conversations],
        "total_conversations": len(conversations)
    }

@app.get("/api/conversations/{conversation_id}")
async def get_conversation_endpoint(conversation_id: str, db: Session = Depends(get_db)):
    """Get a specific conversation with all messages"""
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        # If conversation doesn't exist, create it automatically
        conversation = create_conversation(db, conversation_id)
        return {
            "conversation_id": conversation.id,
            "title": conversation.title,
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
            "messages": [],
            "message_count": 0
        }
    
    messages = get_conversation_messages(db, conversation_id)
    return {
        "conversation_id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "messages": [message_to_dict(msg) for msg in messages],
        "message_count": len(messages)
    }

@app.post("/api/conversations")
async def create_conversation_endpoint(title: str = None, db: Session = Depends(get_db)):
    """Create a new conversation"""
    # Generate conversation ID with timestamp
    conversation_id = f"conversation_{int(datetime.now().timestamp() * 1000)}"
    conversation = create_conversation(db, conversation_id, title)
    return conversation_to_dict(conversation)

@app.put("/api/conversations/{conversation_id}")
async def update_conversation_endpoint(conversation_id: str, title: str, db: Session = Depends(get_db)):
    """Update conversation title"""
    conversation = update_conversation_title(db, conversation_id, title)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_to_dict(conversation)

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: str, db: Session = Depends(get_db)):
    """Delete a specific conversation"""
    success = delete_conversation(db, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": f"Conversation {conversation_id} deleted successfully"}

@app.delete("/api/conversations")
async def clear_all_conversations(db: Session = Depends(get_db)):
    """Clear all conversations (Clear History functionality)"""
    try:
        conversations = get_conversations(db, limit=1000)
        deleted_count = 0
        for conversation in conversations:
            if delete_conversation(db, conversation.id):
                deleted_count += 1
        return {
            "message": "All conversations cleared successfully",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear conversations: {e}")

@app.get("/api/conversations/state/{conversation_id}")
async def get_conversation_state(conversation_id: str, db: Session = Depends(get_db)):
    """Get conversation state (exists, message count, etc.)"""
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        return {
            "exists": False,
            "conversation_id": conversation_id,
            "message_count": 0,
            "title": None,
            "created_at": None,
            "updated_at": None
        }
    messages = get_conversation_messages(db, conversation_id)
    return {
        "exists": True,
        "conversation_id": conversation.id,
        "message_count": len(messages),
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat()
    }

@app.post("/api/conversations/{conversation_id}/auto-title")
async def auto_generate_title(conversation_id: str, db: Session = Depends(get_db)):
    """Auto-generate a title for the conversation based on first few messages"""
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = get_conversation_messages(db, conversation_id)
    if not messages:
        raise HTTPException(status_code=400, detail="No messages in conversation")
    
    # Get first user message to generate title
    first_user_message = next((msg for msg in messages if msg.role == "user"), None)
    if not first_user_message:
        raise HTTPException(status_code=400, detail="No user messages found")
    
    content = first_user_message.content
    if len(content) > 50:
        title = content[:47] + "."
    else:
        title = content
    
    conversation = update_conversation_title(db, conversation_id, title)
    return {
        "conversation_id": conversation_id,
        "title": title,
        "message": "Title generated successfully"
    }

# ====== NEW: Conversation Export Endpoint ======
@app.get(
    "/api/conversations/{conversation_id}/export",
    response_model=ConversationExport
)
async def export_conversation_endpoint(conversation_id: str, db: Session = Depends(get_db)):
    """
    Export all messages for the given conversation_id as JSON.
    Response schema (ConversationExport):
      {
        "conversation_id": string,
        "messages": [ { … } ],
        "export_time": ISO8601 timestamp,
        "metadata": {
          "total_messages": integer
        }
      }
    """
    # Ensure the conversation exists (but do NOT auto-create here)
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Load all messages for this conversation_id
    messages = get_conversation_messages(db, conversation_id)
    messages_list = [message_to_dict(msg) for msg in messages]  # :contentReference[oaicite:0]{index=0}

    export_payload = {
        "conversation_id": conversation_id,
        "messages": messages_list,
        "export_time": datetime.utcnow().isoformat() + "Z",
        "metadata": {
            "total_messages": len(messages_list)
        }
    }
    return export_payload

# ==================== DOCUMENT MANAGEMENT ====================


@app.get("/api/documents")
async def list_documents_endpoint(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all uploaded documents"""
    documents = get_documents(db, skip, limit)
    docs_info = []
    for doc in documents:
        docs_info.append({
            "document_id": doc.id,
            "filename": doc.filename,
            "upload_time": doc.upload_time.isoformat(),
            "content_length": doc.content_length,
            "chunked": doc.chunks is not None,
            "chunk_count": len(doc.chunks) if doc.chunks else 0
        })
    return {
        "documents": docs_info,
        "total_documents": len(documents)
    }

@app.get("/api/documents/{doc_id}")
async def get_document_endpoint(doc_id: str, db: Session = Depends(get_db)):
    """Get a specific document"""
    document = get_document(db, doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document_to_dict(document)

@app.delete("/api/documents/{doc_id}")
async def delete_document_endpoint(doc_id: str, db: Session = Depends(get_db)):
    """Delete a specific document"""
    document = get_document(db, doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    filename = document.filename
    success = delete_document(db, doc_id)
    if success:
        return {"message": f"Document {filename} deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete document")

# ==================== CACHE MANAGEMENT ====================

@app.delete("/api/cache/search")
async def clear_search_cache():
    """Clear the search results cache"""
    cache_size = len(search_cache)
    search_cache.clear()
    return {
        "message": "Search cache cleared successfully",
        "items_cleared": cache_size
    }

@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get cache statistics"""
    from services import is_cache_valid
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

# ==================== ADVANCED FEATURES ====================

@app.post("/api/summaries", response_model=SummaryResponse)
async def generate_summary(req: SummaryRequest, db: Session = Depends(get_db)):
    """Generate structured summaries in different formats"""
    conversation = get_conversation(db, req.conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = get_conversation_messages(db, req.conversation_id)
    if not messages:
        raise HTTPException(status_code=400, detail="No messages in conversation")
    message_objects = [
        Message(
            role=msg.role,
            content=msg.content,
            timestamp=msg.timestamp.isoformat(),
            sources=msg.sources or [],
            reasoning_steps=msg.reasoning_steps or []
        )
        for msg in messages
    ]
    generator = SummaryGenerator()
    if req.format_id == "bullet":
        summary_text = generator.generate_to_bullet_points(message_objects)
    elif req.format_id == "executive":
        summary_text = generator.generate_to_executive_summary(message_objects)
    else:
        summary_text = generator.generate_to_academic_format(message_objects)
    return SummaryResponse(
        conversation_id=req.conversation_id,
        summary=summary_text
    )

@app.get("/api/summaries/formats")
async def get_summary_formats():
    """Get available summary formats"""
    return {
        "formats": [
            {"id": "bullet", "name": "Bullet Points", "description": "Structured bullet-point summary"},
            {"id": "executive", "name": "Executive Summary", "description": "Professional executive summary"},
            {"id": "academic", "name": "Academic Format", "description": "Academic-style structured summary"}
        ]
    }

@app.post("/api/visualizations", response_model=VisualizationResponse)
async def generate_visualization(req: VisualizationRequest, db: Session = Depends(get_db)):
    """Generate visualizations (e.g. concept map, timeline, comparison chart)"""
    conversation = get_conversation(db, req.conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = get_conversation_messages(db, req.conversation_id)
    if not messages:
        raise HTTPException(status_code=400, detail="No messages in conversation")
    data = req.data or {}
    generator = VisualizationGenerator()
    content = generator.generate(req.visualization_type, data)
    return VisualizationResponse(
        conversation_id=req.conversation_id,
        visualization_type=req.visualization_type,
        data=content,
        generated_at=datetime.now().isoformat()
    )

@app.get("/api/visualizations/types")
async def get_visualization_types():
    """Get available visualization types"""
    return {
        "types": [
            {"id": "concept_map", "name": "Concept Map", "description": "Visual map of concepts and relationships"},
            {"id": "timeline", "name": "Timeline", "description": "Chronological timeline of events"},
            {"id": "comparison", "name": "Comparison Chart", "description": "Compare different items or options"}
        ]
    }

# ==================== BATCH PROCESSING ====================

@app.post("/api/llm/batch")
async def batch_llm_requests(requests: List[LLMRequest], db: Session = Depends(get_db)):
    """Process multiple LLM requests in batch"""
    if len(requests) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 requests per batch")

    results = []
    tool = LLMTool()
    
    for req in requests:
        try:
            messages = get_conversation_messages(db, req.conversation_id)
            context = [
                Message(
                    role=msg.role,
                    content=msg.content,
                    timestamp=msg.timestamp.isoformat(),
                    sources=msg.sources or [],
                    reasoning_steps=msg.reasoning_steps or []
                )
                for msg in messages
            ]
            
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
            add_message(db, req.conversation_id, "user", req.prompt)

            reasoning_steps_dict = None
            if reasoning_steps:
                reasoning_steps_dict = [step.dict() for step in reasoning_steps]
            add_message(db, req.conversation_id, "assistant", answer, sources_used, reasoning_steps_dict)

            updated_messages = get_conversation_messages(db, req.conversation_id)
            updated_context = [
                Message(
                    role=msg.role,
                    content=msg.content,
                    timestamp=msg.timestamp.isoformat(),
                    sources=msg.sources or [],
                    reasoning_steps=msg.reasoning_steps or []
                )
                for msg in updated_messages
            ]

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

# ==================== STARTUP AND SHUTDOWN ====================

@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup"""
    print("🚀 SynthesisTalk Backend v1.4.0 starting up.")
    print(f"📊 Web search enabled: {BRAVE_API_KEY is not None}")
    print(f"🧠 Chain of Thought reasoning: Enabled")
    print(f"📚 Document processing: Enabled")
    print(f"🔍 Source attribution: Enabled")
    print(f"💾 Database persistence: Enabled")
    
    # Initialize database
    init_database()
    
    # Migrate existing in-memory data if any exists
    if conversations or document_contexts:
        print("🔄 Migrating existing in-memory data.")
        migrate_in_memory_data(conversations, document_contexts)
        
        # Clear in-memory stores after migration
        conversations.clear()
        document_contexts.clear()
        print("✅ Migration completed, in-memory stores cleared")
    
    print("✅ Backend ready!")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    print("🛑 SynthesisTalk Backend shutting down...")
    print("✅ Shutdown complete!")

# ==================== MAIN ENTRY POINT ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
