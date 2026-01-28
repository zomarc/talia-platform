/**
 * Data Management Page
 * Displays database table information including sources, sync status, and data ranges
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDatabaseTables } from '../../../hooks/useDatabaseTables';
import { LoadingSpinner, ErrorMessage } from '../../../components/shared';
import { getThemeForMode } from '../../../themes/modeThemes';
// Supabase import removed - all database operations now route through GraphQL backend
import { getTableSource } from '../../../config/tableSources';
import { SERVER_SERVICES, getAllServiceIds } from '../../../config/serverServices';
import { getSyncFreshness, getSyncFreshnessColor } from '../../../utils/syncFreshness';
import SummaryBar from './SummaryBar.jsx';
import BackupStatusBar from './BackupStatusBar.jsx';
import FiltersBar from './FiltersBar.jsx';
import StatusModal from './StatusModal.jsx';
import ReviewModal from './ReviewModal.jsx';
import TablesSection from './TablesSection.jsx';
import LogsPanel from './LogsPanel.jsx';
import ServerStatusPanel from './ServerStatusPanel.jsx';
import TableRow from './TableRow.jsx';
import TableHeader from './TableHeader.jsx';
import { createTableActions } from './tableActions.js';
import { getRootStyle } from './styles.js';
import '../../../themes/dataMode.css';
import './dataManagement.css';

const DataManagementPage = () => {
  const { tables, loading, error, refetch, updateTable } = useDatabaseTables();
  const [sortColumn, setSortColumn] = useState('rowCount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState(null); // 'no-data', 'synced', 'outdated', etc.
  const [syncingTables, setSyncingTables] = useState(new Set());
  const [syncProgress, setSyncProgress] = useState({}); // { tableName: { current: 0, total: 0, percentage: 0 } }
  const [logs, setLogs] = useState([]);
  const [serverLogs, setServerLogs] = useState([]);
  const [allActivityLogs, setAllActivityLogs] = useState([]); // Unified activity log
  const [selectedTable, setSelectedTable] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [statusTable, setStatusTable] = useState(null);
  const [showBottomPanels, setShowBottomPanels] = useState(true);
  const [backupStatus, setBackupStatus] = useState({ 
    lastBackup: null, 
    recentBackups: [], 
    status: 'idle',
    size: null,
    sizeBytes: null,
    error: null,
    loading: false 
  });
  const logEndRef = useRef(null);
  const serverLogEndRef = useRef(null);
  const allActivityLogEndRef = useRef(null);
  const logIdCounterRef = useRef(0); // Counter for unique log IDs

  // Helper function to add client log (also adds to unified activity log)
  const addClientLog = (logEntry) => {
    const logWithSource = { ...logEntry, source: 'client' };
    setLogs(prev => [...prev, logWithSource]);
    setAllActivityLogs(prev => [...prev, logWithSource]);
  };

  // Helper function to add server log (also adds to unified activity log)
  const addServerLog = (logEntry) => {
    const logWithSource = { ...logEntry, source: 'server' };
    setServerLogs(prev => [...prev, logWithSource]);
    setAllActivityLogs(prev => [...prev, logWithSource]);
  };
  
  // Server status state - initialized dynamically from config
  const [serverStatus, setServerStatus] = useState(() => {
    const initialState = {};
    SERVER_SERVICES.forEach(service => {
      initialState[service.id] = {
        online: false,
        lastChecked: null,
        error: null,
        ...(service.id === 'graphql' && { lastStarted: null }),
        ...(service.id === 'synapse' && { server: null, database: null })
      };
    });
    return initialState;
  });
  
  // Individual service expanded states - initialized dynamically from config
  const [expandedServices, setExpandedServices] = useState(() => {
    const initialState = {};
    SERVER_SERVICES.forEach(service => {
      initialState[service.id] = false;
    });
    return initialState;
  });
  
  // Refresh status function
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-scroll server logs to bottom
  useEffect(() => {
    if (serverLogEndRef.current) {
      serverLogEndRef.current.scrollTop = serverLogEndRef.current.scrollHeight;
    }
  }, [serverLogs]);

  // Auto-scroll all activity logs to bottom
  useEffect(() => {
    if (allActivityLogEndRef.current) {
      allActivityLogEndRef.current.scrollTop = allActivityLogEndRef.current.scrollHeight;
    }
  }, [allActivityLogs]);

  // Combine client and server logs into unified activity log
  useEffect(() => {
    const combined = [
      ...logs.map(log => ({ ...log, source: 'client' })),
      ...serverLogs.map(log => ({ ...log, source: 'server' }))
    ].sort((a, b) => a.timestamp - b.timestamp);
    setAllActivityLogs(combined);
  }, [logs, serverLogs]);

  // Server status check function (extracted for manual refresh) - Generic implementation
  const checkServerStatus = async () => {
    setIsRefreshingStatus(true);
    
    // Check all services in parallel
    const statusChecks = SERVER_SERVICES.map(async (service) => {
      try {
        let isOnline = false;
        let statusData = { online: false, lastChecked: new Date() };
        
        if (service.check.method === 'graphql') {
          // GraphQL-based check
          const endpoint = typeof service.check.endpoint === 'function' 
            ? service.check.endpoint() 
            : service.check.endpoint;
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: service.check.query })
          });
          
          if (!response.ok) {
            // HTTP error - server responded but with error status
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
          }
          
          const result = await response.json();
          
          // Check for GraphQL errors
          if (result.errors && result.errors.length > 0) {
            throw new Error(`GraphQL error: ${result.errors[0].message || 'Unknown GraphQL error'}`);
          }
          
          if (service.id === 'graphql') {
            // Simple GraphQL server check - if we got here, server is online
            isOnline = true;
            statusData = { online: true, lastChecked: new Date() };
          } else if (result.data) {
            // Service-specific GraphQL query - check for known query names
            let serviceStatus = null;
            if (service.id === 'synapse' && result.data.synapseConnectionStatus) {
              serviceStatus = result.data.synapseConnectionStatus;
            } else if (result.data[`${service.id}ConnectionStatus`]) {
              serviceStatus = result.data[`${service.id}ConnectionStatus`];
            }
            
            if (serviceStatus) {
              isOnline = serviceStatus.online;
              statusData = {
                online: serviceStatus.online,
                lastChecked: serviceStatus.lastChecked ? new Date(serviceStatus.lastChecked) : new Date(),
                error: serviceStatus.error || null,
                ...(serviceStatus.server && { server: serviceStatus.server }),
                ...(serviceStatus.database && { database: serviceStatus.database })
              };
            } else {
              // No service status found in response
              throw new Error(`No status data found in GraphQL response for ${service.id}`);
            }
          } else {
            // No data in response
            throw new Error(`No data in GraphQL response for ${service.id}`);
          }
        } else {
          // All services should use GraphQL - this shouldn't happen
          throw new Error(`Unknown check method for service ${service.id}`);
        }
        
        // Update status for this service
        setServerStatus(prev => {
          const prevStatus = prev[service.id] || {};
          const wasOnline = prevStatus.online;
          
          // Handle lastStarted for graphql service
          let updateData = {
            ...statusData,
            ...(service.id === 'graphql' && {
              lastStarted: (!wasOnline && isOnline) || (prevStatus.lastStarted === null && isOnline)
                ? new Date()
                : prevStatus.lastStarted
            })
          };
          
          return {
            ...prev,
            [service.id]: updateData
          };
        });
      } catch (error) {
        // Error checking this service - log for debugging
        console.error(`Failed to check ${service.id} status:`, error);
        
        setServerStatus(prev => {
          const prevStatus = prev[service.id] || {};
          return {
            ...prev,
            [service.id]: {
              ...prevStatus,
              online: false,
              error: error.message || 'Failed to check connection status',
              lastChecked: new Date() // Always update lastChecked even on error
            }
          };
        });
      }
    });
    
    await Promise.all(statusChecks);
    setIsRefreshingStatus(false);
  };

  // Server status polling - reduced frequency to avoid excessive Azure connection tests
  useEffect(() => {
    // Initial check
    checkServerStatus();
    
    // Poll every 30 seconds (reduced from 5 seconds to avoid excessive Azure connection tests)
    // Azure Synapse connection tests are expensive, so we check less frequently
    const interval = setInterval(checkServerStatus, 30000);
    
    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run on mount/unmount

  // Fetch backup status from GraphQL
  const fetchBackupStatus = async () => {
    try {
      setBackupStatus(prev => ({ ...prev, loading: true }));
      
      const query = `
        query {
          backupMetadata {
            lastBackupAt
            backupStatus
            backupFilePath
            backupSizeBytes
            backupSizeHuman
            error
          }
        }
      `;
      
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      const backup = result.data?.backupMetadata;
      
      setBackupStatus({
        lastBackup: backup?.lastBackupAt ? new Date(backup.lastBackupAt) : null,
        recentBackups: backup?.backupFilePath ? [{
          time: backup.lastBackupAt,
          filename: backup.backupFilePath.split('/').pop(),
          size: backup.backupSizeHuman
        }] : [],
        status: backup?.backupStatus || 'idle',
        size: backup?.backupSizeHuman,
        sizeBytes: backup?.backupSizeBytes,
        error: backup?.error,
        loading: false
      });
    } catch (error) {
      console.warn('Could not fetch backup status:', error);
      setBackupStatus(prev => ({ 
        ...prev, 
        loading: false,
        error: error.message 
      }));
    }
  };

  // Trigger backup - shows instructions
  const triggerBackup = () => {
    addClientLog({
      id: `${Date.now()}-${++logIdCounterRef.current}`,
      timestamp: new Date(),
      type: 'info',
      message: '💾 To create a backup, run: cd talia-server && ./scripts/backup-db.sh',
      tableName: 'System'
    });
    
    // Show alert with instructions
    const instructions = `To create a database backup, run this command in your terminal:

cd talia-server && ./scripts/backup-db.sh

Or use npm:
cd talia-server && npm run db-backup

The backup will be saved to: talia-server/backups/`;
    
    alert(instructions);
    
    // Update last backup time in localStorage (user can manually update this after running backup)
    // In a real implementation, this would be updated by the backup script or API
    const now = new Date();
    localStorage.setItem('lastBackupTime', now.toISOString());
    const recentBackups = JSON.parse(localStorage.getItem('recentBackups') || '[]');
    recentBackups.unshift({ time: now.toISOString(), filename: `backup-${now.toISOString().slice(0, 10)}.sql.gz` });
    if (recentBackups.length > 5) recentBackups.pop();
    localStorage.setItem('recentBackups', JSON.stringify(recentBackups));
    
    fetchBackupStatus();
  };

  // Fetch backup status on mount
  useEffect(() => {
    fetchBackupStatus();
  }, []);

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

  // Format date and time for display
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
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

    // Handle latest snapshot date
    if (sortColumn === 'latestSnapshot') {
      aVal = a.latestSnapshotDate ? new Date(a.latestSnapshotDate).getTime() : 0;
      bVal = b.latestSnapshotDate ? new Date(b.latestSnapshotDate).getTime() : 0;
    }

    // Handle records processed
    if (sortColumn === 'recordsProcessed') {
      aVal = a.recordsProcessed !== null && a.recordsProcessed !== undefined ? a.recordsProcessed : -1;
      bVal = b.recordsProcessed !== null && b.recordsProcessed !== undefined ? b.recordsProcessed : -1;
    }

    // Handle changes detected
    if (sortColumn === 'changesDetected') {
      aVal = a.changesDetected !== null && a.changesDetected !== undefined ? a.changesDetected : -1;
      bVal = b.changesDetected !== null && b.changesDetected !== undefined ? b.changesDetected : -1;
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
    tableName: '11%',
    source: '14%',
    loadMethod: '6%', // New column for batch/direct
    rowCount: '5%',
    dateRange: '11%',
    lastSync: '7%',
    latestSnapshot: '7%',
    recordsProcessed: '5%',
    changesDetected: '5%',
    syncDuration: '6%',
    status: '9%',
    actions: '10%'
  };

  // Get GraphQL endpoint (same logic as Apollo client)
  // Use relative path - Vite proxy handles routing to localhost:4000
  const getGraphQLEndpoint = () => {
    return '/api/graphql';
  };

  // Handle sync button click
  const handleSync = async (tableName, forceFullSync = false) => {
    // Check if table has a sync configuration
    const table = tables.find(t => t.tableName === tableName);
    if (!table || table.source === 'N/A' || table.type === 'unknown' || table.type === 'system' || table.type === 'application') {
      const errorMsg = `Table "${tableName}" does not have a sync configuration. Source: ${table?.source || 'N/A'}, Type: ${table?.type || 'unknown'}`;
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'error',
        message: `❌ ${errorMsg}`,
        tableName
      });
      return;
    }

    // Check service connection status before starting sync (if service requires it)
    const synapseService = SERVER_SERVICES.find(s => s.id === 'synapse');
    if (synapseService && !serverStatus.synapse?.online) {
      const warningMsg = `⚠️ ${synapseService.name} is offline. ${serverStatus.synapse?.error || 'Please check VPN connection.'} Sync will likely fail.`;
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'warning',
        message: warningMsg,
        tableName
      });
      // Continue anyway - let the server handle the error with a clear message
    }

    setSyncingTables(prev => new Set(prev).add(tableName));
    
    // Initialize progress bar immediately
    setSyncProgress(prev => ({
      ...prev,
      [tableName]: { current: 0, total: 100, percentage: 0, type: 'starting', message: 'Starting sync...' }
    }));
    
    const syncStartTime = Date.now();
    const syncType = forceFullSync ? 'full refresh' : 'incremental sync';
    const endpoint = getGraphQLEndpoint();
    
    // Declare eventSource outside try block so it's accessible in finally
    let eventSource = null;
    
    // Add initial log entry
    addClientLog({
      id: `${Date.now()}-${++logIdCounterRef.current}`,
      timestamp: new Date(),
      type: 'info',
      message: `🔄 Starting ${syncType} for "${tableName}"...`,
      tableName
    });

    // Add progress log
    addClientLog({
      id: `${Date.now()}-${++logIdCounterRef.current}`,
      timestamp: new Date(),
      type: 'info',
      message: `📡 Connecting to GraphQL endpoint: ${endpoint}`,
      tableName
    });

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
            detailedLogs
          }
        }
      `;

      const requestBody = {
        query: mutation,
        variables: {
          tableName: tableName,
          // dataset is optional - omit it to use default
          forceFullSync: forceFullSync || false
        }
      };

      // Add progress log
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'info',
        message: `📤 Sending sync request (${forceFullSync ? 'full' : 'incremental'})...`,
        tableName
      });

      // Start sync mutation (non-blocking)
      const syncPromise = fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      // Connect to SSE stream for real-time updates
      // Use relative path - Vite proxy handles routing to localhost:4001
      // This works both locally and when exposed via ngrok
      const basePath = import.meta.env.VITE_BASE_PATH || '';
      const sseUrl = `${basePath}/api/sync/stream/${tableName}`;
      
      try {
        eventSource = new EventSource(sseUrl);
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'connected') {
              addClientLog({
                id: `${Date.now()}-${++logIdCounterRef.current}`,
                timestamp: new Date(),
                type: 'info',
                message: `📡 Connected to real-time sync stream`,
                tableName
              });
              return;
            }
            
            if (data.type === 'log') {
              const logEntry = {
                id: `${Date.now()}-${++logIdCounterRef.current}`,
                timestamp: new Date(data.timestamp),
                message: data.data.message,
                tableName,
                source: 'server',
                type: data.data.level === 'error' ? 'error' : 
                      data.data.level === 'warn' ? 'warning' : 'info'
              };
              addServerLog(logEntry);
            } else if (data.type === 'progress') {
              const progress = data.data;
              setSyncProgress(prev => ({
                ...prev,
                [tableName]: {
                  current: progress.current || 0,
                  total: progress.total || 100,
                  percentage: progress.percentage || 0,
                  type: progress.type || 'records',
                  batchNumber: progress.batchNumber,
                  totalBatches: progress.totalBatches,
                  message: progress.message || `Processing... ${progress.percentage}%`
                }
              }));
            } else if (data.type === 'complete') {
              const complete = data.data;
              setSyncProgress(prev => ({
                ...prev,
                [tableName]: {
                  current: complete.recordsProcessed || 100,
                  total: complete.recordsProcessed || 100,
                  percentage: 100,
                  type: 'complete',
                  message: complete.message || 'Sync completed'
                }
              }));
              
              addServerLog({
                id: `${Date.now()}-${++logIdCounterRef.current}`,
                timestamp: new Date(data.timestamp),
                message: `✅ ${complete.message || 'Sync completed'}`,
                tableName,
                source: 'server',
                type: 'info'
              });
              
              // Close SSE connection
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              
              // Clean up UI state
              setSyncingTables(prev => {
                const newSet = new Set(prev);
                newSet.delete(tableName);
                return newSet;
              });
              
              // Update table data after a short delay to allow metadata to be committed
              setTimeout(async () => {
                try {
                  await updateTable(tableName);
                } catch (err) {
                  console.warn('Failed to update table data:', err);
                  // Fallback to full refresh if individual update fails
                  refetch();
                }
              }, 2000);
              
              // Clear progress after a delay
              setTimeout(() => {
                setSyncProgress(prev => {
                  const newProgress = { ...prev };
                  delete newProgress[tableName];
                  return newProgress;
                });
              }, 5000);
            } else if (data.type === 'error') {
              const error = data.data;
              setSyncProgress(prev => ({
                ...prev,
                [tableName]: {
                  current: 0,
                  total: 100,
                  percentage: 0,
                  type: 'error',
                  message: error.message || 'Sync failed'
                }
              }));
              
              addServerLog({
                id: `${Date.now()}-${++logIdCounterRef.current}`,
                timestamp: new Date(data.timestamp),
                message: `❌ ${error.message || 'Sync failed'}`,
                tableName,
                source: 'server',
                type: 'error'
              });
              
              // Close SSE connection
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              
              // Clean up UI state
              setSyncingTables(prev => {
                const newSet = new Set(prev);
                newSet.delete(tableName);
                return newSet;
              });
              
              // Clear progress after a delay
              setTimeout(() => {
                setSyncProgress(prev => {
                  const newProgress = { ...prev };
                  delete newProgress[tableName];
                  return newProgress;
                });
              }, 5000);
            }
          } catch (parseError) {
            console.warn('Error parsing SSE event:', parseError, event.data);
          }
        };
        
        eventSource.onerror = (error) => {
          console.warn('SSE connection error:', error);
          // Don't close on error - EventSource will auto-reconnect
          // But log it for debugging
          addClientLog({
            id: `${Date.now()}-${++logIdCounterRef.current}`,
            timestamp: new Date(),
            type: 'warning',
            message: `⚠️ SSE connection issue (will retry)`,
            tableName
          });
        };
      } catch (sseError) {
        console.warn('Failed to create SSE connection:', sseError);
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'warning',
          message: `⚠️ Could not connect to real-time stream, falling back to polling`,
          tableName
        });
      }

      // Helper function to parse progress from log messages (kept for fallback)
      const parseProgressFromLog = (log, tableName) => {
        // Check for total records count
        const totalMatch = log.match(/Total records to process:\s+([\d,]+)/);
        if (totalMatch) {
          const total = parseInt(totalMatch[1].replace(/,/g, ''));
          setSyncProgress(prev => ({
            ...prev,
            [tableName]: { 
              current: 0, 
              total, 
              percentage: 0,
              type: 'records',
              message: `Found ${total.toLocaleString()} records to process`
            }
          }));
        }
        
        // Check for processed records
        const progressMatch = log.match(/Processed\s+([\d,]+)\/([\d,]+)\s+records/);
        if (progressMatch) {
          const current = parseInt(progressMatch[1].replace(/,/g, ''));
          const total = parseInt(progressMatch[2].replace(/,/g, ''));
          const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
          setSyncProgress(prev => ({
            ...prev,
            [tableName]: { current, total, percentage, type: 'records' }
          }));
        }
        
        // Check for batch processing
        const batchMatch = log.match(/Processing batch\s+(\d+)\/(\d+)/);
        if (batchMatch) {
          const current = parseInt(batchMatch[1]);
          const total = parseInt(batchMatch[2]);
          const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
          setSyncProgress(prev => ({
            ...prev,
            [tableName]: { current, total, percentage, type: 'batch' }
          }));
        }
        
        // Check for inserted records
        const insertMatch = log.match(/Inserted\s+([\d,]+)\/([\d,]+)\s+records/);
        if (insertMatch) {
          const current = parseInt(insertMatch[1].replace(/,/g, ''));
          const total = parseInt(insertMatch[2].replace(/,/g, ''));
          const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
          setSyncProgress(prev => ({
            ...prev,
            [tableName]: { current, total, percentage, type: 'insert' }
          }));
        }
        
        // Check for state updates
        const stateMatch = log.match(/Updated\s+([\d,]+)\/([\d,]+)\s+state records/);
        if (stateMatch) {
          const current = parseInt(stateMatch[1].replace(/,/g, ''));
          const total = parseInt(stateMatch[2].replace(/,/g, ''));
          const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
          setSyncProgress(prev => ({
            ...prev,
            [tableName]: { current, total, percentage, type: 'state' }
          }));
        }
      };

      let response;
      try {
        response = await syncPromise;
      } catch (fetchError) {
        // Network error - provide detailed information
        const networkErrorMsg = `Network error: Failed to connect to GraphQL server at ${endpoint}. ` +
          `This usually means the server is not running or not accessible. ` +
          `Error details: ${fetchError.message || 'Connection refused'}`;
        
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'error',
          message: `❌ Connection Error: ${networkErrorMsg}. Please ensure the GraphQL server is running on port 4000.`,
          tableName
        });
        return;
      }

      // Add progress log
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'info',
        message: `📥 Received response (status: ${response.status} ${response.statusText})...`,
        tableName
      });

      // Check if response is OK
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        const errorMsg = `HTTP ${response.status}: ${statusText}. The server returned an error response.`;
        
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'error',
          message: `❌ Server Error: ${errorMsg}. Please check the GraphQL server logs for more details.`,
          tableName
        });
        // Close SSE connection on error
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        return;
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        const parseErrorMsg = `Failed to parse server response. The server may have returned invalid JSON. ` +
          `Error: ${parseError.message || 'Parse error'}`;
        
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'error',
          message: `❌ Parse Error: ${parseErrorMsg}`,
          tableName
        });
        return;
      }

      // Add progress log
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'info',
        message: `🔍 Processing response...`,
        tableName
      });

      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        const graphqlErrors = result.errors.map(e => e.message).join('; ');
        const errorMsg = `GraphQL Error: ${graphqlErrors}`;
        
        // Log each error separately for better visibility
        result.errors.forEach((error, idx) => {
          addClientLog({
            id: `${Date.now()}-${++logIdCounterRef.current}`,
            timestamp: new Date(),
            type: 'error',
            message: `❌ GraphQL Error ${idx + 1}: ${error.message}${error.path ? ` (path: ${error.path.join('.')})` : ''}`,
            tableName
          });
        });
        // Close SSE connection on error
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        return;
      }

      // Check if we have data
      if (!result.data) {
        const errorMsg = 'No data returned from server. The response was empty.';
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'error',
          message: `❌ Empty Response: ${errorMsg}`,
          tableName
        });
        return;
      }

      // Close SSE connection - sync mutation has completed
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      
      // Check sync result
      // Note: Logs are now handled via SSE in real-time, so detailedLogs from GraphQL response
      // are not needed. The SSE stream provides all logs as they happen.
      if (result.data?.syncTable?.success) {
        const syncResult = result.data.syncTable;
        const totalDuration = Date.now() - syncStartTime;
        
        // Logs are handled via SSE - no need to process detailedLogs here
        // The sync completed successfully, which is already logged via SSE completion event
        
        // Add detailed success log
        const successDetails = [];
        if (syncResult.recordsProcessed !== null && syncResult.recordsProcessed !== undefined) {
          successDetails.push(`${syncResult.recordsProcessed.toLocaleString()} records processed`);
        }
        if (syncResult.duration !== null && syncResult.duration !== undefined) {
          successDetails.push(`server duration: ${formatDuration(syncResult.duration)}`);
        }
        successDetails.push(`total time: ${formatDuration(totalDuration)}`);
        
        const successMessage = `✅ ${syncType.charAt(0).toUpperCase() + syncType.slice(1)} completed successfully! ${successDetails.join(', ')}.`;
        
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'success',
          message: successMessage,
          tableName
        });
        
        // Update the specific table row without full page refresh
        // Wait a bit to ensure database has updated, then update just this table's data
        setTimeout(async () => {
          try {
            await updateTable(tableName);
          } catch (err) {
            console.warn('Failed to update table data:', err);
            // Fallback to full refresh if individual update fails
            refetch();
          }
        }, 2000); // Wait 2 seconds for metadata to be committed
      } else {
        // Sync failed on server side
        const syncResult = result.data?.syncTable;
        const errorMsg = syncResult?.error || syncResult?.message || 'Unknown error from server';
        
        // Trust the server's error classification - don't re-enhance
        // Server already handles connection error enhancement appropriately
        // Only add context if it's clearly a connection error from server
        const isConnectionError = errorMsg.toLowerCase().includes('connection closed') ||
                                  errorMsg.toLowerCase().includes('connection timeout') ||
                                  errorMsg.toLowerCase().includes('connection refused') ||
                                  errorMsg.toLowerCase().includes('cannot resolve server');
        
        const detailedError = isConnectionError 
          ? `🔌 ${errorMsg}` 
          : `Sync failed: ${errorMsg}`;
        
        // Capture server detailed logs even on failure and add to unified activity log
        if (syncResult?.detailedLogs && syncResult.detailedLogs.length > 0) {
          const newServerLogs = syncResult.detailedLogs.map(log => ({
            id: `${Date.now()}-${++logIdCounterRef.current}-${Math.random()}`,
            timestamp: new Date(),
            message: log,
            tableName,
            source: 'server'
          }));
          setServerLogs(prev => [...prev, ...newServerLogs]);
          // Also add to unified activity log immediately
          setAllActivityLogs(prev => [...prev, ...newServerLogs]);
        }
        
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'error',
          message: `❌ ${detailedError}${isConnectionError ? ' Check the Server Status panel for connection details.' : ' Check the activity log and server logs for more details.'}`,
          tableName
        });
      }
    } catch (err) {
      // Unexpected error
      const errorName = err.name || 'Error';
      const errorMessage = err.message || 'Unknown error occurred';
      const errorStack = err.stack ? `\n\nStack trace:\n${err.stack}` : '';
      
      const detailedError = `Unexpected error during sync: [${errorName}] ${errorMessage}${errorStack}`;
      
      console.error('Sync error:', err);
      
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'error',
        message: `❌ Unexpected Error [${errorName}]: ${errorMessage}. Check the browser console and activity log for details.`,
        tableName
      });
      } finally {
        // Close SSE connection if still open
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        setSyncingTables(prev => {
          const newSet = new Set(prev);
          newSet.delete(tableName);
          return newSet;
        });
        // Clear progress when sync completes
        setSyncProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[tableName];
          return newProgress;
        });
      }
  };

  // Handle GraphQL server restart
  const handleRestartGraphQL = async () => {
    const endpoint = getGraphQLEndpoint();
    try {
      const mutation = `
        mutation {
          restartServer
        }
      `;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation })
      });

      if (!response.ok) {
        const logId = `${Date.now()}-${++logIdCounterRef.current}`;
        setLogs(prev => [...prev, {
          id: logId,
          timestamp: new Date(),
          type: 'error',
          message: `❌ Failed to restart server: HTTP ${response.status}`,
          tableName: 'System'
        }]);
        return;
      }

      const result = await response.json();
      if (result.errors) {
        const logId = `${Date.now()}-${++logIdCounterRef.current}`;
        setLogs(prev => [...prev, {
          id: logId,
          timestamp: new Date(),
          type: 'error',
          message: `❌ Server restart error: ${result.errors[0].message}`,
          tableName: 'System'
        }]);
        return;
      }

      const logId = `${Date.now()}-${++logIdCounterRef.current}`;
      setLogs(prev => [...prev, {
        id: logId,
        timestamp: new Date(),
        type: 'info',
        message: '✅ Server restart request sent. The server will restart shortly.',
        tableName: 'System'
      }]);
    } catch (error) {
      const logId = `${Date.now()}-${++logIdCounterRef.current}`;
      setLogs(prev => [...prev, {
        id: logId,
        timestamp: new Date(),
        type: 'error',
        message: `❌ Failed to restart server: ${error.message}`,
        tableName: 'System'
      }]);
    }
  };

  // Render table header
  const renderTableHeader = () => (
    <TableHeader
      theme={theme}
      columnWidths={columnWidths}
      handleSort={handleSort}
      SortIcon={SortIcon}
    />
  );

  const tableActions = createTableActions({
    setReviewLoading,
    setReviewData,
    addClientLog,
    handleSync,
    logIdCounterRef
  });

  const renderTableRows = (tableList) => (
    tableList.map((table, idx) => (
      <TableRow
        key={table.tableName}
        table={table}
        index={idx}
        theme={theme}
        columnWidths={columnWidths}
        selectedTable={selectedTable}
        setSelectedTable={setSelectedTable}
        syncingTables={syncingTables}
        syncProgress={syncProgress}
        getStatusColor={getStatusColor}
        getSyncFreshness={getSyncFreshness}
        formatDateRange={formatDateRange}
        formatDateTime={formatDateTime}
        formatDate={formatDate}
        formatDuration={formatDuration}
        setStatusTable={setStatusTable}
        reviewLoading={reviewLoading}
        tableActions={tableActions}
      />
    ))
  );

  // Add CSS animations for pulsing and shimmer effects
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.85;
        }
      }
      @keyframes shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }
    `;
    styleTag.setAttribute('data-sync-animations', 'true');
    if (!document.head.querySelector('style[data-sync-animations]')) {
      document.head.appendChild(styleTag);
    }
    return () => {
      const existing = document.head.querySelector('style[data-sync-animations]');
      if (existing) {
        document.head.removeChild(existing);
      }
    };
  }, []);

  // Set CSS variables for theme colors
  const rootStyle = getRootStyle(theme);
  const clientLogStyle = (log) => {
    if (log.type === 'error') return { background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336' };
    if (log.type === 'success') return { background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', borderColor: '#4caf50' };
    return { background: 'rgba(255, 255, 255, 0.02)', color: theme.colors.textSecondary, borderColor: theme.colors.accent };
  };
  const serverLogStyle = (log) => {
    if (log.message.includes('[ERROR]') || log.message.includes('❌')) {
      return { background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336' };
    }
    if (log.message.includes('✅') || log.message.includes('Successfully')) {
      return { background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', borderColor: '#4caf50' };
    }
    return { background: 'rgba(255, 255, 255, 0.02)', color: theme.colors.textSecondary, borderColor: theme.colors.accent };
  };

  return (
    <div style={rootStyle}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowBottomPanels(prev => !prev)}
              style={{
                padding: '4px 8px',
                background: showBottomPanels ? theme.colors.accent : 'transparent',
                color: showBottomPanels ? '#0f0f23' : theme.colors.textSecondary,
                border: showBottomPanels ? 'none' : `1px solid ${theme.colors.glassBorder}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              title="Toggle activity panels"
            >
              {showBottomPanels ? 'Hide Panels' : 'Show Panels'}
            </button>
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
        </div>

        <SummaryBar theme={theme} tables={tables} />

        <BackupStatusBar
          theme={theme}
          backupStatus={backupStatus}
          formatDateTime={formatDateTime}
          triggerBackup={triggerBackup}
          fetchBackupStatus={fetchBackupStatus}
        />

        <FiltersBar
          theme={theme}
          tables={tables}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          filterText={filterText}
          setFilterText={setFilterText}
        />

        <TablesSection
          theme={theme}
          loading={loading}
          error={error}
          top5Tables={top5Tables}
          restTables={restTables}
          renderTableHeader={renderTableHeader}
          renderTableRows={renderTableRows}
        />

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

      {/* Bottom Panel - Split into Client Activity Log, Server Logs, All Activity, and Server Status */}
      {showBottomPanels && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '200px',
          display: 'flex',
          gap: '8px',
          padding: '0 8px 8px 8px',
          zIndex: 1000
        }}>
          <LogsPanel
            theme={theme}
            title="📋 Client Activity"
            logs={logs}
            emptyMessage="No activity yet"
            onClear={() => setLogs([])}
            logRef={logEndRef}
            getLogStyle={clientLogStyle}
          />
          <LogsPanel
            theme={theme}
            title="🔧 Server Logs"
            logs={serverLogs}
            emptyMessage="No server logs yet"
            onClear={() => setServerLogs([])}
            logRef={serverLogEndRef}
            getLogStyle={serverLogStyle}
          />
          <ServerStatusPanel
            theme={theme}
            serverServices={SERVER_SERVICES}
            serverStatus={serverStatus}
            expandedServices={expandedServices}
            setExpandedServices={setExpandedServices}
            isRefreshingStatus={isRefreshingStatus}
            checkServerStatus={checkServerStatus}
            formatDateTime={formatDateTime}
            onRestartGraphQL={handleRestartGraphQL}
            onLogInfo={(message) => {
              const logId = `${Date.now()}-${++logIdCounterRef.current}`;
              setLogs(prev => [...prev, {
                id: logId,
                timestamp: new Date(),
                type: 'info',
                message,
                tableName: 'System'
              }]);
            }}
          />
        </div>
      )}

      <StatusModal
        theme={theme}
        statusTable={statusTable}
        onClose={() => setStatusTable(null)}
        formatDateRange={formatDateRange}
        formatDateTime={formatDateTime}
      />

      <ReviewModal
        theme={theme}
        reviewData={reviewData}
        onClose={() => setReviewData(null)}
      />

      {showBottomPanels && <div style={{ height: '200px' }} />} {/* Spacer for fixed log panel */}
    </div>
  );
};

export default DataManagementPage;

