import React from 'react';
import { IconUser, IconBot, IconCpu, IconHandoff, IconSparkles } from '../common/Icons.jsx';
import ToolCallCard from './ToolCallCard.jsx';

export default function MessageBubble({ message, onFileClick }) {
  const isUser = message.role === 'user';

  const getProviderClass = (provider) => {
    if (!provider) return '';
    if (provider.includes('anthropic') || provider.includes('claude')) return 'provider-anthropic';
    if (provider.includes('openai') || provider.includes('gpt')) return 'provider-openai';
    if (provider.includes('groq')) return 'provider-groq';
    return '';
  };

  const formatProviderLabel = (provider) => {
    if (!provider) return '';
    const parts = provider.split(':');
    return parts.length > 1 ? parts[1] : parts[0];
  };

  // Group tool calls with their corresponding results
  const renderBlocks = () => {
    if (!message.blocks || !message.blocks.length) {
      return <div className="text-muted">No content</div>;
    }

    const elements = [];
    const blocks = message.blocks;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (block.type === 'text') {
        elements.push(
          <div key={`text-${i}`} className="message-text">
            {block.text}
          </div>
        );
      } else if (block.type === 'reasoning') {
        elements.push(
          <details key={`reasoning-${i}`} className="reasoning-accordion">
            <summary className="reasoning-summary">
              <IconSparkles size={14} /> Agent Reasoning
            </summary>
            <div className="reasoning-content">{block.text}</div>
          </details>
        );
      } else if (block.type === 'tool_call' || block.type === 'tool_use') {
        const callId = block.id || block.tool_use_id;
        // Find matching tool_result
        const resultBlock = blocks.find(
          (b) =>
            b.type === 'tool_result' &&
            (b.toolCallId === callId || b.tool_use_id === callId || b.id === callId)
        );

        elements.push(
          <ToolCallCard
            key={`tool-${callId || i}`}
            toolCall={block}
            result={resultBlock}
            isRunning={!resultBlock}
            onFileClick={onFileClick}
          />
        );
      } else if (block.type === 'tool_result') {
        // Already handled above with tool_call
      }
    }

    return elements;
  };

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
      <div className="avatar-col">
        <div className={`avatar ${isUser ? 'avatar-user' : 'avatar-assistant'}`}>
          {isUser ? <IconUser size={16} /> : <IconBot size={16} />}
        </div>
      </div>

      <div className="message-content-col">
        <div className="message-header">
          <span className="author-name">{isUser ? 'You' : 'Relay Agent'}</span>

          {!isUser && message.provider && (
            <span className={`badge ${getProviderClass(message.provider)} message-provider-badge`}>
              <IconCpu size={12} style={{ marginRight: 4 }} />
              {formatProviderLabel(message.provider)}
            </span>
          )}

          {message.handoff && (
            <span className="badge badge-warning handoff-badge">
              <IconHandoff size={12} style={{ marginRight: 4 }} />
              Handoff: {message.handoff.fromProvider?.split(':')[0]} → {message.handoff.toProvider?.split(':')[0]}
            </span>
          )}

          {message.usage && (
            <span className="token-usage-tag">
              {message.usage.tokensIn ? `${message.usage.tokensIn} in / ` : ''}
              {message.usage.tokensOut ? `${message.usage.tokensOut} out` : ''}
            </span>
          )}
        </div>

        <div className="message-bubble">{renderBlocks()}</div>
      </div>
    </div>
  );
}
