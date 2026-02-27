import React from 'react';

const TableActions = ({
  table,
  isSyncing,
  selectedTable,
  reviewLoading,
  setStatusTable,
  tableActions
}) => {
  if (table.source === 'N/A' || table.type === 'unknown' || table.type === 'system' || table.type === 'application') {
    return <span className="dm-action-placeholder">—</span>;
  }

  return (
    <div className="dm-action-group">
      <button
        onClick={() => setStatusTable(table)}
        className="dm-action-button dm-action-button-regular dm-action-button--status"
        title="View table status details"
      >
        🧾 Status
      </button>
      {selectedTable === table.tableName && (
        <button
          onClick={() => tableActions.handleReview(table)}
          disabled={reviewLoading}
          className="dm-action-button dm-action-button-bold dm-action-button--review"
          title="Review top 100 rows"
        >
          {reviewLoading ? '⏳' : '👁️ Review'}
        </button>
      )}
      <button
        onClick={() => tableActions.handleIncrementalSync(table)}
        disabled={isSyncing}
        className="dm-action-button dm-action-button-regular dm-action-button--sync"
        title="Incremental sync"
      >
        {isSyncing ? '⏳ Syncing...' : '🔄 Sync'}
      </button>
      <button
        onClick={() => tableActions.handleFullSync(table)}
        disabled={isSyncing}
        className="dm-action-button dm-action-button-bold dm-action-button--full"
        title="Force full refresh (syncs all data)"
      >
        {isSyncing ? '⏳' : '⚡ Full'}
      </button>
    </div>
  );
};

export default TableActions;
