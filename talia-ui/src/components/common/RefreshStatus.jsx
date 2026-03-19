/**
 * Refresh Status Component
 * Reusable component for showing data refresh status and triggering refreshes
 * Displays last refresh time, status, and refresh button
 */

import React from 'react';
import { formatDayMon } from '../../lib/dateFormat';

const RefreshStatus = ({
  lastRefreshTime,
  isLoading = false,
  error = null,
  onRefresh,
  dataSource = 'data'
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
      
      return formatDayMon(date, 'Unknown');
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="refresh-status">
      <div className="refresh-status__meta">
        {isLoading ? (
          <>
            <span className="refresh-status__spinner" />
            <span className="refresh-status__value">Refreshing...</span>
          </>
        ) : (
          <>
            <span className="refresh-status__label">Last refresh:</span>
            <span className="refresh-status__value" data-error={Boolean(error)}>
              {error ? 'Error' : formatLastRefresh(lastRefreshTime)}
            </span>
          </>
        )}
      </div>
      
      {typeof onRefresh === 'function' && (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="refresh-status__button"
        >
          {isLoading ? (
            <>
              <span className="refresh-status__button-spinner" />
              Refreshing...
            </>
          ) : (
            <>
              🔄 Refresh {dataSource}
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default RefreshStatus;

