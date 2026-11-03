import React from 'react';

const BackupStatusBar = ({
  backupStatus,
  formatDateTime,
  triggerBackup,
  fetchBackupStatus,
  compact = false,
  hideActions = false,
}) => (
  <div
    className={`dm-backup-bar ${compact ? 'dm-backup-bar--compact' : ''}`.trim()}
    data-has-backup={Boolean(backupStatus.lastBackup)}
  >
    <div className="dm-backup-meta">
      <span className="dm-backup-label">Last backup</span>
      <span className="dm-backup-value" data-has-backup={Boolean(backupStatus.lastBackup)}>
        {backupStatus.loading
          ? 'Checking…'
          : backupStatus.lastBackup
            ? formatDateTime(backupStatus.lastBackup)
            : 'Never'}
      </span>
      {backupStatus.size ? (
        <span className="dm-backup-size">({backupStatus.size})</span>
      ) : null}
      {backupStatus.status && backupStatus.status !== 'idle' ? (
        <span
          className={`dm-backup-status ${
            backupStatus.status === 'success' ? 'dm-backup-status--success' : 'dm-backup-status--error'
          }`}
        >
          [{backupStatus.status}]
        </span>
      ) : null}
    </div>
    {hideActions ? null : (
      <div className="dm-backup-bar__actions">
        <button
          type="button"
          onClick={triggerBackup}
          disabled={backupStatus.loading}
          className="talia-btn talia-btn--primary talia-btn--small"
          title="Create a new database backup"
        >
          {backupStatus.loading ? 'Backing up…' : 'Backup now'}
        </button>
        <button
          type="button"
          onClick={fetchBackupStatus}
          disabled={backupStatus.loading}
          className="talia-btn talia-btn--ghost talia-btn--small"
          title="Refresh backup status"
        >
          Refresh
        </button>
      </div>
    )}
  </div>
);

export default BackupStatusBar;
