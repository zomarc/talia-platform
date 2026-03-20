/**
 * Test Page for Component Testing
 * Compact design with component selector, events, and information panels
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSailingData } from '../hooks/data/useSailingData';
import { componentRegistry, getComponentsByCategory } from './TestPage/componentRegistry';
import ComponentWrapper from './TestPage/ComponentWrapper';
import EventMonitor from './shared/EventMonitor';
import InformationPanel from './TestPage/InformationPanel';
import EventContextPanel from './TestPage/EventContextPanel';
import { LoadingSpinner, ErrorMessage } from './shared';
import queryTracker from '../services/data/queryTracker';
import { getThemeForMode } from '../themes/modeThemes';
import '../themes/dataMode.css';
import './TestPage/test-page.css';

export const TestWorkbenchPanelCore = ({ embedded = false }) => {
  // Component selection
  const [selectedComponent, setSelectedComponent] = useState('SailingTable');
  const [activeTab, setActiveTab] = useState('component');

  // Filters for SailingTable
  const [limit, setLimit] = useState(100);
  const [filters, setFilters] = useState({ limit: 100 });
  const [sailCode, setSailCode] = useState('');
  const [shipName, setShipName] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // BookingProfile props
  const [bookingProfileSailCode, setBookingProfileSailCode] = useState('CJ05251122');
  const [includeComparison, setIncludeComparison] = useState(false);

  // Data fetching
  const { 
    data: sailingData, 
    loading, 
    error, 
    refetch 
  } = useSailingData(filters);

  // Get theme for test mode
  const theme = getThemeForMode('test');

  // Component metadata
  const componentMeta = componentRegistry[selectedComponent];
  const Component = componentMeta?.component;
  const componentFile = componentMeta?.filePath || 'Unknown';
  const categories = getComponentsByCategory();

  // Restore persisted event when component changes
  const lastDispatchedRef = useRef(null);
  useEffect(() => {
    if (selectedComponent && latestEvent && lastDispatchedRef.current !== selectedComponent) {
      const eventType = latestEvent.name;
      const eventDetail = latestEvent.detail;
      
      if (eventType && eventType.includes('.select') && eventDetail) {
        lastDispatchedRef.current = selectedComponent;
        
        // Use standard CustomEvent and dispatchEvent
        const restoredEvent = new CustomEvent(eventType, {
          detail: eventDetail,
          bubbles: true
        });
        
        setTimeout(() => {
          window.dispatchEvent(restoredEvent);
        }, 100);
      }
    }
  }, [selectedComponent]);

  // Get component props based on selection
  const getComponentProps = () => {
    if (selectedComponent === 'SailingTable') {
      return { filters, theme };
    }
    if (selectedComponent === 'SimpleTable' && sailingData) {
      return { data: sailingData };
    }
    if (selectedComponent === 'BookingProfile') {
      // Use persisted sail code from event if available
      const sailCodeFromEvent = latestEvent?.detail?.sail_code || latestEvent?.detail?.row_data?.sail_code;
      return { 
        sailCode: sailCodeFromEvent || bookingProfileSailCode,
        includeComparison,
        theme 
      };
    }
    if (selectedComponent === 'PublishedRates') {
      // PublishedRates listens to sail events automatically
      return { theme };
    }
    if (selectedComponent === 'TargetProfileEditor') {
      return {
        theme,
        onSave: (profile) => {
          console.log('Target profile saved:', profile);
          alert(`Target profile "${profile.name}" saved successfully!`);
        },
        onCancel: () => {
          console.log('Target profile editing cancelled');
        }
      };
    }
    if (selectedComponent === 'DataDebugView') {
      return { theme };
    }
    if (selectedComponent === 'MasterVoyagePerformanceSummary') {
      return { theme };
    }
    if (selectedComponent === 'DataTypesValidation') {
      return { theme };
    }
    if (selectedComponent === 'DirectSourceRequest') {
      return { theme };
    }
    return {};
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setFilters(prev => ({ ...prev, limit: newLimit }));
  };

  const handleApplyFilters = () => {
    const newFilters = {
      limit: limit,
      ...(sailCode && { sail_code: sailCode }),
      ...(shipName && { ship_name: shipName }),
    };
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setSailCode('');
    setShipName('');
    setFilters({ limit: limit });
  };

  const tabs = [
    { id: 'component', label: 'Component' },
    { id: 'events', label: 'Events' },
    { id: 'information', label: 'Information' }
  ];

  // Get latest event and query info
  const [latestEvent, setLatestEvent] = useState(null);
  const [latestQuery, setLatestQuery] = useState(null);

  // Load persisted event from localStorage on mount
  useEffect(() => {
    try {
      const persistedEvent = localStorage.getItem('talia:test:lastEvent');
      if (persistedEvent) {
        const eventData = JSON.parse(persistedEvent);
        console.log('[TestPage] Restored persisted event:', eventData);
        setLatestEvent(eventData);
      }
    } catch (e) {
      console.warn('[TestPage] Error loading persisted event:', e);
    }
  }, []);

  // Listen for events using standard addEventListener (library approach)
  useEffect(() => {
    const handleEvent = (event) => {
      if (event instanceof CustomEvent && event.type.startsWith('talia:')) {
        const eventData = {
          name: event.type,
          detail: event.detail,
          timestamp: new Date().toLocaleTimeString()
        };
        setLatestEvent(eventData);
        
        // Persist to localStorage
        try {
          localStorage.setItem('talia:test:lastEvent', JSON.stringify(eventData));
        } catch (e) {
          console.warn('[TestPage] Error persisting event:', e);
        }
      }
    };
    
    // Use standard addEventListener for talia events
    const eventTypes = [
      'talia:sail.select',
      'talia:sail.clear',
      'talia:ship.select',
      'talia:ship.clear',
      'talia:publishedRates.select',
      'talia:publishedRates.clear',
      'talia:reservation.select',
      'talia:reservation.clear'
    ];
    
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleEvent, true);
    });
    
    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleEvent, true);
      });
    };
  }, []);

  // Listen for queries
  useEffect(() => {
    const unsubscribe = queryTracker.subscribe((queries) => {
      if (queries.length > 0) {
        setLatestQuery(queries[0]);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div className={`test-page ${embedded ? 'test-page--panel' : ''}`.trim()}>
      <div className="test-page__container">
        {/* Compact Header */}
        <div className="test-page__glass-card test-page__header">
          <div>
            <h1 className="test-page__header-title">
              🧪 Component Test Page
            </h1>
            <p className="test-page__header-subtitle">
              Test and inspect components with real-time monitoring
            </p>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="test-page__glass-card test-page__summary">
          <div className="test-page__summary-item">
            <span className="test-page__summary-label">Source:</span>
            <span className="test-page__summary-mono">{componentFile}</span>
          </div>
          <div className="test-page__summary-divider"></div>
          <div className="test-page__summary-item">
            <span className="test-page__summary-label">Latest Event:</span>
            <span className="test-page__summary-value" data-active={Boolean(latestEvent)}>
              {latestEvent ? `${latestEvent.name} (${latestEvent.timestamp})` : 'None'}
            </span>
            {latestEvent && localStorage.getItem('talia:test:lastEvent') && (
              <span className="test-page__summary-badge">
                💾 Persisted
              </span>
            )}
          </div>
          <div className="test-page__summary-divider"></div>
          <div className="test-page__summary-item">
            <span className="test-page__summary-label">Data Source:</span>
            <span className="test-page__summary-mono">
              /api/graphql (proxied to localhost:4000)
            </span>
            {latestQuery && (
              <span className="test-page__summary-duration">
                ({Math.round(latestQuery.duration || 0)}ms)
              </span>
            )}
          </div>
          {/* Mock Data Indicator */}
          {componentMeta?.usesMockData || window._componentMockDataFlags?.[selectedComponent] ? (
            <>
              <div className="test-page__summary-divider"></div>
              <div className="test-page__mock-indicator">
                <span>🧪</span>
                <span className="test-page__mock-label">
                  MOCK DATA
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Event Content Bar */}
        {latestEvent && latestEvent.detail && (
          <div className="test-page__event-content">
            <div className="test-page__event-content-row">
              <span className="test-page__event-content-label">Event Content:</span>
              <div className="test-page__event-content-body">
                {typeof latestEvent.detail === 'object' 
                  ? JSON.stringify(latestEvent.detail, null, 2)
                  : String(latestEvent.detail)
                }
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="test-page__glass-card test-page__tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`test-page__tab ${activeTab === tab.id ? 'is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="test-page__glass-card test-page__tab-content">
          {/* Component Tab */}
          {activeTab === 'component' && (
            <div className="test-page__component-tab">
              {/* Component Selector */}
              <div className="test-page__selector-row">
                <div className="test-page__selector-col">
                  <label className="test-page__label">
                    Component
                  </label>
                  <select
                    value={selectedComponent}
                    onChange={(e) => setSelectedComponent(e.target.value)}
                    className="test-page__select"
                  >
                    {Object.entries(categories).map(([category, components]) => (
                      <optgroup key={category} label={category}>
                        {components.map(comp => (
                          <option key={comp.name} value={comp.name}>
                            {comp.name} - {comp.description}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="test-page__toggle-btn"
                  data-active={showFilters}
                >
                  {showFilters ? '▼' : '▶'} Filters
                </button>
              </div>

              {/* Collapsible Filters */}
              {showFilters && (
                <div className="test-page__filters">
                  {/* BookingProfile Filters */}
                  {selectedComponent === 'BookingProfile' ? (
                    <div className="test-page__filter-stack">
                      <div>
                        <label className="test-page__label">
                          Sail Code
                        </label>
                        <input
                          type="text"
                          value={bookingProfileSailCode}
                          onChange={(e) => setBookingProfileSailCode(e.target.value)}
                          placeholder="e.g., CJ07250901"
                          className="test-page__input"
                        />
                      </div>
                      <div>
                        <label className="test-page__checkbox-label">
                          <input
                            type="checkbox"
                            checked={includeComparison}
                            onChange={(e) => setIncludeComparison(e.target.checked)}
                            className="test-page__checkbox"
                          />
                          Include Year-over-Year Comparison
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="test-page__filter-grid">
                      <div>
                        <label className="test-page__label">
                          Sail Code
                        </label>
                        <input
                          type="text"
                          value={sailCode}
                          onChange={(e) => setSailCode(e.target.value)}
                          placeholder="Filter by sail code..."
                          className="test-page__input"
                        />
                      </div>
                      <div>
                        <label className="test-page__label">
                          Ship Name
                        </label>
                        <input
                          type="text"
                          value={shipName}
                          onChange={(e) => setShipName(e.target.value)}
                          placeholder="Filter by ship name..."
                          className="test-page__input"
                        />
                      </div>
                    <div>
                      <label className="test-page__label">
                        Limit
                      </label>
                      <input
                        type="number"
                        value={limit}
                        onChange={(e) => handleLimitChange(parseInt(e.target.value) || 100)}
                        min="10"
                        max="1000"
                        step="10"
                        className="test-page__input"
                      />
                    </div>
                    <div className="test-page__filter-actions">
                      <button
                        onClick={handleApplyFilters}
                        className="test-page__btn test-page__btn--primary"
                      >
                        Apply
                      </button>
                      <button
                        onClick={handleClearFilters}
                        className="test-page__btn test-page__btn--ghost"
                      >
                        Clear
                      </button>
                      <button
                        onClick={refetch}
                        className="test-page__btn test-page__btn--ghost"
                      >
                        ↻ Refresh
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Component Render Area */}
              <div className="test-page__component-area">
                {loading && selectedComponent === 'SailingTable' && (
                  <LoadingSpinner size="small" message="Loading data..." />
                )}
                {error && selectedComponent === 'SailingTable' && (
                  <ErrorMessage error={error} title="Error loading data" onRetry={refetch} />
                )}
                {Component && (
                  <ComponentWrapper
                    componentName={selectedComponent}
                    Component={Component}
                    props={getComponentProps()}
                    theme={theme}
                  />
                )}
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div className="test-page__events-tab">
              <div className="test-page__events-meta">
                Showing events for: <strong className="test-page__events-meta-strong">{selectedComponent}</strong>
              </div>
              <div className="test-page__events-grid">
                <div className="test-page__events-panel">
                  <EventMonitor componentFilter={selectedComponent} />
                </div>
                <div className="test-page__events-panel">
                  <EventContextPanel latestEvent={latestEvent} selectedComponent={selectedComponent} />
                </div>
              </div>
            </div>
          )}

          {/* Information Tab */}
          {activeTab === 'information' && (
            <div className="test-page__information-tab">
              <InformationPanel 
                selectedComponent={selectedComponent}
                performanceData={null} // Will be passed from ComponentWrapper if needed
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TestPage = ({ embedded = false }) => <TestWorkbenchPanelCore embedded={embedded} />;

export default TestPage;
