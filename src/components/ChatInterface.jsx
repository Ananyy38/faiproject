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
    <div className="chat-interface">
      <style jsx>{`
        .chat-interface {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-height: 800px;
          background: rgba(
            255,
            255,
            255,
            0.85
          ); /* light cream with transparency */
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
        }

        .chat-interface::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #800020, transparent);
          opacity: 0.6;
        }

        .conversation-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(128, 0, 32, 0.1);
          background: linear-gradient(
            135deg,
            #800020 0%,
            #a0002a 50%,
            #c41e3a 100%
          );
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 60px;
        }

        .conversation-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .conversation-status {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #00ff88, #00cc6a);
          box-shadow: 0 0 12px rgba(0, 255, 136, 0.4);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .conversation-meta {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.2;
        }

        .message-count {
          color: rgba(255, 255, 255, 0.95);
          font-weight: 600;
        }

        .chat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .reasoning-panel {
          background: linear-gradient(
            135deg,
            rgba(128, 0, 32, 0.08),
            rgba(128, 0, 32, 0.04)
          );
          border-bottom: 1px solid rgba(128, 0, 32, 0.1);
          padding: 1.25rem;
          margin: 0;
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

        .conversation-flow {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          scroll-behavior: smooth;
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
          transition: all 0.2s ease;
          position: relative;
          box-shadow: 0 2px 8px rgba(255, 193, 7, 0.05);
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

        .input-section {
          padding: 1.5rem;
          border-top: 1px solid rgba(128, 0, 32, 0.1);
          background: rgba(255, 255, 255, 0.9);
        }

        .controls-row {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .modern-checkbox {
          position: relative;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .modern-checkbox input {
          opacity: 0;
          position: absolute;
          cursor: pointer;
        }

        .checkbox-custom {
          position: absolute;
          top: 0;
          left: 0;
          height: 18px;
          width: 18px;
          background: rgba(255, 255, 255, 0.9);
          border: 2px solid rgba(128, 0, 32, 0.4);
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .modern-checkbox:hover .checkbox-custom {
          border-color: rgba(128, 0, 32, 0.6);
          background: rgba(255, 255, 255, 1);
        }

        .modern-checkbox input:checked ~ .checkbox-custom {
          background: linear-gradient(135deg, #800020, #a0002a);
          border-color: #800020;
        }

        .checkbox-custom:after {
          content: "";
          position: absolute;
          display: none;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .modern-checkbox input:checked ~ .checkbox-custom:after {
          display: block;
        }

        .control-label {
          font-size: 0.85rem;
          color: #800020;
          font-weight: 500;
          cursor: pointer;
          user-select: none;
        }

        .document-section {
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(128, 0, 32, 0.2);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(128, 0, 32, 0.05);
        }

        .document-controls {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-top: 0.75rem;
        }

        .modern-select {
          flex: 1;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(128, 0, 32, 0.3);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          color: #2c1810;
          font-size: 0.8rem;
          font-family: "Inter", sans-serif;
          transition: all 0.2s ease;
        }

        .modern-select:focus {
          outline: none;
          border-color: #800020;
          box-shadow: 0 0 0 3px rgba(128, 0, 32, 0.15);
          background: rgba(255, 255, 255, 1);
        }

        .modern-select option {
          background: #faf8f5;
          color: #2c1810;
        }

        .delete-btn {
          padding: 0.5rem 0.75rem;
          background: linear-gradient(135deg, #dc3545, #c82333);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .delete-btn:hover {
          background: linear-gradient(135deg, #c82333, #bd2130);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        }

        .input-container {
          position: relative;
          margin-bottom: 1rem;
        }

        .prompt-textarea {
          width: 100%;
          min-height: 100px;
          max-height: 200px;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.8);
          border: 2px solid rgba(128, 0, 32, 0.2);
          border-radius: 16px;
          color: #2c1810;
          font-size: 0.9rem;
          font-family: "Inter", sans-serif;
          line-height: 1.5;
          resize: vertical;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .prompt-textarea:focus {
          outline: none;
          border-color: #800020;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 0 4px rgba(128, 0, 32, 0.1);
        }

        .prompt-textarea::placeholder {
          color: rgba(44, 24, 16, 0.4);
          font-style: italic;
        }

        .prompt-textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .input-hint {
          position: absolute;
          bottom: 0.75rem;
          right: 1rem;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.7rem;
          color: rgba(44, 24, 16, 0.4);
          pointer-events: none;
        }

        .action-buttons {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }

        .action-btn.primary {
          background: linear-gradient(135deg, #800020, #a0002a);
          color: white;
          box-shadow: 0 4px 16px rgba(128, 0, 32, 0.3);
        }

        .action-btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #a0002a, #c41e3a);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(128, 0, 32, 0.4);
        }

        .action-btn.secondary {
          background: linear-gradient(135deg, #28a745, #20c997);
          color: white;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }

        .action-btn.secondary:hover:not(:disabled) {
          background: linear-gradient(135deg, #20c997, #17a2b8);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        }

        .btn-loading {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-message {
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid rgba(220, 53, 69, 0.3);
          border-radius: 12px;
          padding: 1rem;
          margin-top: 1rem;
          color: #dc3545;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          animation: errorSlide 0.3s ease-out;
        }

        @keyframes errorSlide {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .chat-interface {
            border-radius: 0;
            height: 100vh;
            max-height: none;
          }

          .conversation-header {
            padding: 1rem;
          }

          .message {
            padding: 1rem;
          }

          .input-section {
            padding: 1rem;
          }

          .controls-row {
            flex-direction: column;
            gap: 1rem;
          }

          .action-buttons {
            flex-direction: column;
          }

          .action-btn {
            justify-content: center;
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
      `}</style>

      {/* Conversation Header */}
      <div className="conversation-header">
        <div className="conversation-info">
          <div
            className="conversation-status"
            aria-label="Conversation active"
          ></div>
          <div className="conversation-meta">
            <div>ID: {conversationId || "Not set"}</div>
            <div>
              Messages:{" "}
              <span className="message-count">
                {conversationHistory.length}
              </span>
            </div>
          </div>
        </div>
      </div>

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

        {/* Web Search Results */}
        {searchResults && (
          <div
            className="search-results"
            role="region"
            aria-label="Web search results"
          >
            <div className="search-header">
              <span aria-hidden="true">🔍</span>
              <h3 className="search-title">Web Search Results</h3>
            </div>
            {searchResults.map((result, index) => (
              <div key={index} className="search-result">
                <div className="result-title">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Search result: ${result.title}`}
                  >
                    {result.title}
                  </a>
                </div>
                <div className="result-description">{result.description}</div>
                <div className="result-url">{result.url}</div>
              </div>
            ))}
          </div>
        )}

        {/* Conversation History */}
        <div
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

              {/* Message metadata for assistant */}
              {message.role === "assistant" &&
                (message.sources || message.reasoning_steps) && (
                  <div className="message-metadata">
                    {message.sources && (
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
        </div>
      </div>

      {/* Input Section */}
      <div className="input-section">
        {/* Controls */}
        <div className="controls-row">
          <div className="control-group">
            <label className="modern-checkbox">
              <input
                type="checkbox"
                checked={includeSearch}
                onChange={(e) => setIncludeSearch(e.target.checked)}
                aria-describedby="search-help"
              />
              <span className="checkbox-custom"></span>
            </label>
            <label htmlFor="include-search" className="control-label">
              Include web search in response
            </label>
            <span id="search-help" className="sr-only">
              When enabled, web search results will be included with AI
              responses
            </span>
          </div>
        </div>

        {/* Document Integration */}
        {availableDocuments.length > 0 && (
          <div className="document-section">
            <div className="control-group">
              <label className="modern-checkbox">
                <input
                  type="checkbox"
                  checked={includeDocument}
                  onChange={(e) => setIncludeDocument(e.target.checked)}
                  aria-describedby="document-help"
                />
                <span className="checkbox-custom"></span>
              </label>
              <label className="control-label">
                Include document content in conversation
              </label>
              <span id="document-help" className="sr-only">
                When enabled, selected document content will be included in the
                conversation context
              </span>
            </div>

            {includeDocument && (
              <div className="document-controls">
                <select
                  value={selectedDocument?.document_id || ""}
                  onChange={(e) => {
                    const sel = availableDocuments.find(
                      (doc) => doc.document_id === e.target.value
                    );
                    setSelectedDocument(sel || null);
                  }}
                  className="modern-select"
                  aria-label="Select document to include"
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
                    className="delete-btn"
                    onClick={() =>
                      handleDeleteDocument(selectedDocument.document_id)
                    }
                  >
                    Delete Document
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Prompt Input */}
        <div className="input-container">
          <textarea
            className="prompt-textarea"
            placeholder="Type your message..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={llmLoading || searchLoading}
            aria-label="Chat prompt input"
          ></textarea>
          <div className="input-hint">Press Enter to submit</div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className="action-btn primary"
            onClick={handlePromptSubmit}
            disabled={!prompt.trim() || llmLoading || searchLoading}
            aria-label="Submit prompt"
          >
            {llmLoading ? (
              <>
                <span className="btn-loading" aria-hidden="true"></span>{" "}
                Sending...
              </>
            ) : (
              "Send"
            )}
          </button>
          <button
            className="action-btn secondary"
            onClick={handleStandaloneSearch}
            disabled={!prompt.trim() || searchLoading}
            aria-label="Standalone search"
          >
            {searchLoading ? (
              <>
                <span className="btn-loading" aria-hidden="true"></span>{" "}
                Searching...
              </>
            ) : (
              "Search"
            )}
          </button>
        </div>

        {/* Error Messages */}
        {(llmError || searchError) && (
          <div className="error-message" role="alert" aria-live="assertive">
            {llmError && <div>Error: {llmError}</div>}
            {searchError && <div>Error: {searchError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatInterface;
