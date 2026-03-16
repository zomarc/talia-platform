/**
 * StatusBar Component
 * 
 * Unified title bar at the top of the page showing:
 * - Focus save confirmations
 * - Current event from report selection
 * - Persisted event information
 * - Mode selection (integrated on the right)
 * - Clickable to view details
 */

import React, { useState, useEffect } from 'react';
import ModeSelector from '../ModeSelector';
import { canUseAdvancedHeader } from '../../utils/roleUtils';
// CSS imported globally in main.jsx
const DASHBOARD_TOGGLE_SIDEBAR_EVENT = 'talia:dashboard.toggleSidebar';
const DASHBOARD_SIDEBAR_STATE_EVENT = 'talia:dashboard.sidebarState';
const DASHBOARD_FILTER_VISIBILITY_EVENT = 'talia:dashboard.filterVisibility';
const DASHBOARD_CYCLE_FOCUS_EVENT = 'talia:dashboard.cycleFocus';
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';
const DASHBOARD_DETAILS_VISIBILITY_EVENT = 'talia:dashboard.detailsVisibility';

const StatusBar = ({
  statusMessage,
  currentEvent,
  persistedEvent,
  currentMode,
  onModeChange,
  dataStatus,
  userRole,
  canUseAdvancedControls
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [displayMessage, setDisplayMessage] = useState(statusMessage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => !!window.__taliaSidebarCollapsed);
  const [filtersVisible, setFiltersVisible] = useState(() => window.__taliaFiltersVisible !== false);
  const [viewScope, setViewScope] = useState(() => window.__taliaViewScope === 'wide' ? 'wide' : 'local');
  const appVersion = import.meta.env.VITE_APP_VERSION || '0.1.4';
  const hasAdvancedControls = typeof canUseAdvancedControls === 'boolean'
    ? canUseAdvancedControls
    : canUseAdvancedHeader(userRole);

  // Update display message when statusMessage changes
  useEffect(() => {
    if (statusMessage) {
      setDisplayMessage(statusMessage);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setDisplayMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    const handleSidebarState = (event) => {
      const collapsed = event?.detail?.collapsed;
      if (typeof collapsed === 'boolean') {
        setSidebarCollapsed(collapsed);
      }
    };
    window.addEventListener(DASHBOARD_SIDEBAR_STATE_EVENT, handleSidebarState);
    return () => window.removeEventListener(DASHBOARD_SIDEBAR_STATE_EVENT, handleSidebarState);
  }, []);

  const handleSidebarToggle = () => {
    window.dispatchEvent(new CustomEvent(DASHBOARD_TOGGLE_SIDEBAR_EVENT));
  };

  const handleFiltersToggle = () => {
    setFiltersVisible((prev) => !prev);
  };

  const handleCycleFocus = () => {
    window.dispatchEvent(new CustomEvent(DASHBOARD_CYCLE_FOCUS_EVENT));
  };

  const handleViewScopeToggle = () => {
    setViewScope((prev) => (prev === 'wide' ? 'local' : 'wide'));
  };

  const getActivePanelTarget = () => {
    const panelApi = window?.dockviewApi?.activePanel?.api || null;
    const panelId = panelApi?.id || null;
    const panelComponent = panelApi?.component || null;
    return { panelId, panelComponent };
  };

  const getPanelDetailsVisible = (panelId, panelComponent) => {
    const store = window.__taliaPanelDetailsVisibility || {};
    if (panelId && Object.prototype.hasOwnProperty.call(store, panelId)) {
      return store[panelId] !== false;
    }
    if (panelComponent && Object.prototype.hasOwnProperty.call(store, panelComponent)) {
      return store[panelComponent] !== false;
    }
    return true;
  };

  const handleDetailsToggle = () => {
    const { panelId, panelComponent } = getActivePanelTarget();
    if (!panelId && !panelComponent) return;
    const currentVisible = getPanelDetailsVisible(panelId, panelComponent);
    const nextVisible = !currentVisible;
    window.__taliaPanelDetailsVisibility = {
      ...(window.__taliaPanelDetailsVisibility || {}),
      ...(panelId ? { [panelId]: nextVisible } : {}),
      ...(panelComponent ? { [panelComponent]: nextVisible } : {}),
    };
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_DETAILS_VISIBILITY_EVENT, {
        detail: {
          panelId,
          panelComponent,
          visible: nextVisible,
          action: 'set',
        },
      })
    );
  };

  useEffect(() => {
    window.__taliaFiltersVisible = filtersVisible;
    const root = document.documentElement;
    if (filtersVisible) {
      root.classList.remove('talia-filters-hidden');
    } else {
      root.classList.add('talia-filters-hidden');
    }
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_FILTER_VISIBILITY_EVENT, {
        detail: { visible: filtersVisible },
      })
    );
  }, [filtersVisible]);

  useEffect(() => {
    window.__taliaViewScope = viewScope;
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_VIEW_SCOPE_EVENT, {
        detail: { scope: viewScope },
      })
    );
  }, [viewScope]);

  // Get event summary
  const getEventSummary = (event) => {
    if (!event) return null;
    
    const eventType = event.name || event.eventType || 'Unknown';
    const detail = event.detail || event.rowData || {};
    
    // Extract key information
    const source = event.source || eventType.replace('talia:', '').replace('.select', '').replace('.clear', '');
    const timestamp = event.timestamp || detail.timestamp || new Date().toLocaleTimeString();
    
    // Get primary identifier from detail
    let identifier = '';
    if (detail.sail_code) identifier = `Sail: ${detail.sail_code}`;
    else if (detail.ship_code) identifier = `Ship: ${detail.ship_code}`;
    else if (detail.id) identifier = `ID: ${detail.id}`;
    else if (detail.title) identifier = detail.title;
    else if (Object.keys(detail).length > 0) {
      // Try to find a meaningful identifier
      const keys = Object.keys(detail);
      const firstKey = keys.find(k => k !== 'timestamp' && k !== 'row_data');
      if (firstKey) identifier = `${firstKey}: ${detail[firstKey]}`;
    }
    
    return {
      source,
      identifier,
      timestamp,
      eventType,
      detail
    };
  };

  const currentEventSummary = getEventSummary(currentEvent);
  const persistedEventSummary = getEventSummary(persistedEvent);
  const formatRange = (range) => {
    if (!range || (!range.min && !range.max)) return 'N/A';
    const min = range.min ? String(range.min).split('T')[0] : 'N/A';
    const max = range.max ? String(range.max).split('T')[0] : 'N/A';
    return min === max ? min : `${min} → ${max}`;
  };
  const dataRangeText = formatRange(dataStatus?.globalRange);
  const dataLastSyncText = dataStatus?.lastSync
    ? new Date(dataStatus.lastSync).toLocaleString()
    : 'N/A';

  // Always render - mode selector should always be visible
  return (
    <div className="status-bar">
      <div className="status-bar__container">
        {/* Left side: Status messages and events */}
        <div className="status-bar__left">
          {/* Status Message (temporary) */}
          {displayMessage && (
            <div className="status-bar__message status-bar__message--success">
              <span className="status-bar__icon">✓</span>
              <span className="status-bar__text">{displayMessage}</span>
            </div>
          )}

          {/* Current Event */}
          {hasAdvancedControls && currentEventSummary && (
            <div 
              className="status-bar__item status-bar__item--clickable"
              onClick={() => setShowDetails(!showDetails)}
              title="Click to view details"
            >
              <span className="status-bar__label">Current Event:</span>
              <span className="status-bar__value">
                {currentEventSummary.source}
                {currentEventSummary.identifier && ` - ${currentEventSummary.identifier}`}
              </span>
              <span className="status-bar__timestamp">{currentEventSummary.timestamp}</span>
              <span className="status-bar__expand">{showDetails ? '▲' : '▼'}</span>
            </div>
          )}

          {/* Persisted Event */}
          {hasAdvancedControls && persistedEventSummary && (
            <div 
              className="status-bar__item status-bar__item--clickable"
              onClick={() => setShowDetails(!showDetails)}
              title="Click to view details"
            >
              <span className="status-bar__label">Persisted:</span>
              <span className="status-bar__value">
                {persistedEventSummary.source}
                {persistedEventSummary.identifier && ` - ${persistedEventSummary.identifier}`}
              </span>
              <span className="status-bar__timestamp">{persistedEventSummary.timestamp}</span>
            </div>
          )}

          {currentMode === 'data' && dataStatus && (
            <div className="status-bar__item" title="Global data range and last sync">
              <span className="status-bar__label">Data:</span>
              <span className="status-bar__value">Range {dataRangeText}</span>
              <span className="status-bar__timestamp">Last Sync {dataLastSyncText}</span>
            </div>
          )}
        </div>

        {currentMode === 'app' && (
          <div className="status-bar__header">
            <button
              type="button"
              className="status-bar__header-btn"
              onClick={handleSidebarToggle}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {sidebarCollapsed ? '☰' : '◧'}
            </button>
            <button
              type="button"
              className={`status-bar__header-btn ${filtersVisible ? 'status-bar__header-btn--active' : ''}`}
              onClick={handleFiltersToggle}
              title={filtersVisible ? 'Hide filters on all reports' : 'Show filters on all reports'}
              aria-label={filtersVisible ? 'Hide filters on all reports' : 'Show filters on all reports'}
            >
              ▾
            </button>
            <button
              type="button"
              className={`status-bar__header-btn ${viewScope === 'wide' ? 'status-bar__header-btn--active' : ''}`}
              onClick={handleViewScopeToggle}
              title={viewScope === 'wide' ? 'Wide view active (click for local view)' : 'Local view active (click for wide view)'}
              aria-label={viewScope === 'wide' ? 'Switch to local view' : 'Switch to wide view'}
            >
              {viewScope === 'wide' ? 'W' : 'L'}
            </button>
            <button
              type="button"
              className="status-bar__header-btn"
              onClick={handleDetailsToggle}
              title="Show/hide details on active panel"
              aria-label="Show or hide details on active panel"
            >
              ≣
            </button>
            {hasAdvancedControls && (
              <>
                <button
                  type="button"
                  className="status-bar__header-btn status-bar__header-btn--focus"
                  onClick={handleCycleFocus}
                  title="Cycle focus"
                  aria-label="Cycle focus"
                >
                  ⟳
                </button>
              </>
            )}
            <span className="status-bar__header-title">{`Dockview Dashboard - Talia Professional v${appVersion}-dev`}</span>
          </div>
        )}

        {/* Right side: Mode selector (always visible) */}
        {currentMode && onModeChange && (
          <div className="status-bar__right">
            <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
          </div>
        )}
      </div>

      {/* Details Panel */}
      {hasAdvancedControls && showDetails && (currentEventSummary || persistedEventSummary) && (
        <div className="status-bar__details">
          <div className="status-bar__details-header">
            <span className="status-bar__details-title">Event Details</span>
            <button 
              className="status-bar__details-close"
              onClick={() => setShowDetails(false)}
              title="Close"
            >
              ×
            </button>
          </div>
          
          <div className="status-bar__details-content">
            {currentEventSummary && (
              <div className="status-bar__details-section">
                <div className="status-bar__details-section-title">Current Event</div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Type:</span>
                  <span className="status-bar__details-value">{currentEventSummary.eventType}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Source:</span>
                  <span className="status-bar__details-value">{currentEventSummary.source}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Timestamp:</span>
                  <span className="status-bar__details-value">{currentEventSummary.timestamp}</span>
                </div>
                <div className="status-bar__details-data">
                  <span className="status-bar__details-label">Data:</span>
                  <pre className="status-bar__details-json">
                    {JSON.stringify(currentEventSummary.detail, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {persistedEventSummary && (
              <div className="status-bar__details-section">
                <div className="status-bar__details-section-title">Persisted Event</div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Type:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.eventType}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Source:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.source}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Timestamp:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.timestamp}</span>
                </div>
                <div className="status-bar__details-data">
                  <span className="status-bar__details-label">Data:</span>
                  <pre className="status-bar__details-json">
                    {JSON.stringify(persistedEventSummary.detail, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusBar;
