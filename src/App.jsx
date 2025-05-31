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

    try {
      // Get document content if a document is selected and includeDocument is true
      let documentContext = null;
      if (includeDocument && selectedDocument) {
        documentContext = await getDocumentContent(selectedDocument.id);
      }

      console.log("Sending LLM request:", {
        prompt,
        conversationId,
        includeSearch,
        includeDocument,
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
      <h1>SynthesisTalk v1.1 - With Web Search</h1>

      {/* ==================== RESEARCH CONVERSATION SECTION ==================== */}
      <section style={{ marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2>Research Conversation</h2>
          <div>
            <button
              onClick={handleNewConversation}
              style={{
                padding: "6px 12px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: 8,
              }}
            >
              New Conversation
            </button>
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
          </div>
        </div>

        <div style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
          Conversation ID: {conversationId} | Messages:{" "}
          {conversationHistory.length}
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
                <select
                  value={selectedDocument?.id || ""}
                  onChange={(e) => {
                    const selected = availableDocuments.find(
                      (doc) => doc.id === e.target.value
                    );
                    setSelectedDocument(selected || null);
                  }}
                  style={{
                    width: "100%",
                    padding: "4px 8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  <option value="">Select a document...</option>
                  {availableDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename} ({(doc.content_length / 1024).toFixed(1)}KB
                      - {new Date(doc.upload_time).toLocaleDateString()})
                    </option>
                  ))}
                </select>
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
        <div style={{ marginTop: 8, display: "flex", gap: "8px" }}>
          <button
            onClick={handlePromptSubmit}
            style={{
              padding: "8px 16px",
              backgroundColor: llmLoading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: llmLoading ? "not-allowed" : "pointer",
            }}
            disabled={llmLoading || !prompt.trim()}
          >
            {llmLoading ? "Processing..." : "Send Message"}
          </button>

          <button
            onClick={handleStandaloneSearch}
            style={{
              padding: "8px 16px",
              backgroundColor: searchLoading ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: searchLoading ? "not-allowed" : "pointer",
            }}
            disabled={searchLoading || !prompt.trim()}
          >
            {searchLoading ? "Searching..." : "🔍 Search Web"}
          </button>
        </div>

        {/* Error Messages */}
        {llmError && (
          <div
            style={{
              marginTop: 12,
              padding: 8,
              background: "#ffebee",
              color: "#c62828",
              border: "1px solid #ef9a9a",
              borderRadius: "4px",
            }}
          >
            <strong>Error:</strong> {llmError}
          </div>
        )}

        {searchError && (
          <div
            style={{
              marginTop: 12,
              padding: 8,
              background: "#ffebee",
              color: "#c62828",
              border: "1px solid #ef9a9a",
              borderRadius: "4px",
            }}
          >
            <strong>Search Error:</strong> {searchError}
          </div>
        )}
      </section>

      {/* ==================== DOCUMENT UPLOAD SECTION ==================== */}
      <section style={{ marginTop: 24 }}>
        <h2>Document Upload</h2>
        <div style={{ marginBottom: "8px" }}>
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.txt,.doc,.docx"
            disabled={docLoading}
          />
          <button
            onClick={handleFileUpload}
            style={{
              marginLeft: 8,
              padding: "6px 12px",
              backgroundColor: docLoading ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: docLoading ? "not-allowed" : "pointer",
            }}
            disabled={docLoading || !file}
          >
            {docLoading ? "Processing..." : "Upload & Extract"}
          </button>
        </div>

        {file && (
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}

        {docError && (
          <div
            style={{
              marginTop: 12,
              padding: 8,
              background: "#ffebee",
              color: "#c62828",
              border: "1px solid #ef9a9a",
              borderRadius: "4px",
            }}
          >
            <strong>Error:</strong> {docError}
          </div>
        )}

        {docText && (
          <div style={{ marginTop: 12 }}>
            <h3>Extracted Text:</h3>
            <pre
              style={{
                padding: 8,
                background: "#f0f0f0",
                border: "1px solid #ddd",
                borderRadius: "4px",
                whiteSpace: "pre-wrap",
                maxHeight: "400px",
                overflow: "auto",
              }}
            >
              {docText}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
