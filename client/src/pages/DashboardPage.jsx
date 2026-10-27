import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../services/api.js';
import Navbar from '../components/Layout/Navbar.jsx';
import {
  IconPlus,
  IconCpu,
  IconHandoff,
  IconZap,
  IconAlert,
  IconSparkles,
  IconSearch,
  IconTrash,
  IconLayers,
} from '../components/common/Icons.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [primaryProvider, setPrimaryProvider] = useState('anthropic:claude-3-5-sonnet-20241022');
  const [secondaryProvider, setSecondaryProvider] = useState('groq:openai/gpt-oss-120b');
  const [tokenCap, setTokenCap] = useState(100000);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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
      // Ensure Groq is included for free failover if not already in chain
      if (!chain.some(p => p.includes('groq'))) {
        chain.push('groq:openai/gpt-oss-120b');
      }

      const res = await sessionsApi.create({
        title: title.trim(),
        fallbackChain: chain,
        tokenCap: Number(tokenCap),
      });

      setShowCreateModal(false);
      setTitle('');
      navigate(`/sessions/${res.session._id || res.session.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this workspace and all associated files?')) return;

    try {
      setDeletingId(sessionId);
      await sessionsApi.delete(sessionId);
      setSessions(prev => prev.filter(s => (s._id !== sessionId && s.id !== sessionId)));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getProviderClass = (p) => {
    if (!p) return 'badge-neutral';
    if (p.includes('anthropic')) return 'provider-anthropic';
    if (p.includes('openai')) return 'provider-openai';
    if (p.includes('groq')) return 'provider-groq';
    return 'badge-neutral';
  };

  const filteredSessions = sessions.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.activeProvider && s.activeProvider.toLowerCase().includes(q)) ||
      (s.preview && s.preview.toLowerCase().includes(q))
    );
  });

  return (
    <div className="app-shell">
      <Navbar />

      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="page-title">Agent Workspaces</h1>
            <p className="page-subtitle">
              Provider-neutral coding environments with automatic multi-model failover.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <IconPlus size={16} />
            <span>New Workspace</span>
          </button>
        </div>

        {error && (
          <div className="alert-banner alert-warning">
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <IconLayers size={20} />
            </div>
            <div>
              <h3>{sessions.length}</h3>
              <p>Active Workspaces</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <IconCpu size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Groq + OpenAI + Claude</h3>
              <p>Multi-Provider Mesh</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ color: 'var(--status-success)', background: 'var(--status-success-bg)' }}>
              <IconZap size={20} />
            </div>
            <div>
              <h3 style={{ color: 'var(--status-success)', fontSize: '1.2rem' }}>Zero-Downtime</h3>
              <p>Automatic Failover Active</p>
            </div>
          </div>
        </div>

        {/* Controls Bar: Search & Filter */}
        <div className="dashboard-controls">
          <div className="search-box">
            <IconSearch size={15} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search workspaces by name or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
            Showing {filteredSessions.length} of {sessions.length} sessions
          </span>
        </div>

        {/* Sessions Grid */}
        {loading ? (
          <div className="empty-state">
            <span className="pulse-dot" style={{ width: 10, height: 10, marginBottom: 12 }}></span>
            <p>Loading your workspaces...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="empty-state">
            <IconSparkles size={36} className="empty-state-icon" />
            <h3>{searchQuery ? 'No matching workspaces found' : 'No workspaces yet'}</h3>
            <p>
              {searchQuery
                ? 'Try a different search query or clear the filter.'
                : 'Create your first autonomous coding workspace with full context resilience.'}
            </p>
            {!searchQuery && (
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <IconPlus size={16} />
                <span>Create First Workspace</span>
              </button>
            )}
          </div>
        ) : (
          <div className="sessions-grid">
            {filteredSessions.map((s) => {
              const sid = s._id || s.id;
              return (
                <div
                  key={sid}
                  className="session-card"
                  onClick={() => navigate(`/sessions/${sid}`)}
                >
                  <div className="session-card-header">
                    <h3 className="session-card-title">{s.title}</h3>
                    <span className={`badge ${getProviderClass(s.activeProvider)}`}>
                      {s.activeProvider?.split(':')[0] || 'Claude'}
                    </span>
                  </div>

                  <p className="session-preview-text">
                    {s.preview || 'Fresh coding session ready for prompts and file editing.'}
                  </p>

                  <div className="session-card-footer">
                    <div className="session-meta-items">
                      <span>{s.messageCount || 0} messages</span>
                      <span>•</span>
                      <span>{((s.tokenCap || 100000) / 1000).toFixed(0)}k cap</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--text-tertiary)', padding: '4px 6px' }}
                        onClick={(e) => handleDeleteSession(e, sid)}
                        title="Delete workspace"
                        disabled={deletingId === sid}
                      >
                        <IconTrash size={14} />
                      </button>
                      <span style={{ color: 'var(--accent-primary)', fontSize: '1.1rem', fontWeight: 600 }}>→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Session Modal */}
        {showCreateModal && (
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">New Coding Workspace</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSession}>
                <div className="modal-form-group">
                  <label htmlFor="title" className="modal-label">Workspace Title</label>
                  <input
                    id="title"
                    type="text"
                    placeholder="e.g., Express E-Commerce Microservice"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="primary" className="modal-label">Primary AI Provider</label>
                  <select
                    id="primary"
                    value={primaryProvider}
                    onChange={(e) => setPrimaryProvider(e.target.value)}
                  >
                    <option value="groq:openai/gpt-oss-120b">
                      Groq (GPT OSS 120B — High Speed & Free)
                    </option>
                    <option value="anthropic:claude-3-5-sonnet-20241022">
                      Anthropic (Claude 3.5 Sonnet)
                    </option>
                    <option value="openai:gpt-4o">
                      OpenAI (GPT-4o)
                    </option>
                  </select>
                </div>

                <div className="modal-form-group">
                  <label htmlFor="secondary" className="modal-label">Standby Failover Provider</label>
                  <select
                    id="secondary"
                    value={secondaryProvider}
                    onChange={(e) => setSecondaryProvider(e.target.value)}
                  >
                    <option value="groq:openai/gpt-oss-120b">
                      Groq (GPT OSS 120B)
                    </option>
                    <option value="openai:gpt-4o">
                      OpenAI (GPT-4o)
                    </option>
                    <option value="anthropic:claude-3-5-sonnet-20241022">
                      Anthropic (Claude 3.5 Sonnet)
                    </option>
                  </select>
                </div>

                <div className="modal-form-group">
                  <label htmlFor="tokencap" className="modal-label">
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
                    style={{ padding: 0 }}
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
                    {creating ? 'Creating...' : 'Launch Workspace'}
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
