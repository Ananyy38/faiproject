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

  // New UI state for redesign
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

  // Check if conversation has started
  useEffect(() => {
    setHasStartedConversation(conversationHistory.length > 0);
  }, [conversationHistory]);

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
    setToolsMenuOpen(false); // Close tools menu on submit

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
      setHasStartedConversation(false);
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
      setHasStartedConversation(false);

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
    setHasStartedConversation(false);

    // Close sidebar on mobile after starting new conversation
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
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

    // Close sidebar on mobile after switching conversation
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
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

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setDocError("");
      // Auto-upload the dropped file
      setTimeout(() => {
        handleFileUpload();
      }, 100);
    }
  };

  // Handle file picker
  const handleFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        setFile(selectedFile);
        setDocError("");
        // Auto-upload the selected file
        setTimeout(() => {
          handleFileUpload();
        }, 100);
      }
    };
    input.click();
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
            #faf8f5 0%,
            #f5f2ed 50%,
            #f8f5f0 100%
          );
          font-family:
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
          color: #2c1810;
          overflow-x: hidden;
          position: relative;
        }

        .main-layout {
          display: flex;
          min-height: 100vh;
          transition: all 0.3s ease;
        }

        /* Header */
        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          text-align: center;
          padding: 2rem 0 1rem 0;
          background: rgba(250, 248, 245, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(128, 0, 32, 0.1);
        }

        .title {
          font-size: clamp(2rem, 4vw, 3.5rem);
          font-weight: 700;
          margin: 0;
          background: linear-gradient(
            135deg,
            #800020 0%,
            #a0002a 50%,
            #c41e3a 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 2px 8px rgba(128, 0, 32, 0.2);
          letter-spacing: -0.02em;
        }

        .subtitle {
          font-size: 1.1rem;
          color: #8b5a3c;
          margin-top: 0.5rem;
          font-weight: 400;
        }

        /* Status Bar */
        .status-bar {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 1001;
          display: flex;
          gap: 1rem;
          align-items: center;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 12px;
          padding: 0.75rem 1rem;
          font-size: 0.85rem;
          font-family: "JetBrains Mono", monospace;
          box-shadow: 0 4px 16px rgba(128, 0, 32, 0.08);
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
          background: #00b854;
          box-shadow: 0 0 8px rgba(0, 184, 84, 0.6);
          animation: glow 2s ease-in-out infinite alternate;
        }

        .status-indicator.disabled {
          background: #bdb5ab;
          box-shadow: none;
          animation: none;
        }

        @keyframes glow {
          0% {
            box-shadow: 0 0 4px rgba(0, 184, 84, 0.4);
          }
          100% {
            box-shadow:
              0 0 12px rgba(0, 184, 84, 0.8),
              0 0 20px rgba(0, 184, 84, 0.4);
          }
        }

        /* Import/Export Controls */
        .import-export-controls {
          position: fixed;
          top: 5rem;
          right: 1rem;
          z-index: 1001;
          display: flex;
          gap: 0.5rem;
        }

        .import-export-btn {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 8px;
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          color: #800020;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .import-export-btn:hover {
          background: rgba(128, 0, 32, 0.1);
          border-color: rgba(128, 0, 32, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(128, 0, 32, 0.15);
        }

        /* Sidebar Toggle */
        .sidebar-toggle {
          position: fixed;
          top: 1rem;
          left: 1rem;
          z-index: 1002;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 8px;
          padding: 0.75rem;
          cursor: pointer;
          font-size: 1.2rem;
          color: #800020;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(128, 0, 32, 0.08);
        }

        .sidebar-toggle:hover {
          background: rgba(128, 0, 32, 0.1);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(128, 0, 32, 0.15);
        }

        /* Sidebar */
        .sidebar {
          position: fixed;
          top: 0;
          left: ${sidebarOpen ? "0" : "-400px"};
          width: 350px;
          height: 100vh;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(128, 0, 32, 0.15);
          box-shadow: 2px 0 20px rgba(128, 0, 32, 0.1);
          z-index: 999;
          transition: left 0.3s ease;
          overflow-y: auto;
          padding: 8rem 1.5rem 2rem 1.5rem;
        }

        /* Main Content */
        .main-content {
          flex: 1;
          margin-left: ${sidebarOpen ? "350px" : "0"};
          padding-top: 8rem;
          transition: margin-left 0.3s ease;
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Central Chat Input (Empty State) */
        .empty-state {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .central-input-container {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(128, 0, 32, 0.15);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(128, 0, 32, 0.08);
          padding: 2rem;
          width: 100%;
          max-width: 600px;
          position: relative;
          transition: all 0.3s ease;
        }

        .central-input-container.drag-over {
          border-color: #800020;
          background: rgba(128, 0, 32, 0.05);
          transform: scale(1.02);
        }

        .document-preview {
          background: rgba(128, 0, 32, 0.05);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 8px;
          padding: 0.75rem;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: flex-end;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .main-input {
          flex: 1;
          min-height: 120px;
          padding: 1rem;
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.9);
          color: #2c1810;
          font-size: 1rem;
          font-family: inherit;
          resize: vertical;
          transition: all 0.3s ease;
        }

        .main-input:focus {
          outline: none;
          border-color: #800020;
          box-shadow: 0 0 0 3px rgba(128, 0, 32, 0.15);
          background: rgba(255, 255, 255, 1);
        }

        .main-input::placeholder {
          color: #8b5a3c;
          font-style: italic;
        }

        .input-controls {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .control-btn {
          background: rgba(128, 0, 32, 0.1);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 8px;
          padding: 0.75rem;
          cursor: pointer;
          color: #800020;
          font-size: 1.1rem;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          min-height: 44px;
        }

        .control-btn:hover:not(:disabled) {
          background: rgba(128, 0, 32, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(128, 0, 32, 0.15);
        }

        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .control-btn.primary {
          background: linear-gradient(135deg, #800020, #a0002a);
          color: white;
          border-color: #800020;
        }

        .control-btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #a0002a, #c41e3a);
          box-shadow: 0 4px 16px rgba(128, 0, 32, 0.3);
        }

        /* Tools Menu */
        .tools-menu {
          position: relative;
        }

        -dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(128, 0, 32, 0.15);
          padding: 1rem;
          min-width: 200px;
          z-index: 1000;
        }

        .tools-dropdown.open {
          display: block;
        }

        .tools-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .tools-option:hover {
          background: rgba(128, 0, 32, 0.1);
          padding-left: 0.5rem;
          padding-right: 0.5rem;
        }

        .tools-checkbox {
          width: 16px;
          height: 16px;
          border: 2px solid #800020;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .tools-checkbox.checked {
          background: #800020;
          color: white;
        }

        .tools-label {
          font-size: 0.9rem;
          color: #2c1810;
          font-weight: 500;
        }

        /* Action Buttons */
        .action-buttons {
          display: flex;
          gap: 0.5rem;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
        }

        .keyboard-shortcuts {
          font-size: 0.75rem;
          color: #8b5a3c;
          font-family: "JetBrains Mono", monospace;
        }

        .action-group {
          display: flex;
          gap: 0.5rem;
        }

        /* File Upload Area */
        .file-upload-area {
          border: 2px dashed rgba(128, 0, 32, 0.3);
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
          color: #8b5a3c;
          font-size: 0.9rem;
          margin-bottom: 1rem;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .file-upload-area:hover {
          border-color: #800020;
          background: rgba(128, 0, 32, 0.05);
        }

        .file-upload-area.has-file {
          border-color: #800020;
          background: rgba(128, 0, 32, 0.1);
          color: #800020;
        }

        /* Chat Interface (Active State) */
        .chat-interface {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 0 2rem 2rem 2rem;
          height: calc(100vh - 8rem);
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 0;
          margin-bottom: 1rem;
        }

        .message {
          margin-bottom: 1.5rem;
          animation: fadeInUp 0.3s ease;
        }

        .message.user {
          display: flex;
          justify-content: flex-end;
        }

        .message.assistant {
          display: flex;
          justify-content: flex-start;
        }

        .message-content {
          max-width: 70%;
          padding: 1rem 1.25rem;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(128, 0, 32, 0.15);
          box-shadow: 0 2px 8px rgba(128, 0, 32, 0.08);
          word-wrap: break-word;
          line-height: 1.6;
        }

        .message.user .message-content {
          background: linear-gradient(135deg, #800020, #a0002a);
          color: white;
          border-color: #800020;
        }

        .reasoning-steps {
          background: rgba(128, 0, 32, 0.05);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 12px;
          padding: 1rem;
          margin: 1rem 0;
          font-size: 0.9rem;
        }

        .reasoning-step {
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(128, 0, 32, 0.1);
        }

        .reasoning-step:last-child {
          border-bottom: none;
        }

        .search-results {
          background: rgba(0, 184, 84, 0.05);
          border: 1px solid rgba(0, 184, 84, 0.2);
          border-radius: 12px;
          padding: 1rem;
          margin: 1rem 0;
          font-size: 0.9rem;
        }

        .search-result {
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(0, 184, 84, 0.1);
        }

        .search-result:last-child {
          border-bottom: none;
        }

        .search-result-title {
          font-weight: 600;
          color: #2c1810;
          margin-bottom: 0.25rem;
        }

        .search-result-url {
          font-size: 0.8rem;
          color: #8b5a3c;
          font-family: "JetBrains Mono", monospace;
        }

        /* Chat Input (Active State) */
        .chat-input-container {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(128, 0, 32, 0.15);
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(128, 0, 32, 0.08);
          padding: 1rem;
        }

        .chat-input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 0.75rem;
        }

        .chat-input {
          flex: 1;
          min-height: 44px;
          max-height: 200px;
          padding: 0.75rem;
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.9);
          color: #2c1810;
          font-size: 1rem;
          font-family: inherit;
          resize: none;
          transition: all 0.3s ease;
        }

        .chat-input:focus {
          outline: none;
          border-color: #800020;
          box-shadow: 0 0 0 2px rgba(128, 0, 32, 0.15);
          background: rgba(255, 255, 255, 1);
        }

        .chat-input-controls {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Loading States */
        .loading-spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid rgba(128, 0, 32, 0.3);
          border-radius: 50%;
          border-top-color: #800020;
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Error States */
        .error-message {
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid rgba(220, 53, 69, 0.3);
          color: #dc3545;
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
          font-size: 0.9rem;
        }

        /* Sidebar Styles */
        .sidebar h3 {
          color: #800020;
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(128, 0, 32, 0.2);
          z-index: 1;
        }

        .sidebar-section {
          margin-bottom: 2rem;
        }

        .sidebar-btn {
          width: 100%;
          background: rgba(128, 0, 32, 0.1);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          cursor: pointer;
          color: #800020;
          font-size: 0.9rem;
          transition: all 0.3s ease;
          margin-bottom: 0.5rem;
          text-align: left;
        }

        .sidebar-btn:hover:not(:disabled) {
          background: rgba(128, 0, 32, 0.2);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(128, 0, 32, 0.15);
        }

        .sidebar-btn.primary {
          background: linear-gradient(135deg, #800020, #a0002a);
          color: white;
          border-color: #800020;
          font-weight: 500;
        }

        .sidebar-btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #a0002a, #c41e3a);
          box-shadow: 0 4px 12px rgba(128, 0, 32, 0.25);
        }

        .conversation-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .conversation-item {
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(128, 0, 32, 0.1);
          border-radius: 8px;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .conversation-item:hover {
          background: rgba(128, 0, 32, 0.1);
          border-color: rgba(128, 0, 32, 0.2);
        }

        .conversation-item.active {
          background: rgba(128, 0, 32, 0.15);
          border-color: #800020;
        }

        .conversation-title {
          font-weight: 500;
          color: #2c1810;
          margin-bottom: 0.25rem;
          font-size: 0.9rem;
        }

        .title-input-container /* or the input’s wrapper */ {
          z-index: 0;
        }

        .conversation-meta {
          font-size: 0.75rem;
          color: #8b5a3c;
          display: flex;
          justify-content: space-between;
        }

        .document-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .document-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(128, 0, 32, 0.1);
          border-radius: 6px;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
        }

        .document-name {
          color: #2c1810;
          flex: 1;
          margin-right: 0.5rem;
        }

        .document-actions {
          display: flex;
          gap: 0.25rem;
        }

        .document-action {
          background: none;
          border: none;
          color: #800020;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: background 0.2s ease;
        }

        .document-action:hover {
          background: rgba(128, 0, 32, 0.1);
        }

        /* Help Section */
        .help-section {
          background: rgba(128, 0, 32, 0.05);
          border: 1px solid rgba(128, 0, 32, 0.15);
          border-radius: 8px;
          padding: 1rem;
          font-size: 0.85rem;
          color: #2c1810;
        }

        .help-item {
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .help-shortcut {
          background: rgba(128, 0, 32, 0.1);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.75rem;
          color: #800020;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            left: ${sidebarOpen ? "0" : "-100%"};
          }

          .main-content {
            margin-left: 0;
          }

          .central-input-container,
          .chat-input-container {
            margin: 0 1rem;
          }

          .empty-state {
            padding: 1rem;
          }

          .chat-interface {
            padding: 0 1rem 1rem 1rem;
          }

          .message-content {
            max-width: 85%;
          }

          .status-bar,
          .import-export-controls {
            position: relative;
            top: auto;
            right: auto;
            margin: 1rem;
            justify-content: center;
          }

          .header {
            position: relative;
            padding: 1rem 0;
          }

          .main-content {
            padding-top: 2rem;
          }

          .chat-interface {
            height: calc(100vh - 4rem);
          }
        }

        @media (max-width: 480px) {
          .title {
            font-size: 2rem;
          }

          .subtitle {
            font-size: 1rem;
          }

          .input-wrapper,
          .chat-input-wrapper {
            flex-direction: column;
            gap: 0.5rem;
          }

          .input-controls,
          .chat-input-controls {
            flex-direction: row;
            justify-content: space-between;
          }
        }
      `}</style>

      <div className="main-layout">
        {/* Header */}
        <div className="header">
          <h1 className="title">SynthesisTalk</h1>
          <p className="subtitle">
            Intelligent conversations with advanced reasoning and search
          </p>
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-item">
            <div
              className={`status-indicator ${enableChainOfThought ? "" : "disabled"}`}
            ></div>
            <span>CoT</span>
          </div>
          <div className="status-item">
            <div
              className={`status-indicator ${includeSearch ? "" : "disabled"}`}
            ></div>
            <span>Search</span>
          </div>
          <div className="status-item">
            <div
              className={`status-indicator ${enableSourceAttribution ? "" : "disabled"}`}
            ></div>
            <span>Sources</span>
          </div>
        </div>

        {/* Import/Export Controls */}
        <div className="import-export-controls">
          <button
            className="import-export-btn"
            onClick={handleExportConversation}
          >
            📤 Export
          </button>
          <label className="import-export-btn">
            📥 Import
            <input
              type="file"
              accept=".json"
              onChange={handleImportConversation}
              style={{ display: "none" }}
            />
          </label>
          <button className="import-export-btn" onClick={handleClearCache}>
            🗑️ Cache
          </button>
        </div>

        {/* Sidebar Toggle */}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ≡
        </button>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-section">
            <button
              className="sidebar-btn primary"
              onClick={handleNewConversation}
            >
              ➕ New Chat
            </button>
          </div>

          <div className="sidebar-section">
            <h3>Recent Conversations</h3>
            <div className="conversation-list">
              {allConversations.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className={`conversation-item ${conv.conversation_id === conversationId ? "active" : ""}`}
                  onClick={() => handleSwitchConversation(conv.conversation_id)}
                >
                  <div className="conversation-title">
                    {conv.title || "Untitled Conversation"}
                  </div>
                  <div className="conversation-meta">
                    <span>{conv.message_count || 0} messages</span>
                    <span>
                      {conv.last_updated
                        ? new Date(conv.last_updated).toLocaleDateString()
                        : "Unknown"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Document Upload</h3>
            <div className="file-upload-area" onClick={handleFilePicker}>
              {file ? (
                <div>📄 {file.name}</div>
              ) : (
                <div>Click to upload or drag & drop files</div>
              )}
            </div>

            {availableDocuments.length > 0 && (
              <>
                <h4
                  style={{
                    margin: "1rem 0 0.5rem 0",
                    fontSize: "0.9rem",
                    color: "#800020",
                  }}
                >
                  Available Documents
                </h4>
                <div className="document-list">
                  {availableDocuments.map((doc) => (
                    <div key={doc.document_id} className="document-item">
                      <span className="document-name">{doc.filename}</span>
                      <div className="document-actions">
                        <button
                          className="document-action"
                          onClick={() => {
                            setSelectedDocument(doc);
                            setIncludeDocument(true);
                          }}
                          title="Select Document"
                        >
                          ✓
                        </button>
                        <button
                          className="document-action"
                          onClick={() => handleDeleteDocument(doc.document_id)}
                          title="Delete Document"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="sidebar-section">
            <h3>Actions</h3>
            <button className="sidebar-btn" onClick={handleClearConversation}>
              🗑️ Clear Current Chat
            </button>
            <button className="sidebar-btn" onClick={handleClearAllHistory}>
              ⚠️ Clear All History
            </button>
          </div>

          <div className="sidebar-section">
            <div className="help-section">
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#800020" }}>
                Keyboard Shortcuts
              </h4>
              <div className="help-item">
                <span className="help-shortcut">Ctrl + Enter</span>
                <span>Send to AI</span>
              </div>
              <div className="help-item">
                <span className="help-shortcut">Shift + Enter</span>
                <span>Search only</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {!hasStartedConversation ? (
            /* Empty State - Central Input */
            <div className="empty-state">
              <div
                className={`central-input-container ${dragOver ? "drag-over" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedDocument && includeDocument && (
                  <div className="document-preview">
                    📄 Document: {selectedDocument.filename}
                  </div>
                )}

                <div className="input-wrapper">
                  <textarea
                    className="main-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message here... 

Ctrl+Enter to send to AI
Shift+Enter for web search only"
                    disabled={llmLoading || docLoading || searchLoading}
                  />

                  <div className="input-controls">
                    <button
                      className="control-btn"
                      onClick={handleFilePicker}
                      title="Attach File"
                      disabled={llmLoading || docLoading}
                    >
                      ➕
                    </button>

                    <div className="tools-menu">
                      <button
                        className="control-btn"
                        onClick={() => setToolsMenuOpen(!toolsMenuOpen)}
                        title="Tools"
                      >
                        ⚙️
                      </button>

                      {toolsMenuOpen && (
                        <div className="tools-dropdown open">
                          <div
                            className="tools-option"
                            onClick={() =>
                              setEnableChainOfThought(!enableChainOfThought)
                            }
                          >
                            <div
                              className={`tools-checkbox ${enableChainOfThought ? "checked" : ""}`}
                            >
                              {enableChainOfThought && "✓"}
                            </div>
                            <span className="tools-label">
                              Chain of Thought
                            </span>
                          </div>

                          <div
                            className="tools-option"
                            onClick={() => setIncludeSearch(!includeSearch)}
                          >
                            <div
                              className={`tools-checkbox ${includeSearch ? "checked" : ""}`}
                            >
                              {includeSearch && "✓"}
                            </div>
                            <span className="tools-label">Web Search</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      className="control-btn primary"
                      onClick={handlePromptSubmit}
                      disabled={!prompt.trim() || llmLoading || docLoading}
                      title="Send Message"
                    >
                      {llmLoading ? (
                        <div className="loading-spinner"></div>
                      ) : (
                        "↑ "
                      )}
                    </button>
                  </div>
                </div>

                <div className="action-buttons">
                  <div className="keyboard-shortcuts">
                    Ctrl+Enter: AI • Shift+Enter: Search
                  </div>
                  <div className="action-group">
                    <button
                      className="control-btn"
                      onClick={handleStandaloneSearch}
                      disabled={!prompt.trim() || searchLoading}
                      title="Search Only"
                    >
                      {searchLoading ? (
                        <div className="loading-spinner"></div>
                      ) : (
                        "🔍"
                      )}
                    </button>
                  </div>
                </div>

                {llmError && <div className="error-message">{llmError}</div>}
                {docError && <div className="error-message">{docError}</div>}
                {searchError && (
                  <div className="error-message">{searchError}</div>
                )}
              </div>
            </div>
          ) : (
            /* Active Chat Interface */
            <ChatInterface
              conversationHistory={conversationHistory}
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={handlePromptSubmit}
              onSearch={handleStandaloneSearch}
              onKeyPress={handleKeyPress}
              llmLoading={llmLoading}
              searchLoading={searchLoading}
              llmError={llmError}
              searchError={searchError}
              docError={docError}
              searchResults={searchResults}
              reasoningSteps={reasoningSteps}
              sourcesUsed={sourcesUsed}
              selectedDocument={selectedDocument}
              includeDocument={includeDocument}
              includeSearch={includeSearch}
              setIncludeSearch={setIncludeSearch}
              enableChainOfThought={enableChainOfThought}
              setEnableChainOfThought={setEnableChainOfThought}
              onFilePicker={handleFilePicker}
              toolsMenuOpen={toolsMenuOpen}
              setToolsMenuOpen={setToolsMenuOpen}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;