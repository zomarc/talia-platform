import React from 'react';

const SyncStatusCell = ({ isSyncing, progress, statusColors, statusLabel, theme }) => {
  if (!isSyncing) {
    return (
      <span
        className="dm-status-badge"
        style={{
          background: statusColors.bg,
          color: statusColors.text
        }}
      >
        {statusLabel}
      </span>
    );
  }

  return (
    <div className="dm-sync-status">
      <div className="dm-sync-header">
        <span>🔄 Syncing...</span>
        <span>{progress?.percentage || 0}%</span>
      </div>
      <div className="dm-sync-progress-bar">
        <div
          className="dm-sync-progress-fill"
          style={{ width: `${progress?.percentage || 0}%` }}
        >
          <div className="dm-sync-shimmer" />
        </div>
      </div>
      {progress?.message && (
        <div
          className="dm-sync-message"
          style={{ color: theme.colors.textMuted }}
        >
          {progress.message}
        </div>
      )}
      {progress?.type === 'batch' && !progress.message && (
        <div className="dm-sync-submessage" style={{ color: theme.colors.textMuted }}>
          Batch {progress.current}/{progress.total}
        </div>
      )}
      {progress?.type === 'insert' && !progress.message && (
        <div className="dm-sync-submessage" style={{ color: theme.colors.textMuted }}>
          Inserted {progress.current.toLocaleString()}/{progress.total.toLocaleString()}
        </div>
      )}
      {progress?.type === 'records' && !progress.message && progress.total > 0 && (
        <div className="dm-sync-submessage" style={{ color: theme.colors.textMuted }}>
          {progress.current.toLocaleString()}/{progress.total.toLocaleString()} records
        </div>
      )}
      {(!progress || progress.percentage === 0) && (
        <div className="dm-sync-submessage" style={{ color: theme.colors.textMuted }}>
          Initializing...
        </div>
      )}
    </div>
  );
};

export default SyncStatusCell;
