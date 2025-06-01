"""
SynthesisTalk Backend - Data Models & Storage
============================================
Contains all Pydantic models, data structures, and in-memory storage.

REFACTOR CHANGES:
- Moved all Pydantic models from backend.py
- Centralized data storage dictionaries
- Added type hints and documentation
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime
from pydantic import BaseModel

# ==================== PYDANTIC MODELS ====================

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[str] = None
    sources: Optional[List[str]] = None
    reasoning_steps: Optional[List[str]] = None  # Chain of Thought steps

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

class ReasoningStep(BaseModel):  # For Chain of Thought
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
    enable_chain_of_thought: bool = False  # CoT toggle
    reasoning_depth: int = 3  # How many reasoning steps

class LLMResponse(BaseModel):
    response: str
    conversation_id: str
    updated_context: List[Message]
    search_results: Optional[List[SearchResult]] = None
    document_used: Optional[str] = None
    sources_used: Optional[List[str]] = None
    response_metadata: Optional[Dict] = None
    reasoning_steps: Optional[List[ReasoningStep]] = None  # CoT steps

class DocumentResponse(BaseModel):
    document_id: str
    filename: str
    content_length: int
    chunks_created: int
    message: str

class ConversationExport(BaseModel):
    conversation_id: str
    messages: List[Message]
    export_time: str
    metadata: Dict

class SummaryRequest(BaseModel):
    conversation_id: str
    format_type: str  # "bullet", "executive", "academic"

class SummaryResponse(BaseModel):
    conversation_id: str
    format_type: str
    summary: str
    generated_at: str

class VisualizationRequest(BaseModel):
    conversation_id: str
    visualization_type: str  # "concept_map", "timeline", "comparison"

class VisualizationResponse(BaseModel):
    conversation_id: str
    visualization_type: str
    data: Dict
    generated_at: str

# ==================== DATA STORAGE ====================
# In-memory storage for conversations, documents, and search cache

# Conversations storage: {conversation_id: [Message, ...]}
conversations: Dict[str, List[Message]] = {}

# Document contexts storage: {doc_id: DocumentContext}
document_contexts: Dict[str, DocumentContext] = {}

# Search cache storage: {cache_key: (results, timestamp)}
search_cache: Dict[str, Tuple[List[SearchResult], datetime]] = {}

# ==================== CONSTANTS ====================

# Default values and configuration
DEFAULT_CHUNK_SIZE = 2000
DEFAULT_CHUNK_OVERLAP = 200
CACHE_MAX_AGE_HOURS = 24
MAX_CONVERSATION_CONTEXT = 10
MAX_BATCH_REQUESTS = 10
