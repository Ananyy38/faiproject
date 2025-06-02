import React from "react";

function ChatInterface({
  conversationId,
  conversationHistory,
  prompt,
  setPrompt,
  includeSearch,
  setIncludeSearch,
  searchResults,
  reasoningSteps,
  sourcesUsed,
  availableDocuments,
  selectedDocument,
  setSelectedDocument,
  includeDocument,
  setIncludeDocument,
  llmLoading,
  searchLoading,
  llmError,
  searchError,
  handlePromptSubmit,
  handleStandaloneSearch,
  handleKeyPress,
  handleDeleteDocument,
}) {
  return (
    <section style={{ marginTop: 20 }}>
      {/* Conversation ID & Message Count */}
      <div style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
        Conversation ID: {conversationId || "Not set"} | Messages:{" "}
        {conversationHistory.length}
      </div>

      {/* 🧠 Chain of Thought Reasoning (steps) */}
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

      {/* 📚 Sources Used */}
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
            <div key={index} style={{ fontSize: "12px", marginBottom: "2px" }}>
              • {source}
            </div>
          ))}
        </div>
      )}

      {/* Conversation History */}
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
                borderLeft: `4px solid ${
                  message.role === "user" ? "#2196f3" : "#4caf50"
                }`,
              }}
            >
              <strong>
                {message.role === "user" ? "You" : "SynthesisTalk"}:
              </strong>
              <div style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>
                {message.content}
              </div>

              {/* Show sources & reasoning steps for assistant */}
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

      {/* 🔍 Web Search Results */}
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

      {/* Include Web Search Checkbox */}
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

      {/* 📄 Document Integration (within chat) */}
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
                    const sel = availableDocuments.find(
                      (doc) => doc.document_id === e.target.value
                    );
                    setSelectedDocument(sel || null);
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
                      {doc.filename} ({(doc.content_length / 1024).toFixed(1)}KB
                      - {new Date(doc.upload_time).toLocaleDateString()})
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

      {/* 📝 Prompt Input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={`Ask me anything about your research topic... (Ctrl+Enter: Send with AI | Shift+Enter: Search only)
💡 Enable Chain of Thought for complex analysis and reasoning!
💡 Enable document inclusion above to reference uploaded files in your conversation!`}
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
  );
}

export default ChatInterface;
