/**
 * Refresh Status Component
 * Reusable component for showing data refresh status and triggering refreshes
 * Displays last refresh time, status, and refresh button
 */

import React from 'react';

const RefreshStatus = ({
  lastRefreshTime,
  isLoading = false,
  error = null,
  onRefresh,
  dataSource = 'data',
  theme
}) => {
  const formatLastRefresh = (timestamp) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
      borderRadius: '6px',
      border: `1px solid ${theme?.colors?.border || '#333'}`,
      fontSize: '13px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {isLoading ? (
          <>
            <span style={{ 
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: `2px solid ${theme?.colors?.primary || '#1976d2'}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
              Refreshing...
            </span>
          </>
        ) : (
          <>
            <span style={{ color: theme?.colors?.textSecondary || '#999' }}>
              Last refresh:
            </span>
            <span style={{ 
              color: error 
                ? (theme?.colors?.error || '#f44336')
                : (theme?.colors?.foreground || '#e0e0e0'),
              fontWeight: '500'
            }}>
              {error ? 'Error' : formatLastRefresh(lastRefreshTime)}
            </span>
          </>
        )}
      </div>
      
      <button
        onClick={onRefresh}
        disabled={isLoading}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: isLoading
            ? (theme?.colors?.backgroundSecondary || '#2a2a2a')
            : (theme?.colors?.primary || '#1976d2'),
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {isLoading ? (
          <>
            <span style={{ 
              display: 'inline-block',
              width: '10px',
              height: '10px',
              border: '2px solid #fff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            Refreshing...
          </>
        ) : (
          <>
            🔄 Refresh {dataSource}
          </>
        )}
      </button>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RefreshStatus;

