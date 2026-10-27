import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi, filesApi, streamTurn } from '../services/api.js';
import Navbar from '../components/Layout/Navbar.jsx';
import ChatContainer from '../components/Chat/ChatContainer.jsx';
import ChatInput from '../components/Chat/ChatInput.jsx';
import FileTree from '../components/Editor/FileTree.jsx';
import CodeEditor from '../components/Editor/CodeEditor.jsx';
import LedgerPanel from '../components/Ledger/LedgerPanel.jsx';
import HandoffTimeline from '../components/Timeline/HandoffTimeline.jsx';
import { IconLedger, IconHandoff, IconCode, IconAlert } from '../components/common/Icons.jsx';

export default function SessionPage() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  // Session state
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [files, setFiles] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Right panel tab
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'timeline'

  // Turn streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const [currentHandoff, setCurrentHandoff] = useState(null);
  const [failedAttempt, setFailedAttempt] = useState(null);
  const [isSavingFile, setIsSavingFile] = useState(false);

  const abortStreamRef = useRef(null);

  useEffect(() => {
    loadSession();
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const data = await sessionsApi.get(sessionId);
      setSession(data.session);
      setMessages(data.messages || []);
      setLedgerEntries(data.ledger || []);
      setHandoffs(data.handoffs || []);
      setFiles(data.files || []);
      setAttempts(data.attempts || []);

      // If we have files and no active file, select the first one
      if (data.files?.length && !activeFile) {
        loadFileContent(data.files[0].path);
      }
    } catch (err) {
      if (err.status === 404) {
        navigate('/dashboard');
      } else {
        setError('Failed to load session details');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (path) => {
    try {
      const file = await filesApi.get(sessionId, path);
      setActiveFile(file);
    } catch (err) {
      console.error('Failed to load file content:', err);
    }
  };

  const handleSaveFileContent = async (path, content) => {
    try {
      setIsSavingFile(true);
      const updated = await filesApi.save(sessionId, path, content);
      const fileData = updated.file || updated;
      const newVersion = fileData.version || 1;

      setActiveFile({
        path,
        content,
        version: newVersion,
        updatedAt: fileData.updatedAt || new Date().toISOString(),
      });

      // Update in file list or append if new
      setFiles((prev) => {
        const exists = prev.some((f) => f.path === path);
        if (exists) {
          return prev.map((f) => (f.path === path ? { ...f, version: newVersion } : f));
        }
        return [...prev, { path, version: newVersion, updatedAt: fileData.updatedAt || new Date().toISOString() }];
      });
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleNewFile = async () => {
    const filename = prompt('Enter new file path (e.g. src/index.js):');
    if (!filename) return;

    const trimmed = filename.trim();
    const initialContent = '// New file created in virtual workspace\n';
    await handleSaveFileContent(trimmed, initialContent);
    await loadFileContent(trimmed);
  };

  const handleUpdateProvider = async (newProvider) => {
    try {
      const res = await sessionsApi.updateProvider(sessionId, newProvider);
      setSession((prev) => ({ ...prev, activeProvider: newProvider }));
      if (res.handoff) {
        setHandoffs((prev) => [
          ...prev,
          {
            fromProvider: res.handoff.from,
            toProvider: res.handoff.to,
            reason: 'Manual provider swap by user',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      alert(`Provider switch failed: ${err.message}`);
    }
  };

  const handleSendMessage = (content, simulateHeader = null) => {
    if (isStreaming) return;

    // Optimistically append user message to chat
    const userMessage = {
      _id: `temp-${Date.now()}`,
      role: 'user',
      blocks: [{ type: 'text', text: content }],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Initialize streaming message placeholder
    const streamPlaceholder = {
      role: 'assistant',
      provider: session.activeProvider,
      text: '',
      toolCalls: [],
    };
    setStreamingMessage(streamPlaceholder);
    setIsStreaming(true);
    setCurrentHandoff(null);
    setFailedAttempt(null);

    // Call SSE streaming service
    abortStreamRef.current = streamTurn(
      sessionId,
      content,
      {
        onEvent: handleSSEEvent,
        onError: (err) => {
          setError(err.message);
          setIsStreaming(false);
          setStreamingMessage(null);
        },
        onDone: () => {
          setIsStreaming(false);
          setStreamingMessage(null);
          // Refresh full state
          loadSession();
        },
      },
      simulateHeader
    );
  };

  const handleSSEEvent = (event) => {
    switch (event.type) {
      case 'step_start':
        if (event.provider) {
          setStreamingMessage((prev) => (prev ? { ...prev, provider: event.provider } : prev));
        }
        break;

      case 'text_delta':
        setStreamingMessage((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            text: (prev.text || '') + (event.text || ''),
          };
        });
        break;

      case 'tool_call':
        setStreamingMessage((prev) => {
          if (!prev) return prev;
          const currentCalls = prev.toolCalls || [];
          return {
            ...prev,
            toolCalls: [...currentCalls, { id: event.id, name: event.name, args: event.args }],
          };
        });
        break;

      case 'tool_result':
        setStreamingMessage((prev) => {
          if (!prev) return prev;
          const updated = (prev.toolCalls || []).map((tc) => {
            if (tc.id === event.toolCallId || tc.id === event.id) {
              return { ...tc, result: { content: event.content, isError: event.isError } };
            }
            return tc;
          });
          return { ...prev, toolCalls: updated };
        });
        break;

      case 'file_changed':
        // Reload files list
        filesApi.list(sessionId).then((res) => {
          setFiles(res.files || []);
          if (!activeFile || activeFile.path === event.path) {
            loadFileContent(event.path);
          }
        });
        break;

      case 'attempt_failed':
        setFailedAttempt({
          provider: event.provider,
          errorClass: event.errorClass,
          attempt: event.attempt,
        });
        break;

      case 'handoff':
        setCurrentHandoff({
          fromProvider: event.fromProvider,
          toProvider: event.toProvider,
          reason: event.reason,
        });
        setFailedAttempt(null);
        // Update active provider in session state
        setSession((prev) => ({ ...prev, activeProvider: event.toProvider }));
        // Add to handoffs list
        setHandoffs((prev) => [
          ...prev,
          {
            fromProvider: event.fromProvider,
            toProvider: event.toProvider,
            reason: event.reason,
            createdAt: new Date().toISOString(),
          },
        ]);
        break;

      case 'ledger_updated':
        if (event.entry) {
          setLedgerEntries((prev) => [...prev, event.entry]);
        }
        break;

      case 'done':
        setIsStreaming(false);
        setStreamingMessage(null);
        loadSession();
        break;

      case 'error':
        setError(event.message || 'Turn error');
        break;

      default:
        break;
    }
  };

  const handleStopTurn = () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }
    setIsStreaming(false);
    setStreamingMessage(null);
  };

  if (loading && !session) {
    return (
      <div className="app-shell">
        <Navbar />
        <div className="loading-fullscreen">
          <span className="pulse-dot"></span>
          <span>Connecting to autonomous workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell session-shell">
      <Navbar activeSession={session} onUpdateProvider={handleUpdateProvider} />

      {error && (
        <div className="alert-banner alert-warning">
          <IconAlert size={16} />
          <span>{error}</span>
          <button className="close-alert" onClick={() => setError('')}>
            ✕
          </button>
        </div>
      )}

      <div className="workstation-layout">
        {/* Left Column: Chat Area */}
        <section className="workstation-column chat-column">
          <ChatContainer
            messages={messages}
            streamingMessage={streamingMessage}
            currentHandoff={currentHandoff}
            failedAttempt={failedAttempt}
            onFileClick={(path) => loadFileContent(path)}
            onSelectPrompt={(prompt) => handleSendMessage(prompt)}
          />

          <ChatInput
            onSendMessage={handleSendMessage}
            onStopTurn={handleStopTurn}
            isStreaming={isStreaming}
            disabled={loading}
          />
        </section>

        {/* Center Column: Virtual Workspace + Monaco Editor */}
        <section className="workstation-column editor-column">
          <div className="editor-layout-split">
            <aside className="editor-sidebar">
              <FileTree
                files={files}
                activeFile={activeFile}
                onSelectFile={(f) => loadFileContent(f.path)}
                onNewFile={handleNewFile}
              />
            </aside>

            <main className="editor-main">
              <CodeEditor
                activeFile={activeFile}
                onSaveContent={handleSaveFileContent}
                isSaving={isSavingFile}
              />
            </main>
          </div>
        </section>

        {/* Right Column: Ledger & Resilience Timeline */}
        <aside className="workstation-column right-drawer-column">
          <div className="drawer-tabs-header">
            <button
              className={`drawer-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
            >
              <IconLedger size={14} />
              <span>Ledger ({ledgerEntries.length})</span>
            </button>
            <button
              className={`drawer-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              <IconHandoff size={14} />
              <span>Handoffs ({handoffs.length})</span>
            </button>
          </div>

          <div className="drawer-tab-content">
            {activeTab === 'ledger' ? (
              <LedgerPanel ledgerEntries={ledgerEntries} />
            ) : (
              <HandoffTimeline handoffs={handoffs} attempts={attempts} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
