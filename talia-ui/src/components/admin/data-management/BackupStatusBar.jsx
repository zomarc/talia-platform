import React from 'react';

const BackupStatusBar = ({ backupStatus, formatDateTime, triggerBackup, fetchBackupStatus, compact = false }) => {
  return (
    <div className={`dm-backup-bar ${compact ? 'dm-backup-bar--compact' : ''}`.trim()} data-has-backup={Boolean(backupStatus.lastBackup)}>
      <div className="dm-backup-meta">
        <span className="dm-backup-label">💾 Last Backup:</span>
        <span className="dm-backup-value" data-has-backup={Boolean(backupStatus.lastBackup)}>
          {backupStatus.loading
            ? '⏳ Checking...'
            : backupStatus.lastBackup
              ? formatDateTime(backupStatus.lastBackup)
              : 'Never'}
        </span>
        {backupStatus.size && (
          <span className="dm-backup-size">
            ({backupStatus.size})
          </span>
        )}
        {backupStatus.status && backupStatus.status !== 'idle' && (
          <span
            className={`dm-backup-status ${backupStatus.status === 'success' ? 'dm-backup-status--success' : 'dm-backup-status--error'}`}
          >
            [{backupStatus.status}]
          </span>
        )}
      </div>
      <button
        onClick={triggerBackup}
        disabled={backupStatus.loading}
        className="dm-backup-button dm-backup-button--primary"
        title="Create a new database backup"
      >
        {backupStatus.loading ? '⏳ Backing up...' : '💾 Backup Now'}
      </button>
      <button
        onClick={fetchBackupStatus}
        disabled={backupStatus.loading}
        className="dm-backup-button dm-backup-button--ghost"
        title="Refresh backup status"
      >
        ↻
      </button>
    </div>
  );
};

export default BackupStatusBar;
