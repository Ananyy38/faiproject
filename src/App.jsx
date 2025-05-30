import React, { useState } from "react";
import axios from "axios";

function App() {
  const [prompt, setPrompt] = useState("");
  const [llmResponse, setLLMResponse] = useState("");
  const [file, setFile] = useState(null);
  const [docText, setDocText] = useState("");

  // Send prompt to /api/llm
  const handlePromptSubmit = async () => {
    try {
      const res = await axios.post("/api/llm", { prompt });
      setLLMResponse(res.data.response);
    } catch (err) {
      console.error(err);
    }
  };

  // Store selected file
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Upload file to /api/documents
  const handleFileUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("/api/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocText(res.data.text);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>SynthesisTalk</h1>

      <section style={{ marginTop: 20 }}>
        <h2>LLM Chat</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your prompt here..."
          style={{ width: "100%", height: 80 }}
        />
        <button onClick={handlePromptSubmit} style={{ marginTop: 8 }}>
          Send to LLM
        </button>
        {llmResponse && (
          <pre style={{ marginTop: 12, padding: 8, background: "#f0f0f0" }}>
            {llmResponse}
          </pre>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Document Upload</h2>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleFileUpload} style={{ marginLeft: 8 }}>
          Upload & Extract
        </button>
        {docText && (
          <pre
            style={{
              marginTop: 12,
              padding: 8,
              background: "#f0f0f0",
              whiteSpace: "pre-wrap",
            }}
          >
            {docText}
          </pre>
        )}
      </section>
    </div>
  );
}

export default App;
