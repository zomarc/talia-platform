import React from 'react';
import { getTableSource } from '../../../config/tableSources';

const StatusModal = ({ theme, statusTable, onClose, formatDateRange, formatDateTime }) => {
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

  if (!statusTable) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '12px',
          padding: '16px',
          minWidth: '420px',
          maxWidth: '720px',
          border: `1px solid ${theme.colors.glassBorder}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: theme.colors.foreground }}>
            🧾 Status: {statusTable.tableName}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              background: 'transparent',
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.glassBorder}`,
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', fontSize: '10px' }}>
          <div><strong>Provider:</strong> {statusProvider || 'N/A'}</div>
          <div><strong>Source:</strong> {statusTable.source || statusConfig?.source || 'N/A'}</div>
          <div><strong>Source Query:</strong> {statusConfig?.source || 'N/A'}</div>
          <div><strong>Sync Key:</strong> {statusConfig?.syncType || 'N/A'}</div>
          <div><strong>Date Columns:</strong> {statusDateColumns.length > 0 ? statusDateColumns.join(', ') : 'None'}</div>
          <div><strong>Type:</strong> {statusTable.type || 'N/A'}</div>
          <div><strong>Load Method:</strong> {statusTable.loadMethod || 'N/A'}</div>
          <div><strong>Rows:</strong> {(statusTable.rowCount || 0).toLocaleString()}</div>
          <div><strong>Last Requested:</strong> {formatDateRange(statusTable.dateRange)}</div>
          <div><strong>Current Data:</strong> {formatDateRange(statusTable.actualDataRange)}</div>
          <div><strong>Last Sync:</strong> {statusTable.lastSync ? formatDateTime(statusTable.lastSync) : 'N/A'}</div>
          <div><strong>Latest Snapshot:</strong> {statusTable.latestSnapshot ? formatDateTime(statusTable.latestSnapshot) : 'N/A'}</div>
          <div><strong>Records Processed:</strong> {(statusTable.recordsProcessed || 0).toLocaleString()}</div>
          <div><strong>Changes Detected:</strong> {(statusTable.changesDetected || 0).toLocaleString()}</div>
          <div><strong>Last Error:</strong> {statusTable.lastError || 'None'}</div>
          <div><strong>Sync Status:</strong> {statusTable.syncStatus || 'N/A'}</div>
          <div><strong>Status:</strong> {statusTable.status || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
