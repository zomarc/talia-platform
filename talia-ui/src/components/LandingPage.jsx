import React, { useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { GraphQLUtils } from '../lib/apolloClient';

const LandingPage = () => {
  const {
    signInWithPassword,
    signInWithCelestyal,
    enterDevSession,
    isDevMode,
    isOidcAuthMode,
    isBreakGlassEnabled,
    error,
  } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showBreakGlass, setShowBreakGlass] = useState(!isOidcAuthMode);

  const handleCelestyalSso = async () => {
    setLoading(true);
    setMessage('');
    try {
      await signInWithCelestyal();
      setMessage('Redirecting to Celestyal sign-in…');
    } catch (err) {
      console.error('Celestyal SSO error:', err);
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setMessage('');
    try {
      await signInWithPassword(email, password);
      setMessage('Signing in...');
    } catch (err) {
      console.error('Sign in error:', err);
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (isDevMode && typeof enterDevSession === 'function') {
        enterDevSession('dev-user-1');
        GraphQLUtils.setUserContext({
          role: 'ADMIN',
          email: 'dev@talia.local',
          id: 'dev-user-1',
          taliaUserId: 1000,
        });
        setMessage('Signing in as Administrator...');
        return;
      }

      const adminEmail = 'admin@talia.dev';
      const adminPassword = 'admin123';
      await signInWithPassword(adminEmail, adminPassword);
      GraphQLUtils.setUserContext({
        role: 'ADMIN',
        email: adminEmail,
        id: 'admin-dev',
      });
      setMessage('Signing in as Administrator...');
    } catch (err) {
      console.error('Admin login error:', err);
      setMessage(err?.message || 'Failed to login as admin. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-page__card">
        <div className="landing-page__header">
          <h1 className="landing-page__title">Talia UI</h1>
          <p className="landing-page__subtitle">Cruise Management Dashboard</p>
        </div>

        {error && (
          <div className="landing-page__alert landing-page__alert--error">
            {error.message || 'An error occurred'}
          </div>
        )}

        {message && (
          <div className="landing-page__alert landing-page__alert--success">
            {message}
          </div>
        )}

        {isOidcAuthMode ? (
          <>
            <p className="landing-page__notice">
              Sign in with your Celestyal account. Access inside Talia is controlled by your Talia role.
            </p>
            <button
              type="button"
              onClick={handleCelestyalSso}
              disabled={loading}
              className="landing-page__button landing-page__button--sso"
            >
              {loading ? 'Redirecting…' : 'Sign in with Celestyal'}
            </button>
            {isBreakGlassEnabled ? (
              <button
                type="button"
                className="landing-page__break-glass-toggle"
                onClick={() => setShowBreakGlass((open) => !open)}
              >
                {showBreakGlass ? 'Hide emergency admin' : 'Emergency admin'}
              </button>
            ) : null}
          </>
        ) : (
          <div className="landing-page__notice">
            <strong>Development Mode:</strong> Simple email/password authentication
          </div>
        )}

        {(!isOidcAuthMode || showBreakGlass) && isBreakGlassEnabled ? (
          <>
            {!isOidcAuthMode || isDevMode ? (
              <button
                type="button"
                onClick={handleAdminLogin}
                disabled={loading}
                className="landing-page__button landing-page__button--admin"
              >
                {loading ? 'Signing in...' : 'Quick Admin Access (Dev Only)'}
              </button>
            ) : null}

            <form onSubmit={handleSubmit} className="landing-page__form">
              <div className="landing-page__field">
                <label className="landing-page__label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                  className="landing-page__input"
                />
              </div>
              <div className="landing-page__field landing-page__field--spaced">
                <label className="landing-page__label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  className="landing-page__input"
                />
                {!isOidcAuthMode ? (
                  <p className="landing-page__hint">
                    New users will be created automatically
                  </p>
                ) : (
                  <p className="landing-page__hint">
                    Break-glass only — not for day-to-day access
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="landing-page__button landing-page__button--submit"
              >
                {loading ? 'Signing in...' : (isOidcAuthMode ? 'Emergency sign in' : 'Sign In')}
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default LandingPage;
