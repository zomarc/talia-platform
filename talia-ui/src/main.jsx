import { StrictMode, useState, useEffect, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

// Core styles - order matters
import './index.css'
import './styles/theme.css'           // Theme CSS variables (single source of truth)
import './styles/tabulator-theme.css' // Tabulator theme (midnight from npm)
import './styles/tabulator-condensed.css' // Condensed overrides (spacing/sizing only)
import './styles/components.css'      // Shared component classes
import './styles/dashboard.css'       // Dashboard-specific styles
import './styles/dev-components.css' // Dev component styles (separate, does not affect other components)
import './styles/mode-selector.css'  // Mode selector styles
import './styles/status-bar.css'     // Status bar styles

import AppWithAuth from './AppWithAuth.jsx'
import TestPage from './components/TestPage.jsx'
import StatusBar from './components/shared/StatusBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
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

// Global status and event state (shared across all modes)
const DataManagementUnavailable = () => (
  <div style={{ padding: '16px', fontSize: '12px', color: '#c7c7d1' }}>
    Data Management is currently unavailable.
  </div>
);

const DataManagementPage = lazy(() =>
  import('./components/admin/data-management/DataManagementPage.jsx').catch(() => ({
    default: DataManagementUnavailable
  }))
);

const globalStatusState = {
  statusMessage: null,
  currentEvent: null,
  persistedEvent: null,
  listeners: new Set()
};

// Global status API
window.__taliaStatus = {
  setStatusMessage: (message) => {
    globalStatusState.statusMessage = message;
    globalStatusState.listeners.forEach(listener => listener());
    // Auto-clear after 5 seconds
    if (message) {
      setTimeout(() => {
        globalStatusState.statusMessage = null;
        globalStatusState.listeners.forEach(listener => listener());
      }, 5000);
    }
  },
  subscribe: (listener) => {
    globalStatusState.listeners.add(listener);
    return () => globalStatusState.listeners.delete(listener);
  },
  getState: () => ({
    statusMessage: globalStatusState.statusMessage,
    currentEvent: globalStatusState.currentEvent,
    persistedEvent: globalStatusState.persistedEvent
  })
};

// Dev Mode Switcher Component
const DevSwitcher = () => {
  const [mode, setMode] = useState('app'); // 'app', 'test', or 'data'
  const [statusState, setStatusState] = useState({
    statusMessage: null,
    currentEvent: null,
    persistedEvent: null
  });
  
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

  // Subscribe to global status updates
  useEffect(() => {
    const updateStatus = () => {
      const state = window.__taliaStatus.getState();
      setStatusState(state);
    };
    
    const unsubscribe = window.__taliaStatus.subscribe(updateStatus);
    // Initial load - get current state
    updateStatus();
    
    // Also force update on mount to ensure state is synced
    setTimeout(updateStatus, 100);
    
    return unsubscribe;
  }, []);

  // Track events globally (works across all modes)
  useEffect(() => {
    const handleEvent = (event) => {
      if (event instanceof CustomEvent && event.type.startsWith('talia:')) {
        const eventData = {
          name: event.type,
          detail: event.detail || {},
          timestamp: new Date().toLocaleTimeString(),
          source: event.type.replace('talia:', '').replace('.select', '').replace('.clear', '')
        };
        
        // Only track select events, not clear events
        if (event.type.includes('.select')) {
          globalStatusState.currentEvent = eventData;
          
          // Also persist to localStorage
          try {
            localStorage.setItem('talia:persisted:lastEvent', JSON.stringify(eventData));
            globalStatusState.persistedEvent = eventData;
          } catch (e) {
            console.warn('[DevSwitcher] Error persisting event:', e);
          }
        } else if (event.type.includes('.clear')) {
          globalStatusState.currentEvent = null;
        }
        
        // Notify listeners
        globalStatusState.listeners.forEach(listener => listener());
      }
    };

    // Listen to all talia events
    const eventTypes = [
      'talia:sail.select',
      'talia:sail.clear',
      'talia:ship.select',
      'talia:ship.clear',
      'talia:sailing.select',
      'talia:sailing.clear',
      'talia:publishedRates.select',
      'talia:publishedRates.clear',
      'talia:reservation.select',
      'talia:reservation.clear',
      'talia:booking.select',
      'talia:booking.clear'
    ];

    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleEvent, true);
    });

    // Load persisted event on mount
    try {
      const persisted = localStorage.getItem('talia:persisted:lastEvent');
      if (persisted) {
        const eventData = JSON.parse(persisted);
        globalStatusState.persistedEvent = eventData;
        globalStatusState.listeners.forEach(listener => listener());
      }
    } catch (e) {
      console.warn('[DevSwitcher] Error loading persisted event:', e);
    }

    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleEvent, true);
      });
    };
  }, []);

  const renderContent = () => {
    console.log('🎯 renderContent called with mode:', mode);
    switch (mode) {
      case 'test':
        console.log('📋 Rendering TestPage');
        return <TestPage />;
      case 'data':
        console.log('📋 Rendering DataManagementPage');
        return (
          <ErrorBoundary fallback={<DataManagementUnavailable />}>
            <Suspense fallback={<DataManagementUnavailable />}>
              <DataManagementPage />
            </Suspense>
          </ErrorBoundary>
        );
      case 'app':
      default:
        console.log('📋 Rendering AppWithAuth');
        return <AppWithAuth />;
    }
  };

  // Status bar is always visible (has mode selector), so always add padding
  const statusBarHeight = 38;

  return (
    <StrictMode>
      {/* Global Status Bar - visible in all modes */}
      <StatusBar 
        statusMessage={statusState.statusMessage}
        currentEvent={statusState.currentEvent}
        persistedEvent={statusState.persistedEvent}
        currentMode={mode}
        onModeChange={handleModeChange}
      />
      
      {/* Content with padding for status bar (always present) */}
      <div style={{
        paddingTop: `${statusBarHeight}px`,
        transition: 'padding-top 0.3s ease',
        minHeight: `calc(100vh - ${statusBarHeight}px)`,
        height: `calc(100vh - ${statusBarHeight}px)`,
        overflow: 'hidden'
      }}>
        {renderContent()}
      </div>
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
