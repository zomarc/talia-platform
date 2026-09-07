import React from 'react';
import { getTableSource } from '../../../config/tableSources';
import { DATE_ROLES } from '../../../lib/integrationDateProfile.js';
import { computeIntegrationHealth, isOpenEndedDate } from '../../../lib/integrationDateHealth.js';

const dateRoleLabel = (dateRole) => {
  if (dateRole === DATE_ROLES.SAILING_INTERVAL) return 'Sailing applicability';
  if (dateRole === DATE_ROLES.RECORD_VALIDITY) return 'Record version (SCD)';
  if (dateRole === DATE_ROLES.LOAD) return 'Load / sync';
  return 'Event / snapshot';
};

const StatusModal = ({ statusTable, configuredRange, onClose, formatDateRange, formatDateTime }) => {
  const statusConfig = statusTable ? getTableSource(statusTable.tableName) : null;
  const health = statusTable ? computeIntegrationHealth(statusTable, configuredRange) : null;
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

  const formatPreciseDate = (value) => {
    if (!value) return 'N/A';
    if (isOpenEndedDate(value)) return 'Open-ended';
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

  const formatApplicabilityRange = (range) => {
    if (!range?.min && !range?.max) return 'N/A';
    return `${formatPreciseDate(range.min)} -> ${formatPreciseDate(range.max)}`;
  };

  if (!statusTable || !health) return null;

  const isInterval = health.dateRole === DATE_ROLES.SAILING_INTERVAL
    || health.dateRole === DATE_ROLES.RECORD_VALIDITY;
  const requestedTitle = isInterval ? 'Requested sailing horizon' : 'Requested for Sync';
  const availableTitle = health.dateRole === DATE_ROLES.SAILING_INTERVAL
    ? 'Links covering that horizon'
    : health.dateRole === DATE_ROLES.RECORD_VALIDITY
      ? 'Record versions in table'
      : 'Available in Table';
  const coverageMeterLabel = health.dateRole === DATE_ROLES.SAILING_INTERVAL
    ? `Applies to requested sailing horizon (${formatDateRange(health.expectedRange)})`
    : `Coverage inside requested window (${formatDateRange(health.expectedRange)})`;
  const freshnessMeterLabel = health.freshnessClock === 'last_sync'
    ? `Feed freshness (last sync vs today)`
    : `Freshness to target (${health.freshnessTargetTs != null ? formatPreciseDate(new Date(health.freshnessTargetTs)) : 'N/A'})`;
  const rowApplyLabel = health.overlappingRows != null
    ? `${health.overlappingRows.toLocaleString()} of ${(statusTable.rowCount || 0).toLocaleString()} rows`
    : 'N/A';
  const sailApplyLabel = health.sailCoveragePct != null
    ? `${health.coveredSails.toLocaleString()} of ${health.totalSails.toLocaleString()} sailings (${health.sailCoveragePct}%)`
    : null;

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
            Status: {statusTable.tableName}
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
            <div className={`dm-status-pill dm-status-pill--${health.qualityState}`}>
              Quality: {health.qualityLabel}
            </div>
            <div className={`dm-status-pill dm-status-pill--${health.freshnessState}`}>
              Freshness: {health.lagLabel}
            </div>
            <div className="dm-status-pill">
              {health.coveragePhrase}
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
              <div className="dm-table-status-card__title">{requestedTitle}</div>
              <div className="dm-table-status-card__range">
                {health.expectedRange?.min ? formatPreciseDate(health.expectedRange.min) : 'N/A'} {'->'} {health.expectedRange?.max ? formatPreciseDate(health.expectedRange.max) : 'N/A'}
              </div>
              <div className="dm-table-status-card__meta">
                Range Span: {health.requestedSpanDays != null ? `${health.requestedSpanDays} days` : 'N/A'}
              </div>
              <div className="dm-table-status-card__meta">
                Expected End: {health.expectedRange?.max ? formatPreciseDateTime(health.expectedRange.max) : 'N/A'}
              </div>
            </div>
            <div className="dm-table-status-card">
              <div className="dm-table-status-card__title">{availableTitle}</div>
              <div className="dm-table-status-card__range">
                {formatApplicabilityRange(health.actualRange)}
              </div>
              <div className="dm-table-status-card__meta">
                {isInterval
                  ? `Rows applying: ${rowApplyLabel}`
                  : `Loaded Span: ${health.loadedSpanDays != null ? `${health.loadedSpanDays} days` : 'N/A'}`}
              </div>
              <div className="dm-table-status-card__meta">
                {sailApplyLabel
                  ? `Sailings covered: ${sailApplyLabel}`
                  : `Latest Data: ${statusTable.latestAvailableData ? formatPreciseDateTime(statusTable.latestAvailableData) : 'N/A'}`}
              </div>
            </div>
          </div>
        </div>

        <div className="dm-modal__section">
          <div className="dm-modal__section-title">Availability Representation</div>
          <div className="dm-status-meters">
            <div className="dm-status-meter">
              <div className="dm-status-meter__label">
                {coverageMeterLabel}
              </div>
              <div className="dm-status-meter__track">
                <div
                  className={`dm-status-meter__fill dm-status-meter__fill--${health.qualityState}`}
                  style={{ width: `${Math.max(0, Math.min(100, health.coveragePct ?? 0))}%` }}
                />
              </div>
              <div className="dm-status-meter__value">
                {health.coveragePct != null
                  ? `${health.coveragePhrase}${health.overlapDays != null && health.coverageKind !== 'sails' ? ` (${health.overlapDays} days overlap)` : ''}`
                  : 'N/A'}
              </div>
            </div>
            <div className="dm-status-meter">
              <div className="dm-status-meter__label">
                {freshnessMeterLabel}
              </div>
              <div className="dm-status-meter__track">
                <div
                  className={`dm-status-meter__fill dm-status-meter__fill--${health.freshnessState}`}
                  style={{ width: `${Math.max(0, Math.min(100, health.freshnessAlignmentPct))}%` }}
                />
              </div>
              <div className="dm-status-meter__value">
                {health.lagLabel}
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
            <div><strong>Date Role:</strong> {dateRoleLabel(health.dateRole)}</div>
            <div><strong>Date Columns:</strong> {statusDateColumns.length > 0 ? statusDateColumns.join(', ') : 'None'}</div>
            <div><strong>Type / Load:</strong> {(statusTable.type || 'N/A')} / {(statusTable.loadMethod || 'N/A')}</div>
            <div><strong>Requested Range (raw):</strong> {formatDateRange(health.expectedRange)}</div>
            <div><strong>Applicability Range (raw):</strong> {formatDateRange(statusTable.actualDataRange)}</div>
            <div><strong>Open-ended windows:</strong> {health.openEnded ? 'Yes (to 2099+)' : 'No'}</div>
            <div><strong>Rows applying to horizon:</strong> {rowApplyLabel}</div>
            <div><strong>Sailings covered:</strong> {sailApplyLabel || 'N/A'}</div>
            <div><strong>Outside Range Before:</strong> {health.beforeRequestedDays > 0 ? `${health.beforeRequestedDays} days` : 'No'}</div>
            <div><strong>Outside Range After:</strong> {health.afterRequestedDays > 0 ? `${health.afterRequestedDays} days` : 'No'}</div>
            <div><strong>Latest Snapshot:</strong> {statusTable.latestSnapshotDate ? formatPreciseDateTime(statusTable.latestSnapshotDate) : 'N/A'}</div>
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
