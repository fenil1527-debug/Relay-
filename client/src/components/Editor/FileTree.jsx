import React from 'react';
import { IconFile, IconFolder, IconPlus } from '../common/Icons.jsx';

export default function FileTree({ files, activeFile, onSelectFile, onNewFile }) {
  const getFileExtension = (path) => {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop() : '';
  };

  const getFileBadgeColor = (ext) => {
    switch (ext) {
      case 'js':
      case 'jsx':
        return '#f7df1e';
      case 'ts':
      case 'tsx':
        return '#3178c6';
      case 'py':
        return '#3572A5';
      case 'json':
        return '#cb3837';
      case 'html':
        return '#e34c26';
      case 'css':
        return '#563d7c';
      case 'md':
        return '#083fa1';
      default:
        return 'var(--text-tertiary)';
    }
  };

  return (
    <div className="file-tree-container">
      <div className="file-tree-header">
        <div className="file-tree-title">
          <IconFolder size={14} />
          <span>Virtual Workspace</span>
        </div>
        <button
          className="btn-icon"
          onClick={onNewFile}
          title="Create virtual file"
        >
          <IconPlus size={14} />
        </button>
      </div>

      <div className="file-tree-list">
        {files.length === 0 ? (
          <div className="file-tree-empty">
            <span>No files created yet.</span>
            <small>Agent will write files here during turns.</small>
          </div>
        ) : (
          files.map((file) => {
            const ext = getFileExtension(file.path);
            const isSelected = activeFile?.path === file.path;

            return (
              <div
                key={file.path}
                className={`file-tree-item ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectFile(file)}
              >
                <span
                  className="file-type-indicator"
                  style={{ backgroundColor: getFileBadgeColor(ext) }}
                />
                <IconFile size={14} className="file-icon" />
                <span className="file-path" title={file.path}>
                  {file.path}
                </span>
                {file.version && (
                  <span className="file-version-tag">v{file.version}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
