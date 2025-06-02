import React from "react";

function ConversationManager({
  conversationId,
  allConversations,
  showConversationList,
  setShowConversationList,
  handleNewConversation,
  handleSwitchConversation,
  handleExportConversation,
  handleImportConversation,
  handleClearConversation,
  handleClearAllHistory,
  handleClearCache,
  file,
  docText,
  docLoading,
  docError,
  availableDocuments,
  selectedDocument,
  setSelectedDocument,
  includeDocument,
  setIncludeDocument,
  enableChunking,
  setEnableChunking,
  chunkSize,
  setChunkSize,
  handleFileChange,
  handleFileUpload,
  handleDeleteDocument,
}) {
  return (
    <section style={{ marginTop: 20, marginBottom: 20 }}>
      {/* Conversation Management Buttons */}
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
          disabled={!conversationId}
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
          Clear Current
        </button>
        <button
          onClick={handleClearAllHistory}
          style={{
            padding: "6px 12px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Clear All History
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

      {/* Conversation List Dropdown */}
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
          {allConversations.length === 0 ? (
            <div
              style={{ fontSize: "12px", color: "#666", fontStyle: "italic" }}
            >
              No conversations found. Start a new conversation to get started!
            </div>
          ) : (
            allConversations.map((conv) => (
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
                    {conv.title || conv.conversation_id}
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
            ))
          )}
        </div>
      )}

      {/* 📄 Document Upload & Management */}
      <section style={{ marginTop: 30 }}>
        <h2>📄 Document Upload & Management</h2>

        {/* Document Processing Options */}
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

        {/* File Input + Upload */}
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

        {/* Document Upload Error */}
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

        {/* Document Preview */}
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
              style={{ whiteSpace: "pre-wrap", fontSize: "12px", margin: 0 }}
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

      {/* 💡 Help Section */}
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
    </section>
  );
}

export default ConversationManager;
