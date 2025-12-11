/**
 * Information Panel Component
 * Displays files, queries, source, and performance information
 */

import React, { useState, useEffect } from 'react';
import queryTracker from '../../services/data/queryTracker';
import { componentRegistry } from './componentRegistry';

const InformationPanel = ({ selectedComponent, performanceData, theme }) => {
  const [activeTab, setActiveTab] = useState('queries');
  const [queries, setQueries] = useState([]);
  const [metrics, setMetrics] = useState(null);

  // Use theme colors or fallback to defaults
  const colors = theme?.colors || {};
  const bgColor = colors.cardBackground || colors.background || '#1a1a1a';
  const fgColor = colors.foreground || '#ffffff';
  const textSecondary = colors.textSecondary || '#b0b0b0';
  const borderColor = colors.border || '#333333';
  const accentColor = colors.accent || '#b08d57';
  const cardBg = colors.cardBackground || '#2a2a2a';
  const headerBg = colors.headerBackground || '#222222';

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
        <div style={{ padding: '16px', color: textSecondary, fontSize: '13px' }}>
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
      <div style={{ padding: '12px', color: fgColor }}>
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: fgColor }}>
            {selectedComponent}
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: textSecondary }}>
            {componentMeta.description}
          </p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: textSecondary }}>
            File Dependencies
          </h5>
          <div style={{ 
            background: cardBg, 
            borderRadius: '4px', 
            padding: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            border: `1px solid ${borderColor}`,
            color: fgColor
          }}>
            {imports.map((imp, idx) => (
              <div key={idx} style={{ marginBottom: '4px' }}>
                {imp.path}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: textSecondary }}>
            Props
          </h5>
          <div style={{ fontSize: '11px' }}>
            {Object.entries(componentMeta.props || {}).map(([key, prop]) => (
              <div key={key} style={{ marginBottom: '6px', padding: '6px', background: cardBg, borderRadius: '3px', border: `1px solid ${borderColor}` }}>
                <strong style={{ color: fgColor }}>{key}</strong> <span style={{ color: textSecondary }}>({prop.type})</span>
                {prop.required && <span style={{ color: '#f44336', marginLeft: '4px' }}>*</span>}
                {prop.description && (
                  <div style={{ color: textSecondary, fontSize: '10px', marginTop: '2px' }}>
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
      <div style={{ padding: '12px', color: fgColor }}>
        {metrics && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <div style={{ padding: '8px', background: cardBg, borderRadius: '4px', fontSize: '11px', border: `1px solid ${borderColor}` }}>
              <div style={{ color: textSecondary }}>Total</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: fgColor }}>{metrics.totalQueries}</div>
            </div>
            <div style={{ padding: '8px', background: cardBg, borderRadius: '4px', fontSize: '11px', border: `1px solid ${borderColor}` }}>
              <div style={{ color: textSecondary }}>Success</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: '#4caf50' }}>{metrics.successfulQueries}</div>
            </div>
            <div style={{ padding: '8px', background: cardBg, borderRadius: '4px', fontSize: '11px', border: `1px solid ${borderColor}` }}>
              <div style={{ color: textSecondary }}>Failed</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: '#f44336' }}>{metrics.failedQueries}</div>
            </div>
            <div style={{ padding: '8px', background: cardBg, borderRadius: '4px', fontSize: '11px', border: `1px solid ${borderColor}` }}>
              <div style={{ color: textSecondary }}>Avg Time</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: fgColor }}>{metrics.avgDuration}ms</div>
            </div>
          </div>
        )}

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {(() => {
            // Filter queries by selected component if specified
            const filteredQueries = selectedComponent 
              ? queryTracker.getQueriesByComponent(selectedComponent)
              : queries;
            
            return filteredQueries.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: textSecondary, fontSize: '12px' }}>
                {selectedComponent 
                  ? `No queries tracked for ${selectedComponent} yet`
                  : 'No queries tracked yet'}
              </div>
            ) : (
              filteredQueries.map((query, idx) => (
              <div 
                key={query.id || idx}
                style={{
                  marginBottom: '8px',
                  padding: '10px',
                  background: query.status === 'error' ? '#ffebee' : cardBg,
                  borderRadius: '4px',
                  border: `1px solid ${query.status === 'error' ? '#f44336' : borderColor}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11px', color: fgColor }}>
                    <strong>{query.component}</strong> - {query.purpose}
                    {query.status === 'error' && (
                      <span style={{ color: '#f44336', marginLeft: '8px' }}>✗ Error</span>
                    )}
                    {query.status === 'success' && (
                      <span style={{ color: '#4caf50', marginLeft: '8px' }}>✓ Success</span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: textSecondary }}>
                    {query.duration !== null ? `${Math.round(query.duration)}ms` : 'pending'}
                  </div>
                </div>
                
                <div style={{ 
                  background: bgColor, 
                  padding: '8px', 
                  borderRadius: '3px',
                  marginBottom: '6px',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  maxHeight: '100px',
                  overflow: 'auto',
                  position: 'relative',
                  border: `1px solid ${borderColor}`,
                  color: fgColor
                }}>
                  <button
                    onClick={() => copyToClipboard(query.query)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      padding: '2px 6px',
                      background: borderColor,
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '9px',
                      color: fgColor
                    }}
                  >
                    Copy
                  </button>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: fgColor }}>
                    {queryTracker.formatQuery(query.query)}
                  </pre>
                </div>

                {Object.keys(query.variables || {}).length > 0 && (
                  <div style={{ fontSize: '10px', color: textSecondary, marginTop: '4px' }}>
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

                <div style={{ fontSize: '9px', color: textSecondary, marginTop: '4px' }}>
                  {new Date(query.timestamp).toLocaleTimeString()}
                  {query.responseSize && ` • ${(query.responseSize / 1024).toFixed(2)} KB`}
                </div>
              </div>
            ))
            );
          })()}
        </div>
      </div>
    );
  };

  const renderSourceTab = () => {
    return (
      <div style={{ padding: '12px', color: fgColor }}>
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: fgColor }}>
            Data Source
          </h4>
          <div style={{ 
            padding: '10px', 
            background: cardBg, 
            borderRadius: '4px',
            fontSize: '12px',
            border: `1px solid ${borderColor}`
          }}>
            <div style={{ marginBottom: '6px' }}>
              <strong style={{ color: fgColor }}>GraphQL Endpoint:</strong>
              <div style={{ fontFamily: 'monospace', color: textSecondary, marginTop: '2px' }}>
                /api/graphql (proxied to localhost:4000)
              </div>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <strong style={{ color: fgColor }}>Service:</strong> <span style={{ color: textSecondary }}>sailingsService</span>
            </div>
            <div>
              <strong style={{ color: fgColor }}>Status:</strong>{' '}
              <span style={{ color: '#4caf50' }}>● Connected</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: fgColor }}>
            Service Files
          </h4>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: textSecondary }}>
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
      <div style={{ padding: '12px', color: fgColor }}>
        {metrics && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: fgColor }}>
              Query Performance
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              <div style={{ padding: '10px', background: cardBg, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '4px' }}>Success Rate</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: fgColor }}>{metrics.successRate}%</div>
              </div>
              <div style={{ padding: '10px', background: cardBg, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '4px' }}>Avg Duration</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: fgColor }}>{metrics.avgDuration}ms</div>
              </div>
              <div style={{ padding: '10px', background: cardBg, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '4px' }}>Total Data</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: fgColor }}>
                  {(metrics.totalDataSize / 1024).toFixed(2)} KB
                </div>
              </div>
              <div style={{ padding: '10px', background: cardBg, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '4px' }}>Avg Size</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: fgColor }}>
                  {(metrics.avgDataSize / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>
          </div>
        )}

        {performanceData && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: fgColor }}>
              Component Performance
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              <div style={{ padding: '10px', background: cardBg, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '4px' }}>Render Count</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: fgColor }}>{performanceData.renderCount || 0}</div>
              </div>
              <div style={{ padding: '10px', background: cardBg, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '4px' }}>Avg Render Time</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: fgColor }}>
                  {performanceData.avgRenderTime ? `${performanceData.avgRenderTime}ms` : 'N/A'}
                </div>
              </div>
              {performanceData.mountTime && (
                <div style={{ padding: '10px', background: cardBg, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                  <div style={{ fontSize: '11px', color: textSecondary, marginBottom: '4px' }}>Mount Time</div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: fgColor }}>
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
      background: bgColor,
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      color: fgColor
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${borderColor}`,
        background: headerBg
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: activeTab === tab.id ? bgColor : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${accentColor}` : `2px solid transparent`,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              color: activeTab === tab.id ? accentColor : textSecondary
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
