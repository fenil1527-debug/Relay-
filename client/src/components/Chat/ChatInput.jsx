import React, { useState, useRef, useEffect } from 'react';
import { IconSend, IconZap, IconAlert } from '../common/Icons.jsx';

export default function ChatInput({ onSendMessage, onStopTurn, isStreaming, disabled }) {
  const [content, setContent] = useState('');
  const [simulateMode, setSimulateMode] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!content.trim() || isStreaming || disabled) return;

    onSendMessage(content.trim(), simulateMode || null);
    setContent('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-wrapper">
      <div className="input-toolbar">
        <div className="simulation-control">
          <label htmlFor="sim-select" className="sim-label">
            <IconZap size={13} /> Simulation Mode:
          </label>
          <select
            id="sim-select"
            className="sim-select"
            value={simulateMode}
            onChange={(e) => setSimulateMode(e.target.value)}
            disabled={isStreaming}
          >
            <option value="">Normal Execution</option>
            <option value="rate_limit">Simulate 429 Rate Limit (Failover Test)</option>
            <option value="server_error">Simulate 500 Outage (Failover Test)</option>
            <option value="context_overflow">Simulate Context Overflow</option>
          </select>
        </div>

        {simulateMode && (
          <span className="badge badge-warning sim-alert-badge">
            <IconAlert size={12} style={{ marginRight: 4 }} />
            Will trigger automatic handoff
          </span>
        )}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask Relay to build code, create files, or solve a problem..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={disabled}
        />

        <div className="chat-actions">
          {isStreaming ? (
            <button
              type="button"
              className="btn btn-secondary stop-btn"
              onClick={onStopTurn}
              title="Stop turn stream"
            >
              <span className="stop-square"></span>
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary send-btn"
              disabled={!content.trim() || disabled}
              title="Send message (Enter)"
            >
              <IconSend size={16} />
              <span>Send</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
