import os
from typing import List
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

# Import our organized modules
from models import (
    Message, SearchRequest, SearchResponse, LLMRequest, LLMResponse,
    DocumentResponse, ConversationExport, SummaryRequest, SummaryResponse,
    VisualizationRequest, VisualizationResponse
)
from services import (
    WebSearchTool, LLMTool, SummaryGenerator, VisualizationGenerator,
    conversations, document_contexts, search_cache,
    get_conversation_context, update_conversation, process_document
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

# ==================== BASIC ENDPOINTS ====================

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
            "chain_of_thought_reasoning": True
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
async def llm_endpoint(req: LLMRequest):
    """Main LLM endpoint with Chain of Thought reasoning"""
    try:
        # Ensure conversation exists before getting context
        if req.conversation_id not in conversations:
            conversations[req.conversation_id] = []
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
            req.enable_chain_of_thought,
            req.reasoning_depth
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
            reasoning_steps=reasoning_steps
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), enable_chunking: bool = True, chunk_size: int = 2000):
    """Upload and process documents with optional chunking"""
    try:
        return await process_document(file, enable_chunking, chunk_size)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")

# ==================== CONVERSATION MANAGEMENT ====================

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

# ==================== DOCUMENT MANAGEMENT ====================

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

# ==================== CACHE MANAGEMENT ====================

@app.delete("/api/cache/search")
async def clear_search_cache():
    """Clear the search results cache"""
    cache_size = len(search_cache)
    search_cache.clear()
    return {
        "message": f"Search cache cleared successfully",
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

@app.post("/api/summaries", response_model=SummaryResponse)
async def generate_summary(req: SummaryRequest):
    """Generate structured summaries in different formats"""
    if req.conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = conversations[req.conversation_id]
    if not messages:
        raise HTTPException(status_code=400, detail="No messages in conversation")
    
    generator = SummaryGenerator()
    
    if req.format_type == "bullet":
        summary = generator.generate_bullet_summary(messages)
    elif req.format_type == "executive":
        summary = generator.generate_executive_summary(messages)
    elif req.format_type == "academic":
        summary = generator.generate_academic_summary(messages)
    else:
        raise HTTPException(status_code=400, detail="Invalid format type. Use: bullet, executive, or academic")
    
    return SummaryResponse(
        conversation_id=req.conversation_id,
        format_type=req.format_type,
        summary=summary,
        generated_at=datetime.now().isoformat()
    )

@app.post("/api/visualizations", response_model=VisualizationResponse)
async def generate_visualization(req: VisualizationRequest):
    """Generate visualization data from conversation"""
    if req.conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = conversations[req.conversation_id]
    if not messages:
        raise HTTPException(status_code=400, detail="No messages in conversation")
    
    generator = VisualizationGenerator()
    
    if req.visualization_type == "concept_map":
        data = generator.generate_concept_map_data(messages)
    elif req.visualization_type == "timeline":
        data = generator.generate_timeline_data(messages)
    elif req.visualization_type == "comparison":
        data = generator.generate_comparison_chart_data(messages)
    else:
        raise HTTPException(status_code=400, detail="Invalid visualization type. Use: concept_map, timeline, or comparison")
    
    return VisualizationResponse(
        conversation_id=req.conversation_id,
        visualization_type=req.visualization_type,
        data=data,
        generated_at=datetime.now().isoformat()
    )

# ==================== ANALYTICS & METADATA ====================

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
            "cache_hit_rate": "N/A"
        }
    }

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