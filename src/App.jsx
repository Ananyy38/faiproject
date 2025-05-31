import React, { useState } from "react";
import axios from "axios";

function App() {
  const [prompt, setPrompt] = useState("");
  const [llmResponse, setLLMResponse] = useState("");
  const [file, setFile] = useState(null);
  const [docText, setDocText] = useState("");

  // Loading and error states
  const [llmLoading, setLlmLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [docError, setDocError] = useState("");

  // Send prompt to /api/llm
  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;

    setLlmLoading(true);
    setLlmError("");
    setLLMResponse("");

    try {
      console.log("Sending LLM request:", { prompt });
      const res = await axios.post(
        "/api/llm",
        { prompt },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("LLM response received:", res.data);
      setLLMResponse(res.data.response);
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

  // Handle Enter key for prompt submission
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handlePromptSubmit();
    }
  };

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "sans-serif",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      <h1>SynthesisTalk</h1>

      <section style={{ marginTop: 20 }}>
        <h2>LLM Chat</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your prompt here... (Ctrl+Enter to send)"
          style={{
            width: "100%",
            height: 80,
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
          disabled={llmLoading}
        />
        <button
          onClick={handlePromptSubmit}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            backgroundColor: llmLoading ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: llmLoading ? "not-allowed" : "pointer",
          }}
          disabled={llmLoading || !prompt.trim()}
        >
          {llmLoading ? "Processing..." : "Send to LLM"}
        </button>

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

        {llmResponse && (
          <div style={{ marginTop: 12 }}>
            <h3>Response:</h3>
            <pre
              style={{
                padding: 8,
                background: "#f0f0f0",
                border: "1px solid #ddd",
                borderRadius: "4px",
                whiteSpace: "pre-wrap",
                overflow: "auto",
              }}
            >
              {llmResponse}
            </pre>
          </div>
        )}
      </section>

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
