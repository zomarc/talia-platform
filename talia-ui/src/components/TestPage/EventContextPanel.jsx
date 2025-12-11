/**
 * Event Context Panel Component
 * Displays the current event context: row data, filters applied, and component debug state
 */

import React, { useState, useEffect } from 'react';

const EventContextPanel = ({ latestEvent, theme, selectedComponent }) => {
  const [componentDebugState, setComponentDebugState] = useState(null);

  // Poll for component debug state (development only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

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

  const colors = theme?.colors || {};
  const bgColor = colors.cardBackground || '#2a2a2a';
  const fgColor = colors.foreground || '#ffffff';
  const textSecondary = colors.textSecondary || '#b0b0b0';
  const borderColor = colors.border || '#333333';
  const accentColor = colors.accent || '#b08d57';

  // Show component debug state even if no event
  if (!latestEvent || !latestEvent.detail) {
    return (
      <div style={{
        background: bgColor,
        padding: '12px',
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        color: fgColor,
        fontSize: '11px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${borderColor}`,
          paddingBottom: '8px'
        }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: accentColor }}>
            📋 Event Context
          </h4>
        </div>
        <div style={{ textAlign: 'center', fontStyle: 'italic', color: textSecondary }}>
          No event context available. Select a row to see context.
        </div>
        {/* Component Debug State (Development Only) - show even without event */}
        {process.env.NODE_ENV === 'development' && componentDebugState && (
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: '600',
              color: textSecondary,
              marginBottom: '6px',
              marginTop: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Component State ({selectedComponent})
            </div>
            <div style={{
              background: colors.background || '#1a1a1a',
              padding: '8px',
              borderRadius: '4px',
              border: `1px solid ${borderColor}`,
              fontFamily: 'monospace',
              fontSize: '10px'
            }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: textSecondary }}>Loading:</span>
                <span style={{ color: componentDebugState.loading ? accentColor : fgColor }}>
                  {componentDebugState.loading ? 'YES' : 'NO'}
                </span>
              </div>
              {componentDebugState.error && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: textSecondary }}>Error:</span>
                  <span style={{ color: colors.error || '#f44336' }}>
                    {componentDebugState.error}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: textSecondary }}>Data Records:</span>
                <span style={{ color: fgColor, fontWeight: '600' }}>
                  {componentDebugState.dataLength}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: textSecondary }}>Table Initialized:</span>
                <span style={{ color: componentDebugState.tableInitialized ? accentColor : fgColor }}>
                  {componentDebugState.tableInitialized ? 'YES' : 'NO'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: textSecondary }}>Has Instance:</span>
                <span style={{ color: componentDebugState.hasInstance ? accentColor : fgColor }}>
                  {componentDebugState.hasInstance ? 'YES' : 'NO'}
                </span>
              </div>
              {componentDebugState.context && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: textSecondary }}>Context:</span>
                  <span style={{ color: accentColor }}>{componentDebugState.context}</span>
                </div>
              )}
              {componentDebugState.lastUpdate && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '9px', marginTop: '4px', paddingTop: '4px', borderTop: `1px solid ${borderColor}` }}>
                  <span style={{ color: textSecondary }}>Last Update:</span>
                  <span style={{ color: textSecondary }}>
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
  const sailCode = detail.sail_code || detail.Sail_Code || rowData?.sail_code || rowData?.Sail_Code || 'N/A';
  
  // Extract filter information
  const filters = {
    sail_code: sailCode !== 'N/A' ? sailCode : null
  };

  // Format row data for display (remove quotes, format nicely)
  const formatValue = (value) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div style={{
      background: bgColor,
      padding: '12px',
      borderRadius: '8px',
      border: `1px solid ${borderColor}`,
      color: fgColor,
      fontSize: '11px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${borderColor}`,
        paddingBottom: '8px'
      }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: accentColor }}>
          📋 Event Context
        </h4>
        <span style={{ fontSize: '10px', color: textSecondary }}>
          {latestEvent.name}
        </span>
      </div>

      {/* Filter Applied */}
      <div>
        <div style={{
          fontSize: '10px',
          fontWeight: '600',
          color: textSecondary,
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Filter Applied
        </div>
        <div style={{
          background: colors.background || '#1a1a1a',
          padding: '8px',
          borderRadius: '4px',
          border: `1px solid ${borderColor}`,
          fontFamily: 'monospace',
          fontSize: '10px'
        }}>
          {filters.sail_code ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: textSecondary }}>sail_code:</span>
              <span style={{ color: accentColor, fontWeight: '600' }}>{filters.sail_code}</span>
            </div>
          ) : (
            <span style={{ color: textSecondary, fontStyle: 'italic' }}>No filters applied</span>
          )}
        </div>
      </div>

      {/* Row Data */}
      <div>
        <div style={{
          fontSize: '10px',
          fontWeight: '600',
          color: textSecondary,
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Row Retrieved
        </div>
        <div style={{
          background: colors.background || '#1a1a1a',
          padding: '8px',
          borderRadius: '4px',
          border: `1px solid ${borderColor}`,
          fontFamily: 'monospace',
          fontSize: '10px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {Object.entries(rowData).slice(0, 10).map(([key, value]) => (
            <div key={key} style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '4px',
              padding: '2px 0'
            }}>
              <span style={{ color: textSecondary, minWidth: '120px' }}>{key}:</span>
              <span style={{ color: fgColor, wordBreak: 'break-word' }}>{formatValue(value)}</span>
            </div>
          ))}
          {Object.keys(rowData).length > 10 && (
            <div style={{ color: textSecondary, fontSize: '9px', marginTop: '4px', fontStyle: 'italic' }}>
              ... and {Object.keys(rowData).length - 10} more fields
            </div>
          )}
        </div>
      </div>

      {/* Component Debug State (Development Only) */}
      {process.env.NODE_ENV === 'development' && componentDebugState && (
        <div>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            color: textSecondary,
            marginBottom: '6px',
            marginTop: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Component State ({selectedComponent})
          </div>
          <div style={{
            background: colors.background || '#1a1a1a',
            padding: '8px',
            borderRadius: '4px',
            border: `1px solid ${borderColor}`,
            fontFamily: 'monospace',
            fontSize: '10px'
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: textSecondary }}>Loading:</span>
              <span style={{ color: componentDebugState.loading ? accentColor : fgColor }}>
                {componentDebugState.loading ? 'YES' : 'NO'}
              </span>
            </div>
            {componentDebugState.error && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: textSecondary }}>Error:</span>
                <span style={{ color: colors.error || '#f44336' }}>
                  {componentDebugState.error}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: textSecondary }}>Data Records:</span>
              <span style={{ color: fgColor, fontWeight: '600' }}>
                {componentDebugState.dataLength}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: textSecondary }}>Table Initialized:</span>
              <span style={{ color: componentDebugState.tableInitialized ? accentColor : fgColor }}>
                {componentDebugState.tableInitialized ? 'YES' : 'NO'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: textSecondary }}>Has Instance:</span>
              <span style={{ color: componentDebugState.hasInstance ? accentColor : fgColor }}>
                {componentDebugState.hasInstance ? 'YES' : 'NO'}
              </span>
            </div>
            {componentDebugState.context && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: textSecondary }}>Context:</span>
                <span style={{ color: accentColor }}>{componentDebugState.context}</span>
              </div>
            )}
            {componentDebugState.lastUpdate && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '9px', marginTop: '4px', paddingTop: '4px', borderTop: `1px solid ${borderColor}` }}>
                <span style={{ color: textSecondary }}>Last Update:</span>
                <span style={{ color: textSecondary }}>
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

