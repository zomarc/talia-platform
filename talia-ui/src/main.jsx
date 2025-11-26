import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme.css' // Import theme CSS variables
import './styles/tabulator.css' // Import global Tabulator theme styles
import AppWithAuth from './AppWithAuth.jsx'
import TestPage from './components/TestPage.jsx'
import DataManagementPage from './components/DataManagementPage.jsx'
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

// Apollo Client temporarily disabled during database restoration
// TODO: Re-enable when database is restored
// import { ApolloProvider } from '@apollo/client';
// import apolloClient from './lib/apolloClient.js';

// Debug logging for main entry point
console.log('🚀 main.jsx loading');
console.log('📦 React StrictMode:', !!StrictMode);
console.log('🎯 Root element:', document.getElementById('root'));
console.log('🌐 Window object:', typeof window);
console.log('📱 Document ready state:', document.readyState);

// Dev Mode Switcher Component
const DevSwitcher = () => {
  const [mode, setMode] = useState('app'); // 'app', 'test', or 'data'
  
  // Check localStorage for saved preference on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('devMode');
    if (savedMode && ['app', 'test', 'data'].includes(savedMode)) {
      setMode(savedMode);
    }
  }, []);

  const toggleToTest = () => {
    setMode('test');
    localStorage.setItem('devMode', 'test');
  };

  const toggleToApp = () => {
    setMode('app');
    localStorage.setItem('devMode', 'app');
  };

  const toggleToData = () => {
    setMode('data');
    localStorage.setItem('devMode', 'data');
  };

  const ModeToggle = () => (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      background: 'white',
      padding: '8px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }}>
      <button
        onClick={toggleToTest}
        style={{
          padding: '6px 12px',
          background: mode === 'test' ? '#b08d57' : '#e8e8e8',
          color: mode === 'test' ? 'white' : '#333',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        🧪 TEST MODE
      </button>
      <button
        onClick={toggleToApp}
        style={{
          padding: '6px 12px',
          background: mode === 'app' ? '#b08d57' : '#e8e8e8',
          color: mode === 'app' ? 'white' : '#333',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        🚀 APP MODE
      </button>
      <button
        onClick={toggleToData}
        style={{
          padding: '6px 12px',
          background: mode === 'data' ? '#b08d57' : '#e8e8e8',
          color: mode === 'data' ? 'white' : '#333',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        📊 DATA MODE
      </button>
    </div>
  );

  const renderContent = () => {
    console.log('🎯 renderContent called with mode:', mode);
    switch (mode) {
      case 'test':
        console.log('📋 Rendering TestPage');
        return <TestPage />;
      case 'data':
        console.log('📋 Rendering DataManagementPage');
        return <DataManagementPage />;
      case 'app':
      default:
        console.log('📋 Rendering AppWithAuth');
        return <AppWithAuth />;
    }
  };

  return (
    <StrictMode>
      <ModeToggle />
      {renderContent()}
    </StrictMode>
  );
};

const root = document.getElementById('root');
if (!root) {
  console.error('❌ Root element not found!');
} else {
  console.log('✅ Root element found, creating React app');
  try {
    const reactRoot = createRoot(root);
    console.log('✅ React root created');
    
    reactRoot.render(
      <SupabaseAuthProvider>
        <ThemeProvider>
          <DevSwitcher />
        </ThemeProvider>
      </SupabaseAuthProvider>
    );
    console.log('✅ React app rendered successfully');
  } catch (error) {
    console.error('❌ React render error:', error);
    // Fallback: render error message directly to DOM
    root.innerHTML = '<h1 style="color: red;">React Error: ' + error.message + '</h1>';
  }
}
