import React from 'react';
import { getTableSource } from '../../../config/tableSources';

const StatusModal = ({ statusTable, configuredRange, onClose, formatDateRange, formatDateTime }) => {
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
  const expectedRange = configuredRange || statusTable?.dateRange || null;
  const actualRange = statusTable?.actualDataRange || null;
  const expectedEndDate = expectedRange?.max || null;
  const expectedStartTs = toTimestamp(expectedRange?.min);
  const expectedEndTs = toTimestamp(expectedRange?.max);
  const todayTs = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const freshnessTargetTs = expectedEndTs == null ? null : Math.min(expectedEndTs, todayTs);
  const actualStartTs = toTimestamp(actualRange?.min);
  const actualEndTs = toTimestamp(actualRange?.max);
  const currentTs = toTimestamp(statusTable?.latestAvailableData);

  const formatPreciseDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatPreciseDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getSpanDays = (startTs, endTs) => {
    if (startTs == null || endTs == null) return null;
    return Math.max(0, Math.round((endTs - startTs) / dayMs) + 1);
  };

  let coveragePct = null;
  let overlapDays = null;
  if (expectedStartTs != null && expectedEndTs != null && actualStartTs != null && actualEndTs != null) {
    const expectedSpan = Math.max(expectedEndTs - expectedStartTs, dayMs);
    const overlapStart = Math.max(expectedStartTs, actualStartTs);
    const overlapEnd = Math.min(expectedEndTs, actualEndTs);
    const overlapSpan = Math.max(0, overlapEnd - overlapStart);
    overlapDays = Math.round(overlapSpan / dayMs) + (overlapSpan > 0 ? 1 : 0);
    coveragePct = Math.round(Math.min(1, overlapSpan / expectedSpan) * 100);
  }

  const requestedSpanDays = getSpanDays(expectedStartTs, expectedEndTs);
  const loadedSpanDays = getSpanDays(actualStartTs, actualEndTs);
  const beforeRequestedDays = (expectedStartTs != null && actualStartTs != null && actualStartTs < expectedStartTs)
    ? Math.round((expectedStartTs - actualStartTs) / dayMs)
    : 0;
  const afterRequestedDays = (expectedEndTs != null && actualEndTs != null && actualEndTs > expectedEndTs)
    ? Math.round((actualEndTs - expectedEndTs) / dayMs)
    : 0;

  const lagDaysRaw = freshnessTargetTs != null && currentTs != null
    ? (freshnessTargetTs - currentTs) / dayMs
    : null;
  const lagLabel = lagDaysRaw == null
    ? 'N/A'
    : lagDaysRaw <= -0.1
      ? `Ahead by ${Math.abs(lagDaysRaw).toFixed(1)}d`
      : lagDaysRaw > 0.1
        ? `${lagDaysRaw.toFixed(1)}d behind`
        : 'On time';

  const qualityState = coveragePct == null
    ? 'unknown'
    : coveragePct >= 95 && (lagDaysRaw == null || lagDaysRaw <= 1)
      ? 'ok'
      : coveragePct >= 80 && (lagDaysRaw == null || lagDaysRaw <= 7)
        ? 'warn'
        : 'mismatch';
  const qualityLabel = qualityState === 'ok' ? 'Good'
    : qualityState === 'warn' ? 'Partial'
      : qualityState === 'mismatch' ? 'Limited'
        : 'Unknown';

  const freshnessState = lagDaysRaw == null
    ? 'unknown'
    : lagDaysRaw <= 1
      ? 'ok'
      : lagDaysRaw <= 7
        ? 'warn'
        : 'mismatch';

  const freshnessAlignmentPct = lagDaysRaw == null
    ? 0
    : lagDaysRaw <= 0
      ? 100
      : Math.max(0, 100 - Math.min(100, Math.round(lagDaysRaw * (100 / 60))));

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
          <div className="dm-modal__section-title">Current Integration Snapshot</div>
          <div className="dm-status-summary">
            <div className={`dm-status-pill dm-status-pill--${qualityState}`}>
              Quality: {qualityLabel}
            </div>
            <div className={`dm-status-pill dm-status-pill--${freshnessState}`}>
              Freshness: {lagLabel}
            </div>
            <div className="dm-status-pill">
              Coverage: {coveragePct != null ? `${coveragePct}%` : 'N/A'}
            </div>
            <div className="dm-status-pill">
              Rows: {(statusTable.rowCount || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="dm-modal__section">
          <div className="dm-modal__section-title">Requested vs Loaded Data</div>
          <div className="dm-status-compare">
            <div className="dm-table-status-card">
              <div className="dm-table-status-card__title">Requested for Sync</div>
              <div className="dm-table-status-card__range">
                {expectedRange?.min ? formatPreciseDate(expectedRange.min) : 'N/A'} {'->'} {expectedRange?.max ? formatPreciseDate(expectedRange.max) : 'N/A'}
              </div>
              <div className="dm-table-status-card__meta">
                Range Span: {requestedSpanDays != null ? `${requestedSpanDays} days` : 'N/A'}
              </div>
              <div className="dm-table-status-card__meta">
                Expected End: {expectedEndDate ? formatPreciseDateTime(expectedEndDate) : 'N/A'}
              </div>
            </div>
            <div className="dm-table-status-card">
              <div className="dm-table-status-card__title">Available in Table</div>
              <div className="dm-table-status-card__range">
                {actualRange?.min ? formatPreciseDate(actualRange.min) : 'N/A'} {'->'} {actualRange?.max ? formatPreciseDate(actualRange.max) : 'N/A'}
              </div>
              <div className="dm-table-status-card__meta">
                Loaded Span: {loadedSpanDays != null ? `${loadedSpanDays} days` : 'N/A'}
              </div>
              <div className="dm-table-status-card__meta">
                Latest Data: {statusTable.latestAvailableData ? formatPreciseDateTime(statusTable.latestAvailableData) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <div className="dm-modal__section">
          <div className="dm-modal__section-title">Availability Representation</div>
          <div className="dm-status-meters">
            <div className="dm-status-meter">
              <div className="dm-status-meter__label">
                Coverage Inside Requested Window ({formatDateRange(expectedRange)})
              </div>
              <div className="dm-status-meter__track">
                <div
                  className={`dm-status-meter__fill dm-status-meter__fill--${qualityState}`}
                  style={{ width: `${Math.max(0, Math.min(100, coveragePct ?? 0))}%` }}
                />
              </div>
              <div className="dm-status-meter__value">
                {coveragePct != null
                  ? `${coveragePct}%${overlapDays != null ? ` (${overlapDays} days overlap)` : ''}`
                  : 'N/A'}
              </div>
            </div>
            <div className="dm-status-meter">
              <div className="dm-status-meter__label">
                Freshness to Target ({freshnessTargetTs != null ? formatPreciseDate(new Date(freshnessTargetTs)) : 'N/A'})
              </div>
              <div className="dm-status-meter__track">
                <div
                  className={`dm-status-meter__fill dm-status-meter__fill--${freshnessState}`}
                  style={{ width: `${Math.max(0, Math.min(100, freshnessAlignmentPct))}%` }}
                />
              </div>
              <div className="dm-status-meter__value">
                {lagLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="dm-modal__section">
          <div className="dm-modal__section-title">Operational Details</div>
          <div className="dm-modal__grid">
            <div><strong>Provider:</strong> {statusProvider || 'N/A'}</div>
            <div><strong>Source:</strong> {statusTable.source || statusConfig?.source || 'N/A'}</div>
            <div><strong>Source Query:</strong> {statusConfig?.source || 'N/A'}</div>
            <div><strong>Sync Key:</strong> {statusConfig?.syncType || 'N/A'}</div>
            <div><strong>Date Columns:</strong> {statusDateColumns.length > 0 ? statusDateColumns.join(', ') : 'None'}</div>
            <div><strong>Type / Load:</strong> {(statusTable.type || 'N/A')} / {(statusTable.loadMethod || 'N/A')}</div>
            <div><strong>Requested Range (raw):</strong> {formatDateRange(expectedRange)}</div>
            <div><strong>Loaded Range (raw):</strong> {formatDateRange(statusTable.actualDataRange)}</div>
            <div><strong>Outside Range Before:</strong> {beforeRequestedDays > 0 ? `${beforeRequestedDays} days` : 'No'}</div>
            <div><strong>Outside Range After:</strong> {afterRequestedDays > 0 ? `${afterRequestedDays} days` : 'No'}</div>
            <div><strong>Latest Snapshot:</strong> {statusTable.latestSnapshotDate ? formatPreciseDateTime(statusTable.latestSnapshotDate) : 'N/A'}</div>
            <div><strong>Freshness Target:</strong> {freshnessTargetTs != null ? formatPreciseDateTime(new Date(freshnessTargetTs)) : 'N/A'}</div>
            <div><strong>Last Sync:</strong> {statusTable.lastSync ? formatPreciseDateTime(statusTable.lastSync) : 'N/A'}</div>
            <div><strong>Rows:</strong> {(statusTable.rowCount || 0).toLocaleString()}</div>
            <div><strong>Records Processed:</strong> {(statusTable.recordsProcessed || 0).toLocaleString()}</div>
            <div><strong>Changes Detected:</strong> {(statusTable.changesDetected || 0).toLocaleString()}</div>
            <div><strong>Last Error:</strong> {statusTable.lastError || 'None'}</div>
            <div><strong>Sync Status:</strong> {statusTable.syncStatus || 'N/A'}</div>
            <div><strong>Status:</strong> {statusTable.status || 'N/A'}</div>
            <div><strong>Latest Data (formatted):</strong> {statusTable.latestAvailableData ? formatDateTime(statusTable.latestAvailableData) : 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
