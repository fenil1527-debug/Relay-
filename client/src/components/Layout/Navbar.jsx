import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { IconCpu, IconHandoff, IconZap } from '../common/Icons.jsx';

export default function Navbar({ activeSession, onSwitchProvider }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getProviderClass = (provider) => {
    if (!provider) return '';
    if (provider.includes('anthropic') || provider.includes('claude')) return 'provider-anthropic';
    if (provider.includes('openai') || provider.includes('gpt')) return 'provider-openai';
    if (provider.includes('groq')) return 'provider-groq';
    return '';
  };

  const formatProviderName = (p) => {
    if (!p) return 'Unknown';
    const [family, model] = p.split(':');
    return `${family === 'anthropic' ? 'Anthropic' : family === 'openai' ? 'OpenAI' : 'Groq'} (${model || ''})`;
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard" className="brand-logo">
          <div className="logo-icon">
            <IconZap size={20} />
          </div>
          <span className="brand-name">Relay</span>
          <span className="badge badge-accent brand-badge">v1.0</span>
        </Link>

        {activeSession && (
          <div className="navbar-session-info">
            <span className="divider">/</span>
            <span className="session-title-nav" title={activeSession.title}>
              {activeSession.title}
            </span>
          </div>
        )}
      </div>

      <div className="navbar-center">
        {activeSession && (
          <div className="active-provider-indicator">
            <span className="label">Active Model:</span>
            <span className={`badge ${getProviderClass(activeSession.activeProvider)}`}>
              <IconCpu size={12} style={{ marginRight: 4 }} />
              {formatProviderName(activeSession.activeProvider)}
            </span>

            {activeSession.fallbackChain && activeSession.fallbackChain.length > 1 && (
              <div className="fallback-pill" title="Fallback chain configured">
                <IconHandoff size={12} />
                <span>{activeSession.fallbackChain.length - 1} standby</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="navbar-actions">
        {user ? (
          <div className="user-menu">
            <div className="user-avatar" title={user.name || user.email}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} />
              ) : (
                <span>{(user.name || user.email || 'U')[0].toUpperCase()}</span>
              )}
            </div>
            <span className="user-name">{user.name || 'Developer'}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
