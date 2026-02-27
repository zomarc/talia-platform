/**
 * Event Context Panel Component
 * Displays the current event context: row data, filters applied, and component debug state
 */

import React, { useState, useEffect } from 'react';

const EventContextPanel = ({ latestEvent, selectedComponent }) => {
  const [componentDebugState, setComponentDebugState] = useState(null);
  const isDevMode = import.meta.env.DEV;

  // Poll for component debug state (development only)
  useEffect(() => {
    if (!isDevMode) return;

    const interval = setInterval(() => {
      if (window._componentDebugState && selectedComponent) {
        const state = window._componentDebugState[selectedComponent];
        if (state) {
          setComponentDebugState(state);
        }
      }
    }, 500); // Poll every 500ms

    return () => clearInterval(interval);
  }, [selectedComponent]);

  // Show component debug state even if no event
  if (!latestEvent || !latestEvent.detail) {
    return (
      <div className="event-context">
        <div className="event-context__header">
          <h4 className="event-context__title">
            📋 Event Context
          </h4>
        </div>
        <div className="event-context__empty">
          No event context available. Select a row to see context.
        </div>
        {/* Component Debug State (Development Only) - show even without event */}
        {isDevMode && componentDebugState && (
          <div>
            <div className="event-context__section-title">
              Component State ({selectedComponent})
            </div>
            <div className="event-context__card">
              <div className="event-context__kv">
                <span className="event-context__kv-label">Loading:</span>
                <span className={`event-context__kv-value ${componentDebugState.loading ? 'event-context__kv-value--accent' : ''}`}>
                  {componentDebugState.loading ? 'YES' : 'NO'}
                </span>
              </div>
              {componentDebugState.error && (
                <div className="event-context__kv">
                  <span className="event-context__kv-label">Error:</span>
                  <span className="event-context__kv-value event-context__kv-value--error">
                    {componentDebugState.error}
                  </span>
                </div>
              )}
              <div className="event-context__kv">
                <span className="event-context__kv-label">Data Records:</span>
                <span className="event-context__kv-value event-context__kv-value--strong">
                  {componentDebugState.dataLength}
                </span>
              </div>
              <div className="event-context__kv">
                <span className="event-context__kv-label">Table Initialized:</span>
                <span className={`event-context__kv-value ${componentDebugState.tableInitialized ? 'event-context__kv-value--accent' : ''}`}>
                  {componentDebugState.tableInitialized ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="event-context__kv">
                <span className="event-context__kv-label">Has Instance:</span>
                <span className={`event-context__kv-value ${componentDebugState.hasInstance ? 'event-context__kv-value--accent' : ''}`}>
                  {componentDebugState.hasInstance ? 'YES' : 'NO'}
                </span>
              </div>
              {componentDebugState.context && (
                <div className="event-context__kv">
                  <span className="event-context__kv-label">Context:</span>
                  <span className="event-context__kv-value event-context__kv-value--accent">{componentDebugState.context}</span>
                </div>
              )}
              {componentDebugState.lastUpdate && (
                <div className="event-context__meta-row">
                  <span className="event-context__kv-label">Last Update:</span>
                  <span className="event-context__kv-value event-context__kv-value--muted">
                    {new Date(componentDebugState.lastUpdate).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const detail = latestEvent.detail;
  const rowData = detail.row_data || detail;
  
  // Extract key fields - support both sail and ship events
  const sailCode = detail.sail_code || detail.Sail_Code || rowData?.sail_code || rowData?.Sail_Code || null;
  const shipCode = detail.ship_code || detail.Ship_Code || rowData?.ship_code || rowData?.Ship_Code || null;
  const departureDate = detail.departure_date || rowData?.departure_date || rowData?.sail_date_from || null;
  
  // Extract filter information
  const filters = {
    sail_code: sailCode,
    ship_code: shipCode,
    departure_date: departureDate
  };

  // Format row data for display (remove quotes, format nicely)
  const formatValue = (value) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div className="event-context">
      <div className="event-context__header">
        <h4 className="event-context__title">📋 Event Context</h4>
        <span className="event-context__subtitle">{latestEvent.name}</span>
      </div>

      {/* Filter Applied */}
      <div>
        <div className="event-context__section-title">Filter Applied</div>
        <div className="event-context__card event-context__kv-list">
          {filters.sail_code && (
            <div className="event-context__kv">
              <span className="event-context__kv-label">sail_code:</span>
              <span className="event-context__kv-value event-context__kv-value--accent">{filters.sail_code}</span>
            </div>
          )}
          {filters.ship_code && (
            <div className="event-context__kv">
              <span className="event-context__kv-label">ship_code:</span>
              <span className="event-context__kv-value event-context__kv-value--accent">{filters.ship_code}</span>
            </div>
          )}
          {filters.departure_date && (
            <div className="event-context__kv">
              <span className="event-context__kv-label">departure_date:</span>
              <span className="event-context__kv-value event-context__kv-value--accent">{filters.departure_date}</span>
            </div>
          )}
          {!filters.sail_code && !filters.ship_code && !filters.departure_date && (
            <span className="event-context__kv-value event-context__kv-value--muted">No filters applied</span>
          )}
        </div>
      </div>

      {/* Row Data */}
      <div>
        <div className="event-context__section-title">Row Retrieved</div>
        <div className="event-context__card event-context__card--scroll">
          {Object.entries(rowData).slice(0, 10).map(([key, value]) => (
            <div key={key} className="event-context__row">
              <span className="event-context__row-key">{key}:</span>
              <span className="event-context__row-value">{formatValue(value)}</span>
            </div>
          ))}
          {Object.keys(rowData).length > 10 && (
            <div className="event-context__more">
              ... and {Object.keys(rowData).length - 10} more fields
            </div>
          )}
        </div>
      </div>

      {/* Component Debug State (Development Only) */}
      {isDevMode && componentDebugState && (
        <div>
          <div className="event-context__section-title">
            Component State ({selectedComponent})
          </div>
          <div className="event-context__card">
            <div className="event-context__kv">
              <span className="event-context__kv-label">Loading:</span>
              <span className={`event-context__kv-value ${componentDebugState.loading ? 'event-context__kv-value--accent' : ''}`}>
                {componentDebugState.loading ? 'YES' : 'NO'}
              </span>
            </div>
            {componentDebugState.error && (
              <div className="event-context__kv">
                <span className="event-context__kv-label">Error:</span>
                <span className="event-context__kv-value event-context__kv-value--error">
                  {componentDebugState.error}
                </span>
              </div>
            )}
            <div className="event-context__kv">
              <span className="event-context__kv-label">Data Records:</span>
              <span className="event-context__kv-value event-context__kv-value--strong">
                {componentDebugState.dataLength}
              </span>
            </div>
            <div className="event-context__kv">
              <span className="event-context__kv-label">Table Initialized:</span>
              <span className={`event-context__kv-value ${componentDebugState.tableInitialized ? 'event-context__kv-value--accent' : ''}`}>
                {componentDebugState.tableInitialized ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="event-context__kv">
              <span className="event-context__kv-label">Has Instance:</span>
              <span className={`event-context__kv-value ${componentDebugState.hasInstance ? 'event-context__kv-value--accent' : ''}`}>
                {componentDebugState.hasInstance ? 'YES' : 'NO'}
              </span>
            </div>
            {componentDebugState.context && (
              <div className="event-context__kv">
                <span className="event-context__kv-label">Context:</span>
                <span className="event-context__kv-value event-context__kv-value--accent">{componentDebugState.context}</span>
              </div>
            )}
            {componentDebugState.lastUpdate && (
              <div className="event-context__meta-row">
                <span className="event-context__kv-label">Last Update:</span>
                <span className="event-context__kv-value event-context__kv-value--muted">
                  {new Date(componentDebugState.lastUpdate).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventContextPanel;

