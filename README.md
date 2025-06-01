# README.md

# SynthesisTalk

SynthesisTalk is an intelligent research assistant that helps you explore complex topics via an interactive chat interface.  
Built with FastAPI (backend), React (frontend), and Google’s Vertex AI LLMs.

## Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/your-org/synthesistalk.git
   cd synthesistalk



feat: Add multi-turn context maintenance to SynthesisTalk

- Implement conversation history storage with unique conversation IDs
- Add context management for up to 10 recent messages in LLM calls
- Create conversation management endpoints (get, clear, list)
- Update frontend to display conversation history with user/assistant messages
- Add conversation controls (new conversation, clear history)
- Enhance LLM system prompt for better research assistant behavior
- Store conversations in-memory with proper message threading

Features added:
- Multi-turn conversation context
- Conversation history display
- Conversation management (new/clear)
- Enhanced LLM prompting with context
- Message role differentiation (user/assistant)


feat: Add document context integration to conversations

- Add document selection dropdown for uploaded files
- Implement document inclusion toggle checkbox
- Auto-select newly uploaded documents with inclusion enabled
- Display document metadata (size, upload date) in selection
- Enhance textarea placeholder with document integration hint
- Maintain backward compatibility with existing chat/search features

feat: Integrate document content into LLM conversations

- Store uploaded documents with metadata in memory
- Inject selected document content into LLM system prompts
- Add GET /api/documents endpoint to list available documents
- Add GET /api/documents/{doc_id} endpoint for document retrieval
- Extend LLMRequest/LLMResponse models with document context fields
- Enhanced LLM responses indicate when document content is referenced
- Preserve existing conversation and search functionality


feat: complete SynthesisTalk backend with Chain of Thought reasoning

- Add remaining API endpoints for conversation and document management
- Implement list_conversations with reasoning metadata tracking
- Add delete operations for conversations and documents
- Complete document CRUD operations with chunking support
- Add startup/shutdown event handlers with feature status logging
- Implement error handlers for 404 and 500 responses
- Maintain existing Chain of Thought reasoning capabilities
- Preserve all advanced features: web search, caching, source attribution
- Ready for production deployment with uvicorn server setup