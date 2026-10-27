import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { IconCpu, IconHandoff, IconZap, IconSun, IconMoon } from '../common/Icons.jsx';

export default function Navbar({ activeSession }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getProviderBadgeClass = (provider) => {
    if (!provider) return '';
    if (provider.includes('anthropic') || provider.includes('claude')) return 'provider-anthropic';
    if (provider.includes('openai') || provider.includes('gpt')) return 'provider-openai';
    if (provider.includes('groq')) return 'provider-groq';
    return '';
  };

  const formatProviderName = (p) => {
    if (!p) return 'Ready';
    const [family, model] = p.split(':');
    const brand = family === 'anthropic' ? 'Anthropic' : family === 'openai' ? 'OpenAI' : 'Groq';
    return `${brand} (${model || ''})`;
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard" className="brand-logo" title="Relay Studio Home">
          <div className="logo-icon">
            <IconZap size={18} />
          </div>
          <span className="brand-name">Relay</span>
          <span className="badge badge-accent brand-badge">Studio</span>
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
            <span className={`badge ${getProviderBadgeClass(activeSession.activeProvider)}`}>
              <span className="pulse-dot" style={{ width: 6, height: 6 }} />
              {formatProviderName(activeSession.activeProvider)}
            </span>

            {activeSession.fallbackChain && activeSession.fallbackChain.length > 1 && (
              <div className="fallback-pill" title="Automatic fallback chain active">
                <IconHandoff size={12} />
                <span>{activeSession.fallbackChain.length - 1} standby</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="navbar-actions">
        {/* Adaptive Light/Dark Theme Switcher */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Studio Mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
        </button>

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
