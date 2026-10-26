import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../services/api.js';
import Navbar from '../components/Layout/Navbar.jsx';
import { IconPlus, IconCpu, IconHandoff, IconZap, IconAlert, IconSparkles } from '../components/common/Icons.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [primaryProvider, setPrimaryProvider] = useState('anthropic:claude-3-5-sonnet-20241022');
  const [secondaryProvider, setSecondaryProvider] = useState('openai:gpt-4o');
  const [tokenCap, setTokenCap] = useState(100000);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await sessionsApi.list();
      setSessions(res.sessions || []);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setCreating(true);
      const chain = [primaryProvider];
      if (secondaryProvider && secondaryProvider !== primaryProvider) {
        chain.push(secondaryProvider);
      }

      const res = await sessionsApi.create({
        title: title.trim(),
        fallbackChain: chain,
        tokenCap: Number(tokenCap),
      });

      setShowCreateModal(false);
      navigate(`/sessions/${res.session._id}`);
    } catch (err) {
      setError(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const getProviderClass = (p) => {
    if (!p) return '';
    if (p.includes('anthropic')) return 'provider-anthropic';
    if (p.includes('openai')) return 'provider-openai';
    if (p.includes('groq')) return 'provider-groq';
    return '';
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="page-title">Agent Sessions</h1>
            <p className="page-subtitle">
              Manage your autonomous coding workspaces and provider fallback chains.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={16} />
            <span>New Session</span>
          </button>
        </div>

        {error && (
          <div className="alert-banner alert-warning">
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-card glassmorphism">
            <div className="stat-icon-wrap icon-primary">
              <IconCpu size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Workspaces</span>
              <span className="stat-value">{sessions.length}</span>
            </div>
          </div>

          <div className="stat-card glassmorphism">
            <div className="stat-icon-wrap icon-accent">
              <IconHandoff size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Multi-Model Architecture</span>
              <span className="stat-value">Anthropic + OpenAI</span>
            </div>
          </div>

          <div className="stat-card glassmorphism">
            <div className="stat-icon-wrap icon-success">
              <IconZap size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Failover Engine</span>
              <span className="stat-value">Active & Ready</span>
            </div>
          </div>
        </div>

        {/* Sessions Grid */}
        {loading ? (
          <div className="loading-state">
            <span className="pulse-dot"></span>
            <span>Loading workspaces...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="dashboard-empty glassmorphism">
            <IconSparkles size={40} className="empty-sparkle" />
            <h3>No Sessions Yet</h3>
            <p>Create your first autonomous coding session with instant multi-model failover.</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <IconPlus size={16} />
              <span>Create First Session</span>
            </button>
          </div>
        ) : (
          <div className="sessions-grid">
            {sessions.map((s) => (
              <div
                key={s._id}
                className="session-card glassmorphism"
                onClick={() => navigate(`/sessions/${s._id}`)}
              >
                <div className="session-card-header">
                  <h3 className="session-card-title">{s.title}</h3>
                  <span className={`badge ${getProviderClass(s.activeProvider)}`}>
                    {s.activeProvider?.split(':')[0]}
                  </span>
                </div>

                <p className="session-preview">
                  {s.preview || 'No messages yet in this session.'}
                </p>

                <div className="session-card-footer">
                  <div className="session-meta">
                    <span>{s.messageCount || 0} messages</span>
                    <span>·</span>
                    <span>Cap: {(s.tokenCap / 1000).toFixed(0)}k tok</span>
                  </div>

                  <span className="open-arrow">→</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-backdrop">
            <div className="modal-card glassmorphism">
              <div className="modal-header">
                <h2>New Coding Session</h2>
                <button
                  className="close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSession} className="modal-form">
                <div className="form-group">
                  <label htmlFor="title">Session Title</label>
                  <input
                    id="title"
                    type="text"
                    placeholder="e.g. Build Payment Gateway, Refactor Auth"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="primary">Primary Provider</label>
                  <select
                    id="primary"
                    value={primaryProvider}
                    onChange={(e) => setPrimaryProvider(e.target.value)}
                  >
                    <option value="anthropic:claude-3-5-sonnet-20241022">
                      Anthropic Claude 3.5 Sonnet
                    </option>
                    <option value="openai:gpt-4o">OpenAI GPT-4o</option>
                    <option value="groq:llama-3.3-70b-versatile">
                      Groq Llama 3.3 70B
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="secondary">Standby Failover Provider</label>
                  <select
                    id="secondary"
                    value={secondaryProvider}
                    onChange={(e) => setSecondaryProvider(e.target.value)}
                  >
                    <option value="openai:gpt-4o">OpenAI GPT-4o</option>
                    <option value="anthropic:claude-3-5-sonnet-20241022">
                      Anthropic Claude 3.5 Sonnet
                    </option>
                    <option value="groq:llama-3.3-70b-versatile">
                      Groq Llama 3.3 70B
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="tokencap">
                    Token Budget Cap: {(tokenCap / 1000).toFixed(0)}k tokens
                  </label>
                  <input
                    id="tokencap"
                    type="range"
                    min="20000"
                    max="200000"
                    step="10000"
                    value={tokenCap}
                    onChange={(e) => setTokenCap(e.target.value)}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={creating || !title.trim()}
                  >
                    {creating ? 'Creating...' : 'Initialize Session'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
