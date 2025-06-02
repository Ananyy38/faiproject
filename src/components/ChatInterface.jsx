import React from "react";

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
}) {
  return (
    <div className="chat-interface">
      <style jsx>{`
        .chat-interface {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 0;
          height: calc(100vh - 120px);
          margin-top: 40px;
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

        /* Responsive Design */
        @media (max-width: 768px) {
          .chat-interface {
            border-radius: 0;
            height: 100vh;
            max-height: none;
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

              {/** If assistant message has attached metadata */}
              {message.role === "assistant" && (
                <div className="message-metadata">
                  {message.sources && message.sources.length > 0 && (
                    <div>Sources: {message.sources.join(", ")}</div>
                  )}
                  {message.reasoning_steps &&
                    message.reasoning_steps.length > 0 && (
                      <div>
                        Reasoning Steps: {message.reasoning_steps.length} steps
                        used
                      </div>
                    )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
