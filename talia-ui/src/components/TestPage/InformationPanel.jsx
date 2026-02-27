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
        <div className="test-info__empty">
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
      <div className="test-info__body">
        <div className="test-info__section">
          <h4 className="test-info__title">{selectedComponent}</h4>
          <p className="test-info__subtitle">{componentMeta.description}</p>
        </div>

        <div className="test-info__section">
          <h5 className="test-info__heading">File Dependencies</h5>
          <div className="test-info__code-box">
            {imports.map((imp, idx) => (
              <div key={idx} className="test-info__code-line">
                {imp.path}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h5 className="test-info__heading">Props</h5>
          <div className="test-info__props">
            {Object.entries(componentMeta.props || {}).map(([key, prop]) => (
              <div key={key} className="test-info__prop">
                <strong className="test-info__prop-name">{key}</strong>{' '}
                <span className="test-info__prop-type">({prop.type})</span>
                {prop.required && <span className="test-info__prop-required">*</span>}
                {prop.description && (
                  <div className="test-info__prop-desc">
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
      <div className="test-info__body">
        {metrics && (
          <div className="test-info__metrics">
            <div className="test-info__metric-card">
              <div className="test-info__metric-label">Total</div>
              <div className="test-info__metric-value">{metrics.totalQueries}</div>
            </div>
            <div className="test-info__metric-card">
              <div className="test-info__metric-label">Success</div>
              <div className="test-info__metric-value test-info__metric-value--success">{metrics.successfulQueries}</div>
            </div>
            <div className="test-info__metric-card">
              <div className="test-info__metric-label">Failed</div>
              <div className="test-info__metric-value test-info__metric-value--error">{metrics.failedQueries}</div>
            </div>
            <div className="test-info__metric-card">
              <div className="test-info__metric-label">Avg Time</div>
              <div className="test-info__metric-value">{metrics.avgDuration}ms</div>
            </div>
          </div>
        )}

        <div className="test-info__list">
          {(() => {
            // Filter queries by selected component if specified
            const filteredQueries = selectedComponent 
              ? queryTracker.getQueriesByComponent(selectedComponent)
              : queries;
            
            return filteredQueries.length === 0 ? (
              <div className="test-info__list-empty">
                {selectedComponent 
                  ? `No queries tracked for ${selectedComponent} yet`
                  : 'No queries tracked yet'}
              </div>
            ) : (
              filteredQueries.map((query, idx) => (
              <div 
                key={query.id || idx}
                className="test-info__query"
                data-status={query.status}
              >
                <div className="test-info__query-header">
                  <div className="test-info__query-info">
                    <strong>{query.component}</strong> - {query.purpose}
                    {query.status === 'error' && (
                      <span className="test-info__query-status test-info__query-status--error">✗ Error</span>
                    )}
                    {query.status === 'success' && (
                      <span className="test-info__query-status test-info__query-status--success">✓ Success</span>
                    )}
                  </div>
                  <div className="test-info__query-meta">
                    {query.duration !== null ? `${Math.round(query.duration)}ms` : 'pending'}
                  </div>
                </div>
                
                <div className="test-info__query-code">
                  <button
                    onClick={() => copyToClipboard(query.query)}
                    className="test-info__query-copy"
                  >
                    Copy
                  </button>
                  <pre className="test-info__query-pre">
                    {queryTracker.formatQuery(query.query)}
                  </pre>
                </div>

                {Object.keys(query.variables || {}).length > 0 && (
                  <div className="test-info__query-variables">
                    Variables: {JSON.stringify(query.variables, null, 2)}
                  </div>
                )}

                {query.error && (
                  <div className="test-info__query-error-box">
                    {query.error}
                  </div>
                )}

                <div className="test-info__query-timestamp">
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
      <div className="test-info__body">
        <div className="test-info__section">
          <h4 className="test-info__title">Data Source</h4>
          <div className="test-info__source-card">
            <div className="test-info__source-row">
              <strong className="test-info__source-label">GraphQL Endpoint:</strong>
              <div className="test-info__source-value">
                /api/graphql (proxied to localhost:4000)
              </div>
            </div>
            <div className="test-info__source-row">
              <strong className="test-info__source-label">Service:</strong>{' '}
              <span className="test-info__source-value">sailingsService</span>
            </div>
            <div className="test-info__source-row">
              <strong className="test-info__source-label">Status:</strong>{' '}
              <span className="test-info__source-status">● Connected</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="test-info__title">Service Files</h4>
          <div className="test-info__source-list">
            <div className="test-info__source-item">src/services/data/sailingsService.js</div>
            <div className="test-info__source-item">src/hooks/data/useSailingData.js</div>
            <div className="test-info__source-item">src/services/data/queryTracker.js</div>
          </div>
        </div>
      </div>
    );
  };

  const renderPerformanceTab = () => {
    return (
      <div className="test-info__body">
        {metrics && (
          <div className="test-info__section">
            <h4 className="test-info__title">Query Performance</h4>
            <div className="test-info__performance-grid">
              <div className="test-info__performance-card">
                <div className="test-info__performance-label">Success Rate</div>
                <div className="test-info__performance-value">{metrics.successRate}%</div>
              </div>
              <div className="test-info__performance-card">
                <div className="test-info__performance-label">Avg Duration</div>
                <div className="test-info__performance-value">{metrics.avgDuration}ms</div>
              </div>
              <div className="test-info__performance-card">
                <div className="test-info__performance-label">Total Data</div>
                <div className="test-info__performance-value">
                  {(metrics.totalDataSize / 1024).toFixed(2)} KB
                </div>
              </div>
              <div className="test-info__performance-card">
                <div className="test-info__performance-label">Avg Size</div>
                <div className="test-info__performance-value">
                  {(metrics.avgDataSize / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>
          </div>
        )}

        {performanceData && (
          <div>
            <h4 className="test-info__title">Component Performance</h4>
            <div className="test-info__performance-grid">
              <div className="test-info__performance-card">
                <div className="test-info__performance-label">Render Count</div>
                <div className="test-info__performance-value">{performanceData.renderCount || 0}</div>
              </div>
              <div className="test-info__performance-card">
                <div className="test-info__performance-label">Avg Render Time</div>
                <div className="test-info__performance-value">
                  {performanceData.avgRenderTime ? `${performanceData.avgRenderTime}ms` : 'N/A'}
                </div>
              </div>
              {performanceData.mountTime && (
                <div className="test-info__performance-card">
                  <div className="test-info__performance-label">Mount Time</div>
                  <div className="test-info__performance-value">
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
    <div className="test-info">
      {/* Tabs */}
      <div className="test-info__tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="test-info__tab"
            data-active={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="test-info__content">
        {activeTab === 'files' && renderFilesTab()}
        {activeTab === 'queries' && renderQueriesTab()}
        {activeTab === 'source' && renderSourceTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
      </div>
    </div>
  );
};

export default InformationPanel;
