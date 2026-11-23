import React, { useMemo, useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { GraphQLUtils } from '../lib/apolloClient';
import taliaLogo from '../assets/talia-default-logo.png';

const readUrlAuthError = () => {
  if (typeof window === 'undefined') return '';
  const search = new URLSearchParams(window.location.search || '');
  const hash = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  const raw = search.get('error_description')
    || hash.get('error_description')
    || search.get('error')
    || hash.get('error');
  if (!raw) return '';
  try {
    return decodeURIComponent(String(raw).replace(/\+/g, ' '));
  } catch {
    return String(raw);
  }
};

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
  const urlAuthError = useMemo(() => readUrlAuthError(), []);
  const displayError = error?.message || urlAuthError;

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
      <aside className="landing-page__brand" aria-label="Talia">
        <div className="landing-page__brand-glow" aria-hidden="true" />
        <div className="landing-page__brand-inner">
          <img
            className="landing-page__logo"
            src={taliaLogo}
            alt="Talia"
          />
          <p className="landing-page__brand-line">Revenue management for the voyage</p>
        </div>
      </aside>

      <main className="landing-page__panel">
        <div className="landing-page__panel-inner">
          <header className="landing-page__header">
            <p className="landing-page__eyebrow">Welcome</p>
            <h1 className="landing-page__title">Sign in</h1>
            <p className="landing-page__subtitle">Cruise management workspace</p>
          </header>

          {displayError && (
            <div className="landing-page__alert landing-page__alert--error" role="alert">
              {displayError}
            </div>
          )}

          {message && (
            <div className="landing-page__alert landing-page__alert--success" role="status">
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
                  <label className="landing-page__label" htmlFor="landing-email">Email Address</label>
                  <input
                    id="landing-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                    className="landing-page__input"
                    autoComplete="username"
                  />
                </div>
                <div className="landing-page__field landing-page__field--spaced">
                  <label className="landing-page__label" htmlFor="landing-password">Password</label>
                  <input
                    id="landing-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    className="landing-page__input"
                    autoComplete="current-password"
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
      </main>
    </div>
  );
};

export default LandingPage;
