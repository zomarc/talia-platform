/**
 * Context Row Monitor Presenter
 * Displays the currently selected context row from any component
 * Admin-only component
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';

const ContextRowMonitorPresenter = ({ currentContext, theme }) => {
  const { theme: contextTheme } = useTheme();
  const themeValues = theme || contextTheme || {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      glass: 'rgba(255, 255, 255, 0.9)',
      border: '#e0e0e0'
    }
  };

  if (!currentContext) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: themeValues.colors.foreground,
        background: themeValues.colors.background
      }}>
        <p style={{ color: themeValues.colors.textSecondary || '#666', fontSize: '14px' }}>
          No context selected. Select a row in any table to see details here.
        </p>
      </div>
    );
  }

  const { eventType, rowData, timestamp, source } = currentContext;

  return (
    <div style={{
      padding: '16px',
      height: '100%',
      overflow: 'auto',
      background: themeValues.colors.background,
      color: themeValues.colors.foreground
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: `2px solid ${themeValues.colors.border || '#e0e0e0'}`
      }}>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: themeValues.colors.foreground
        }}>
          📋 Current Context
        </h3>
        <div style={{
          display: 'flex',
          gap: '12px',
          fontSize: '12px',
          color: themeValues.colors.textSecondary || '#666'
        }}>
          <span><strong>Source:</strong> {source}</span>
          <span><strong>Event:</strong> {eventType}</span>
          {timestamp && <span><strong>Time:</strong> {timestamp}</span>}
        </div>
      </div>

      {/* Row Data */}
      <div>
        <h4 style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: themeValues.colors.foreground
        }}>
          Row Data:
        </h4>
        <div style={{
          background: themeValues.colors.glass || 'rgba(0, 0, 0, 0.05)',
          border: `1px solid ${themeValues.colors.border || '#e0e0e0'}`,
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '12px',
          overflow: 'auto',
          maxHeight: 'calc(100vh - 200px)'
        }}>
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: themeValues.colors.foreground
          }}>
            {JSON.stringify(rowData, null, 2)}
          </pre>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: `1px solid ${themeValues.colors.border || '#e0e0e0'}`
      }}>
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(rowData, null, 2));
            alert('Row data copied to clipboard!');
          }}
          style={{
            padding: '6px 12px',
            background: themeValues.colors.accent || '#b08d57',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            marginRight: '8px'
          }}
        >
          📋 Copy JSON
        </button>
        <button
          onClick={() => {
            console.log('[ContextRowMonitor] Current context:', currentContext);
            console.log('[ContextRowMonitor] Row data:', rowData);
          }}
          style={{
            padding: '6px 12px',
            background: themeValues.colors.glass || 'rgba(0, 0, 0, 0.1)',
            color: themeValues.colors.foreground,
            border: `1px solid ${themeValues.colors.border || '#e0e0e0'}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🔍 Log to Console
        </button>
      </div>
    </div>
  );
};

export default ContextRowMonitorPresenter;

