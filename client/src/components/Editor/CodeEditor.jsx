import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { IconFile, IconCheck } from '../common/Icons.jsx';

export default function CodeEditor({ activeFile, onSaveContent, isSaving }) {
  const { theme } = useTheme();
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (activeFile) {
      setContent(activeFile.content || '');
      setIsDirty(false);
      setSaveSuccess(false);
    }
  }, [activeFile?.path, activeFile?.version, activeFile?.content]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && isDirty && !isSaving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, content, isDirty, isSaving]);

  if (!activeFile) {
    return (
      <div className="editor-empty-state">
        <IconFile size={44} className="empty-file-icon" />
        <h3>No file selected</h3>
        <p>Select a file from the workspace tree or ask Relay to generate code.</p>
      </div>
    );
  }

  const getLanguage = (path) => {
    if (!path) return 'plaintext';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.sql')) return 'sql';
    if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml';
    return 'plaintext';
  };

  const handleEditorChange = (value) => {
    setContent(value || '');
    setIsDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!activeFile) return;
    await onSaveContent(activeFile.path, content);
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="code-editor-container">
      <div className="editor-toolbar">
        <div className="editor-file-info">
          <IconFile size={15} />
          <span className="file-name">{activeFile.path}</span>
          {activeFile.version && (
            <span className="file-badge">v{activeFile.version}</span>
          )}
          {isDirty && <span className="dirty-indicator">● Unsaved changes</span>}
        </div>

        <div className="editor-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saveSuccess && (
            <span className="save-confirmed">
              <IconCheck size={14} /> Saved
            </span>
          )}
          <button
            className={`btn btn-sm ${isDirty ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            title="Save file (Ctrl+S)"
          >
            {isSaving ? 'Saving...' : 'Save File'}
          </button>
        </div>
      </div>

      <div className="editor-monaco-wrapper">
        <Editor
          height="100%"
          language={getLanguage(activeFile.path)}
          value={content}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          onChange={handleEditorChange}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 14, bottom: 14 },
            renderLineHighlight: 'all',
          }}
        />
      </div>
    </div>
  );
}
