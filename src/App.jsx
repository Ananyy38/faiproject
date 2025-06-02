import React, { useState, useEffect } from "react";
import axios from "axios";
import ChatInterface from "./components/ChatInterface";
import ConversationManager from "./components/ConversationList";


function App() {
  // ==================== STATE MANAGEMENT ====================

  // Core conversation state
  const [prompt, setPrompt] = useState("");
  const [conversationId, setConversationId] = useState(null); // Changed from "default" to null
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
    <div
      style={{
        padding: 20,
        fontFamily: "sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1>SynthesisTalk v1.3 - Enhanced Research Assistant</h1>

      {/* System Status */}
      <div
        style={{
          marginBottom: 20,
          padding: 12,
          backgroundColor: "#f8f9fa",
          borderRadius: 4,
          border: "1px solid #e9ecef",
          fontSize: "12px",
        }}
      >
        <strong>System Status:</strong> Chain of Thought:{" "}
        {enableChainOfThought ? "✅" : "❌"} | Source Attribution:{" "}
        {enableSourceAttribution ? "✅" : "❌"} |
        {cacheStats &&
          ` Cache: ${cacheStats.valid_cached_searches}/${cacheStats.total_cached_searches} valid`}
      </div>

      {/* Chain of Thought Settings */}
      <div
        style={{
          marginBottom: 16,
          padding: 12,
          backgroundColor: "#e8f4f8",
          borderRadius: 4,
          border: "1px solid #bee5eb",
        }}
      >
        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
          🧠 Chain of Thought Reasoning
        </h4>
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "12px",
            }}
          >
            <input
              type="checkbox"
              checked={enableChainOfThought}
              onChange={(e) => setEnableChainOfThought(e.target.checked)}
              style={{ marginRight: "4px" }}
            />
            Enable Chain of Thought
          </label>
          {enableChainOfThought && (
            <label style={{ fontSize: "12px" }}>
              Reasoning Depth:
              <select
                value={reasoningDepth}
                onChange={(e) => setReasoningDepth(parseInt(e.target.value))}
                style={{ marginLeft: "4px", padding: "2px" }}
              >
                <option value={2}>2 steps</option>
                <option value={3}>3 steps</option>
                <option value={4}>4 steps</option>
                <option value={5}>5 steps</option>
              </select>
            </label>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "12px",
            }}
          >
            <input
              type="checkbox"
              checked={enableSourceAttribution}
              onChange={(e) => setEnableSourceAttribution(e.target.checked)}
              style={{ marginRight: "4px" }}
            />
            Enable Source Attribution
          </label>
        </div>
      </div>

      {/* Conversation Manager Component */}
      <ConversationManager
        // Conversation state
        conversationId={conversationId}
        conversationHistory={conversationHistory}
        allConversations={allConversations}
        showConversationList={showConversationList}
        setShowConversationList={setShowConversationList}
        // Document state
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
        // Event handlers
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
        // Conversation state
        conversationId={conversationId}
        conversationHistory={conversationHistory}
        prompt={prompt}
        setPrompt={setPrompt}
        // Search and results state
        includeSearch={includeSearch}
        setIncludeSearch={setIncludeSearch}
        searchResults={searchResults}
        reasoningSteps={reasoningSteps}
        sourcesUsed={sourcesUsed}
        // Document integration
        availableDocuments={availableDocuments}
        selectedDocument={selectedDocument}
        setSelectedDocument={setSelectedDocument}
        includeDocument={includeDocument}
        setIncludeDocument={setIncludeDocument}
        // Loading and error states
        llmLoading={llmLoading}
        searchLoading={searchLoading}
        llmError={llmError}
        searchError={searchError}
        // Event handlers
        handlePromptSubmit={handlePromptSubmit}
        handleStandaloneSearch={handleStandaloneSearch}
        handleKeyPress={handleKeyPress}
        handleDeleteDocument={handleDeleteDocument}
      />
    </div>
  );
}

export default App;
