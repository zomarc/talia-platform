/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

// Core styles - order matters
import './index.css'
import './styles/theme.css'           // Theme CSS variables (single source of truth)
import './styles/tabulator-theme.css' // Tabulator theme (midnight from npm)
import './styles/tabulator-condensed.css' // Condensed overrides (spacing/sizing only)
import './styles/components.css'      // Shared component classes
import './styles/dashboard.css'       // Dashboard-specific styles
import './styles/focus-panels.css'    // Focus panel styles
import 'leaflet/dist/leaflet.css'     // Leaflet map styles
import './styles/dev-components.css' // Dev component styles (separate, does not affect other components)
import './styles/mode-selector.css'  // Mode selector styles
import './styles/status-bar.css'     // Status bar styles

import AppWithAuth from './AppWithAuth.jsx'
import StatusBar from './components/shared/StatusBar.jsx'
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext.jsx';
import { FocusManagementProvider } from './contexts/FocusManagementProvider.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { applyTheme, DEFAULT_THEME } from './config/themes.js';
import { initChartDefaults } from './lib/chartConfig.js';
import { GraphQLUtils } from './lib/apolloClient.js';
import {
  GROUP_CLEAR_EVENT,
  GROUP_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  SAIL_SELECT_EVENT,
  SHIP_CLEAR_EVENT,
  SHIP_SELECT_EVENT,
} from './lib/eventBus.js';
import { normalizeRole, canUseAdvancedHeader } from './utils/roleUtils.js';
import userActivityTracker, { initUserActivityTracking } from './services/userActivityTracker.js';
import { applyInstanceBrowserIdentity } from './lib/instanceIdentity.js';
import { enforceDashboardUiState } from './services/dashboardUiState.js';

// Paint tab title/favicon ASAP (local/mvp/…) so multi-instance tabs are distinguishable.
applyInstanceBrowserIdentity().catch(() => {});

// Apply global visibility chrome (filters/details/legends/titles) from localStorage
// before React paints panels — avoids a flash of "everything visible".
try {
  enforceDashboardUiState({ dispatchEvents: false });
} catch {
  // Boot must not fail if DOM/storage is unavailable.
}

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
  // Initialize lightweight user activity tracking for admin telemetry.
  initUserActivityTracking();
  
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

const globalStatusState = {
  statusMessage: null,
  currentEvent: null,
  persistedEvent: null,
  dataStatus: null,
  statusTimer: null,
  listeners: new Set()
};

// Global status API
window.__taliaStatus = {
  setStatusMessage: (message) => {
    if (globalStatusState.statusTimer) {
      clearTimeout(globalStatusState.statusTimer);
      globalStatusState.statusTimer = null;
    }
    globalStatusState.statusMessage = message;
    globalStatusState.listeners.forEach(listener => listener());
    // Standard message lifecycle: clear after 10 seconds.
    if (message) {
      globalStatusState.statusTimer = setTimeout(() => {
        globalStatusState.statusMessage = null;
        globalStatusState.statusTimer = null;
        globalStatusState.listeners.forEach(listener => listener());
      }, 10000);
    }
  },
  setDataStatus: (dataStatus) => {
    globalStatusState.dataStatus = dataStatus;
    globalStatusState.listeners.forEach(listener => listener());
  },
  subscribe: (listener) => {
    globalStatusState.listeners.add(listener);
    return () => globalStatusState.listeners.delete(listener);
  },
  getState: () => ({
    statusMessage: globalStatusState.statusMessage,
    currentEvent: globalStatusState.currentEvent,
    persistedEvent: globalStatusState.persistedEvent,
    dataStatus: globalStatusState.dataStatus
  })
};

// Dev Mode Switcher Component
const DevSwitcher = () => {
  const [mode, setMode] = useState('app'); // single framework mode; test/data open as panels
  const [userRole, setUserRole] = useState(() => normalizeRole(GraphQLUtils.getUserRole()));
  const [statusState, setStatusState] = useState({
    statusMessage: null,
    currentEvent: null,
    persistedEvent: null,
    dataStatus: null
  });
  
  // Check localStorage for saved preference on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('devMode');
    if (savedMode && savedMode !== 'app') {
      localStorage.setItem('devMode', 'app');
    }
    setMode('app');
  }, []);

  useEffect(() => {
    const syncUserRole = () => {
      setUserRole(normalizeRole(GraphQLUtils.getUserRole()));
    };
    const handleStorage = (event) => {
      if (!event || event.key === 'userRole') {
        syncUserRole();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', syncUserRole);
    document.addEventListener('visibilitychange', syncUserRole);
    syncUserRole();
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', syncUserRole);
      document.removeEventListener('visibilitychange', syncUserRole);
    };
  }, []);

  const handleModeChange = (newMode) => {
    const normalized = newMode === 'app' ? 'app' : 'app';
    setMode(normalized);
    localStorage.setItem('devMode', normalized);
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
        userActivityTracker.recordBusinessEvent(event.type, event.detail || {});
        
        // Notify listeners
        globalStatusState.listeners.forEach(listener => listener());
      }
    };

    // Listen to all talia events
    const eventTypes = [
      SAIL_SELECT_EVENT,
      SAIL_CLEAR_EVENT,
      SHIP_SELECT_EVENT,
      SHIP_CLEAR_EVENT,
      GROUP_SELECT_EVENT,
      GROUP_CLEAR_EVENT,
      'talia:publishedRates.select',
      'talia:publishedRates.clear',
      'talia:reservation.select',
      'talia:reservation.clear',
      'talia:booking.select',
      'talia:booking.clear',
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
    console.log('🎯 renderContent called with framework mode:', mode);
    return <AppWithAuth />;
  };

  return (
    <StrictMode>
      {/* Global Status Bar - visible in all modes (includes mode selector and event log; Hide Panels toggles details) */}
      <StatusBar 
        statusMessage={statusState.statusMessage}
        currentEvent={statusState.currentEvent}
        persistedEvent={statusState.persistedEvent}
        dataStatus={statusState.dataStatus}
        currentMode={mode}
        onModeChange={handleModeChange}
        userRole={userRole}
        canUseAdvancedControls={canUseAdvancedHeader(userRole)}
      />
      
      {/* Content with padding for status bar (always present) */}
      <div className="talia-app-shell">
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
          <FocusManagementProvider>
            <DevSwitcher />
          </FocusManagementProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    );
    console.log('✅ React app rendered successfully');
  } catch (error) {
    console.error('❌ React render error:', error);
    // Fallback: render error message directly to DOM
    root.innerHTML = '<h1 class="talia-startup-error">React Error: ' + error.message + '</h1>';
  }
}
