import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import Dashboard, { ThemeProvider } from './Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

// Main app component that handles authentication routing
const AppContent = () => {
  console.log('🎯 AppContent rendering...');
  
  let authResult;
  try {
    authResult = useAuth();
    console.log('✅ useAuth hook successful:', { 
      hasUser: !!authResult.user, 
      loading: authResult.loading, 
      hasError: !!authResult.error 
    });
  } catch (err) {
    console.error('❌ useAuth hook failed:', err);
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h2 style={{ color: '#dc2626', margin: '0 0 1rem 0' }}>Authentication Error</h2>
          <p style={{ color: '#6b7280', margin: '0 0 1rem 0' }}>
            Failed to initialize authentication: {err.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
  
  const { user, loading, error } = authResult;

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280', margin: 0 }}>Loading Talia UI...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h2 style={{ color: '#dc2626', margin: '0 0 1rem 0' }}>Authentication Error</h2>
          <p style={{ color: '#6b7280', margin: '0 0 1rem 0' }}>
            {error.message || 'An error occurred during authentication'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <ThemeProvider>
      <Dashboard user={user} />
    </ThemeProvider>
  );
};

// Main app with authentication provider and error boundary
const AppWithAuth = () => {
  console.log('🎯 AppWithAuth component initializing...');
  
  try {
    return (
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    );
  } catch (err) {
    console.error('❌ AppWithAuth render error:', err);
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h2 style={{ color: '#dc2626', margin: '0 0 1rem 0' }}>App Error</h2>
          <p style={{ color: '#6b7280', margin: '0 0 1rem 0' }}>
            Failed to render app: {err.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
};

export default AppWithAuth;
