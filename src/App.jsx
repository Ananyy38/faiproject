import React, { useState, useEffect } from "react";
import axios from "axios";
import ChatInterface from "./components/ChatInterface";
import ConversationManager from "./components/ConversationList";

function App() {
  // ==================== STATE MANAGEMENT ====================

  // Core conversation state
  const [prompt, setPrompt] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);

  // File handling state
  const [file, setFile] = useState(null);
  const [docText, setDocText] = useState("");

  // Search functionality state
  const [includeSearch, setIncludeSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  // Document integration state
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [includeDocument, setIncludeDocument] = useState(false);

  // Chain of Thought features
  const [enableChainOfThought, setEnableChainOfThought] = useState(false);
  const [reasoningDepth, setReasoningDepth] = useState(3);
  const [reasoningSteps, setReasoningSteps] = useState([]);

  // Source attribution
  const [enableSourceAttribution, setEnableSourceAttribution] = useState(true);
  const [sourcesUsed, setSourcesUsed] = useState([]);

  // Document chunking options
  const [enableChunking, setEnableChunking] = useState(true);
  const [chunkSize, setChunkSize] = useState(2000);

  // Conversation management
  const [allConversations, setAllConversations] = useState([]);
  const [showConversationList, setShowConversationList] = useState(false);

  // Cache management
  const [cacheStats, setCacheStats] = useState(null);

  // Loading states
  const [llmLoading, setLlmLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Error states
  const [llmError, setLlmError] = useState("");
  const [docError, setDocError] = useState("");
  const [searchError, setSearchError] = useState("");

  // ==================== EFFECTS ====================

  // Load conversation history when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadConversationHistory();
    }
  }, [conversationId]);

  // Initialize app on component mount
  useEffect(() => {
    initializeApp();
  }, []);

  // ==================== INITIALIZATION ====================

  const initializeApp = async () => {
    try {
      // Load available documents
      await loadAvailableDocuments();

      // Load all conversations
      const conversations = await loadAllConversations();

      // Load cache stats
      await loadCacheStats();

      // If no conversations exist, start with a new one
      if (conversations.length === 0) {
        const newConvId = `conversation_${Date.now()}`;
        setConversationId(newConvId);
        setConversationHistory([]);
      } else {
        // Optionally load the most recent conversation
        // For now, just set up for a new conversation
        const newConvId = `conversation_${Date.now()}`;
        setConversationId(newConvId);
        setConversationHistory([]);
      }
    } catch (error) {
      console.error("Failed to initialize app:", error);
      // Fallback: create a new conversation
      const newConvId = `conversation_${Date.now()}`;
      setConversationId(newConvId);
      setConversationHistory([]);
    }
  };

  // ==================== DATA LOADING FUNCTIONS ====================

  // Load conversation history from backend
  const loadConversationHistory = async () => {
    if (!conversationId) return;

    try {
      const res = await axios.get(`/api/conversations/${conversationId}`);
      setConversationHistory(res.data.messages || []);
    } catch (err) {
      console.log("No existing conversation found, starting fresh");
      setConversationHistory([]);
      // Don't throw error - this is expected for new conversations
    }
  };

  // Load available documents from backend
  const loadAvailableDocuments = async () => {
    try {
      const res = await axios.get("/api/documents");
      setAvailableDocuments(res.data.documents || []);
    } catch (err) {
      console.log("No documents found or error loading documents");
      setAvailableDocuments([]);
    }
  };

  // Load all conversations
  const loadAllConversations = async () => {
    try {
      const res = await axios.get("/api/conversations");
      const conversations = res.data.conversations || [];
      setAllConversations(conversations);
      return conversations;
    } catch (err) {
      console.log("Error loading conversations list");
      setAllConversations([]);
      return [];
    }
  };

  // Load cache statistics
  const loadCacheStats = async () => {
    try {
      const res = await axios.get("/api/cache/stats");
      setCacheStats(res.data);
    } catch (err) {
      console.log("Error loading cache stats");
    }
  };

  // Get full document content
  const getDocumentContent = async (docId) => {
    try {
      const res = await axios.get(`/api/documents/${docId}`);
      return res.data.content;
    } catch (err) {
      console.error("Error loading document content:", err);
      return null;
    }
  };

  // ==================== CORE FUNCTIONALITY ====================

  // Send prompt to /api/llm with context, search, and document support
  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;

    // Ensure we have a conversation ID
    if (!conversationId) {
      const newConvId = `conversation_${Date.now()}`;
      setConversationId(newConvId);
    }

    setLlmLoading(true);
    setLlmError("");
    setSearchResults(null);
    setReasoningSteps([]);
    setSourcesUsed([]);

    try {
      // Get document content if a document is selected and includeDocument is true
      let documentContext = null;
      if (includeDocument && selectedDocument) {
        documentContext = await getDocumentContent(
          selectedDocument.document_id
        );
      }

      console.log("Sending LLM request:", {
        prompt,
        conversationId: conversationId || `conversation_${Date.now()}`,
        includeSearch,
        includeDocument,
        enableChainOfThought,
        reasoningDepth,
        enableSourceAttribution,
        selectedDocument: selectedDocument?.filename,
      });

      const requestBody = {
        prompt,
        conversation_id: conversationId || `conversation_${Date.now()}`,
        include_search: includeSearch,
        enable_source_attribution: enableSourceAttribution,
        enable_chain_of_thought: enableChainOfThought,
        reasoning_depth: reasoningDepth,
      };

      // Add document context if available
      if (documentContext) {
        requestBody.document_context = documentContext;
      }

      const res = await axios.post("/api/llm", requestBody, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("LLM response received:", res.data);

      // Update conversation history with the new response
      setConversationHistory(res.data.updated_context || []);

      // Set search results if returned
      if (res.data.search_results) {
        setSearchResults(res.data.search_results);
      }

      // Set reasoning steps if returned
      if (res.data.reasoning_steps) {
        setReasoningSteps(res.data.reasoning_steps);
      }

      // Set sources used if returned
      if (res.data.sources_used) {
        setSourcesUsed(res.data.sources_used);
      }

      // Auto-generate title for first message
      const updatedContext = res.data.updated_context || [];
      if (updatedContext.length === 2) {
        // First user + assistant message
        await generateTitle(conversationId || `conversation_${Date.now()}`);
      }

      setPrompt(""); // Clear the input after successful submission

      // Refresh conversations list
      await loadAllConversations();
    } catch (err) {
      console.error("LLM Error:", err);
      if (err.response) {
        setLlmError(
          `Server error: ${err.response.data.detail || err.response.statusText}`
        );
      } else if (err.request) {
        setLlmError("Network error: Unable to reach server");
      } else {
        setLlmError(`Request error: ${err.message}`);
      }
    } finally {
      setLlmLoading(false);
    }
  };

  // Auto-generate title
  const generateTitle = async (convId) => {
    try {
      await axios.post(`/api/conversations/${convId}/auto-title`);
      // Refresh conversations list to show updated title
      await loadAllConversations();
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  };

  // Standalone search function
  const handleStandaloneSearch = async () => {
    if (!prompt.trim()) return;

    setSearchLoading(true);
    setSearchError("");
    setSearchResults(null);

    try {
      const res = await axios.post("/api/search", {
        query: prompt,
        max_results: 5,
      });

      setSearchResults(res.data.results);
    } catch (err) {
      console.error("Search Error:", err);
      if (err.response) {
        setSearchError(
          `Search error: ${err.response.data.detail || err.response.statusText}`
        );
      } else {
        setSearchError("Search failed: Unable to reach server");
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // ==================== CONVERSATION MANAGEMENT ====================

  // Clear current conversation
  const handleClearConversation = async () => {
    if (!conversationId) return;

    try {
      await axios.delete(`/api/conversations/${conversationId}`);
      setConversationHistory([]);
      setPrompt("");
      setLlmError("");
      setSearchResults(null);
      setReasoningSteps([]);
      setSourcesUsed([]);
      await loadAllConversations();
    } catch (err) {
      console.error("Error clearing conversation:", err);
    }
  };

  // Clear all conversations
  const handleClearAllHistory = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all conversation history?"
    );
    if (!confirmed) return;

    try {
      const res = await axios.delete("/api/conversations");
      console.log(`Cleared ${res.data.deleted_count} conversations`);

      // Reset UI state
      setAllConversations([]);
      setConversationHistory([]);
      setPrompt("");
      setLlmError("");
      setSearchResults(null);
      setReasoningSteps([]);
      setSourcesUsed([]);

      // Start with a new conversation
      const newConvId = `conversation_${Date.now()}`;
      setConversationId(newConvId);
    } catch (err) {
      console.error("Error clearing all history:", err);
    }
  };

  // Start new conversation
  const handleNewConversation = async () => {
    // Save current conversation state if needed (refresh conversations list)
    if (conversationHistory.length > 0 && conversationId) {
      await loadAllConversations();
    }

    // Start new conversation
    const newConvId = `conversation_${Date.now()}`;
    setConversationId(newConvId);
    setConversationHistory([]);
    setPrompt("");
    setLlmError("");
    setSearchResults(null);
    setReasoningSteps([]);
    setSourcesUsed([]);
  };

  // Switch to existing conversation
  const handleSwitchConversation = async (convId) => {
    setConversationId(convId);
    setShowConversationList(false);
    setReasoningSteps([]);
    setSourcesUsed([]);
    setPrompt("");
    setLlmError("");
    setSearchResults(null);

    // Load the conversation history
    try {
      const res = await axios.get(`/api/conversations/${convId}`);
      setConversationHistory(res.data.messages || []);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      // If loading fails, treat as new conversation
      setConversationHistory([]);
    }
  };

  // Export conversation
  const handleExportConversation = async () => {
    if (!conversationId) return;

    try {
      const res = await axios.get(
        `/api/conversations/${conversationId}/export`
      );
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation_${conversationId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting conversation:", err);
    }
  };

  // Import conversation
  const handleImportConversation = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const conversationData = JSON.parse(text);

      await axios.post("/api/conversations/import", conversationData);
      await loadAllConversations();
      alert("Conversation imported successfully!");
    } catch (err) {
      console.error("Error importing conversation:", err);
      alert("Error importing conversation");
    }
  };

  // Clear search cache
  const handleClearCache = async () => {
    try {
      await axios.delete("/api/cache/search");
      await loadCacheStats();
      alert("Search cache cleared successfully!");
    } catch (err) {
      console.error("Error clearing cache:", err);
    }
  };

  // ==================== FILE HANDLING ====================

  // Store selected file
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setDocError(""); // Clear any previous errors
  };

  // Upload file to /api/documents
  const handleFileUpload = async () => {
    if (!file) {
      setDocError("Please select a file first");
      return;
    }

    setDocLoading(true);
    setDocError("");
    setDocText("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("enable_chunking", enableChunking);
    formData.append("chunk_size", chunkSize);

    try {
      console.log("Uploading file:", file.name, file.type);
      const res = await axios.post("/api/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Document response received:", res.data);
      setDocText(res.data.text);

      // Refresh the available documents list
      await loadAvailableDocuments();

      // Auto-select the newly uploaded document
      const newDocuments = await axios.get("/api/documents");
      const latestDoc =
        newDocuments.data.documents[newDocuments.data.documents.length - 1];
      if (latestDoc) {
        setSelectedDocument(latestDoc);
        setIncludeDocument(true); // Auto-enable document inclusion
      }
    } catch (err) {
      console.error("Document Error:", err);
      if (err.response) {
        setDocError(
          `Server error: ${err.response.data.detail || err.response.statusText}`
        );
      } else if (err.request) {
        setDocError("Network error: Unable to reach server");
      } else {
        setDocError(`Request error: ${err.message}`);
      }
    } finally {
      setDocLoading(false);
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId) => {
    try {
      await axios.delete(`/api/documents/${docId}`);
      await loadAvailableDocuments();
      if (selectedDocument?.document_id === docId) {
        setSelectedDocument(null);
        setIncludeDocument(false);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  // ==================== EVENT HANDLERS ====================

  // Handle Enter key for prompt submission
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handlePromptSubmit();
    } else if (e.key === "Enter" && e.shiftKey) {
      handleStandaloneSearch();
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="app-container">
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

        .app-container {
          min-height: 100vh;
          background: linear-gradient(
            135deg,
            #0f0f0f 0%,
            #1a1a1a 50%,
            #0f0f0f 100%
          );
          font-family:
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
          color: #ffffff;
          overflow-x: hidden;
        }

        .glass-effect {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
        }

        .main-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header {
          text-align: center;
          margin-bottom: 3rem;
          position: relative;
        }

        .header::before {
          content: "";
          position: absolute;
          top: -50px;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #800020, transparent);
          animation: pulse 2s ease-in-out infinite alternate;
        }

        @keyframes pulse {
          0% {
            opacity: 0.3;
          }
          100% {
            opacity: 1;
          }
        }

        .title {
          font-size: clamp(2rem, 4vw, 3.5rem);
          font-weight: 700;
          margin: 0;
          background: linear-gradient(
            135deg,
            #ffffff 0%,
            #800020 50%,
            #ff6b9d 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 30px rgba(128, 0, 32, 0.3);
          letter-spacing: -0.02em;
        }

        .subtitle {
          font-size: 1.1rem;
          color: #888;
          margin-top: 0.5rem;
          font-weight: 300;
        }

        .system-status {
          background: rgba(128, 0, 32, 0.1);
          border: 1px solid rgba(128, 0, 32, 0.3);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 2rem;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          transition: all 0.3s ease;
        }

        .system-status:hover {
          background: rgba(128, 0, 32, 0.15);
          border-color: rgba(128, 0, 32, 0.5);
          transform: translateY(-2px);
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00ff88;
          box-shadow: 0 0 10px #00ff88;
          animation: glow 2s ease-in-out infinite alternate;
        }

        .status-indicator.disabled {
          background: #666;
          box-shadow: none;
          animation: none;
        }

        @keyframes glow {
          0% {
            box-shadow: 0 0 5px #00ff88;
          }
          100% {
            box-shadow:
              0 0 20px #00ff88,
              0 0 30px #00ff88;
          }
        }

        .cot-settings {
          background: rgba(128, 0, 32, 0.08);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          transition: all 0.3s ease;
        }

        .cot-settings:hover {
          background: rgba(128, 0, 32, 0.12);
          border-color: rgba(128, 0, 32, 0.3);
        }

        .cot-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .cot-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0;
          color: #ffffff;
        }

        .brain-icon {
          font-size: 1.5rem;
          animation: think 3s ease-in-out infinite;
        }

        @keyframes think {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .cot-controls {
          display: flex;
          gap: 2rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .modern-checkbox {
          position: relative;
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .modern-checkbox input {
          opacity: 0;
          position: absolute;
        }

        .modern-checkbox .checkmark {
          position: absolute;
          top: 0;
          left: 0;
          height: 20px;
          width: 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(128, 0, 32, 0.5);
          border-radius: 4px;
          transition: all 0.3s ease;
        }

        .modern-checkbox input:checked ~ .checkmark {
          background: linear-gradient(135deg, #800020, #a0002a);
          border-color: #800020;
        }

        .modern-checkbox .checkmark:after {
          content: "";
          position: absolute;
          display: none;
          left: 6px;
          top: 2px;
          width: 6px;
          height: 10px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .modern-checkbox input:checked ~ .checkmark:after {
          display: block;
        }

        .modern-select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(128, 0, 32, 0.3);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          color: #ffffff;
          font-size: 0.9rem;
          margin-left: 0.5rem;
          transition: all 0.3s ease;
        }

        .modern-select:focus {
          outline: none;
          border-color: #800020;
          box-shadow: 0 0 0 3px rgba(128, 0, 32, 0.2);
        }

        .modern-select option {
          background: #1a1a1a;
          color: #ffffff;
        }

        .control-label {
          font-size: 0.9rem;
          color: #cccccc;
          font-weight: 500;
        }

        .components-container {
          display: grid;
          gap: 2rem;
        }

        @media (min-width: 1200px) {
          .components-container {
            grid-template-columns: 350px 1fr;
          }
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .main-content {
            padding: 1rem;
          }

          .system-status {
            flex-direction: column;
            align-items: flex-start;
          }

          .cot-controls {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
        }

        /* Accessibility improvements */
        .modern-checkbox:focus-within .checkmark {
          box-shadow: 0 0 0 3px rgba(128, 0, 32, 0.3);
        }

        .modern-select:focus,
        .modern-checkbox:focus-within {
          outline: 2px solid #800020;
          outline-offset: 2px;
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .title {
            -webkit-text-fill-color: #ffffff;
            text-shadow: none;
          }

          .system-status,
          .cot-settings {
            border-width: 2px;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .header::before,
          .status-indicator,
          .brain-icon {
            animation: none;
          }

          .system-status:hover,
          .cot-settings:hover {
            transform: none;
          }
        }
      `}</style>

      <div className="main-content">
        <header className="header">
          <h1 className="title">SynthesisTalk</h1>
          <p className="subtitle">Enhanced Research Assistant v1.3</p>
        </header>

        {/* System Status */}
        <div className="system-status">
          <div className="status-item">
            <span className="control-label">System Status</span>
          </div>
          <div className="status-item">
            <div
              className={`status-indicator ${
                !enableChainOfThought ? "disabled" : ""
              }`}
            ></div>
            <span>Chain of Thought</span>
          </div>
          <div className="status-item">
            <div
              className={`status-indicator ${
                !enableSourceAttribution ? "disabled" : ""
              }`}
            ></div>
            <span>Source Attribution</span>
          </div>
          {cacheStats && (
            <div className="status-item">
              <div className="status-indicator"></div>
              <span>
                Cache: {cacheStats.valid_cached_searches}/
                {cacheStats.total_cached_searches} valid
              </span>
            </div>
          )}
        </div>

        {/* Chain of Thought Settings */}
        <div className="cot-settings">
          <div className="cot-header">
            <span className="brain-icon">🧠</span>
            <h3 className="cot-title">Chain of Thought Reasoning</h3>
          </div>
          <div className="cot-controls">
            <div className="control-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={enableChainOfThought}
                  onChange={(e) => setEnableChainOfThought(e.target.checked)}
                  aria-label="Enable Chain of Thought reasoning"
                />
                <span className="checkmark"></span>
              </label>
              <span className="control-label">Enable Chain of Thought</span>
            </div>

            {enableChainOfThought && (
              <div className="control-group">
                <span className="control-label">Reasoning Depth:</span>
                <select
                  value={reasoningDepth}
                  onChange={(e) => setReasoningDepth(parseInt(e.target.value))}
                  className="modern-select"
                  aria-label="Select reasoning depth"
                >
                  <option value={2}>2 steps</option>
                  <option value={3}>3 steps</option>
                  <option value={4}>4 steps</option>
                  <option value={5}>5 steps</option>
                </select>
              </div>
            )}

            <div className="control-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={enableSourceAttribution}
                  onChange={(e) => setEnableSourceAttribution(e.target.checked)}
                  aria-label="Enable source attribution"
                />
                <span className="checkmark"></span>
              </label>
              <span className="control-label">Enable Source Attribution</span>
            </div>
          </div>
        </div>

        {/* Components Container */}
        <div className="components-container">
          {/* Conversation Manager Component */}
          <ConversationManager
            conversationId={conversationId}
            conversationHistory={conversationHistory}
            allConversations={allConversations}
            showConversationList={showConversationList}
            setShowConversationList={setShowConversationList}
            file={file}
            docText={docText}
            docLoading={docLoading}
            docError={docError}
            availableDocuments={availableDocuments}
            selectedDocument={selectedDocument}
            setSelectedDocument={setSelectedDocument}
            includeDocument={includeDocument}
            setIncludeDocument={setIncludeDocument}
            enableChunking={enableChunking}
            setEnableChunking={setEnableChunking}
            chunkSize={chunkSize}
            setChunkSize={setChunkSize}
            handleNewConversation={handleNewConversation}
            handleSwitchConversation={handleSwitchConversation}
            handleExportConversation={handleExportConversation}
            handleImportConversation={handleImportConversation}
            handleClearConversation={handleClearConversation}
            handleClearAllHistory={handleClearAllHistory}
            handleClearCache={handleClearCache}
            handleFileChange={handleFileChange}
            handleFileUpload={handleFileUpload}
            handleDeleteDocument={handleDeleteDocument}
          />

          {/* Chat Interface Component */}
          <ChatInterface
            conversationId={conversationId}
            conversationHistory={conversationHistory}
            prompt={prompt}
            setPrompt={setPrompt}
            includeSearch={includeSearch}
            setIncludeSearch={setIncludeSearch}
            searchResults={searchResults}
            reasoningSteps={reasoningSteps}
            sourcesUsed={sourcesUsed}
            availableDocuments={availableDocuments}
            selectedDocument={selectedDocument}
            setSelectedDocument={setSelectedDocument}
            includeDocument={includeDocument}
            setIncludeDocument={setIncludeDocument}
            llmLoading={llmLoading}
            searchLoading={searchLoading}
            llmError={llmError}
            searchError={searchError}
            handlePromptSubmit={handlePromptSubmit}
            handleStandaloneSearch={handleStandaloneSearch}
            handleKeyPress={handleKeyPress}
            handleDeleteDocument={handleDeleteDocument}
          />
        </div>
      </div>
      {/* ↓ Missing closing tags were added above ↓ */}
    </div>
  );
}

export default App;
