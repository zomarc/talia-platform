import React from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { useSupabaseAuth } from './contexts/SupabaseAuthContext';

// Main app component that handles authentication routing
const AppContent = () => {
  console.log('🎯 AppContent rendering...');

  // Hooks must be called unconditionally (never inside try/catch or after early return)
  const { user, loading, error } = useSupabaseAuth();
  console.log('✅ useSupabaseAuth:', { hasUser: !!user, loading, hasError: !!error });

  if (loading) {
    const boot = typeof window !== 'undefined' ? window.__taliaBoot : null;
    const mode = boot?.mode || (import.meta.env.DEV ? 'vite-dev' : 'preview');
    return (
      <div className="talia-auth-screen">
        <div className="talia-auth-center">
          <div className="talia-auth-spinner" />
          <p className="talia-auth-message">Loading Talia UI…</p>
          <p className="talia-auth-message" style={{ opacity: 0.75, fontSize: '0.8rem' }}>
            Auth bootstrap · {mode} · {boot?.host || window.location.host}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="talia-auth-screen">
        <div className="talia-auth-card">
          <h2 className="talia-auth-title">Authentication Error</h2>
          <p className="talia-auth-message">
            {error.message || 'An error occurred during authentication'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="talia-auth-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // In dev mode, if no user, create mock user
  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_MODE === 'true';
  if (!user && isDevMode) {
    // This should be handled by SupabaseAuthContext, but as a fallback:
    console.log('🔧 Dev mode: No user found, should be handled by context');
    // The context will create a mock user, so we'll wait for it
    return (
      <div className="talia-auth-screen">
        <div className="talia-auth-center">
          <div className="talia-auth-spinner" />
          <p className="talia-auth-message">Initializing development user...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <LandingPage />;
  }

  return (
    <Dashboard user={user} mode={window.__taliaMode} onModeChange={window.__taliaModeChange} />
  );
};

// Main app with authentication provider and error boundary
const AppWithAuth = () => {
  console.log('🎯 AppWithAuth component initializing...');
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default AppWithAuth;
