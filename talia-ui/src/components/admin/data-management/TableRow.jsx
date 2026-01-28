import React from 'react';
import SyncStatusCell from './SyncStatusCell.jsx';
import TableActions from './TableActions.jsx';

const TableRow = ({
  table,
  index,
  theme,
  columnWidths,
  selectedTable,
  setSelectedTable,
  syncingTables,
  syncProgress,
  getStatusColor,
  getSyncFreshness,
  formatDateRange,
  formatDateTime,
  formatDate,
  formatDuration,
  setStatusTable,
  reviewLoading,
  tableActions
}) => {
  const statusColors = getStatusColor(table.status);
  const isSelected = table.tableName === selectedTable;
  const isEven = index % 2 === 0;
  const isSyncing = syncingTables.has(table.tableName);
  const progress = syncProgress[table.tableName];
  const syncFreshness = getSyncFreshness(table.lastSync);
  const freshnessStatus = syncFreshness.status;
  const syncIndicatorClass = isSyncing
    ? 'sync-indicator-syncing'
    : table.lastSync
      ? `sync-indicator-${freshnessStatus}`
      : 'sync-indicator-none';

  return (
    <tr
      key={table.tableName}
      onClick={() => setSelectedTable(table.tableName === selectedTable ? null : table.tableName)}
      className={`${isSelected ? 'table-row-selected' : (isEven ? 'table-row-even' : 'table-row-odd')} ${syncIndicatorClass}`}
      style={{
        borderBottom: `1px solid ${theme.colors.glassBorder}`,
        cursor: 'pointer',
        color: theme.colors.foreground,
        background: isSyncing
          ? 'rgba(255, 192, 203, 0.15)'
          : isSelected
            ? theme.colors.tableRowSelected
            : (isEven ? theme.colors.tableRowEven : theme.colors.tableRowOdd),
        transition: 'all 0.3s ease',
        animation: isSyncing ? 'pulse 2s ease-in-out infinite' : 'none',
        position: 'relative'
      }}
      title={table.lastSync ? syncFreshness.label : 'No sync data available'}
    >
      <td
        className="dm-table-cell dm-table-cell-mono"
        style={{
          fontWeight: '500',
          width: columnWidths.tableName
        }}
      >
        {table.tableName}
      </td>
      <td
        className="dm-table-cell dm-table-cell-mono"
        style={{
          color: table.source === 'N/A' ? theme.colors.textMuted : theme.colors.foreground,
          width: columnWidths.source
        }}
      >
        {table.source}
      </td>
      <td
        className="dm-table-cell dm-table-cell-center"
        style={{
          fontSize: '9px',
          fontWeight: '600',
          width: columnWidths.loadMethod
        }}
      >
        <span
          className="dm-load-badge"
          style={{
            background: table.loadMethod === 'Batch'
              ? 'rgba(33, 150, 243, 0.2)'
              : 'rgba(76, 175, 80, 0.2)',
            color: table.loadMethod === 'Batch'
              ? '#2196F3'
              : '#4CAF50',
            border: `1px solid ${table.loadMethod === 'Batch' ? '#2196F3' : '#4CAF50'}`
          }}
        >
          {table.loadMethod || 'N/A'}
        </span>
      </td>
      <td
        className="dm-table-cell dm-table-cell-mono dm-table-cell-right"
        style={{ width: columnWidths.rowCount }}
      >
        {table.rowCount.toLocaleString()}
      </td>
      <td
        className="dm-table-cell dm-table-cell-sm"
        style={{
          padding: '8px 12px',
          width: columnWidths.dateRange,
          color: theme.colors.textSecondary
        }}
      >
        {formatDateRange(table.dateRange)}
      </td>
      <td
        className="dm-table-cell dm-table-cell-sm"
        style={{
          padding: '8px 12px',
          width: columnWidths.lastSync,
          color: theme.colors.textSecondary
        }}
      >
        {formatDateTime(table.lastSync)}
      </td>
      <td
        className="dm-table-cell dm-table-cell-sm"
        style={{
          padding: '8px 12px',
          width: columnWidths.latestSnapshot,
          color: table.latestSnapshotDate ? theme.colors.textSecondary : theme.colors.textMuted
        }}
      >
        {table.latestSnapshotDate ? formatDate(table.latestSnapshotDate) : 'N/A'}
      </td>
      <td
        className="dm-table-cell dm-table-cell-mono dm-table-cell-right"
        style={{
          padding: '8px 12px',
          color: table.recordsProcessed !== null && table.recordsProcessed !== undefined ? theme.colors.textSecondary : theme.colors.textMuted,
          width: columnWidths.recordsProcessed
        }}
      >
        {table.recordsProcessed !== null && table.recordsProcessed !== undefined
          ? table.recordsProcessed.toLocaleString()
          : '—'}
      </td>
      <td
        className="dm-table-cell dm-table-cell-mono dm-table-cell-right"
        style={{
          padding: '8px 12px',
          color: table.changesDetected !== null && table.changesDetected !== undefined ? theme.colors.textSecondary : theme.colors.textMuted,
          width: columnWidths.changesDetected
        }}
      >
        {table.changesDetected !== null && table.changesDetected !== undefined
          ? table.changesDetected.toLocaleString()
          : '—'}
      </td>
      <td
        className="dm-table-cell dm-table-cell-sm dm-table-cell-mono"
        style={{
          padding: '8px 12px',
          color: table.syncDuration === null ? theme.colors.textMuted : theme.colors.textSecondary,
          width: columnWidths.syncDuration
        }}
      >
        {formatDuration(table.syncDuration)}
      </td>
      <td
        className="dm-table-cell"
        style={{ width: columnWidths.status }}
      >
        <SyncStatusCell
          isSyncing={isSyncing}
          progress={progress}
          statusColors={statusColors}
          statusLabel={table.status}
          theme={theme}
        />
      </td>
      <td
        className="dm-table-cell dm-table-actions"
        style={{ width: columnWidths.actions }}
        onClick={(e) => e.stopPropagation()}
      >
        <TableActions
          table={table}
          isSyncing={isSyncing}
          selectedTable={selectedTable}
          reviewLoading={reviewLoading}
          theme={theme}
          setStatusTable={setStatusTable}
          tableActions={tableActions}
        />
      </td>
    </tr>
  );
};

export default TableRow;
