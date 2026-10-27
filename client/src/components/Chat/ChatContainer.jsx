import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble.jsx';
import ToolCallCard from './ToolCallCard.jsx';
import { IconCpu, IconHandoff, IconAlert, IconSparkles } from '../common/Icons.jsx';

export default function ChatContainer({
  messages,
  streamingMessage,
  currentHandoff,
  failedAttempt,
  onFileClick,
  onSelectPrompt,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage, currentHandoff, failedAttempt]);

  return (
    <div className="chat-container">
      <div className="messages-scroll-area">
        {messages.length === 0 && !streamingMessage && (
          <div className="empty-chat-placeholder">
            <div className="empty-icon-wrapper">
              <IconSparkles size={36} />
            </div>
            <h3>Welcome to Relay</h3>
            <p>
              Your provider-neutral agent with seamless multi-model failover. Start by typing a prompt below.
            </p>
            <div className="suggested-prompts">
              <button
                type="button"
                className="suggestion-chip"
                onClick={() => onSelectPrompt && onSelectPrompt('Create an Express REST API for an e-commerce cart')}
                style={{ cursor: 'pointer', background: 'none', border: '1px solid var(--border-default)', textAlign: 'left', font: 'inherit' }}
              >
                "Create an Express REST API for an e-commerce cart"
              </button>
              <button
                type="button"
                className="suggestion-chip"
                onClick={() => onSelectPrompt && onSelectPrompt('Write a Python script that scrapes Hacker News')}
                style={{ cursor: 'pointer', background: 'none', border: '1px solid var(--border-default)', textAlign: 'left', font: 'inherit' }}
              >
                "Write a Python script that scrapes Hacker News"
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <MessageBubble key={msg._id || index} message={msg} onFileClick={onFileClick} />
        ))}

        {/* Failed attempt banner during active turn */}
        {failedAttempt && (
          <div className="alert-banner alert-warning animate-fade-in">
            <IconAlert size={16} />
            <div className="alert-content">
              <strong>Provider Attempt Failed:</strong> {failedAttempt.provider} encountered{' '}
              <code>{failedAttempt.errorClass || 'error'}</code>. Initiating automatic handoff...
            </div>
          </div>
        )}

        {/* Live handoff event banner */}
        {currentHandoff && (
          <div className="alert-banner alert-info animate-bounce-subtle">
            <IconHandoff size={16} />
            <div className="alert-content">
              <strong>Seamless Handoff:</strong> Switched from{' '}
              <code>{currentHandoff.fromProvider?.split(':')[0]}</code> →{' '}
              <code>{currentHandoff.toProvider?.split(':')[0]}</code>. Handoff packet transferred.
            </div>
          </div>
        )}

        {/* Real-time streaming assistant bubble */}
        {streamingMessage && (
          <div className="message-row assistant-row streaming-row">
            <div className="avatar-col">
              <div className="avatar avatar-assistant pulse-avatar">
                <IconCpu size={16} />
              </div>
            </div>
            <div className="message-content-col">
              <div className="message-header">
                <span className="author-name">Relay Agent</span>
                {streamingMessage.provider && (
                  <span className="badge provider-anthropic message-provider-badge">
                    {streamingMessage.provider.split(':')[0]}
                  </span>
                )}
                <span className="live-pill">
                  <span className="pulse-dot"></span> Generating...
                </span>
              </div>
              <div className="message-bubble">
                {streamingMessage.text && (
                  <div className="message-text">{streamingMessage.text}</div>
                )}
                {streamingMessage.toolCalls?.map((tc, idx) => (
                  <ToolCallCard
                    key={idx}
                    toolCall={tc}
                    result={tc.result}
                    isRunning={!tc.result}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
