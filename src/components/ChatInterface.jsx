import React, { useEffect, useRef } from "react";

function ChatInterface({
  conversationId,
  conversationHistory,
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
  docLoading,
  searchLoading,
  llmError,
  docError,
  searchError,
  handlePromptSubmit,
  handleStandaloneSearch,
  handleKeyPress,
  handleFilePicker,
  handleDeleteDocument,
  toolsMenuOpen,
  setToolsMenuOpen,
  enableChainOfThought,
  setEnableChainOfThought,
  prompt,
  setPrompt,
  handleTextareaChange,
  dragOver,
  setDragOver,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  file,
  setFile,
  enableSourceAttribution,
  setEnableSourceAttribution,
  reasoningDepth,
  setReasoningDepth,
  enableChunking,
  setEnableChunking,
  chunkSize,
  setChunkSize,
}) {
  const conversationFlowRef = useRef(null);
  const bottomRef = useRef(null); // <-- new ref for scrolling to bottom

  // Auto-scroll to bottom whenever conversationHistory changes
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationHistory]);

  return (
    <>
      <div className="chat-interface">
        <style jsx>{`
          .chat-interface {
            display: flex;
            flex-direction: column;
            flex: 1;
            padding: 0;
            height: calc(
              100vh - 200px
            ); /* Increased from 160px to 200px to account for larger input area */
            margin-top: 40px;
            margin-bottom: 40px; /* Increased from 20px to 40px */
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(128, 0, 32, 0.15);
            border-radius: 24px;
            overflow: hidden;
            font-family:
              "Inter",
              -apple-system,
              BlinkMacSystemFont,
              sans-serif;
            position: relative;
            box-shadow: 0 8px 32px rgba(128, 0, 32, 0.08);
            max-width: 883px;
            margin-left: auto;
            margin-right: auto;
            width: 100%;
          }

          .chat-interface::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(
              90deg,
              transparent,
              #800020,
              transparent
            );
            opacity: 0.6;
          }

          /* Chat content area */
          .chat-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }

          /* Chain of Thought panel */
          .reasoning-panel {
            background: linear-gradient(
              135deg,
              rgba(128, 0, 32, 0.08),
              rgba(128, 0, 32, 0.04)
            );
            border-bottom: 1px solid rgba(128, 0, 32, 0.1);
            padding: 1.25rem;
            animation: slideDown 0.3s ease-out;
          }

          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .reasoning-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
          }

          .brain-icon {
            font-size: 1.25rem;
            filter: drop-shadow(0 0 8px rgba(128, 0, 32, 0.6));
            animation: think 3s ease-in-out infinite;
            color: #800020;
          }

          @keyframes think {
            0%,
            100% {
              transform: scale(1) rotate(0deg);
            }
            25% {
              transform: scale(1.05) rotate(-2deg);
            }
            75% {
              transform: scale(1.05) rotate(2deg);
            }
          }

          .reasoning-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: #800020;
            margin: 0;
          }

          .reasoning-step {
            background: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(128, 0, 32, 0.2);
            border-radius: 12px;
            padding: 0.875rem;
            margin-bottom: 0.75rem;
            position: relative;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(128, 0, 32, 0.05);
          }

          .reasoning-step:hover {
            background: rgba(255, 255, 255, 0.85);
            border-color: rgba(128, 0, 32, 0.3);
            transform: translateY(-1px);
          }

          .reasoning-step::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, #800020, #a0002a);
            border-radius: 0 2px 2px 0;
          }

          .step-header {
            font-family: "JetBrains Mono", monospace;
            font-size: 0.7rem;
            color: #800020;
            font-weight: 600;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .step-content {
            font-size: 0.85rem;
            color: #2c1810;
            line-height: 1.4;
            margin-bottom: 0.5rem;
          }

          .step-sources {
            font-family: "JetBrains Mono", monospace;
            font-size: 0.7rem;
            color: #8b5a3c;
            font-style: italic;
          }

          /* Sources panel */
          .sources-panel {
            background: rgba(255, 255, 255, 0.5);
            border-bottom: 1px solid rgba(128, 0, 32, 0.1);
            padding: 1rem 1.25rem;
          }

          .sources-title {
            font-size: 0.8rem;
            font-weight: 600;
            color: #800020;
            margin: 0 0 0.75rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .source-item {
            font-size: 0.75rem;
            color: #8b5a3c;
            margin-bottom: 0.25rem;
            padding-left: 1rem;
            position: relative;
          }

          .source-item::before {
            content: "▸";
            position: absolute;
            left: 0;
            color: #800020;
            font-weight: bold;
          }

          /* Search results panel */
          .search-results {
            background: linear-gradient(
              135deg,
              rgba(255, 193, 7, 0.08),
              rgba(255, 193, 7, 0.04)
            );
            border-bottom: 1px solid rgba(255, 193, 7, 0.2);
            padding: 1.25rem;
          }

          .search-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
          }

          .search-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: #800020;
            margin: 0;
          }

          .search-result {
            background: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(255, 193, 7, 0.2);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 0.75rem;
            position: relative;
            box-shadow: 0 2px 8px rgba(255, 193, 7, 0.05);
            transition: all 0.2s ease;
          }

          .search-result:hover {
            background: rgba(255, 255, 255, 0.85);
            border-color: rgba(255, 193, 7, 0.3);
            transform: translateY(-1px);
          }

          .search-result::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, #ffc107, #ffb300);
            border-radius: 0 2px 2px 0;
          }

          .result-title {
            font-weight: 600;
            margin-bottom: 0.5rem;
          }

          .result-title a {
            color: #800020;
            text-decoration: none;
            transition: color 0.2s ease;
          }

          .result-title a:hover {
            color: #a0002a;
          }

          .result-description {
            font-size: 0.85rem;
            color: #2c1810;
            line-height: 1.4;
            margin-bottom: 0.5rem;
          }

          .result-url {
            font-family: "JetBrains Mono", monospace;
            font-size: 0.7rem;
            color: #8b5a3c;
          }

          /* Conversation History Flow */
          .conversation-flow {
            flex: 1;
            overflow-y: auto;
            padding: 0;
            scroll-behavior: smooth;
            padding-bottom: 120px; /* Increased from 20px to 120px for more breathing room */
          }

          .conversation-flow::-webkit-scrollbar {
            width: 6px;
          }

          .conversation-flow::-webkit-scrollbar-track {
            background: rgba(128, 0, 32, 0.05);
          }

          .conversation-flow::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #800020, #a0002a);
            border-radius: 3px;
          }

          .message {
            padding: 1.25rem 1.5rem;
            margin: 0;
            border-bottom: 1px solid rgba(128, 0, 32, 0.05);
            animation: messageSlide 0.4s ease-out;
            position: relative;
          }

          @keyframes messageSlide {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .message.user {
            background: rgba(128, 0, 32, 0.08);
          }

          .message.assistant {
            background: rgba(255, 255, 255, 0.6);
          }

          .message::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, #800020, #a0002a);
            opacity: 0;
            transition: opacity 0.3s ease;
          }

          .message.user::before {
            opacity: 1;
          }

          .message-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
          }

          .message-avatar {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: 600;
            border: 1px solid rgba(128, 0, 32, 0.2);
          }

          .message-avatar.user {
            background: linear-gradient(135deg, #800020, #a0002a);
            color: white;
          }

          .message-avatar.assistant {
            background: rgba(255, 255, 255, 0.8);
            color: #800020;
          }

          .message-sender {
            font-weight: 600;
            font-size: 0.85rem;
            color: #800020;
          }

          .message-content {
            font-size: 0.9rem;
            line-height: 1.6;
            color: #2c1810;
            white-space: pre-wrap;
            word-wrap: break-word;
          }

          .message-metadata {
            margin-top: 0.75rem;
            padding-top: 0.75rem;
            border-top: 1px solid rgba(128, 0, 32, 0.1);
            font-family: "JetBrains Mono", monospace;
            font-size: 0.7rem;
            color: #8b5a3c;
          }

          /* Input Area Styles */
          .central-input-container {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            max-width: 883px;
            z-index: 1000;
            padding: 0 20px;
          }

          .central-input-container.drag-over {
            background: rgba(128, 0, 32, 0.05);
            border-radius: 16px;
          }

          .document-preview {
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(128, 0, 32, 0.2);
            border-radius: 12px 12px 0 0;
            padding: 8px 16px;
            font-size: 0.85rem;
            color: #800020;
            display: flex;
            align-items: center;
            justify-content: space-between;
            backdrop-filter: blur(10px);
          }

          .document-actions-inline {
            display: flex;
            gap: 4px;
          }

          .document-action-inline {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 0.8rem;
            opacity: 0.7;
            transition: opacity 0.2s ease;
          }

          .document-action-inline:hover {
            opacity: 1;
          }

          .central-input-container {
            position: fixed;
            bottom: 30px; /* Increased from 20px to 30px for more margin from bottom */
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            max-width: 883px;
            z-index: 1000;
            padding: 0 20px;
          }

          /* 3. Add more visual separation with enhanced input wrapper */
          .chat-input-wrapper {
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(128, 0, 32, 0.2);
            border-radius: 16px;
            padding: 12px;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(128, 0, 32, 0.1);
            transition: all 0.2s ease;
            margin-top: 20px; /* Add top margin for additional separation */
          }

          .chat-input-wrapper:focus-within {
            border-color: rgba(128, 0, 32, 0.4);
            box-shadow: 0 8px 32px rgba(128, 0, 32, 0.15);
          }

          .chat-input {
            width: 100%;
            border: none;
            outline: none;
            background: transparent;
            font-size: 1rem;
            font-family: inherit;
            color: #2c1810;
            line-height: 1.5;
            resize: none;
          }

          .chat-input::placeholder {
            color: #8b5a3c;
            opacity: 0.7;
          }

          .chat-input-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
            gap: 8px;
          }

          .chat-input-controls-left,
          .chat-input-controls-right {
            display: flex;
            gap: 8px;
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

          .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          .error-message {
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.2);
            border-radius: 8px;
            color: #dc3545;
            font-size: 0.85rem;
          }

          /* Tools Menu */
          .tools-menu {
            position: absolute;
            bottom: 80px; /* adjust if you need more/less vertical gap */
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(128, 0, 32, 0.2);
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(128, 0, 32, 0.1);
            padding: 0;
            z-index: 1001;
            width: 800px;
          }

          .tools-menu h4 {
            margin: 0 0 8px 0;
            font-size: 0.9rem;
            color: #800020;
            padding: 12px;
            border-bottom: 1px solid rgba(128, 0, 32, 0.2);
          }

          .tools-menu-content {
            max-height: 400px;
            overflow-y: auto;
            padding: 0 12px 12px;
          }

          .tool-section {
            margin-bottom: 12px;
          }

          .tool-section h4 {
            margin: 0 0 6px 0;
            font-size: 0.85rem;
            font-weight: 500;
            color: #2c1810;
          }

          .tool-option {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
            font-size: 0.85rem;
            color: #2c1810;
            cursor: pointer;
          }

          .tool-option input[type="checkbox"] {
            margin: 0;
          }

          .tool-option input[type="range"] {
            flex: 1;
            margin: 0 6px;
          }

          .tool-option span {
            min-width: 20px;
            text-align: right;
          }

          /* Responsive Design */
          @media (max-width: 768px) {
            .chat-interface {
              border-radius: 0;
              height: calc(100vh - 180px); /* Account for mobile prompt box */
              max-width: none;
              margin-left: 0;
              margin-right: 0;
              margin-bottom: 120px; /* Space for mobile prompt box + gap */
            }

            .message {
              padding: 1rem;
            }
          }

          /* Accessibility */
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }

          /* High contrast mode support */
          @media (prefers-contrast: high) {
            .message-content,
            .step-content,
            .result-description {
              color: #2c1810;
            }

            .reasoning-step,
            .search-result,
            .document-section {
              border-width: 2px;
              background: rgba(255, 255, 255, 1);
            }
          }

          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
        `}</style>

        <div className="chat-content">
          {/* Chain of Thought Reasoning */}
          {reasoningSteps && reasoningSteps.length > 0 && (
            <div
              className="reasoning-panel"
              role="region"
              aria-label="Chain of thought reasoning"
            >
              <div className="reasoning-header">
                <span className="brain-icon" aria-hidden="true">
                  🧠
                </span>
                <h3 className="reasoning-title">Chain of Thought Reasoning</h3>
              </div>
              {reasoningSteps.map((step, index) => (
                <div key={index} className="reasoning-step">
                  <div className="step-header">
                    Step {step.step_number}: {step.description} ({step.action})
                  </div>
                  <div className="step-content">{step.content}</div>
                  {step.sources_used && (
                    <div className="step-sources">
                      Sources: {step.sources_used.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sources Used */}
          {sourcesUsed && sourcesUsed.length > 0 && (
            <div
              className="sources-panel"
              role="region"
              aria-label="Sources used"
            >
              <h4 className="sources-title">
                <span aria-hidden="true">📚</span> Sources Used
              </h4>
              {sourcesUsed.map((source, index) => (
                <div key={index} className="source-item">
                  {source}
                </div>
              ))}
            </div>
          )}

          {/* Conversation History */}
          <div
            ref={conversationFlowRef}
            className="conversation-flow"
            role="log"
            aria-label="Conversation history"
          >
            {conversationHistory.map((message, index) => (
              <div
                key={index}
                className={`message ${message.role}`}
                role="article"
                aria-label={`Message from ${
                  message.role === "user" ? "you" : "SynthesisTalk"
                }`}
              >
                <div className="message-header">
                  <div className={`message-avatar ${message.role}`}>
                    {message.role === "user" ? "You" : "ST"}
                  </div>
                  <div className="message-sender">
                    {message.role === "user" ? "You" : "SynthesisTalk"}
                  </div>
                </div>
                <div className="message-content">{message.content}</div>

                {/** If assistant message has attached metadata */}
                {message.role === "assistant" && (
                  <div className="message-metadata">
                    {message.sources && message.sources.length > 0 && (
                      <div>Sources: {message.sources.join(", ")}</div>
                    )}
                    {message.reasoning_steps &&
                      message.reasoning_steps.length > 0 && (
                        <div>
                          Reasoning Steps: {message.reasoning_steps.length}{" "}
                          steps used
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}

            {/* Invisible “anchor” at the bottom for scrolling */}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      <div
        className={`central-input-container ${dragOver ? "drag-over" : ""}`}
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
                className="control-btn primary"
                onClick={() => {
                  handlePromptSubmit();
                  // No need to manually scroll here—our useEffect on conversationHistory will handle it.
                }}
                disabled={!prompt.trim() || llmLoading || docLoading}
                title="Send Message"
              >
                {llmLoading ? <div className="loading-spinner"></div> : "↑"}
              </button>
            </div>
          </div>

          {llmError && <div className="error-message">{llmError}</div>}
          {docError && <div className="error-message">{docError}</div>}
          {searchError && <div className="error-message">{searchError}</div>}
        </div>

        {/* Tools Menu */}
        {toolsMenuOpen && (
          <div className="tools-menu" role="dialog" aria-label="Tools Menu">
            <h4>Configuration</h4>
            <div className="tools-menu-content">
              <div className="tool-section">
                <h4>Search Settings</h4>
                <label className="tool-option">
                  <input
                    type="checkbox"
                    checked={includeSearch}
                    onChange={(e) => setIncludeSearch(e.target.checked)}
                  />
                  Enable Web Search
                </label>
              </div>

              <div className="tool-section">
                <h4>Document Settings</h4>
                <label className="tool-option">
                  <input
                    type="checkbox"
                    checked={includeDocument}
                    onChange={(e) => setIncludeDocument(e.target.checked)}
                  />
                  Enable Document Search
                </label>
                {includeDocument && (
                  <div className="tool-subsection">
                    <label className="tool-option">
                      <input
                        type="checkbox"
                        checked={enableSourceAttribution}
                        onChange={(e) =>
                          setEnableSourceAttribution(e.target.checked)
                        }
                      />
                      Enable Source Attribution
                    </label>
                  </div>
                )}
              </div>

              <div className="tool-section">
                <h4>Chain of Thought</h4>
                <label className="tool-option">
                  <input
                    type="checkbox"
                    checked={enableChainOfThought}
                    onChange={(e) => setEnableChainOfThought(e.target.checked)}
                  />
                  Enable Chain of Thought
                </label>
                {enableChainOfThought && (
                  <div className="tool-subsection">
                    <label className="tool-option">
                      Reasoning Depth:
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={reasoningDepth}
                        onChange={(e) =>
                          setReasoningDepth(parseInt(e.target.value))
                        }
                      />
                      <span>{reasoningDepth}</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="tool-section">
                <h4>Advanced Document</h4>
                <label className="tool-option">
                  <input
                    type="checkbox"
                    checked={enableChunking}
                    onChange={(e) => setEnableChunking(e.target.checked)}
                  />
                  Enable Document Chunking
                </label>
                {enableChunking && (
                  <div className="tool-subsection">
                    <label className="tool-option">
                      Chunk Size:
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="500"
                        value={chunkSize}
                        onChange={(e) => setChunkSize(parseInt(e.target.value))}
                      />
                      <span>{chunkSize}</span>
                    </label>
                  </div>
                )}
              </div>

              {availableDocuments.length > 0 && (
                <div className="tool-section">
                  <h4>Available Documents</h4>
                  <select
                    value={selectedDocument?.document_id || ""}
                    onChange={(e) => {
                      const doc = availableDocuments.find(
                        (d) => d.document_id === e.target.value
                      );
                      setSelectedDocument(doc);
                    }}
                  >
                    <option value="">-- Select Document --</option>
                    {availableDocuments.map((doc) => (
                      <option key={doc.document_id} value={doc.document_id}>
                        {doc.filename}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="tools-close-btn"
                onClick={() => setToolsMenuOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ChatInterface;
