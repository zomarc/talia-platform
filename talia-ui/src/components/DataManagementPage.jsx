/**
 * Data Management Page
 * Displays database table information including sources, sync status, and data ranges
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDatabaseTables } from '../hooks/useDatabaseTables';
import { LoadingSpinner, ErrorMessage } from './shared';
import { getThemeForMode } from '../themes/modeThemes';
import { supabase } from '../lib/supabase';

const DataManagementPage = () => {
  const { tables, loading, error, refetch } = useDatabaseTables();
  const [sortColumn, setSortColumn] = useState('rowCount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState(null); // 'no-data', 'synced', 'outdated', etc.
  const [syncingTables, setSyncingTables] = useState(new Set());
  const [logs, setLogs] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const logEndRef = useRef(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  // Get theme for data mode
  const theme = getThemeForMode('data');

  // Format date for display (condensed)
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  // Format date range for display (condensed)
  const formatDateRange = (dateRange) => {
    if (!dateRange || (!dateRange.min && !dateRange.max)) {
      return 'N/A';
    }
    if (dateRange.min === dateRange.max) {
      return formatDate(dateRange.min);
    }
    const min = dateRange.min ? formatDate(dateRange.min) : 'N/A';
    const max = dateRange.max ? formatDate(dateRange.max) : 'N/A';
    return `${min} - ${max}`;
  };

  // Format duration in milliseconds to human-readable format
  const formatDuration = (durationMs) => {
    if (durationMs === null || durationMs === undefined) {
      return 'N/A';
    }
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      // Show milliseconds if less than 1 second, otherwise seconds
      return durationMs < 1000 ? `${durationMs}ms` : `${seconds}s`;
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    if (status.includes('Synced') && status.includes('Has Data')) {
      return { bg: '#e8f5e9', text: '#2e7d32' };
    }
    if (status.includes('Outdated') || status.includes('Stale')) {
      return { bg: '#fff3e0', text: '#e65100' };
    }
    if (status.includes('Never Synced') || status.includes('Not Synced')) {
      return { bg: '#fce4ec', text: '#c2185b' };
    }
    if (status.includes('Empty')) {
      return { bg: '#f5f5f5', text: '#757575' };
    }
    return { bg: '#e3f2fd', text: '#1976d2' };
  };

  // Sort tables
  const sortedTables = [...tables].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    // Handle date ranges
    if (sortColumn === 'dateRange') {
      aVal = a.dateRange?.max || a.dateRange?.min || '';
      bVal = b.dateRange?.max || b.dateRange?.min || '';
    }

    // Handle dates
    if (sortColumn === 'lastSync') {
      aVal = a.lastSync ? new Date(a.lastSync).getTime() : 0;
      bVal = b.lastSync ? new Date(b.lastSync).getTime() : 0;
    }

    // Handle duration
    if (sortColumn === 'syncDuration') {
      aVal = a.syncDuration !== null && a.syncDuration !== undefined ? a.syncDuration : -1;
      bVal = b.syncDuration !== null && b.syncDuration !== undefined ? b.syncDuration : -1;
    }

    // Convert to strings for comparison
    if (typeof aVal !== 'string') aVal = String(aVal || '');
    if (typeof bVal !== 'string') bVal = String(bVal || '');

    const comparison = aVal.localeCompare(bVal);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Filter tables
  const filteredTables = sortedTables.filter(table => {
    // Apply active filter button
    if (activeFilter === 'no-data') {
      if (table.rowCount > 0) return false;
    } else if (activeFilter === 'synced') {
      if (table.syncStatus !== 'Synced') return false;
    } else if (activeFilter === 'outdated') {
      if (table.syncStatus !== 'Outdated') return false;
    } else if (activeFilter === 'has-data') {
      if (table.rowCount === 0) return false;
    }

    // Apply text filter
    if (!filterText) return true;
    const searchText = filterText.toLowerCase();
    return (
      table.tableName.toLowerCase().includes(searchText) ||
      (table.source && table.source.toLowerCase().includes(searchText)) ||
      table.status.toLowerCase().includes(searchText)
    );
  });

  // Split into top 5 (by row count) and rest
  // Top 5 should always be sorted by row count descending, regardless of current sort
  const sortedByRowCount = [...filteredTables].sort((a, b) => b.rowCount - a.rowCount);
  const top5Tables = sortedByRowCount.slice(0, 5);
  // Rest should use the current sort order, excluding top 5
  const top5TableNames = new Set(top5Tables.map(t => t.tableName));
  const restTables = filteredTables.filter(table => !top5TableNames.has(table.tableName));

  // Handle column sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  // Column widths configuration - shared between both tables
  const columnWidths = {
    tableName: '16%',
    source: '20%',
    rowCount: '7%',
    dateRange: '16%',
    lastSync: '10%',
    syncDuration: '9%',
    status: '10%',
    actions: '12%'
  };

  // Handle sync button click
  const handleSync = async (tableName, forceFullSync = false) => {
    // Check if table has a sync configuration
    const table = tables.find(t => t.tableName === tableName);
    if (!table || table.source === 'N/A' || table.type === 'unknown' || table.type === 'system' || table.type === 'application') {
      alert(`Table "${tableName}" does not have a sync configuration.`);
      return;
    }

    setSyncingTables(prev => new Set(prev).add(tableName));
    
    // Add log entry
    const logEntry = {
      id: Date.now(),
      timestamp: new Date(),
      type: 'info',
      message: `Starting ${forceFullSync ? 'full refresh' : 'sync'} for ${tableName}...`,
      tableName
    };
    setLogs(prev => [...prev, logEntry]);

    try {
      const mutation = `
        mutation SyncTable($tableName: String!, $dataset: String, $forceFullSync: Boolean) {
          syncTable(tableName: $tableName, dataset: $dataset, forceFullSync: $forceFullSync) {
            success
            tableName
            message
            recordsProcessed
            duration
            error
          }
        }
      `;

      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            tableName: tableName,
            dataset: null,
            forceFullSync: forceFullSync
          }
        })
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL error');
      }

      if (result.data?.syncTable?.success) {
        const syncResult = result.data.syncTable;
        console.log('Sync completed:', syncResult);
        
        // Show success message with details
        const syncType = forceFullSync ? 'Full refresh' : 'Sync';
        const message = syncResult.recordsProcessed 
          ? `${syncType} completed successfully! Processed ${syncResult.recordsProcessed.toLocaleString()} records in ${formatDuration(syncResult.duration)}.`
          : `${syncType} completed successfully!`;
        console.log(message);
        
        // Add success log
        setLogs(prev => [...prev, {
          id: Date.now(),
          timestamp: new Date(),
          type: 'success',
          message,
          tableName
        }]);
        
        // Wait a bit longer to ensure database has updated, then refresh
        // For direct tables, the sync completes synchronously, but we give it time to commit
        setTimeout(() => {
          console.log('Refreshing table data...');
          refetch();
        }, 2000);
      } else {
        const errorMsg = result.data?.syncTable?.error || result.data?.syncTable?.message || 'Unknown error';
        // Add error log
        setLogs(prev => [...prev, {
          id: Date.now(),
          timestamp: new Date(),
          type: 'error',
          message: `Sync failed for ${tableName}: ${errorMsg}`,
          tableName
        }]);
        alert(`Sync failed: ${errorMsg}`);
      }
    } catch (err) {
      console.error('Sync error:', err);
      const errorMsg = err.message || 'Unknown error';
      // Add error log
      setLogs(prev => [...prev, {
        id: Date.now(),
        timestamp: new Date(),
        type: 'error',
        message: `Sync error for ${tableName}: ${errorMsg}`,
        tableName
      }]);
      alert(`Sync error: ${errorMsg}`);
    } finally {
      setSyncingTables(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableName);
        return newSet;
      });
    }
  };

  // Render table header
  const renderTableHeader = () => (
    <thead>
      <tr style={{
        background: theme.colors.glass,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${theme.colors.glassBorder}`
      }}>
        <th
          onClick={() => handleSort('tableName')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.tableName
          }}
        >
          Table Name<SortIcon column="tableName" />
        </th>
        <th
          onClick={() => handleSort('source')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.source
          }}
        >
          Source<SortIcon column="source" />
        </th>
        <th
          onClick={() => handleSort('rowCount')}
          style={{
            padding: '6px 8px',
            textAlign: 'right',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.rowCount
          }}
        >
          Rows<SortIcon column="rowCount" />
        </th>
        <th
          onClick={() => handleSort('dateRange')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.dateRange
          }}
        >
          Data Range<SortIcon column="dateRange" />
        </th>
        <th
          onClick={() => handleSort('lastSync')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.lastSync
          }}
        >
          Last Sync<SortIcon column="lastSync" />
        </th>
        <th
          onClick={() => handleSort('syncDuration')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.syncDuration
          }}
        >
          Sync Duration<SortIcon column="syncDuration" />
        </th>
        <th
          onClick={() => handleSort('status')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.status
          }}
        >
          Status<SortIcon column="status" />
        </th>
        <th
          style={{
            padding: '6px 8px',
            textAlign: 'center',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.actions
          }}
        >
          Actions
        </th>
      </tr>
    </thead>
  );

  // Render table rows
  const renderTableRows = (tableList) => {
    return tableList.map((table, idx) => {
      const statusColors = getStatusColor(table.status);
      return (
        <tr
          key={table.tableName}
          onClick={() => setSelectedTable(table.tableName === selectedTable ? null : table.tableName)}
          style={{
            borderBottom: `1px solid ${theme.colors.glassBorder}`,
            background: table.tableName === selectedTable 
              ? 'rgba(100, 181, 246, 0.2)' 
              : idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          <td style={{
            padding: '6px 8px',
            fontFamily: 'monospace',
            fontSize: '10px',
            fontWeight: '500',
            width: columnWidths.tableName,
            color: theme.colors.foreground
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
            textAlign: 'right',
            fontFamily: 'monospace',
            fontSize: '10px',
            width: columnWidths.rowCount,
            color: theme.colors.foreground
          }}>
            {table.rowCount.toLocaleString()}
          </td>
          <td style={{
            padding: '6px 8px',
            fontSize: '10px',
            color: theme.colors.textSecondary,
            width: columnWidths.dateRange
          }}>
            {formatDateRange(table.dateRange)}
          </td>
          <td style={{
            padding: '6px 8px',
            fontSize: '10px',
            color: theme.colors.textSecondary,
            width: columnWidths.lastSync
          }}>
            {formatDate(table.lastSync)}
          </td>
          <td style={{
            padding: '6px 8px',
            fontSize: '10px',
            fontFamily: 'monospace',
            color: table.syncDuration === null ? theme.colors.textMuted : theme.colors.textSecondary,
            width: columnWidths.syncDuration
          }}>
            {formatDuration(table.syncDuration)}
          </td>
          <td style={{ 
            padding: '6px 8px',
            width: columnWidths.status
          }}>
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
          </td>
          <td style={{
            padding: '6px 8px',
            textAlign: 'center',
            width: columnWidths.actions
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {table.source !== 'N/A' && table.type !== 'unknown' && table.type !== 'system' && table.type !== 'application' ? (
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedTable === table.tableName && (
                  <button
                    onClick={async () => {
                      setReviewLoading(true);
                      try {
                        const { data, error } = await supabase
                          .from(table.tableName)
                          .select('*')
                          .limit(100);
                        
                        if (error) throw error;
                        setReviewData({ tableName: table.tableName, data });
                        setLogs(prev => [...prev, {
                          id: Date.now(),
                          timestamp: new Date(),
                          type: 'info',
                          message: `Loaded ${data.length} rows from ${table.tableName}`,
                          tableName: table.tableName
                        }]);
                      } catch (err) {
                        setLogs(prev => [...prev, {
                          id: Date.now(),
                          timestamp: new Date(),
                          type: 'error',
                          message: `Failed to load data for ${table.tableName}: ${err.message}`,
                          tableName: table.tableName
                        }]);
                        alert(`Failed to load data: ${err.message}`);
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
                  disabled={syncingTables.has(table.tableName)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '9px',
                    background: syncingTables.has(table.tableName) 
                      ? theme.colors.textMuted 
                      : theme.colors.accent,
                    color: syncingTables.has(table.tableName) 
                      ? theme.colors.textSecondary 
                      : '#0f0f23',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: syncingTables.has(table.tableName) ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: syncingTables.has(table.tableName) ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                  title="Incremental sync"
                >
                  {syncingTables.has(table.tableName) ? '⏳ Syncing...' : '🔄 Sync'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Force full refresh for "${table.tableName}"? This will sync all data, not just changes.`)) {
                      handleSync(table.tableName, true);
                    }
                  }}
                  disabled={syncingTables.has(table.tableName)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '9px',
                    background: syncingTables.has(table.tableName) 
                      ? theme.colors.textMuted 
                      : '#ff6b35',
                    color: syncingTables.has(table.tableName) 
                      ? theme.colors.textSecondary 
                      : '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: syncingTables.has(table.tableName) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: syncingTables.has(table.tableName) ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                  title="Force full refresh (syncs all data)"
                >
                  {syncingTables.has(table.tableName) ? '⏳' : '⚡ Full'}
                </button>
              </div>
            ) : (
              <span style={{ color: theme.colors.textMuted, fontSize: '9px' }}>—</span>
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <div style={{
      padding: '8px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      backgroundAttachment: 'fixed',
      minHeight: '100vh',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '8px 12px',
          borderRadius: '12px',
          marginBottom: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          border: `1px solid ${theme.colors.glassBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '14px', color: theme.colors.foreground, fontWeight: '600' }}>
              📊 Data Management
            </h1>
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            style={{
              padding: '4px 8px',
              background: loading ? theme.colors.glass : theme.colors.accent,
              color: loading ? theme.colors.textMuted : '#0f0f23',
              border: loading ? `1px solid ${theme.colors.glassBorder}` : 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              backdropFilter: loading ? 'blur(10px)' : 'none',
              WebkitBackdropFilter: loading ? 'blur(10px)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '⏳' : '↻'} Refresh
          </button>
        </div>

        {/* Summary Bar */}
        <div style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '6px 12px',
          borderRadius: '12px',
          marginBottom: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          border: `1px solid ${theme.colors.glassBorder}`,
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          fontSize: '10px',
          borderLeft: `2px solid ${theme.colors.accent}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: theme.colors.textSecondary }}>Total:</span>
            <span style={{ color: theme.colors.foreground, fontWeight: '600' }}>{tables.length}</span>
          </div>
          <div style={{ width: '1px', height: '16px', background: theme.colors.glassBorder }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: theme.colors.textSecondary }}>Synced:</span>
            <span style={{ color: '#4caf50', fontWeight: '600' }}>
              {tables.filter(t => t.syncStatus === 'Synced').length}
            </span>
          </div>
          <div style={{ width: '1px', height: '16px', background: theme.colors.glassBorder }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: theme.colors.textSecondary }}>With Data:</span>
            <span style={{ color: theme.colors.foreground, fontWeight: '600' }}>
              {tables.filter(t => t.rowCount > 0).length}
            </span>
          </div>
        </div>

        {/* Filter Buttons */}
        <div style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '6px 8px',
          borderRadius: '12px',
          marginBottom: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          border: `1px solid ${theme.colors.glassBorder}`,
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setActiveFilter(activeFilter === 'no-data' ? null : 'no-data')}
            style={{
              padding: '4px 8px',
              background: activeFilter === 'no-data' ? theme.colors.accent : theme.colors.glass,
              backdropFilter: activeFilter !== 'no-data' ? 'blur(10px)' : 'none',
              WebkitBackdropFilter: activeFilter !== 'no-data' ? 'blur(10px)' : 'none',
              color: activeFilter === 'no-data' ? '#0f0f23' : theme.colors.foreground,
              border: activeFilter !== 'no-data' ? `1px solid ${theme.colors.glassBorder}` : 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            No Data ({tables.filter(t => t.rowCount === 0).length})
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'has-data' ? null : 'has-data')}
            style={{
              padding: '4px 8px',
              background: activeFilter === 'has-data' ? theme.colors.accent : theme.colors.glass,
              backdropFilter: activeFilter !== 'has-data' ? 'blur(10px)' : 'none',
              WebkitBackdropFilter: activeFilter !== 'has-data' ? 'blur(10px)' : 'none',
              color: activeFilter === 'has-data' ? '#0f0f23' : theme.colors.foreground,
              border: activeFilter !== 'has-data' ? `1px solid ${theme.colors.glassBorder}` : 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            Has Data ({tables.filter(t => t.rowCount > 0).length})
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'synced' ? null : 'synced')}
            style={{
              padding: '4px 8px',
              background: activeFilter === 'synced' ? theme.colors.accent : theme.colors.glass,
              backdropFilter: activeFilter !== 'synced' ? 'blur(10px)' : 'none',
              WebkitBackdropFilter: activeFilter !== 'synced' ? 'blur(10px)' : 'none',
              color: activeFilter === 'synced' ? '#0f0f23' : theme.colors.foreground,
              border: activeFilter !== 'synced' ? `1px solid ${theme.colors.glassBorder}` : 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            Synced ({tables.filter(t => t.syncStatus === 'Synced').length})
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'outdated' ? null : 'outdated')}
            style={{
              padding: '4px 8px',
              background: activeFilter === 'outdated' ? theme.colors.accent : theme.colors.glass,
              backdropFilter: activeFilter !== 'outdated' ? 'blur(10px)' : 'none',
              WebkitBackdropFilter: activeFilter !== 'outdated' ? 'blur(10px)' : 'none',
              color: activeFilter === 'outdated' ? '#0f0f23' : theme.colors.foreground,
              border: activeFilter !== 'outdated' ? `1px solid ${theme.colors.glassBorder}` : 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            Outdated ({tables.filter(t => t.syncStatus === 'Outdated').length})
          </button>
          <input
            type="text"
            placeholder="Search..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '4px 8px',
              border: `1px solid ${theme.colors.glassBorder}`,
              borderRadius: '6px',
              fontSize: '10px',
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: theme.colors.foreground
            }}
          />
        </div>

        {/* Top 5 Tables */}
        {!loading && !error && top5Tables.length > 0 && (
          <div style={{
            background: theme.colors.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            border: `1px solid ${theme.colors.glassBorder}`,
            marginBottom: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '6px 8px',
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderBottom: `1px solid ${theme.colors.glassBorder}`,
              fontSize: '10px',
              fontWeight: '600',
              color: theme.colors.textSecondary
            }}>
              Top 5 Tables
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                tableLayout: 'fixed',
                color: theme.colors.foreground
              }}>
                {renderTableHeader()}
                <tbody>
                  {renderTableRows(top5Tables)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rest of Tables */}
        {!loading && !error && restTables.length > 0 && (
          <div style={{
            background: theme.colors.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            border: `1px solid ${theme.colors.glassBorder}`,
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '6px 8px',
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderBottom: `1px solid ${theme.colors.glassBorder}`,
              fontSize: '10px',
              fontWeight: '600',
              color: theme.colors.textSecondary
            }}>
              All Tables ({restTables.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                tableLayout: 'fixed',
                color: theme.colors.foreground
              }}>
                {renderTableHeader()}
                <tbody>
                  {renderTableRows(restTables)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading/Error States */}
        {loading && (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            background: theme.colors.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: `1px solid ${theme.colors.glassBorder}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}>
            <LoadingSpinner size="small" message="Loading table information..." />
          </div>
        )}

        {error && (
          <div style={{ 
            padding: '12px', 
            background: theme.colors.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: `1px solid ${theme.colors.glassBorder}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}>
            <ErrorMessage error={error} title="Error loading tables" onRetry={refetch} />
          </div>
        )}

        {!loading && !error && filteredTables.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            background: theme.colors.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: `1px solid ${theme.colors.glassBorder}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            color: theme.colors.textMuted,
            fontSize: '11px'
          }}>
            {filterText || activeFilter ? 'No tables match your filter' : 'No tables found'}
          </div>
        )}
      </div>

      {/* Log Panel */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '200px',
        background: theme.colors.glass,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${theme.colors.glassBorder}`,
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000
      }}>
        <div style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.colors.glassBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.foreground }}>
            📋 Activity Log
          </div>
          <button
            onClick={() => setLogs([])}
            style={{
              padding: '2px 6px',
              fontSize: '9px',
              background: 'transparent',
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.glassBorder}`,
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          fontFamily: 'monospace',
          fontSize: '9px'
        }}
        ref={logEndRef}
        >
          {logs.length === 0 ? (
            <div style={{ color: theme.colors.textMuted, textAlign: 'center', padding: '20px' }}>
              No activity yet
            </div>
          ) : (
            logs.map(log => (
              <div
                key={log.id}
                style={{
                  padding: '4px 8px',
                  marginBottom: '2px',
                  borderRadius: '4px',
                  background: log.type === 'error' 
                    ? 'rgba(244, 67, 54, 0.1)' 
                    : log.type === 'success' 
                      ? 'rgba(76, 175, 80, 0.1)' 
                      : 'rgba(255, 255, 255, 0.02)',
                  color: log.type === 'error' 
                    ? '#f44336' 
                    : log.type === 'success' 
                      ? '#4caf50' 
                      : theme.colors.textSecondary,
                  borderLeft: `3px solid ${
                    log.type === 'error' 
                      ? '#f44336' 
                      : log.type === 'success' 
                        ? '#4caf50' 
                        : theme.colors.accent
                  }`
                }}
              >
                <span style={{ color: theme.colors.textMuted }}>
                  {log.timestamp.toLocaleTimeString()}
                </span>
                {' '}
                <span style={{ fontWeight: '600' }}>[{log.tableName}]</span>
                {' '}
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewData && (
        <div
          onClick={() => setReviewData(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
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
              border: `1px solid ${theme.colors.glassBorder}`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              width: '100%'
            }}
          >
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${theme.colors.glassBorder}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '14px', color: theme.colors.foreground }}>
                👁️ Review: {reviewData.tableName} (Top 100 rows)
              </h2>
              <button
                onClick={() => setReviewData(null)}
                style={{
                  padding: '4px 8px',
                  background: 'transparent',
                  color: theme.colors.textSecondary,
                  border: `1px solid ${theme.colors.glassBorder}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px'
            }}>
              {reviewData.data.length === 0 ? (
                <div style={{ color: theme.colors.textMuted, textAlign: 'center', padding: '40px' }}>
                  No data found
                </div>
              ) : (
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '10px',
                  fontFamily: 'monospace'
                }}>
                  <thead>
                    <tr style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderBottom: `2px solid ${theme.colors.glassBorder}`
                    }}>
                      {Object.keys(reviewData.data[0]).map(col => (
                        <th
                          key={col}
                          style={{
                            padding: '6px 8px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: theme.colors.foreground,
                            fontSize: '9px',
                            position: 'sticky',
                            top: 0,
                            background: 'rgba(15, 15, 35, 0.95)'
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviewData.data.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: `1px solid ${theme.colors.glassBorder}`,
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        {Object.values(row).map((val, colIdx) => (
                          <td
                            key={colIdx}
                            style={{
                              padding: '6px 8px',
                              color: theme.colors.textSecondary,
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={String(val)}
                          >
                            {val === null || val === undefined ? (
                              <span style={{ color: theme.colors.textMuted }}>NULL</span>
                            ) : typeof val === 'object' ? (
                              JSON.stringify(val)
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '200px' }} /> {/* Spacer for fixed log panel */}
    </div>
  );
};

export default DataManagementPage;

