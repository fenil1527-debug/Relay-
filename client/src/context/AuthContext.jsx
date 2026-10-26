import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setLoading(true);
      const res = await authApi.getMe();
      setUser(res.user);
      setError(null);
    } catch (err) {
      setUser(null);
      // Not authenticated is a normal initial state, don't show full error
    } finally {
      setLoading(false);
    }
  }

  async function loginDemo() {
    try {
      setLoading(true);
      const res = await authApi.demoLogin();
      setUser(res.user);
      setError(null);
      return res.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  const value = {
    user,
    loading,
    error,
    loginDemo,
    logout,
    refreshUser: checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
