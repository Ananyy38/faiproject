import React, { useState, useEffect } from "react";
import axios from "axios";
import ChatInterface from "./components/ChatInterface";

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

  // Conversation management (sidebar, list)
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

  // New UI state for redesign (sidebar toggle, tools menu, etc.)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ==================== EFFECTS ====================

  // Whenever conversationId changes, load its history
  useEffect(() => {
    if (conversationId) {
      loadConversationHistory();
    }
  }, [conversationId]);

  // On mount, initialize app (fetch documents, conversations, cache stats)
  useEffect(() => {
    initializeApp();
  }, []);

  // Determine whether we've started chatting
  useEffect(() => {
    setHasStartedConversation(conversationHistory.length > 0);
  }, [conversationHistory]);

  // Auto-resize any existing textareas on mount
  useEffect(() => {
    const textareas = document.querySelectorAll(".chat-input");
    textareas.forEach((textarea) => {
      textarea.style.height = "auto";
      const newHeight = Math.max(44, Math.min(200, textarea.scrollHeight));
      textarea.style.height = newHeight + "px";
    });
  }, []);

  // If a new file is set (via drag-and-drop or picker), upload it
  useEffect(() => {
    if (file) {
      handleFileUpload();
    }
  }, [file]);

  // ==================== INITIALIZATION ====================

  const initializeApp = async () => {
    try {
      // Load available documents from backend
      await loadAvailableDocuments();

      // Load all conversations (for sidebar)
      const conversations = await loadAllConversations();

      // Load cache stats
      await loadCacheStats();

      // If no existing conversations, start a new one
      if (conversations.length === 0) {
        const newConvId = `conversation_${Date.now()}`;
        setConversationId(newConvId);
        setConversationHistory([]);
      } else {
        // Otherwise, also start fresh with a new conversation ID
        const newConvId = `conversation_${Date.now()}`;
        setConversationId(newConvId);
        setConversationHistory([]);
      }
    } catch (error) {
      console.error("Failed to initialize app:", error);
      // Fallback: always start a new conversation
      const newConvId = `conversation_${Date.now()}`;
      setConversationId(newConvId);
      setConversationHistory([]);
    }
  };

  // ==================== DATA LOADING FUNCTIONS ====================

  // Fetch conversation history for the given conversationId
  const loadConversationHistory = async () => {
    if (!conversationId) return;

    try {
      const res = await axios.get(`/api/conversations/${conversationId}`);
      setConversationHistory(res.data.messages || []);
    } catch (err) {
      console.log("No existing conversation found, starting fresh");
      setConversationHistory([]);
    }
  };

  // Fetch all available documents
  const loadAvailableDocuments = async () => {
    try {
      const res = await axios.get("/api/documents");
      setAvailableDocuments(res.data.documents || []);
    } catch (err) {
      console.log("No documents found or error loading documents");
      setAvailableDocuments([]);
    }
  };

  // Fetch list of all past conversations (for sidebar)
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

  // Fetch cache statistics (e.g., search cache)
  const loadCacheStats = async () => {
    try {
      const res = await axios.get("/api/cache/stats");
      setCacheStats(res.data);
    } catch (err) {
      console.log("Error loading cache stats");
    }
  };

  // Get full document content by ID
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

  // Send prompt to LLM API, including search/document context
  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;

    // Ensure conversationId exists
    if (!conversationId) {
      const newConvId = `conversation_${Date.now()}`;
      setConversationId(newConvId);
    }

    setLlmLoading(true);
    setLlmError("");
    setSearchResults(null);
    setReasoningSteps([]);
    setSourcesUsed([]);
    setToolsMenuOpen(false);

    try {
      // If a document is selected and includeDocument is true, fetch content
      let documentContext = null;
      if (includeDocument && selectedDocument) {
        documentContext = await getDocumentContent(
          selectedDocument.document_id
        );
      }

      // Build request body
      const requestBody = {
        prompt,
        conversation_id: conversationId || `conversation_${Date.now()}`,
        include_search: includeSearch,
        enable_source_attribution: enableSourceAttribution,
        enable_chain_of_thought: enableChainOfThought,
        reasoning_depth: reasoningDepth,
      };

      if (documentContext) {
        requestBody.document_context = documentContext;
      }

      const res = await axios.post("/api/llm", requestBody, {
        headers: { "Content-Type": "application/json" },
      });

      // Update conversation history
      setConversationHistory(res.data.updated_context || []);

      // Set optional pieces if returned
      if (res.data.search_results) {
        setSearchResults(res.data.search_results);
      }
      if (res.data.reasoning_steps) {
        setReasoningSteps(res.data.reasoning_steps);
      }
      if (res.data.sources_used) {
        setSourcesUsed(res.data.sources_used);
      }

      // Auto-generate title on first exchange
      const updatedContext = res.data.updated_context || [];
      if (updatedContext.length === 2) {
        await generateTitle(conversationId || `conversation_${Date.now()}`);
      }

      setPrompt(""); // Clear input after sending
      await loadAllConversations(); // Refresh sidebar list
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

  // Auto-generate conversation title via backend
  const generateTitle = async (convId) => {
    try {
      await axios.post(`/api/conversations/${convId}/auto-title`);
      // Refresh sidebar list so updated title appears
      await loadAllConversations();
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  };

  // Standalone search (without LLM)
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

  const handleClearAllHistory = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all conversation history?"
    );
    if (!confirmed) return;

    try {
      const res = await axios.delete("/api/conversations");
      console.log(`Cleared ${res.data.deleted_count} conversations`);

      setAllConversations([]);
      setConversationHistory([]);
      setPrompt("");
      setLlmError("");
      setSearchResults(null);
      setReasoningSteps([]);
      setSourcesUsed([]);
      setHasStartedConversation(false);

      // Start a brand‐new conversation
      const newConvId = `conversation_${Date.now()}`;
      setConversationId(newConvId);
    } catch (err) {
      console.error("Error clearing all history:", err);
    }
  };

  const handleNewConversation = async () => {
    // If current conversation has messages, refresh sidebar list
    if (conversationHistory.length > 0 && conversationId) {
      await loadAllConversations();
    }

    // Now truly start brand‐new
    const newConvId = `conversation_${Date.now()}`;
    setConversationId(newConvId);
    setConversationHistory([]);
    setPrompt("");
    setLlmError("");
    setSearchResults(null);
    setReasoningSteps([]);
    setSourcesUsed([]);
    setHasStartedConversation(false);

    // On mobile, close sidebar
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleSwitchConversation = async (convId) => {
    setConversationId(convId);
    setShowConversationList(false);
    setReasoningSteps([]);
    setSourcesUsed([]);
    setPrompt("");
    setLlmError("");
    setSearchResults(null);

    try {
      const res = await axios.get(`/api/conversations/${convId}`);
      setConversationHistory(res.data.messages || []);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      setConversationHistory([]);
    }

    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

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

  const handleImportConversation = async (event) => {
    const fileToImport = event.target.files[0];
    if (!fileToImport) return;

    try {
      const text = await fileToImport.text();
      const conversationData = JSON.parse(text);

      await axios.post("/api/conversations/import", conversationData);
      await loadAllConversations();
      alert("Conversation imported successfully!");
    } catch (err) {
      console.error("Error importing conversation:", err);
      alert("Error importing conversation");
    }
  };

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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setDocError(""); // Clear previous errors
  };

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
      const res = await axios.post("/api/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocText(res.data.text);

      // Refresh document list
      await loadAvailableDocuments();

      // Auto-select the newly uploaded doc
      const newDocs = await axios.get("/api/documents");
      const latestDoc =
        newDocs.data.documents[newDocs.data.documents.length - 1];
      if (latestDoc) {
        setSelectedDocument(latestDoc);
        setIncludeDocument(true);
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

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePromptSubmit();
    }
  };

  const handleTextareaChange = (e) => {
    const textarea = e.target;
    setPrompt(e.target.value);

    requestAnimationFrame(() => {
      textarea.style.height = "auto";
      const minHeight = 44;
      const maxHeight = 200;
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, textarea.scrollHeight)
      );
      textarea.style.height = newHeight + "px";
    });
  };

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
      // The upload is triggered by the useEffect above
    }
  };

  const handleFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        setFile(selectedFile);
        setDocError("");
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
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
        }

        .import-export-btn:hover {
          background: rgba(128, 0, 32, 0.1);
          border-color: rgba(128, 0, 32, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(128, 0, 32, 0.15);
        }

        /* Sidebar Toggle */
        .sidebar-button {
          width: 3rem;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          position: fixed;
          top: 1rem;
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

        .sidebar-button:hover {
          background: rgba(128, 0, 32, 0.1);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(128, 0, 32, 0.15);
        }

        /* Position of “≡” toggle */
        .sidebar-toggle {
          left: 1rem;
        }

        /* Position of “➕” new chat button */
        .new-chat-shortcut {
          left: calc(1.7rem + 3rem + 0.5rem);
        }

        /* Sidebar */
        .sidebar {
          position: fixed;
          top: 7rem; /* if your header height is 6rem */
          left: ${sidebarOpen ? "0" : "-400px"};
          width: 350px;
          height: calc(100vh - 6rem);
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(128, 0, 32, 0.15);
          box-shadow: 2px 0 20px rgba(128, 0, 32, 0.1);
          z-index: 999;
          transition: left 0.3s ease;
          overflow-y: auto;
          padding: 5.85rem 1.5rem 2rem 1.5rem;
        }

        .sidebar h3 {
          color: #800020;
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(128, 0, 32, 0.2);
        }

        .sidebar-section {
          margin-bottom: 1rem;
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

        .conversation-meta {
          font-size: 0.75rem;
          color: #8b5a3c;
          display: flex;
          justify-content: space-between;
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

        /* ======================
           NEW: Bottom-center input 
           ====================== */
        .central-input-container {
          position: fixed;
          bottom: 20px;
          left: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          z-index: 100;
        }

        .chat-input-wrapper {
          width: 100%;
          max-width: 850px; /* ← adjust as needed */
          padding: 1rem;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(128, 0, 32, 0.15);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(128, 0, 32, 0.08);
        }

        .chat-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid rgba(128, 0, 32, 0.2);
          font-size: 1rem;
          resize: none;
          box-sizing: border-box;
        }

        .chat-input-controls {
          margin-top: 0.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chat-input-controls-left {
          display: flex;
          gap: 0.5rem;
        }

        .chat-input-controls-right {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .control-btn {
          background: rgba(152, 64, 56, 0.35); /* Bright green */
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s ease;
          min-width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .control-btn:hover {
          background: rgb(152, 64, 56); /* Bright green */
          transform: translateY(-1px);
        }

        .control-btn.primary {
          background: rgba(0, 0, 0, 0.84); /* Bright blue for send button */
        }

        .control-btn.primary:hover {
          background: rgb(0, 0, 0);
        }

        .control-btn:disabled {
          background: #cccccc;
          cursor: not-allowed;
        }
        /* ==================== */
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
              className={`status-indicator ${
                enableChainOfThought ? "" : "disabled"
              }`}
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
              className={`status-indicator ${
                enableSourceAttribution ? "" : "disabled"
              }`}
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

        {/* Sidebar Toggle (“≡”) */}
        <button
          className="sidebar-button sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Toggle Sidebar"
        >
          ≡
        </button>

        {/* New Chat Shortcut (“➕”) */}
        <button
          className="sidebar-button new-chat-shortcut"
          onClick={handleNewConversation}
          title="New Chat"
        >
          📝
        </button>

        {/* Sidebar / Conversation List */}
        <div className="sidebar">
          <div className="sidebar-section">
            <button
              className="sidebar-btn primary"
              onClick={handleNewConversation}
            >
              📝 New Chat
            </button>
          </div>

          <div className="sidebar-section">
            <h3>Recent Conversations</h3>
            <div className="conversation-list">
              {allConversations.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className={`conversation-item ${
                    conv.conversation_id === conversationId ? "active" : ""
                  }`}
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
            <h3>Actions</h3>
            <button className="sidebar-btn" onClick={handleClearConversation}>
              🗑️ Clear Current Chat
            </button>
            <button className="sidebar-btn" onClick={handleClearAllHistory}>
              ⚠️ Clear All History
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* 
            If no conversation has started, show the “empty state” placeholder.
            Otherwise, render ChatInterface (all chat UI lives there now).
          */}
          {!hasStartedConversation ? (
            /* Empty State – drag/drop area + central input placeholder */
            <div className="empty-state">
              <div
                className={`central-input-container ${
                  dragOver ? "drag-over" : ""
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedDocument && includeDocument && (
                  <div className="document-preview">
                    📄 {selectedDocument.filename}
                    <div className="document-actions-inline">
                      <button
                        className="document-action-inline"
                        onClick={() =>
                          handleDeleteDocument(selectedDocument.document_id)
                        }
                        title="Delete Document"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}

                <div className="chat-input-wrapper">
                  <textarea
                    className="chat-input"
                    value={prompt}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message here…"
                    disabled={llmLoading || docLoading || searchLoading}
                    rows={1}
                    style={{
                      height: "44px",
                      minHeight: "44px",
                      maxHeight: "200px",
                      resize: "none",
                      overflow: "hidden",
                    }}
                  />

                  <div className="chat-input-controls">
                    <div className="chat-input-controls-left">
                      <button
                        className="control-btn"
                        onClick={handleFilePicker}
                        title="Attach File"
                        disabled={llmLoading || docLoading}
                      >
                        ➕
                      </button>

                      <button
                        className="control-btn"
                        onClick={() => setToolsMenuOpen(!toolsMenuOpen)}
                        title="Tools"
                      >
                        🛠️
                      </button>
                    </div>

                    <div className="chat-input-controls-right">
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
                      <button
                        className="control-btn primary"
                        onClick={handlePromptSubmit}
                        disabled={!prompt.trim() || llmLoading || docLoading}
                        title="Send Message"
                      >
                        {llmLoading ? (
                          <div className="loading-spinner"></div>
                        ) : (
                          "↑"
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
            </div>
          ) : (
            /* Active Chat Interface – now fully handled by ChatInterface.jsx */
            <ChatInterface
              conversationId={conversationId}
              conversationHistory={conversationHistory}
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
              docLoading={docLoading}
              searchLoading={searchLoading}
              llmError={llmError}
              docError={docError}
              searchError={searchError}
              handlePromptSubmit={handlePromptSubmit}
              handleStandaloneSearch={handleStandaloneSearch}
              handleKeyPress={handleKeyPress}
              handleFilePicker={handleFilePicker}
              handleDeleteDocument={handleDeleteDocument}
              toolsMenuOpen={toolsMenuOpen}
              setToolsMenuOpen={setToolsMenuOpen}
              enableChainOfThought={enableChainOfThought}
              setEnableChainOfThought={setEnableChainOfThought}
            />
          )}

          {/*
            ========================
            BOTTOM-CENTER INPUT AREA
            ========================
            This only shows when a conversation exists.
          */}
          {hasStartedConversation && (
            <div className="central-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder="Type your message here…"
                  value={prompt}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  disabled={llmLoading || docLoading || searchLoading}
                  rows={1}
                  style={{
                    height: "44px",
                    minHeight: "44px",
                    maxHeight: "200px",
                    resize: "none",
                    overflow: "hidden",
                  }}
                />
                <div className="chat-input-controls">
                  <button
                    onClick={handlePromptSubmit}
                    disabled={!prompt.trim() || llmLoading || docLoading}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
