/**
 * Information Panel Component
 * Displays files, queries, source, and performance information
 */

import React, { useState, useEffect } from 'react';
import queryTracker from '../../services/data/queryTracker';
import { componentRegistry } from './componentRegistry';

const InformationPanel = ({ selectedComponent, performanceData }) => {
  const [activeTab, setActiveTab] = useState('queries');
  const [queries, setQueries] = useState([]);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const updateQueries = () => {
      setQueries(queryTracker.getQueries());
      setMetrics(queryTracker.getMetrics());
    };

    updateQueries();
    const unsubscribe = queryTracker.subscribe(updateQueries);

    return unsubscribe;
  }, []);

  const tabs = [
    { id: 'files', label: 'Files' },
    { id: 'queries', label: 'Queries' },
    { id: 'source', label: 'Source' },
    { id: 'performance', label: 'Performance' }
  ];

  const renderFilesTab = () => {
    const componentMeta = selectedComponent 
      ? componentRegistry[selectedComponent]
      : null;

    if (!componentMeta) {
      return (
        <div style={{ padding: '16px', color: '#666', fontSize: '13px' }}>
          Select a component to view file information
        </div>
      );
    }

    // Determine presenter file name based on component name
    const componentName = selectedComponent || '';
    const presenterFileName = componentName === 'SailingTable' 
      ? 'SailingTablePresenter.jsx'
      : componentName === 'PublishedRates'
      ? 'PublishedRatesPresenter.jsx'
      : componentName === 'ReservationCurrentState'
      ? 'ReservationCurrentStatePresenter.jsx'
      : componentName === 'BookingProfile'
      ? 'BookingProfilePresenter.jsx'
      : null;

    const imports = [
      { name: 'Component', path: componentMeta.filePath },
      ...(componentMeta.filePath.includes('/index.jsx') ? [] : [
        { name: 'Container', path: componentMeta.filePath.replace('.jsx', '/index.jsx') }
      ]),
      ...(presenterFileName ? [
        { name: 'Presenter', path: componentMeta.filePath.replace('index.jsx', presenterFileName) }
      ] : [])
    ].filter(imp => imp.path);

    return (
      <div style={{ padding: '12px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
            {selectedComponent}
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
            {componentMeta.description}
          </p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#666' }}>
            File Dependencies
          </h5>
          <div style={{ 
            background: '#f5f5f5', 
            borderRadius: '4px', 
            padding: '8px',
            fontSize: '11px',
            fontFamily: 'monospace'
          }}>
            {imports.map((imp, idx) => (
              <div key={idx} style={{ marginBottom: '4px', color: '#333' }}>
                {imp.path}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#666' }}>
            Props
          </h5>
          <div style={{ fontSize: '11px' }}>
            {Object.entries(componentMeta.props || {}).map(([key, prop]) => (
              <div key={key} style={{ marginBottom: '6px', padding: '6px', background: '#f9f9f9', borderRadius: '3px' }}>
                <strong>{key}</strong> ({prop.type})
                {prop.required && <span style={{ color: '#f44336', marginLeft: '4px' }}>*</span>}
                {prop.description && (
                  <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>
                    {prop.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderQueriesTab = () => {
    const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
    };

    return (
      <div style={{ padding: '12px' }}>
        {metrics && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '11px' }}>
              <div style={{ color: '#666' }}>Total</div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{metrics.totalQueries}</div>
            </div>
            <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '11px' }}>
              <div style={{ color: '#666' }}>Success</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: '#4caf50' }}>{metrics.successfulQueries}</div>
            </div>
            <div style={{ padding: '8px', background: '#ffebee', borderRadius: '4px', fontSize: '11px' }}>
              <div style={{ color: '#666' }}>Failed</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: '#f44336' }}>{metrics.failedQueries}</div>
            </div>
            <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '11px' }}>
              <div style={{ color: '#666' }}>Avg Time</div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{metrics.avgDuration}ms</div>
            </div>
          </div>
        )}

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {queries.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
              No queries tracked yet
            </div>
          ) : (
            queries.map((query, idx) => (
              <div 
                key={query.id || idx}
                style={{
                  marginBottom: '8px',
                  padding: '10px',
                  background: query.status === 'error' ? '#ffebee' : '#f9f9f9',
                  borderRadius: '4px',
                  border: `1px solid ${query.status === 'error' ? '#f44336' : '#e0e0e0'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11px' }}>
                    <strong>{query.component}</strong> - {query.purpose}
                    {query.status === 'error' && (
                      <span style={{ color: '#f44336', marginLeft: '8px' }}>✗ Error</span>
                    )}
                    {query.status === 'success' && (
                      <span style={{ color: '#4caf50', marginLeft: '8px' }}>✓ Success</span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    {query.duration !== null ? `${Math.round(query.duration)}ms` : 'pending'}
                  </div>
                </div>
                
                <div style={{ 
                  background: '#fff', 
                  padding: '8px', 
                  borderRadius: '3px',
                  marginBottom: '6px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  maxHeight: '100px',
                  overflow: 'auto',
                  position: 'relative'
                }}>
                  <button
                    onClick={() => copyToClipboard(query.query)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      padding: '2px 6px',
                      background: '#e0e0e0',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '9px'
                    }}
                  >
                    Copy
                  </button>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {queryTracker.formatQuery(query.query)}
                  </pre>
                </div>

                {Object.keys(query.variables || {}).length > 0 && (
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                    Variables: {JSON.stringify(query.variables, null, 2)}
                  </div>
                )}

                {query.error && (
                  <div style={{ 
                    marginTop: '6px', 
                    padding: '6px', 
                    background: '#ffebee', 
                    borderRadius: '3px',
                    fontSize: '10px',
                    color: '#c62828'
                  }}>
                    {query.error}
                  </div>
                )}

                <div style={{ fontSize: '9px', color: '#999', marginTop: '4px' }}>
                  {new Date(query.timestamp).toLocaleTimeString()}
                  {query.responseSize && ` • ${(query.responseSize / 1024).toFixed(2)} KB`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderSourceTab = () => {
    return (
      <div style={{ padding: '12px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
            Data Source
          </h4>
          <div style={{ 
            padding: '10px', 
            background: '#f5f5f5', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <div style={{ marginBottom: '6px' }}>
              <strong>GraphQL Endpoint:</strong>
              <div style={{ fontFamily: 'monospace', color: '#333', marginTop: '2px' }}>
                /api/graphql (proxied to localhost:4000)
              </div>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <strong>Service:</strong> sailingsService
            </div>
            <div>
              <strong>Status:</strong>{' '}
              <span style={{ color: '#4caf50' }}>● Connected</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
            Service Files
          </h4>
          <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
            <div style={{ marginBottom: '4px' }}>src/services/data/sailingsService.js</div>
            <div style={{ marginBottom: '4px' }}>src/hooks/data/useSailingData.js</div>
            <div style={{ marginBottom: '4px' }}>src/services/data/queryTracker.js</div>
          </div>
        </div>
      </div>
    );
  };

  const renderPerformanceTab = () => {
    return (
      <div style={{ padding: '12px' }}>
        {metrics && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
              Query Performance
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Success Rate</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{metrics.successRate}%</div>
              </div>
              <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Avg Duration</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{metrics.avgDuration}ms</div>
              </div>
              <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Total Data</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>
                  {(metrics.totalDataSize / 1024).toFixed(2)} KB
                </div>
              </div>
              <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Avg Size</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>
                  {(metrics.avgDataSize / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>
          </div>
        )}

        {performanceData && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
              Component Performance
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Render Count</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{performanceData.renderCount || 0}</div>
              </div>
              <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Avg Render Time</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>
                  {performanceData.avgRenderTime ? `${performanceData.avgRenderTime}ms` : 'N/A'}
                </div>
              </div>
              {performanceData.mountTime && (
                <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Mount Time</div>
                  <div style={{ fontSize: '18px', fontWeight: '600' }}>
                    {Math.round(performanceData.mountTime)}ms
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e0e0e0',
        background: '#f9f9f9'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: activeTab === tab.id ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #b08d57' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? '#b08d57' : '#666'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'files' && renderFilesTab()}
        {activeTab === 'queries' && renderQueriesTab()}
        {activeTab === 'source' && renderSourceTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
      </div>
    </div>
  );
};

export default InformationPanel;

