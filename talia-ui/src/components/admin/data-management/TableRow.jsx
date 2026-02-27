import React from 'react';
import SyncStatusCell from './SyncStatusCell.jsx';
import TableActions from './TableActions.jsx';

const TableRow = ({
  table,
  index,
  selectedTable,
  setSelectedTable,
  syncingTables,
  syncProgress,
  getStatusVariant,
  getSyncFreshness,
  formatDateRange,
  formatDateTime,
  formatDate,
  formatDuration,
  setStatusTable,
  reviewLoading,
  tableActions
}) => {
  const statusVariant = getStatusVariant(table.status);
  const isSelected = table.tableName === selectedTable;
  const isEven = index % 2 === 0;
  const isSyncing = syncingTables.has(table.tableName);
  const progress = syncProgress[table.tableName];
  const syncFreshness = getSyncFreshness(table.lastSync);
  const freshnessStatus = syncFreshness.status;
  const expectedRange = table.dateRange;
  const actualRange = table.actualDataRange;
  const expectedEndDate = table.latestSnapshotDate || table.dateRange?.max || null;
  const currentDate = table.latestAvailableData;
  const reportedDate = table.lastSync;
  const dayMs = 1000 * 60 * 60 * 24;

  const toTimestamp = (value) => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  };

  const expectedStartTs = toTimestamp(expectedRange?.min);
  const expectedEndTs = toTimestamp(expectedRange?.max);
  const actualStartTs = toTimestamp(actualRange?.min);
  const actualEndTs = toTimestamp(actualRange?.max);
  const currentTs = toTimestamp(currentDate);

  let coverageRatio = null;
  if (expectedStartTs != null && expectedEndTs != null && actualStartTs != null && actualEndTs != null) {
    const expectedSpan = Math.max(expectedEndTs - expectedStartTs, dayMs);
    const overlapStart = Math.max(expectedStartTs, actualStartTs);
    const overlapEnd = Math.min(expectedEndTs, actualEndTs);
    const overlapSpan = Math.max(0, overlapEnd - overlapStart);
    coverageRatio = Math.min(1, overlapSpan / expectedSpan);
  }
  const coveragePct = coverageRatio != null ? Math.round(coverageRatio * 100) : null;

  const lagDaysRaw = expectedEndTs != null && currentTs != null
    ? (expectedEndTs - currentTs) / dayMs
    : null;
  const lagDisplay = lagDaysRaw == null
    ? '—'
    : lagDaysRaw <= 0
      ? '0d'
      : `${lagDaysRaw.toFixed(1)}d`;
  const lagDetail = lagDaysRaw == null
    ? 'N/A'
    : lagDaysRaw <= -0.1
      ? `${Math.abs(lagDaysRaw).toFixed(1)}d ahead`
      : lagDaysRaw > 0.1
        ? `${lagDaysRaw.toFixed(1)}d behind`
        : 'On time';

  const healthVariant = (coverageRatio == null && lagDaysRaw == null)
    ? 'unknown'
    : (coverageRatio != null && coverageRatio < 0.75) || (lagDaysRaw != null && lagDaysRaw > 7)
      ? 'mismatch'
      : (coverageRatio != null && coverageRatio < 0.9) || (lagDaysRaw != null && lagDaysRaw > 3)
        ? 'warn'
        : 'ok';
  const syncIndicatorClass = isSyncing
    ? 'sync-indicator-syncing'
    : table.lastSync
      ? `sync-indicator-${freshnessStatus}`
      : 'sync-indicator-none';

  const healthLabel = healthVariant === 'ok'
    ? 'OK'
    : healthVariant === 'warn'
      ? 'Warn'
      : healthVariant === 'mismatch'
        ? 'Mismatch'
        : 'Unknown';

  return (
    <tr
      key={table.tableName}
      onClick={() => setSelectedTable(table.tableName === selectedTable ? null : table.tableName)}
      className={`dm-table-row ${isSelected ? 'table-row-selected' : (isEven ? 'table-row-even' : 'table-row-odd')} ${syncIndicatorClass} ${isSyncing ? 'dm-table-row--syncing' : ''}`}
      title={table.lastSync ? syncFreshness.label : 'No sync data available'}
    >
      <td
        className="dm-table-cell dm-table-cell-mono dm-table-cell--name dm-col-table-name"
      >
        {table.tableName}
      </td>
      <td
        className={`dm-table-cell dm-table-cell-mono dm-col-source ${table.source === 'N/A' ? 'dm-text-muted' : ''}`}
      >
        {table.source}
      </td>
      <td
        className="dm-table-cell dm-table-cell-center dm-table-cell--load-method dm-col-load-method"
      >
        <span
          className={`dm-load-badge ${table.loadMethod === 'Batch' ? 'dm-load-badge--batch' : 'dm-load-badge--direct'}`}
        >
          {table.loadMethod || 'N/A'}
        </span>
      </td>
      <td
        className="dm-table-cell dm-table-cell-mono dm-table-cell-right dm-col-row-count"
      >
        {table.rowCount.toLocaleString()}
      </td>
      <td
        className="dm-table-cell dm-table-cell-sm dm-table-cell--padded dm-col-date-range dm-text-secondary"
      >
        {formatDateRange(table.dateRange)}
      </td>
      <td
        className="dm-table-cell dm-table-cell-sm dm-table-cell--padded dm-col-last-sync dm-text-secondary"
      >
        {formatDateTime(table.lastSync)}
      </td>
      <td
        className={`dm-table-cell dm-table-cell-sm dm-table-cell--padded dm-col-latest-snapshot ${table.latestSnapshotDate ? 'dm-text-secondary' : 'dm-text-muted'}`}
        title="Latest snapshot from sync metadata"
      >
        {table.latestSnapshotDate ? formatDate(table.latestSnapshotDate) : 'N/A'}
      </td>
      <td
        className={`dm-table-cell dm-table-cell-sm dm-table-cell--padded dm-col-latest-available ${table.latestAvailableData ? 'dm-text-secondary' : 'dm-text-muted'}`}
        title="Latest data timestamp from the table (prefers snapshot_date, otherwise created/updated)"
      >
        {table.latestAvailableData ? formatDateTime(table.latestAvailableData) : 'N/A'}
      </td>
      <td
        className="dm-table-cell dm-table-cell-center dm-col-data-health"
      >
        <div
          title={[
            `Configured Range: ${formatDateRange(expectedRange)}`,
            `Actual Range: ${formatDateRange(actualRange)}`,
            `Coverage: ${coveragePct != null ? `${coveragePct}%` : 'N/A'}`,
            `Expected End: ${expectedEndDate ? formatDateTime(expectedEndDate) : 'N/A'}`,
            `Latest Snapshot: ${table.latestSnapshotDate ? formatDateTime(table.latestSnapshotDate) : 'N/A'}`,
            `Latest Data: ${currentDate ? formatDateTime(currentDate) : 'N/A'} • ${lagDetail}`,
            `Last Sync: ${reportedDate ? formatDateTime(reportedDate) : 'N/A'}`
          ].join('\n')}
          className="dm-health"
        >
          <div className="dm-health__metrics">
            <div className="dm-health__metric">
              <span className="dm-health__metric-label">Cov</span>
              <span className={`dm-health__metric-value dm-health__metric-value--${healthVariant}`}>
                {coveragePct != null ? `${coveragePct}%` : '—'}
              </span>
            </div>
            <div className="dm-health__metric">
              <span className="dm-health__metric-label">Lag</span>
              <span className={`dm-health__metric-value dm-health__metric-value--${healthVariant}`}>
                {lagDisplay}
              </span>
            </div>
          </div>
          <div className={`dm-health__status dm-health__status--${healthVariant}`}>
            {healthLabel}
          </div>
        </div>
      </td>
      <td
        className={`dm-table-cell dm-table-cell-mono dm-table-cell-right dm-table-cell--padded dm-col-records-processed ${table.recordsProcessed !== null && table.recordsProcessed !== undefined ? 'dm-text-secondary' : 'dm-text-muted'}`}
      >
        {table.recordsProcessed !== null && table.recordsProcessed !== undefined
          ? table.recordsProcessed.toLocaleString()
          : '—'}
      </td>
      <td
        className={`dm-table-cell dm-table-cell-mono dm-table-cell-right dm-table-cell--padded dm-col-changes-detected ${table.changesDetected !== null && table.changesDetected !== undefined ? 'dm-text-secondary' : 'dm-text-muted'}`}
      >
        {table.changesDetected !== null && table.changesDetected !== undefined
          ? table.changesDetected.toLocaleString()
          : '—'}
      </td>
      <td
        className={`dm-table-cell dm-table-cell-sm dm-table-cell-mono dm-table-cell--padded dm-col-sync-duration ${table.syncDuration === null ? 'dm-text-muted' : 'dm-text-secondary'}`}
      >
        {formatDuration(table.syncDuration)}
      </td>
      <td
        className="dm-table-cell dm-col-status"
      >
        <SyncStatusCell
          isSyncing={isSyncing}
          progress={progress}
          statusVariant={statusVariant}
          statusLabel={table.status}
        />
      </td>
      <td
        className="dm-table-cell dm-table-actions dm-col-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <TableActions
          table={table}
          isSyncing={isSyncing}
          selectedTable={selectedTable}
          reviewLoading={reviewLoading}
          setStatusTable={setStatusTable}
          tableActions={tableActions}
        />
      </td>
    </tr>
  );
};

export default TableRow;
