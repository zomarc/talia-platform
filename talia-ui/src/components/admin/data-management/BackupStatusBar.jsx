import React from 'react';

const BackupStatusBar = ({ theme, backupStatus, formatDateTime, triggerBackup, fetchBackupStatus }) => {
  return (
    <div
      style={{
        background: theme.colors.glass,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '8px 12px',
        borderRadius: '12px',
        marginBottom: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        border: `1px solid ${theme.colors.glassBorder}`,
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        fontSize: '10px',
        borderLeft: `2px solid ${backupStatus.lastBackup ? '#4caf50' : '#ff9800'}`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
        <span style={{ color: theme.colors.textSecondary }}>💾 Last Backup:</span>
        <span
          style={{
            color: backupStatus.lastBackup ? theme.colors.foreground : theme.colors.textMuted,
            fontWeight: '600'
          }}
        >
          {backupStatus.loading
            ? '⏳ Checking...'
            : backupStatus.lastBackup
              ? formatDateTime(backupStatus.lastBackup)
              : 'Never'}
        </span>
        {backupStatus.size && (
          <span style={{ color: theme.colors.textSecondary, marginLeft: '8px' }}>
            ({backupStatus.size})
          </span>
        )}
        {backupStatus.status && backupStatus.status !== 'idle' && (
          <span
            style={{
              color: backupStatus.status === 'success' ? '#4caf50' : '#f44336',
              marginLeft: '8px',
              fontSize: '8px'
            }}
          >
            [{backupStatus.status}]
          </span>
        )}
      </div>
      <button
        onClick={triggerBackup}
        disabled={backupStatus.loading}
        style={{
          padding: '4px 8px',
          fontSize: '10px',
          background: backupStatus.loading ? theme.colors.glass : '#4caf50',
          color: backupStatus.loading ? theme.colors.textMuted : 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: backupStatus.loading ? 'not-allowed' : 'pointer',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
        title="Create a new database backup"
      >
        {backupStatus.loading ? '⏳ Backing up...' : '💾 Backup Now'}
      </button>
      <button
        onClick={fetchBackupStatus}
        disabled={backupStatus.loading}
        style={{
          padding: '4px 8px',
          fontSize: '10px',
          background: 'transparent',
          color: theme.colors.textSecondary,
          border: `1px solid ${theme.colors.glassBorder}`,
          borderRadius: '6px',
          cursor: backupStatus.loading ? 'not-allowed' : 'pointer',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
        title="Refresh backup status"
      >
        ↻
      </button>
    </div>
  );
};

export default BackupStatusBar;
