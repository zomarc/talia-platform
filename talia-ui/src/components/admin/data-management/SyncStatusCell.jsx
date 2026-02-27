import React from 'react';

const SyncStatusCell = ({ isSyncing, progress, statusVariant = 'default', statusLabel }) => {
  if (!isSyncing) {
    return (
      <span
        className={`dm-status-badge dm-status-badge--${statusVariant}`}
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
      <progress
        className="dm-sync-progress"
        value={progress?.percentage || 0}
        max="100"
      />
      {progress?.message && (
        <div className="dm-sync-message">
          {progress.message}
        </div>
      )}
      {progress?.type === 'batch' && !progress.message && (
        <div className="dm-sync-submessage">
          Batch {progress.current}/{progress.total}
        </div>
      )}
      {progress?.type === 'insert' && !progress.message && (
        <div className="dm-sync-submessage">
          Inserted {progress.current.toLocaleString()}/{progress.total.toLocaleString()}
        </div>
      )}
      {progress?.type === 'records' && !progress.message && progress.total > 0 && (
        <div className="dm-sync-submessage">
          {progress.current.toLocaleString()}/{progress.total.toLocaleString()} records
        </div>
      )}
      {(!progress || progress.percentage === 0) && (
        <div className="dm-sync-submessage">
          Initializing...
        </div>
      )}
    </div>
  );
};

export default SyncStatusCell;
