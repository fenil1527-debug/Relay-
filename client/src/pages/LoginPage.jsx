import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconZap, IconCpu, IconHandoff, IconCode, IconAlert } from '../components/common/Icons.jsx';

export default function LoginPage() {
  const { loginDemo } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await loginDemo();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/github';
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-hero-card glassmorphism">
          <div className="login-brand">
            <div className="brand-logo-large">
              <IconZap size={32} />
            </div>
            <h1>Relay</h1>
            <p className="hero-tagline">
              Provider-Neutral AI Coding Agent with Automatic Multi-Model Failover
            </p>
          </div>

          {error && (
            <div className="alert-banner alert-warning">
              <IconAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="login-actions">
            <button
              className="btn btn-primary btn-lg full-width"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="pulse-dot"></span> Starting Session...
                </span>
              ) : (
                <>
                  <IconZap size={18} />
                  <span>Launch Demo Workspace (1-Click)</span>
                </>
              )}
            </button>

            <div className="login-divider">
              <span>or connect with OAuth</span>
            </div>

            <button
              className="btn btn-secondary btn-lg full-width"
              onClick={handleGitHubLogin}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div className="features-grid">
            <div className="feature-item">
              <IconHandoff size={20} className="feature-icon" />
              <h4>Zero-Disruption Handoffs</h4>
              <p>When Anthropic hits 429 rate limits, OpenAI resumes automatically.</p>
            </div>
            <div className="feature-item">
              <IconCode size={20} className="feature-icon" />
              <h4>Virtual Workspaces</h4>
              <p>In-memory file trees with Monaco editor and instant diff tracking.</p>
            </div>
            <div className="feature-item">
              <IconCpu size={20} className="feature-icon" />
              <h4>Persistent Decision Ledger</h4>
              <p>Architectural choices survive context trimming across turns.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
