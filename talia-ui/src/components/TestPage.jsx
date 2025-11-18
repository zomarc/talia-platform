/**
 * Test Page for Component Testing
 * Compact design with component selector, events, and information panels
 */

import React, { useState, useEffect } from 'react';
import { useSailingData } from '../hooks/data/useSailingData';
import { componentRegistry, getComponentsByCategory } from './TestPage/componentRegistry';
import ComponentWrapper from './TestPage/ComponentWrapper';
import EventMonitor from './shared/EventMonitor';
import InformationPanel from './TestPage/InformationPanel';
import { LoadingSpinner, ErrorMessage } from './shared';
import queryTracker from '../services/data/queryTracker';

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

  // Data fetching
  const { 
    data: sailingData, 
    loading, 
    error, 
    refetch 
  } = useSailingData(filters);

  // Theme
  const theme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      sidebar: '#f7f3ee',
      sidebarBorder: '#e8dfd0',
      sidebarHeader: '#f5efe6',
      accent: '#b08d57',
    }
  };

  // Component metadata
  const componentMeta = componentRegistry[selectedComponent];
  const Component = componentMeta?.component;
  const componentFile = componentMeta?.filePath || 'Unknown';
  const categories = getComponentsByCategory();

  // Get component props based on selection
  const getComponentProps = () => {
    if (selectedComponent === 'SailingTable') {
      return { filters, theme };
    }
    if (selectedComponent === 'SimpleTable' && sailingData) {
      return { data: sailingData };
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

  // Listen for events - intercept ALL custom events
  useEffect(() => {
    const handleEvent = (event) => {
      if (event instanceof CustomEvent) {
        console.log('[TestPage] Event captured:', event.type, event.detail);
        setLatestEvent({
          name: event.type,
          detail: event.detail,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    };
    
    // Intercept dispatchEvent to catch all custom events
    const originalDispatchEvent = window.dispatchEvent.bind(window);
    window.dispatchEvent = function(event) {
      if (event instanceof CustomEvent) {
        handleEvent(event);
      }
      return originalDispatchEvent(event);
    };
    
    // Also listen directly for talia events
    window.addEventListener('talia:sailing.select', handleEvent, true);
    window.addEventListener('talia:sailing.clear', handleEvent, true);
    window.addEventListener('talia:sail.select', handleEvent, true);
    window.addEventListener('talia:sail.clear', handleEvent, true);
    
    return () => {
      window.dispatchEvent = originalDispatchEvent;
      window.removeEventListener('talia:sailing.select', handleEvent, true);
      window.removeEventListener('talia:sailing.clear', handleEvent, true);
      window.removeEventListener('talia:sail.select', handleEvent, true);
      window.removeEventListener('talia:sail.clear', handleEvent, true);
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
      background: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        {/* Compact Header */}
        <div style={{
          background: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', color: '#2b2b2b' }}>
              🧪 Component Test Page
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '12px' }}>
              Test and inspect components with real-time monitoring
            </p>
          </div>
        </div>

        {/* Summary Bar */}
        <div style={{
          background: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          marginBottom: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          fontSize: '11px',
          borderLeft: '3px solid #b08d57'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#666', fontWeight: '500' }}>Source:</span>
            <span style={{ color: '#333', fontFamily: 'monospace' }}>{componentFile}</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: '#e0e0e0' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#666', fontWeight: '500' }}>Latest Event:</span>
            <span style={{ color: latestEvent ? '#b08d57' : '#999' }}>
              {latestEvent ? `${latestEvent.name} (${latestEvent.timestamp})` : 'None'}
            </span>
          </div>
          <div style={{ width: '1px', height: '20px', background: '#e0e0e0' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#666', fontWeight: '500' }}>Data Source:</span>
            <span style={{ color: '#333', fontFamily: 'monospace' }}>
              http://localhost:4000/graphql
            </span>
            {latestQuery && (
              <span style={{ color: '#4caf50', marginLeft: '4px' }}>
                ({Math.round(latestQuery.duration || 0)}ms)
              </span>
            )}
          </div>
        </div>

        {/* Event Content Bar */}
        {latestEvent && latestEvent.detail && (
          <div style={{
            background: '#fff9e6',
            padding: '8px 16px',
            borderRadius: '8px',
            marginBottom: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderLeft: '3px solid #ffc107',
            fontSize: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ color: '#666', fontWeight: '500', minWidth: '80px' }}>Event Content:</span>
              <div style={{ 
                flex: 1, 
                fontFamily: 'monospace', 
                color: '#333',
                background: '#fff',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #e0e0e0',
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
          background: 'white',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid #e0e0e0',
          padding: '0 12px'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #b08d57' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? '#b08d57' : '#666',
                marginRight: '8px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{
          background: 'white',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
                    color: '#666',
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
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '13px',
                      background: 'white'
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
                    background: showFilters ? '#b08d57' : '#e0e0e0',
                    color: showFilters ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    alignSelf: 'flex-end',
                    marginTop: '20px'
                  }}
                >
                  {showFilters ? '▼' : '▶'} Filters
                </button>
              </div>

              {/* Collapsible Filters */}
              {showFilters && (
                <div style={{
                  padding: '12px',
                  background: '#f9f9f9',
                  borderRadius: '4px',
                  marginBottom: '12px'
                }}>
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
                        color: '#666',
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
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#666',
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
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#666',
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
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleApplyFilters}
                      style={{
                        padding: '6px 12px',
                        background: '#b08d57',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleClearFilters}
                      style={{
                        padding: '6px 12px',
                        background: '#e0e0e0',
                        color: '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={refetch}
                      style={{
                        padding: '6px 12px',
                        background: '#e0e0e0',
                        color: '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>
              )}

              {/* Component Render Area */}
              <div style={{
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                padding: '12px',
                minHeight: '500px',
                background: '#fafafa'
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
            <div style={{ padding: '12px', height: '600px' }}>
              <div style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
                Showing events for: <strong>{selectedComponent}</strong>
              </div>
              <EventMonitor componentFilter={selectedComponent} />
            </div>
          )}

          {/* Information Tab */}
          {activeTab === 'information' && (
            <div style={{ height: '600px' }}>
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

export default TestPage;
