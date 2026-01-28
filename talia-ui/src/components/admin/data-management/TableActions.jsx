import React from 'react';

const TableActions = ({
  table,
  isSyncing,
  selectedTable,
  reviewLoading,
  theme,
  setStatusTable,
  tableActions
}) => {
  if (table.source === 'N/A' || table.type === 'unknown' || table.type === 'system' || table.type === 'application') {
    return <span className="dm-action-placeholder" style={{ color: theme.colors.textMuted }}>—</span>;
  }

  return (
    <div className="dm-action-group">
      <button
        onClick={() => setStatusTable(table)}
        className="dm-action-button dm-action-button-regular"
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          color: theme.colors.foreground,
          border: `1px solid ${theme.colors.glassBorder}`
        }}
        title="View table status details"
      >
        🧾 Status
      </button>
      {selectedTable === table.tableName && (
        <button
          onClick={() => tableActions.handleReview(table)}
          disabled={reviewLoading}
          className="dm-action-button dm-action-button-bold"
          style={{
            background: reviewLoading ? theme.colors.textMuted : '#4caf50',
            color: reviewLoading ? theme.colors.textSecondary : '#ffffff',
            border: 'none',
            cursor: reviewLoading ? 'not-allowed' : 'pointer',
            opacity: reviewLoading ? 0.6 : 1
          }}
          title="Review top 100 rows"
        >
          {reviewLoading ? '⏳' : '👁️ Review'}
        </button>
      )}
      <button
        onClick={() => tableActions.handleIncrementalSync(table)}
        disabled={isSyncing}
        className="dm-action-button dm-action-button-regular"
        style={{
          background: isSyncing
            ? theme.colors.textMuted
            : theme.colors.accent,
          color: isSyncing
            ? theme.colors.textSecondary
            : '#0f0f23',
          border: 'none',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          opacity: isSyncing ? 0.6 : 1
        }}
        title="Incremental sync"
      >
        {isSyncing ? '⏳ Syncing...' : '🔄 Sync'}
      </button>
      <button
        onClick={() => tableActions.handleFullSync(table)}
        disabled={isSyncing}
        className="dm-action-button dm-action-button-bold"
        style={{
          background: isSyncing
            ? theme.colors.textMuted
            : '#ff6b35',
          color: isSyncing
            ? theme.colors.textSecondary
            : '#ffffff',
          border: 'none',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          opacity: isSyncing ? 0.6 : 1
        }}
        title="Force full refresh (syncs all data)"
      >
        {isSyncing ? '⏳' : '⚡ Full'}
      </button>
    </div>
  );
};

export default TableActions;
