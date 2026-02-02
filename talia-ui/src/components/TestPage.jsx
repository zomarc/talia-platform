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

const TestPage = () => {
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
    <div style={{
      padding: '12px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      backgroundAttachment: 'fixed',
      minHeight: '100vh',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        {/* Compact Header */}
        <div style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          border: `1px solid ${theme.colors.glassBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', color: theme.colors.foreground, fontWeight: '600' }}>
              🧪 Component Test Page
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'rgba(224, 224, 224, 0.7)', fontSize: '12px' }}>
              Test and inspect components with real-time monitoring
            </p>
          </div>
        </div>

        {/* Summary Bar */}
        <div style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '8px 16px',
          borderRadius: '12px',
          marginBottom: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          border: `1px solid ${theme.colors.glassBorder}`,
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          fontSize: '11px',
          borderLeft: `3px solid ${theme.colors.accent}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'rgba(224, 224, 224, 0.7)', fontWeight: '500' }}>Source:</span>
            <span style={{ color: theme.colors.foreground, fontFamily: 'monospace' }}>{componentFile}</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'rgba(224, 224, 224, 0.7)', fontWeight: '500' }}>Latest Event:</span>
            <span style={{ color: latestEvent ? theme.colors.accent : 'rgba(224, 224, 224, 0.5)' }}>
              {latestEvent ? `${latestEvent.name} (${latestEvent.timestamp})` : 'None'}
            </span>
            {latestEvent && localStorage.getItem('talia:test:lastEvent') && (
              <span style={{ 
                fontSize: '10px', 
                color: '#4caf50',
                marginLeft: '4px',
                padding: '2px 6px',
                background: 'rgba(76, 175, 80, 0.2)',
                borderRadius: '4px'
              }}>
                💾 Persisted
              </span>
            )}
          </div>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'rgba(224, 224, 224, 0.7)', fontWeight: '500' }}>Data Source:</span>
            <span style={{ color: theme.colors.foreground, fontFamily: 'monospace' }}>
              /api/graphql (proxied to localhost:4000)
            </span>
            {latestQuery && (
              <span style={{ color: '#4caf50', marginLeft: '4px' }}>
                ({Math.round(latestQuery.duration || 0)}ms)
              </span>
            )}
          </div>
          {/* Mock Data Indicator */}
          {componentMeta?.usesMockData || window._componentMockDataFlags?.[selectedComponent] ? (
            <>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '4px 8px',
                background: 'rgba(255, 193, 7, 0.2)',
                borderRadius: '6px',
                border: '1px solid rgba(255, 193, 7, 0.4)'
              }}>
                <span style={{ fontSize: '14px' }}>🧪</span>
                <span style={{ color: '#ffc107', fontWeight: '600', fontSize: '11px' }}>
                  MOCK DATA
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Event Content Bar */}
        {latestEvent && latestEvent.detail && (
          <div style={{
            background: 'rgba(255, 193, 7, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '8px 16px',
            borderRadius: '12px',
            marginBottom: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderLeft: `3px solid #ffc107`,
            fontSize: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ color: 'rgba(224, 224, 224, 0.9)', fontWeight: '500', minWidth: '80px' }}>Event Content:</span>
              <div style={{ 
                flex: 1, 
                fontFamily: 'monospace', 
                color: theme.colors.foreground,
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                maxHeight: '80px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {typeof latestEvent.detail === 'object' 
                  ? JSON.stringify(latestEvent.detail, null, 2)
                  : String(latestEvent.detail)
                }
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '12px 12px 0 0',
          border: `1px solid ${theme.colors.glassBorder}`,
          borderBottom: `1px solid ${theme.colors.glassBorder}`,
          padding: '0 12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? theme.colors.accent : 'rgba(224, 224, 224, 0.7)',
                marginRight: '8px',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          border: `1px solid ${theme.colors.glassBorder}`,
          borderTop: 'none',
          minHeight: '600px'
        }}>
          {/* Component Tab */}
          {activeTab === 'component' && (
            <div style={{ padding: '12px' }}>
              {/* Component Selector */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'rgba(224, 224, 224, 0.7)',
                    marginBottom: '4px',
                    fontWeight: '500'
                  }}>
                    Component
                  </label>
                  <select
                    value={selectedComponent}
                    onChange={(e) => setSelectedComponent(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: `1px solid ${theme.colors.glassBorder}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: theme.colors.foreground
                    }}
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
                  style={{
                    padding: '6px 12px',
                    background: showFilters ? theme.colors.accent : theme.colors.glass,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: showFilters ? '#0f0f23' : theme.colors.foreground,
                    border: `1px solid ${theme.colors.glassBorder}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    alignSelf: 'flex-end',
                    marginTop: '20px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  {showFilters ? '▼' : '▶'} Filters
                </button>
              </div>

              {/* Collapsible Filters */}
              {showFilters && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: `1px solid ${theme.colors.glassBorder}`
                }}>
                  {/* BookingProfile Filters */}
                  {selectedComponent === 'BookingProfile' ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '11px',
                          color: 'rgba(224, 224, 224, 0.7)',
                          marginBottom: '4px',
                          fontWeight: '500'
                        }}>
                          Sail Code
                        </label>
                        <input
                          type="text"
                          value={bookingProfileSailCode}
                          onChange={(e) => setBookingProfileSailCode(e.target.value)}
                          placeholder="e.g., CJ07250901"
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: `1px solid ${theme.colors.glassBorder}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            color: theme.colors.foreground,
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11px',
                          color: 'rgba(224, 224, 224, 0.7)',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={includeComparison}
                            onChange={(e) => setIncludeComparison(e.target.checked)}
                            style={{
                              width: '16px',
                              height: '16px',
                              cursor: 'pointer'
                            }}
                          />
                          Include Year-over-Year Comparison
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '11px',
                          color: 'rgba(224, 224, 224, 0.7)',
                          marginBottom: '4px',
                          fontWeight: '500'
                        }}>
                          Sail Code
                        </label>
                        <input
                          type="text"
                          value={sailCode}
                          onChange={(e) => setSailCode(e.target.value)}
                          placeholder="Filter by sail code..."
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: `1px solid ${theme.colors.glassBorder}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            color: theme.colors.foreground,
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '11px',
                          color: 'rgba(224, 224, 224, 0.7)',
                          marginBottom: '4px',
                          fontWeight: '500'
                        }}>
                          Ship Name
                        </label>
                        <input
                          type="text"
                          value={shipName}
                          onChange={(e) => setShipName(e.target.value)}
                          placeholder="Filter by ship name..."
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: `1px solid ${theme.colors.glassBorder}`,
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            color: theme.colors.foreground,
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)'
                          }}
                        />
                      </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: 'rgba(224, 224, 224, 0.7)',
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        Limit
                      </label>
                      <input
                        type="number"
                        value={limit}
                        onChange={(e) => handleLimitChange(parseInt(e.target.value) || 100)}
                        min="10"
                        max="1000"
                        step="10"
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: `1px solid ${theme.colors.glassBorder}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'rgba(0, 0, 0, 0.4)',
                          color: theme.colors.foreground,
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={handleApplyFilters}
                        style={{
                          padding: '6px 12px',
                          background: theme.colors.accent,
                          color: '#0f0f23',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'all 0.2s'
                        }}
                      >
                        Apply
                      </button>
                      <button
                        onClick={handleClearFilters}
                        style={{
                          padding: '6px 12px',
                          background: theme.colors.glass,
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: theme.colors.foreground,
                          border: `1px solid ${theme.colors.glassBorder}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.2s'
                        }}
                      >
                        Clear
                      </button>
                      <button
                        onClick={refetch}
                        style={{
                          padding: '6px 12px',
                          background: theme.colors.glass,
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: theme.colors.foreground,
                          border: `1px solid ${theme.colors.glassBorder}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.2s'
                        }}
                      >
                        ↻ Refresh
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Component Render Area */}
              <div style={{
                border: `1px solid ${theme.colors.glassBorder}`,
                borderRadius: '8px',
                padding: '12px',
                minHeight: '500px',
                background: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
              }}>
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
            <div style={{ padding: '12px', height: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(224, 224, 224, 0.7)' }}>
                Showing events for: <strong style={{ color: theme.colors.foreground }}>{selectedComponent}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <EventMonitor componentFilter={selectedComponent} theme={theme} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <EventContextPanel latestEvent={latestEvent} theme={theme} selectedComponent={selectedComponent} />
                </div>
              </div>
            </div>
          )}

          {/* Information Tab */}
          {activeTab === 'information' && (
            <div style={{ height: '600px' }}>
              <InformationPanel 
                selectedComponent={selectedComponent}
                performanceData={null} // Will be passed from ComponentWrapper if needed
                theme={theme}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestPage;
