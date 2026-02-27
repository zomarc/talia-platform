/**
 * Context Row Monitor Presenter
 * Displays the currently selected context row from any component
 * Admin-only component
 */

import React from 'react';

const ContextRowMonitorPresenter = ({ currentContext }) => {

  if (!currentContext) {
    return (
      <div className="focus-panel-empty">
        <p className="focus-panel-empty__detail">
          No context selected. Select a row in any table to see details here.
        </p>
      </div>
    );
  }

  const { eventType, rowData, timestamp, source } = currentContext;

  return (
    <div className="context-row-monitor">
      {/* Header */}
      <div className="context-row-monitor__header">
        <h3 className="context-row-monitor__title">
          📋 Current Context
        </h3>
        <div className="context-row-monitor__meta">
          <span><strong>Source:</strong> {source}</span>
          <span><strong>Event:</strong> {eventType}</span>
          {timestamp && <span><strong>Time:</strong> {timestamp}</span>}
        </div>
      </div>

      {/* Row Data */}
      <div>
        <h4 className="context-row-monitor__section-title">
          Row Data:
        </h4>
        <div className="context-row-monitor__data">
          <pre className="context-row-monitor__pre">
            {JSON.stringify(rowData, null, 2)}
          </pre>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="context-row-monitor__actions">
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(rowData, null, 2));
            alert('Row data copied to clipboard!');
          }}
          className="context-row-monitor__button context-row-monitor__button--primary"
        >
          📋 Copy JSON
        </button>
        <button
          onClick={() => {
            console.log('[ContextRowMonitor] Current context:', currentContext);
            console.log('[ContextRowMonitor] Row data:', rowData);
          }}
          className="context-row-monitor__button"
        >
          🔍 Log to Console
        </button>
      </div>
    </div>
  );
};

export default ContextRowMonitorPresenter;




