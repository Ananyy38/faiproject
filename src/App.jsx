import React, { useState, useEffect } from "react";
import axios from "axios";

function App() {
  // ==================== STATE MANAGEMENT ====================

  // Core conversation state
  const [prompt, setPrompt] = useState("");
  const [conversationId, setConversationId] = useState("default");
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

  // NEW: Chain of Thought features
  const [enableChainOfThought, setEnableChainOfThought] = useState(false);
  const [reasoningDepth, setReasoningDepth] = useState(3);
  const [reasoningSteps, setReasoningSteps] = useState([]);

  // NEW: Source attribution
  const [enableSourceAttribution, setEnableSourceAttribution] = useState(true);
  const [sourcesUsed, setSourcesUsed] = useState([]);

  // NEW: Document chunking options
  const [enableChunking, setEnableChunking] = useState(true);
  const [chunkSize, setChunkSize] = useState(2000);

  // NEW: Conversation management
  const [allConversations, setAllConversations] = useState([]);
  const [showConversationList, setShowConversationList] = useState(false);

  // NEW: Cache management
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

  // Load conversation history on component mount
  useEffect(() => {
    loadConversationHistory();
  }, [conversationId]);

  // Load available documents on component mount
  useEffect(() => {
    loadAvailableDocuments();
    loadAllConversations();
    loadCacheStats();
  }, []);

  // ==================== DATA LOADING FUNCTIONS ====================

  // Load conversation history from backend
  const loadConversationHistory = async () => {
    try {
      const res = await axios.get(`/api/conversations/${conversationId}`);
      setConversationHistory(res.data.messages || []);
    } catch (err) {
      console.log("No existing conversation found, starting fresh");
      setConversationHistory([]);
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

  // NEW: Load all conversations
  const loadAllConversations = async () => {
    try {
      const res = await axios.get("/api/conversations");
      setAllConversations(res.data.conversations || []);
    } catch (err) {
      console.log("Error loading conversations list");
      setAllConversations([]);
    }
  };

  // NEW: Load cache statistics
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
        conversationId,
        includeSearch,
        includeDocument,
        enableChainOfThought,
        reasoningDepth,
        enableSourceAttribution,
        selectedDocument: selectedDocument?.filename,
      });

      const res = await axios.post(
        "/api/llm",
        {
          prompt,
          conversation_id: conversationId,
          context: conversationHistory,
          include_search: includeSearch,
          document_context: documentContext,
          enable_source_attribution: enableSourceAttribution,
          enable_chain_of_thought: enableChainOfThought,
          reasoning_depth: reasoningDepth,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("LLM response received:", res.data);

      // Update conversation history with the new response
      setConversationHistory(res.data.updated_context);

      // Set search results if returned
      if (res.data.search_results) {
        setSearchResults(res.data.search_results);
      }

      // NEW: Set reasoning steps if returned
      if (res.data.reasoning_steps) {
        setReasoningSteps(res.data.reasoning_steps);
      }

      // NEW: Set sources used if returned
      if (res.data.sources_used) {
        setSourcesUsed(res.data.sources_used);
      }

      setPrompt(""); // Clear the input after successful submission
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

  // Clear conversation
  const handleClearConversation = async () => {
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

  // Start new conversation
  const handleNewConversation = () => {
    const newId = `conversation_${Date.now()}`;
    setConversationId(newId);
    setConversationHistory([]);
    setPrompt("");
    setLlmError("");
    setSearchResults(null);
    setReasoningSteps([]);
    setSourcesUsed([]);
  };

  // NEW: Switch to existing conversation
  const handleSwitchConversation = (convId) => {
    setConversationId(convId);
    setShowConversationList(false);
    setReasoningSteps([]);
    setSourcesUsed([]);
  };

  // NEW: Export conversation
  const handleExportConversation = async () => {
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

  // NEW: Import conversation
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

  // NEW: Clear search cache
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

  // NEW: Delete document
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

      {/* NEW: System Status */}
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
          `Cache: ${cacheStats.valid_cached_searches}/${cacheStats.total_cached_searches} valid`}
      </div>

      {/* ==================== CONVERSATION MANAGEMENT SECTION ==================== */}
      <section style={{ marginTop: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={handleNewConversation}
            style={{
              padding: "6px 12px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            New Conversation
          </button>
          <button
            onClick={() => setShowConversationList(!showConversationList)}
            style={{
              padding: "6px 12px",
              backgroundColor: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Load Conversation ({allConversations.length})
          </button>
          <button
            onClick={handleExportConversation}
            style={{
              padding: "6px 12px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            disabled={conversationHistory.length === 0}
          >
            Export
          </button>
          <label
            style={{
              padding: "6px 12px",
              backgroundColor: "#ffc107",
              color: "black",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImportConversation}
              style={{ display: "none" }}
            />
          </label>
          <button
            onClick={handleClearConversation}
            style={{
              padding: "6px 12px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Clear History
          </button>
          <button
            onClick={handleClearCache}
            style={{
              padding: "6px 12px",
              backgroundColor: "#fd7e14",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Clear Cache
          </button>
        </div>

        {/* NEW: Conversation List */}
        {showConversationList && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: 4,
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0" }}>Available Conversations:</h4>
            {allConversations.map((conv) => (
              <div
                key={conv.conversation_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 8px",
                  margin: "4px 0",
                  backgroundColor:
                    conv.conversation_id === conversationId
                      ? "#007bff"
                      : "white",
                  color:
                    conv.conversation_id === conversationId ? "white" : "black",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                onClick={() => handleSwitchConversation(conv.conversation_id)}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                    {conv.conversation_id}
                  </div>
                  <div style={{ fontSize: "10px" }}>{conv.preview}</div>
                  <div style={{ fontSize: "10px" }}>
                    {conv.message_count} msgs | CoT:{" "}
                    {conv.has_reasoning_steps ? "✅" : "❌"}
                  </div>
                </div>
                <div style={{ fontSize: "10px" }}>
                  {new Date(conv.last_message_time).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================== RESEARCH CONVERSATION SECTION ==================== */}
      <section style={{ marginTop: 20 }}>
        <div style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
          Conversation ID: {conversationId} | Messages:{" "}
          {conversationHistory.length}
        </div>

        {/* NEW: Chain of Thought Settings */}
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

        {/* Conversation History Display */}
        {conversationHistory.length > 0 && (
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "12px",
              marginBottom: "16px",
              backgroundColor: "#f8f9fa",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>
              Conversation History
            </h3>
            {conversationHistory.map((message, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "12px",
                  padding: "8px",
                  backgroundColor:
                    message.role === "user" ? "#e3f2fd" : "#f1f8e9",
                  borderRadius: "4px",
                  borderLeft: `4px solid ${message.role === "user" ? "#2196f3" : "#4caf50"}`,
                }}
              >
                <strong>
                  {message.role === "user" ? "You" : "SynthesisTalk"}:
                </strong>
                <div style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>
                  {message.content}
                </div>
                {/* NEW: Show sources and reasoning steps for assistant messages */}
                {message.role === "assistant" && message.sources && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "11px",
                      color: "#666",
                      borderTop: "1px solid #ddd",
                      paddingTop: "4px",
                    }}
                  >
                    <strong>Sources:</strong> {message.sources.join(", ")}
                  </div>
                )}
                {message.role === "assistant" &&
                  message.reasoning_steps &&
                  message.reasoning_steps.length > 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "11px",
                        color: "#666",
                        borderTop: "1px solid #ddd",
                        paddingTop: "4px",
                      }}
                    >
                      <strong>Reasoning Steps:</strong>{" "}
                      {message.reasoning_steps.length} steps used
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}

        {/* NEW: Reasoning Steps Display */}
        {reasoningSteps && reasoningSteps.length > 0 && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#e8f4f8",
              border: "1px solid #bee5eb",
              borderRadius: "4px",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "16px",
                color: "#0c5460",
              }}
            >
              🧠 Chain of Thought Reasoning
            </h3>
            {reasoningSteps.map((step, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "8px",
                  padding: "8px",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  borderLeft: "3px solid #17a2b8",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "12px",
                    color: "#0c5460",
                  }}
                >
                  Step {step.step_number}: {step.description} ({step.action})
                </div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>
                  {step.content}
                </div>
                {step.sources_used && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#666",
                      marginTop: "4px",
                    }}
                  >
                    Sources: {step.sources_used.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* NEW: Sources Used Display */}
        {sourcesUsed && sourcesUsed.length > 0 && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: "4px",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
              📚 Sources Used:
            </h4>
            {sourcesUsed.map((source, index) => (
              <div
                key={index}
                style={{ fontSize: "12px", marginBottom: "2px" }}
              >
                • {source}
              </div>
            ))}
          </div>
        )}

        {/* Search Results Display */}
        {searchResults && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffeaa7",
              borderRadius: "4px",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "16px",
                color: "#856404",
              }}
            >
              🔍 Web Search Results
            </h3>
            {searchResults.map((result, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "12px",
                  padding: "8px",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  borderLeft: "3px solid #ffc107",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007bff", textDecoration: "none" }}
                  >
                    {result.title}
                  </a>
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    marginBottom: "4px",
                  }}
                >
                  {result.description}
                </div>
                <div style={{ fontSize: "12px", color: "#999" }}>
                  {result.url}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Options */}
        <div style={{ marginBottom: "8px" }}>
          <label
            style={{ display: "flex", alignItems: "center", fontSize: "14px" }}
          >
            <input
              type="checkbox"
              checked={includeSearch}
              onChange={(e) => setIncludeSearch(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Include web search in response
          </label>
        </div>

        {/* Document Integration Section */}
        {availableDocuments.length > 0 && (
          <div
            style={{
              marginBottom: "8px",
              padding: "8px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              border: "1px solid #e9ecef",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontSize: "14px",
                }}
              >
                <input
                  type="checkbox"
                  checked={includeDocument}
                  onChange={(e) => setIncludeDocument(e.target.checked)}
                  style={{ marginRight: "8px" }}
                />
                Include document content in conversation
              </label>
            </div>

            {includeDocument && (
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  Select document to include:
                </label>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <select
                    value={selectedDocument?.document_id || ""}
                    onChange={(e) => {
                      const selected = availableDocuments.find(
                        (doc) => doc.document_id === e.target.value
                      );
                      setSelectedDocument(selected || null);
                    }}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                  >
                    <option value="">Select a document...</option>
                    {availableDocuments.map((doc) => (
                      <option key={doc.document_id} value={doc.document_id}>
                        {doc.filename} ({(doc.content_length / 1024).toFixed(1)}
                        KB - {new Date(doc.upload_time).toLocaleDateString()})
                        {doc.is_chunked && ` [${doc.chunk_count} chunks]`}
                      </option>
                    ))}
                  </select>
                  {selectedDocument && (
                    <button
                      onClick={() =>
                        handleDeleteDocument(selectedDocument.document_id)
                      }
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything about your research topic... (Ctrl+Enter: Send with AI | Shift+Enter: Search only)
💡 Enable Chain of Thought for complex analysis and reasoning!
💡 Enable document inclusion above to reference uploaded files in your conversation!"
          style={{
            width: "100%",
            height: 80,
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
          disabled={llmLoading || searchLoading}
        />

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            onClick={handlePromptSubmit}
            disabled={llmLoading || !prompt.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: llmLoading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: llmLoading ? "not-allowed" : "pointer",
            }}
          >
            {llmLoading ? "Processing..." : "Send with AI (Ctrl+Enter)"}
          </button>
          <button
            onClick={handleStandaloneSearch}
            disabled={searchLoading || !prompt.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: searchLoading ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: searchLoading ? "not-allowed" : "pointer",
            }}
          >
            {searchLoading ? "Searching..." : "Search Only (Shift+Enter)"}
          </button>
        </div>

        {/* Error Messages */}
        {llmError && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#f8d7da",
              color: "#721c24",
              border: "1px solid #f5c6cb",
              borderRadius: "4px",
            }}
          >
            {llmError}
          </div>
        )}

        {searchError && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#f8d7da",
              color: "#721c24",
              border: "1px solid #f5c6cb",
              borderRadius: "4px",
            }}
          >
            {searchError}
          </div>
        )}
      </section>

      {/* ==================== DOCUMENT UPLOAD SECTION ==================== */}
      <section style={{ marginTop: 30 }}>
        <h2>📄 Document Upload & Management</h2>

        {/* NEW: Document chunking options */}
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: "#f8f9fa",
            borderRadius: 4,
            border: "1px solid #e9ecef",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
            Document Processing Options
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
                checked={enableChunking}
                onChange={(e) => setEnableChunking(e.target.checked)}
                style={{ marginRight: "4px" }}
              />
              Enable chunking for large documents
            </label>
            {enableChunking && (
              <label style={{ fontSize: "12px" }}>
                Chunk size:
                <select
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  style={{ marginLeft: "4px", padding: "2px" }}
                >
                  <option value={1000}>1000 chars</option>
                  <option value={2000}>2000 chars</option>
                  <option value={3000}>3000 chars</option>
                  <option value={4000}>4000 chars</option>
                </select>
              </label>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="file"
            onChange={handleFileChange}
            accept=".txt,.pdf,.docx,.md"
            style={{ flex: 1 }}
          />
          <button
            onClick={handleFileUpload}
            disabled={docLoading || !file}
            style={{
              padding: "8px 16px",
              backgroundColor: docLoading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: docLoading || !file ? "not-allowed" : "pointer",
            }}
          >
            {docLoading ? "Uploading..." : "Upload Document"}
          </button>
        </div>

        {docError && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "#f8d7da",
              color: "#721c24",
              border: "1px solid #f5c6cb",
              borderRadius: "4px",
            }}
          >
            {docError}
          </div>
        )}

        {docText && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: "4px",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0" }}>Document Preview:</h4>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "12px",
                margin: 0,
              }}
            >
              {docText.substring(0, 1000)}
              {docText.length > 1000 && "..."}
            </pre>
          </div>
        )}

        {/* Available Documents List */}
        {availableDocuments.length > 0 && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: "4px",
            }}
          >
            <h4 style={{ margin: "0 0 12px 0" }}>
              Available Documents ({availableDocuments.length}):
            </h4>
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {availableDocuments.map((doc) => (
                <div
                  key={doc.document_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px",
                    margin: "4px 0",
                    backgroundColor: "white",
                    borderRadius: "4px",
                    border: "1px solid #e9ecef",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      {doc.filename}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Size: {(doc.content_length / 1024).toFixed(1)}KB |
                      Uploaded: {new Date(doc.upload_time).toLocaleDateString()}
                      {doc.is_chunked && ` | Chunks: ${doc.chunk_count}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => {
                        setSelectedDocument(doc);
                        setIncludeDocument(true);
                      }}
                      style={{
                        padding: "4px 8px",
                        backgroundColor:
                          selectedDocument?.document_id === doc.document_id
                            ? "#28a745"
                            : "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      {selectedDocument?.document_id === doc.document_id
                        ? "Selected"
                        : "Select"}
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.document_id)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ==================== HELP SECTION ==================== */}
      <section style={{ marginTop: 30, fontSize: "12px", color: "#666" }}>
        <h3>💡 How to Use SynthesisTalk v1.3</h3>
        <ul style={{ paddingLeft: "20px" }}>
          <li>
            <strong>Chain of Thought:</strong> Enable for complex reasoning and
            step-by-step analysis
          </li>
          <li>
            <strong>Web Search:</strong> Check "Include web search" for
            real-time information
          </li>
          <li>
            <strong>Document Integration:</strong> Upload documents and include
            them in conversations
          </li>
          <li>
            <strong>Keyboard Shortcuts:</strong> Ctrl+Enter (AI response),
            Shift+Enter (search only)
          </li>
          <li>
            <strong>Conversation Management:</strong> Export/import
            conversations, switch between multiple threads
          </li>
          <li>
            <strong>Document Chunking:</strong> Large documents are
            automatically split for better processing
          </li>
          <li>
            <strong>Source Attribution:</strong> See which sources were used in
            responses
          </li>
        </ul>
      </section>
    </div>
  );
}

export default App;