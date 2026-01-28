import React from 'react';

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
  setReviewLoading,
  setReviewData,
  addClientLog,
  handleSync,
  handleFullSync,
  logIdCounterRef
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
      <td style={{
        padding: '6px 8px',
        fontFamily: 'monospace',
        fontSize: '10px',
        fontWeight: '500',
        width: columnWidths.tableName
      }}>
        {table.tableName}
      </td>
      <td style={{
        padding: '6px 8px',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: table.source === 'N/A' ? theme.colors.textMuted : theme.colors.foreground,
        width: columnWidths.source
      }}>
        {table.source}
      </td>
      <td style={{
        padding: '6px 8px',
        textAlign: 'center',
        fontSize: '9px',
        fontWeight: '600',
        width: columnWidths.loadMethod
      }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 6px',
          borderRadius: '3px',
          background: table.loadMethod === 'Batch'
            ? 'rgba(33, 150, 243, 0.2)'
            : 'rgba(76, 175, 80, 0.2)',
          color: table.loadMethod === 'Batch'
            ? '#2196F3'
            : '#4CAF50',
          border: `1px solid ${table.loadMethod === 'Batch' ? '#2196F3' : '#4CAF50'}`
        }}>
          {table.loadMethod || 'N/A'}
        </span>
      </td>
      <td style={{
        padding: '6px 8px',
        textAlign: 'right',
        fontFamily: 'monospace',
        fontSize: '10px',
        width: columnWidths.rowCount
      }}>
        {table.rowCount.toLocaleString()}
      </td>
      <td style={{
        padding: '8px 12px',
        fontSize: '11px',
        width: columnWidths.dateRange,
        color: theme.colors.textSecondary
      }}>
        {formatDateRange(table.dateRange)}
      </td>
      <td style={{
        padding: '8px 12px',
        fontSize: '11px',
        width: columnWidths.lastSync,
        color: theme.colors.textSecondary
      }}>
        {formatDateTime(table.lastSync)}
      </td>
      <td style={{
        padding: '8px 12px',
        fontSize: '11px',
        width: columnWidths.latestSnapshot,
        color: table.latestSnapshotDate ? theme.colors.textSecondary : theme.colors.textMuted
      }}>
        {table.latestSnapshotDate ? formatDate(table.latestSnapshotDate) : 'N/A'}
      </td>
      <td style={{
        padding: '8px 12px',
        fontFamily: 'monospace',
        fontSize: '10px',
        textAlign: 'right',
        color: table.recordsProcessed !== null && table.recordsProcessed !== undefined ? theme.colors.textSecondary : theme.colors.textMuted,
        width: columnWidths.recordsProcessed
      }}>
        {table.recordsProcessed !== null && table.recordsProcessed !== undefined
          ? table.recordsProcessed.toLocaleString()
          : '—'}
      </td>
      <td style={{
        padding: '8px 12px',
        fontFamily: 'monospace',
        fontSize: '10px',
        textAlign: 'right',
        color: table.changesDetected !== null && table.changesDetected !== undefined ? theme.colors.textSecondary : theme.colors.textMuted,
        width: columnWidths.changesDetected
      }}>
        {table.changesDetected !== null && table.changesDetected !== undefined
          ? table.changesDetected.toLocaleString()
          : '—'}
      </td>
      <td style={{
        padding: '8px 12px',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: table.syncDuration === null ? theme.colors.textMuted : theme.colors.textSecondary,
        width: columnWidths.syncDuration
      }}>
        {formatDuration(table.syncDuration)}
      </td>
      <td style={{
        padding: '6px 8px',
        width: columnWidths.status
      }}>
        {isSyncing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '8px',
              color: '#ff69b4',
              fontWeight: '600'
            }}>
              <span>🔄 Syncing...</span>
              <span>{progress?.percentage || 0}%</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 105, 180, 0.2)',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                width: `${progress?.percentage || 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ff69b4, #ff1493)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
                boxShadow: '0 0 6px rgba(255, 105, 180, 0.6)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  animation: 'shimmer 2s infinite'
                }} />
              </div>
            </div>
            {progress?.message && (
              <div style={{ fontSize: '7px', color: theme.colors.textMuted, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {progress.message}
              </div>
            )}
            {progress?.type === 'batch' && !progress.message && (
              <div style={{ fontSize: '7px', color: theme.colors.textMuted }}>
                Batch {progress.current}/{progress.total}
              </div>
            )}
            {progress?.type === 'insert' && !progress.message && (
              <div style={{ fontSize: '7px', color: theme.colors.textMuted }}>
                Inserted {progress.current.toLocaleString()}/{progress.total.toLocaleString()}
              </div>
            )}
            {progress?.type === 'records' && !progress.message && progress.total > 0 && (
              <div style={{ fontSize: '7px', color: theme.colors.textMuted }}>
                {progress.current.toLocaleString()}/{progress.total.toLocaleString()} records
              </div>
            )}
            {(!progress || progress.percentage === 0) && (
              <div style={{ fontSize: '7px', color: theme.colors.textMuted }}>
                Initializing...
              </div>
            )}
          </div>
        ) : (
          <span style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '9px',
            fontWeight: '500',
            background: statusColors.bg,
            color: statusColors.text
          }}>
            {table.status}
          </span>
        )}
      </td>
      <td
        style={{
          padding: '6px 8px',
          textAlign: 'center',
          width: columnWidths.actions
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {table.source !== 'N/A' && table.type !== 'unknown' && table.type !== 'system' && table.type !== 'application' ? (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusTable(table)}
              style={{
                padding: '4px 8px',
                fontSize: '9px',
                background: 'rgba(255, 255, 255, 0.06)',
                color: theme.colors.foreground,
                border: `1px solid ${theme.colors.glassBorder}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              title="View table status details"
            >
              🧾 Status
            </button>
            {selectedTable === table.tableName && (
              <button
                onClick={async () => {
                  setReviewLoading(true);
                  try {
                    const query = `
                          query GetTableData($tableName: String!, $limit: Int) {
                            tableData(tableName: $tableName, limit: $limit)
                          }
                        `;

                    const response = await fetch('/api/graphql', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        query,
                        variables: { tableName: table.tableName, limit: 100 }
                      })
                    });

                    if (!response.ok) {
                      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                    }

                    const result = await response.json();

                    if (result.errors && result.errors.length > 0) {
                      throw new Error(`GraphQL error: ${result.errors[0].message}`);
                    }

                    const data = result.data?.tableData || [];
                    setReviewData({ tableName: table.tableName, data });
                    addClientLog({
                      id: `${Date.now()}-${++logIdCounterRef.current}`,
                      timestamp: new Date(),
                      type: 'info',
                      message: `Loaded ${data.length} rows from ${table.tableName}`,
                      tableName: table.tableName
                    });
                  } catch (err) {
                    addClientLog({
                      id: `${Date.now()}-${++logIdCounterRef.current}`,
                      timestamp: new Date(),
                      type: 'error',
                      message: `❌ Failed to load data for ${table.tableName}: ${err.message}`,
                      tableName: table.tableName
                    });
                  } finally {
                    setReviewLoading(false);
                  }
                }}
                disabled={reviewLoading}
                style={{
                  padding: '4px 8px',
                  fontSize: '9px',
                  background: reviewLoading ? theme.colors.textMuted : '#4caf50',
                  color: reviewLoading ? theme.colors.textSecondary : '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: reviewLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  opacity: reviewLoading ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
                title="Review top 100 rows"
              >
                {reviewLoading ? '⏳' : '👁️ Review'}
              </button>
            )}
            <button
              onClick={() => handleSync(table.tableName, false)}
              disabled={isSyncing}
              style={{
                padding: '4px 8px',
                fontSize: '9px',
                background: isSyncing
                  ? theme.colors.textMuted
                  : theme.colors.accent,
                color: isSyncing
                  ? theme.colors.textSecondary
                  : '#0f0f23',
                border: 'none',
                borderRadius: '4px',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                opacity: isSyncing ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              title="Incremental sync"
            >
              {isSyncing ? '⏳ Syncing...' : '🔄 Sync'}
            </button>
            <button
              onClick={() => handleFullSync(table.tableName)}
              disabled={isSyncing}
              style={{
                padding: '4px 8px',
                fontSize: '9px',
                background: isSyncing
                  ? theme.colors.textMuted
                  : '#ff6b35',
                color: isSyncing
                  ? theme.colors.textSecondary
                  : '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                opacity: isSyncing ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              title="Force full refresh (syncs all data)"
            >
              {isSyncing ? '⏳' : '⚡ Full'}
            </button>
          </div>
        ) : (
          <span style={{ color: theme.colors.textMuted, fontSize: '9px' }}>—</span>
        )}
      </td>
    </tr>
  );
};

export default TableRow;
