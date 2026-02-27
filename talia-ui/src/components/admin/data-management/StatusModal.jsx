import React from 'react';
import { getTableSource } from '../../../config/tableSources';

const StatusModal = ({ statusTable, onClose, formatDateRange, formatDateTime }) => {
  const statusConfig = statusTable ? getTableSource(statusTable.tableName) : null;
  const statusDateColumns = statusConfig?.dateColumns || [];
  const statusProvider = statusTable
    ? (statusTable.type === 'application'
        ? 'Supabase (App)'
        : statusTable.type === 'system'
          ? 'Supabase (System)'
          : (statusTable.source && statusTable.source !== 'N/A')
            ? 'Azure Synapse'
            : 'Supabase')
    : '';

  const dayMs = 1000 * 60 * 60 * 24;
  const toTimestamp = (value) => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  };
  const expectedRange = statusTable?.dateRange || null;
  const actualRange = statusTable?.actualDataRange || null;
  const expectedEndDate = statusTable?.latestSnapshotDate || statusTable?.dateRange?.max || null;
  const expectedStartTs = toTimestamp(expectedRange?.min);
  const expectedEndTs = toTimestamp(expectedRange?.max);
  const actualStartTs = toTimestamp(actualRange?.min);
  const actualEndTs = toTimestamp(actualRange?.max);
  const currentTs = toTimestamp(statusTable?.latestAvailableData);

  let coveragePct = null;
  if (expectedStartTs != null && expectedEndTs != null && actualStartTs != null && actualEndTs != null) {
    const expectedSpan = Math.max(expectedEndTs - expectedStartTs, dayMs);
    const overlapStart = Math.max(expectedStartTs, actualStartTs);
    const overlapEnd = Math.min(expectedEndTs, actualEndTs);
    const overlapSpan = Math.max(0, overlapEnd - overlapStart);
    coveragePct = Math.round(Math.min(1, overlapSpan / expectedSpan) * 100);
  }

  const lagDaysRaw = expectedEndTs != null && currentTs != null
    ? (expectedEndTs - currentTs) / dayMs
    : null;
  const lagLabel = lagDaysRaw == null
    ? 'N/A'
    : lagDaysRaw <= -0.1
      ? `Ahead by ${Math.abs(lagDaysRaw).toFixed(1)}d`
      : lagDaysRaw > 0.1
        ? `${lagDaysRaw.toFixed(1)}d behind`
        : 'On time';

  if (!statusTable) return null;

  return (
    <div
      onClick={onClose}
      className="dm-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="dm-modal"
      >
        <div className="dm-modal__header">
          <div className="dm-modal__title">
            🧾 Status: {statusTable.tableName}
          </div>
          <button
            onClick={onClose}
            className="dm-modal__close"
          >
            Close
          </button>
        </div>
        <div className="dm-modal__section">
          <div className="dm-modal__section-title">Source & Sync</div>
          <div className="dm-modal__grid">
            <div><strong>Provider:</strong> {statusProvider || 'N/A'}</div>
            <div><strong>Source:</strong> {statusTable.source || statusConfig?.source || 'N/A'}</div>
            <div><strong>Source Query:</strong> {statusConfig?.source || 'N/A'}</div>
            <div><strong>Sync Key:</strong> {statusConfig?.syncType || 'N/A'}</div>
            <div><strong>Date Columns:</strong> {statusDateColumns.length > 0 ? statusDateColumns.join(', ') : 'None'}</div>
            <div><strong>Type:</strong> {statusTable.type || 'N/A'}</div>
            <div><strong>Load Method:</strong> {statusTable.loadMethod || 'N/A'}</div>
          </div>
        </div>
        <div className="dm-modal__section">
          <div className="dm-modal__section-title">Date Range & Freshness</div>
          <div className="dm-modal__grid">
            <div><strong>Configured Range:</strong> {formatDateRange(statusTable.dateRange)}</div>
            <div><strong>Actual Data Range:</strong> {formatDateRange(statusTable.actualDataRange)}</div>
            <div><strong>Expected End:</strong> {expectedEndDate ? formatDateTime(expectedEndDate) : 'N/A'}</div>
            <div><strong>Latest Snapshot:</strong> {statusTable.latestSnapshotDate ? formatDateTime(statusTable.latestSnapshotDate) : 'N/A'}</div>
            <div><strong>Latest Data:</strong> {statusTable.latestAvailableData ? formatDateTime(statusTable.latestAvailableData) : 'N/A'}</div>
            <div><strong>Last Sync:</strong> {statusTable.lastSync ? formatDateTime(statusTable.lastSync) : 'N/A'}</div>
          </div>
        </div>
        <div className="dm-modal__section">
          <div className="dm-modal__section-title">Quality & Volume</div>
          <div className="dm-modal__grid">
            <div><strong>Coverage:</strong> {coveragePct != null ? `${coveragePct}% of configured range` : 'N/A'}</div>
            <div><strong>Lag vs Expected:</strong> {lagLabel}</div>
            <div><strong>Rows:</strong> {(statusTable.rowCount || 0).toLocaleString()}</div>
            <div><strong>Records Processed:</strong> {(statusTable.recordsProcessed || 0).toLocaleString()}</div>
            <div><strong>Changes Detected:</strong> {(statusTable.changesDetected || 0).toLocaleString()}</div>
            <div><strong>Last Error:</strong> {statusTable.lastError || 'None'}</div>
            <div><strong>Sync Status:</strong> {statusTable.syncStatus || 'N/A'}</div>
            <div><strong>Status:</strong> {statusTable.status || 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
