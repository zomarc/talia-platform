import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithAuth from './AppWithAuth.jsx'
import TestPage from './components/TestPage.jsx'

// Debug logging for main entry point
console.log('🚀 main.jsx loading');
console.log('📦 React StrictMode:', !!StrictMode);
console.log('🎯 Root element:', document.getElementById('root'));
console.log('🌐 Window object:', typeof window);
console.log('📱 Document ready state:', document.readyState);

// Dev Mode Switcher Component
const DevSwitcher = () => {
  const [showTestPage, setShowTestPage] = useState(false);
  
  // Check localStorage for saved preference on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('devMode');
    if (savedMode) {
      setShowTestPage(savedMode === 'test');
    }
  }, []);

  const toggleToTest = () => {
    setShowTestPage(true);
    localStorage.setItem('devMode', 'test');
  };

  const toggleToApp = () => {
    setShowTestPage(false);
    localStorage.setItem('devMode', 'app');
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
          background: showTestPage ? '#b08d57' : '#e8e8e8',
          color: showTestPage ? 'white' : '#333',
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
          background: !showTestPage ? '#b08d57' : '#e8e8e8',
          color: !showTestPage ? 'white' : '#333',
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
    </div>
  );

  return (
    <StrictMode>
      <ModeToggle />
      {showTestPage ? <TestPage /> : <AppWithAuth />}
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
    
    reactRoot.render(<DevSwitcher />);
    console.log('✅ React app rendered successfully');
  } catch (error) {
    console.error('❌ React render error:', error);
    // Fallback: render error message directly to DOM
    root.innerHTML = '<h1 style="color: red;">React Error: ' + error.message + '</h1>';
  }
}
