import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

// Core styles - order matters
import './index.css'
import './styles/theme.css'           // Theme CSS variables (single source of truth)
import './styles/tabulator-theme.css' // Tabulator theme (midnight from npm)
import './styles/components.css'      // Shared component classes
import './styles/dashboard.css'       // Dashboard-specific styles
import './styles/dev-components.css' // Dev component styles (separate, does not affect other components)
import './styles/mode-selector.css'  // Mode selector styles

import AppWithAuth from './AppWithAuth.jsx'
import TestPage from './components/TestPage.jsx'
import DataManagementPage from './components/DataManagementPage.jsx'
import ModeSelector from './components/ModeSelector.jsx'
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { applyTheme, DEFAULT_THEME } from './config/themes.js';
import { initChartDefaults } from './lib/chartConfig.js';

// Apollo Client temporarily disabled during database restoration
// TODO: Re-enable when database is restored
// import { ApolloProvider } from '@apollo/client';
// import apolloClient from './lib/apolloClient.js';

// Initialize application styling before React renders
try {
  // Apply theme CSS variables
  applyTheme(DEFAULT_THEME);
  
  // Set table spacing CSS variables
  const root = document.documentElement;
  root.style.setProperty('--theme-table-header-height', '28px');
  root.style.setProperty('--theme-table-row-height', '24px');
  
  // Initialize Chart.js with theme defaults
  initChartDefaults();
  
  console.log('[main.jsx] Theme and Chart.js initialized');
} catch (e) {
  console.warn('[main.jsx] Error during initialization:', e);
}

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

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem('devMode', newMode);
  };

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
      <ModeSelector currentMode={mode} onModeChange={handleModeChange} />
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
