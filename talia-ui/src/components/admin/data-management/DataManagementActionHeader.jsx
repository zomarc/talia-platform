/**
 * Common Data Management action header — Talia standard.
 * Dispatches DATA_MANAGEMENT_* events for async actions; panel listens and runs handlers.
 * Always visible when panel is shown (no showDetails gate).
 */

import React from 'react';
import {
  DATA_MANAGEMENT_SYNC_ALL_EVENT,
  DATA_MANAGEMENT_BACKUP_EVENT,
  DATA_MANAGEMENT_REFRESH_EVENT,
  DATA_MANAGEMENT_TABLE_ACTION_EVENT,
} from '../../dockview/eventConstants';
import {
  IconBackup,
  IconBolt,
  IconEye,
  IconRefresh,
  IconSpinner,
  IconStatus,
  IconStop,
} from '../../shared/StatusBarIcons';

const dispatch = (eventName, detail) => {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

const ActionIconLabel = ({ icon, label }) => (
  <span className="dm-action-header__btn-inner">
    <span className="dm-action-header__btn-icon" aria-hidden="true">{icon}</span>
    <span>{label}</span>
  </span>
);

const DataManagementActionHeader = ({
  panelComponentId,
  tables = [],
  selectedTable,
  syncableTableNames = [],
  bulkSyncing,
  runningSyncCount,
  runningProgress,
  bulkSummary,
  backupStatus,
  configuredRange,
  globalActualRange,
  formatDateTime,
  formatDateRange = (r) => (r?.min && r?.max ? `${r.min} - ${r.max}` : 'N/A'),
  lastActivityLog = null,
  syncBlock = null,
  stoppingSync = false,
  onStopSync = null,
  children = null,
}) => {
  const isSyncActive = runningSyncCount > 0 || bulkSyncing === true || Boolean(syncBlock);
  const syncPercent = Number.isFinite(Number(runningProgress)) ? Math.max(0, Math.min(100, Number(runningProgress))) : 0;
  const handleTableAction = (action) => () => {
    if (!selectedTable) return;
    dispatch(DATA_MANAGEMENT_TABLE_ACTION_EVENT, {
      panelComponent: panelComponentId,
      tableName: selectedTable,
      action,
    });
  };

  const handleSyncAll = (mode) => () => {
    dispatch(DATA_MANAGEMENT_SYNC_ALL_EVENT, {
      panelComponent: panelComponentId,
      mode: mode === 'full' ? 'full' : 'sync',
    });
  };

  const handleBackup = () => {
    dispatch(DATA_MANAGEMENT_BACKUP_EVENT, {
      panelComponent: panelComponentId,
    });
  };

  const handleRefresh = () => {
    dispatch(DATA_MANAGEMENT_REFRESH_EVENT, {
      panelComponent: panelComponentId,
    });
  };

  const canActOnTable = selectedTable && syncableTableNames.includes(selectedTable);
  const hasTableSelection = Boolean(selectedTable);
  const totalTables = Array.isArray(tables) ? tables.length : 0;
  const syncedTables = Array.isArray(tables) ? tables.filter((t) => t?.syncStatus === 'Synced').length : 0;
  const withDataTables = Array.isArray(tables) ? tables.filter((t) => Number(t?.rowCount || 0) > 0).length : 0;
  const lastMessage = typeof lastActivityLog?.message === 'string' ? lastActivityLog.message.trim() : '';
  const lastMessageSource = typeof lastActivityLog?.source === 'string' ? lastActivityLog.source : 'client';
  const lastMessageTime = lastActivityLog?.timestamp ? formatDateTime?.(lastActivityLog.timestamp) : null;
  const liveStateLabel = syncBlock ? 'Blocked' : isSyncActive ? 'Working' : 'Ready';

  return (
    <header className={`dm-action-header talia-report__actions-bar ${isSyncActive ? 'dm-action-header--syncing' : ''}`} aria-label="Data management actions">
      <div className="dm-action-header__row">
        <div className="dm-action-header__actions">
          <button
            type="button"
            className="talia-btn talia-btn--small"
            onClick={handleTableAction('status')}
            disabled={!hasTableSelection}
            title="Status for selected table"
          >
            <ActionIconLabel icon={<IconStatus />} label="Status" />
          </button>
          <button
            type="button"
            className="talia-btn talia-btn--small"
            onClick={handleTableAction('review')}
            disabled={!hasTableSelection}
            title="Review selected table rows"
          >
            <ActionIconLabel icon={<IconEye />} label="Review" />
          </button>
          <button
            type="button"
            className="talia-btn talia-btn--small talia-btn--primary"
            onClick={handleTableAction('sync')}
            disabled={!canActOnTable || bulkSyncing}
            title="Sync selected table"
          >
            <ActionIconLabel icon={<IconRefresh />} label="Sync" />
          </button>
          <button
            type="button"
            className="talia-btn talia-btn--small"
            onClick={handleTableAction('full')}
            disabled={!canActOnTable || bulkSyncing}
            title="Full update selected table"
          >
            <ActionIconLabel icon={<IconBolt />} label="Full" />
          </button>
        </div>

        <span className="dm-action-header__separator" aria-hidden />

        <button
          type="button"
          className="talia-btn talia-btn--small"
          onClick={handleSyncAll('sync')}
          disabled={bulkSyncing || syncableTableNames.length === 0}
          title="Sync all configured tables"
        >
          <ActionIconLabel icon={<IconRefresh all />} label="Sync All" />
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--small"
          onClick={handleSyncAll('full')}
          disabled={bulkSyncing || syncableTableNames.length === 0}
          title="Full update all tables"
        >
          <ActionIconLabel icon={<IconBolt />} label="Full All" />
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--small"
          onClick={handleBackup}
          disabled={backupStatus?.loading}
          title="Create database backup"
        >
          <ActionIconLabel
            icon={backupStatus?.loading ? <IconSpinner /> : <IconBackup />}
            label="Backup"
          />
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--small talia-btn--ghost"
          onClick={handleRefresh}
          title="Refresh tables and backup status"
        >
          <IconRefresh />
        </button>
        {isSyncActive && (
          <div className="dm-action-header__sync-live" role="status" aria-live="polite">
            <div className="dm-action-header__sync-live-title">
              <span className="dm-action-header__sync-live-dot" aria-hidden="true" />
              Syncing {runningSyncCount || 1} table{(runningSyncCount || 1) > 1 ? 's' : ''}
            </div>
            <div className="dm-action-header__sync-live-track" aria-hidden="true">
              <div className="dm-action-header__sync-live-fill" style={{ width: `${syncPercent}%` }} />
            </div>
            <div className="dm-action-header__sync-live-value">{syncPercent}%</div>
            <button
              type="button"
              className="talia-btn talia-btn--small dm-btn--danger"
              onClick={() => onStopSync?.()}
              disabled={stoppingSync || !onStopSync}
              title="Stop the running table sync"
            >
              <ActionIconLabel
                icon={stoppingSync ? <IconSpinner /> : <IconStop />}
                label={stoppingSync ? 'Stopping…' : 'Stop'}
              />
            </button>
          </div>
        )}
      </div>

      <div className="dm-action-header__meta">
        <span className="dm-action-header__stat">Total: <strong>{totalTables}</strong></span>
        <span className="dm-action-header__stat dm-action-header__stat--success">Synced: <strong>{syncedTables}</strong></span>
        <span className="dm-action-header__stat">With Data: <strong>{withDataTables}</strong></span>
        <span className={`dm-action-header__working ${syncBlock ? 'dm-action-header__working--blocked' : isSyncActive ? 'dm-action-header__working--active' : ''}`}>
          <span className="dm-action-header__working-dot" aria-hidden="true" />
          {liveStateLabel}
        </span>
        {syncBlock ? (
          <span
            className="dm-action-header__block"
            title={syncBlock?.message || 'Server sync lock is active'}
          >
            Lock active{syncBlock?.tableName ? `: ${syncBlock.tableName}` : ''}
          </span>
        ) : null}
        {lastMessage ? (
          <span className="dm-action-header__last-log" title={`${lastMessageTime || 'Now'} • ${lastMessageSource}: ${lastMessage}`}>
            <span className="dm-action-header__last-log-label">Last log</span>
            <span className="dm-action-header__last-log-message">
              [{lastMessageSource}] {lastMessage}
            </span>
            {lastMessageTime ? <span className="dm-action-header__last-log-time">{lastMessageTime}</span> : null}
          </span>
        ) : (
          <span className="dm-action-header__last-log dm-action-header__last-log--empty">
            <span className="dm-action-header__last-log-label">Last log</span>
            <span className="dm-action-header__last-log-message">No activity yet</span>
          </span>
        )}
        {runningSyncCount > 0 ? (
          <span className="dm-action-header__progress">
            Syncing {runningSyncCount} table{runningSyncCount > 1 ? 's' : ''} — {syncPercent}%
          </span>
        ) : bulkSummary ? (
          <span className={bulkSummary.failedCount > 0 ? 'dm-action-header__summary--error' : ''}>
            {bulkSummary.successCount}/{bulkSummary.total} succeeded
            {bulkSummary.failedCount > 0 ? ` (${bulkSummary.failedCount} failed)` : ''}
          </span>
        ) : (
          <>
            <span>Backup: {backupStatus?.lastBackup ? formatDateTime?.(backupStatus.lastBackup) : 'Never'}</span>
            <span>Global: {formatDateRange(configuredRange)}</span>
            <span>Available: {formatDateRange(globalActualRange)}</span>
          </>
        )}
      </div>
      {children ? <div className="dm-action-header__import">{children}</div> : null}
    </header>
  );
};

export default DataManagementActionHeader;
