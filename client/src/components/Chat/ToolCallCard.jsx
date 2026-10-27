import React, { useState } from 'react';
import { IconCode, IconFile, IconCheck, IconAlert, IconChevronDown, IconChevronRight } from '../common/Icons.jsx';

export default function ToolCallCard({ toolCall, result, isRunning, onFileClick }) {
  const [expanded, setExpanded] = useState(false);

  const getToolIcon = (name) => {
    switch (name) {
      case 'read_file':
      case 'write_file':
      case 'delete_file':
        return <IconFile size={14} />;
      default:
        return <IconCode size={14} />;
    }
  };

  const getTarget = (args) => {
    if (!args) return '';
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        return '';
      }
    }
    return args.path || args.pattern || '';
  };

  const targetPath = getTarget(toolCall.input || toolCall.args || toolCall.arguments);
  const toolName = toolCall.name || toolCall.tool;
  const toolArgs = toolCall.input || toolCall.args || toolCall.arguments || {};
  const isErr = result?.is_error || result?.isError;
  const toolOutput = result?.output !== undefined ? result.output : result?.content;

  return (
    <div className={`tool-call-card ${isRunning ? 'running' : isErr ? 'error' : 'success'}`}>
      <div className="tool-call-header" onClick={() => setExpanded(!expanded)}>
        <div className="tool-call-info">
          <span className="tool-badge">
            {getToolIcon(toolName)}
            <span className="tool-name">{toolName}</span>
          </span>
          {targetPath && (
            <span
              className="tool-target"
              onClick={(e) => {
                if (onFileClick) {
                  e.stopPropagation();
                  onFileClick(targetPath);
                }
              }}
              style={onFileClick ? { cursor: 'pointer', textDecoration: 'underline' } : undefined}
              title={onFileClick ? 'Click to open in editor' : undefined}
            >
              {targetPath}
            </span>
          )}
        </div>

        <div className="tool-call-status">
          {isRunning ? (
            <span className="status-indicator status-running">
              <span className="pulse-dot"></span> Executing...
            </span>
          ) : isErr ? (
            <span className="status-indicator status-error">
              <IconAlert size={14} /> Failed
            </span>
          ) : (
            <span className="status-indicator status-success">
              <IconCheck size={14} /> Complete
            </span>
          )}
          <span className="expand-chevron">
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="tool-call-body">
          <div className="tool-section">
            <span className="tool-section-title">Arguments:</span>
            <pre className="code-block">
              {typeof toolArgs === 'string'
                ? toolArgs
                : JSON.stringify(toolArgs, null, 2)}
            </pre>
          </div>

          {result && (
            <div className="tool-section">
              <span className="tool-section-title">Output:</span>
              <pre className={`code-block ${isErr ? 'output-error' : ''}`}>
                {typeof toolOutput === 'string'
                  ? toolOutput
                  : JSON.stringify(toolOutput, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
