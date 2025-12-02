/**
 * Data Management Page
 * Displays database table information including sources, sync status, and data ranges
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDatabaseTables } from '../hooks/useDatabaseTables';
import { LoadingSpinner, ErrorMessage } from './shared';
import { getThemeForMode } from '../themes/modeThemes';
import { supabase } from '../lib/supabase';
import { getTableSource } from '../config/tableSources';
import { SERVER_SERVICES, getAllServiceIds } from '../config/serverServices';
import { getSyncFreshness, getSyncFreshnessColor } from '../utils/syncFreshness';
import '../themes/dataMode.css';

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
        } else if (service.check.method === 'supabase') {
          // Supabase-based check
          const { error } = await supabase
            .from(service.check.table)
            .select(service.check.select)
            .limit(service.check.limit || 1);
          isOnline = !error;
          statusData = { online: isOnline, lastChecked: new Date() };
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
  const getGraphQLEndpoint = () => {
    if (import.meta.env.PROD) {
      return '/api/graphql';
    } else {
      return 'http://localhost:4000/graphql';
    }
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
      const sseBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:4001';
      const sseUrl = `${sseBaseUrl}/api/sync/stream/${tableName}`;
      
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
        
        // Check if it's a connection error and enhance the message
        let enhancedErrorMsg = errorMsg;
        let isConnectionError = false;
        
        if (errorMsg.toLowerCase().includes('vpn') || 
            errorMsg.toLowerCase().includes('connection') ||
            errorMsg.toLowerCase().includes('cannot connect') ||
            errorMsg.toLowerCase().includes('timeout') ||
            errorMsg.toLowerCase().includes('dns') ||
            errorMsg.toLowerCase().includes('refused')) {
          isConnectionError = true;
          enhancedErrorMsg = `🔌 Connection Error: ${errorMsg}. Please check your VPN connection and ensure Azure Synapse is accessible.`;
        }
        
        const detailedError = isConnectionError ? enhancedErrorMsg : `Sync failed: ${errorMsg}`;
        
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
          onClick={() => handleSort('loadMethod')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.loadMethod
          }}
        >
          Load Method<SortIcon column="loadMethod" />
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
          onClick={() => handleSort('latestSnapshot')}
          style={{
            padding: '6px 8px',
            textAlign: 'left',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.latestSnapshot
          }}
        >
          Latest Snapshot<SortIcon column="latestSnapshot" />
        </th>
        <th
          onClick={() => handleSort('recordsProcessed')}
          style={{
            padding: '6px 8px',
            textAlign: 'right',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.recordsProcessed
          }}
        >
          Records<SortIcon column="recordsProcessed" />
        </th>
        <th
          onClick={() => handleSort('changesDetected')}
          style={{
            padding: '6px 8px',
            textAlign: 'right',
            fontWeight: '600',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            width: columnWidths.changesDetected
          }}
        >
          Changes<SortIcon column="changesDetected" />
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
          Duration<SortIcon column="syncDuration" />
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
      const isSelected = table.tableName === selectedTable;
      const isEven = idx % 2 === 0;
      const isSyncing = syncingTables.has(table.tableName);
      const progress = syncProgress[table.tableName];
      
      // Get sync freshness for visual indicator
      const syncFreshness = getSyncFreshness(table.lastSync);
      const freshnessStatus = syncFreshness.status;
      
      // Build className for sync freshness indicator
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
              ? 'rgba(255, 192, 203, 0.15)' // Rose color background when syncing
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
                    {/* Animated shimmer effect */}
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
                        const logId = `${Date.now()}-${++logIdCounterRef.current}`;
                        setLogs(prev => [...prev, {
                          id: logId,
                          timestamp: new Date(),
                          type: 'info',
                          message: `Loaded ${data.length} rows from ${table.tableName}`,
                          tableName: table.tableName
                        }]);
                      } catch (err) {
                        const logId = `${Date.now()}-${++logIdCounterRef.current}`;
                        setLogs(prev => [...prev, {
                          id: logId,
                          timestamp: new Date(),
                          type: 'error',
                          message: `❌ Failed to load data for ${table.tableName}: ${err.message}`,
                          tableName: table.tableName
                        }]);
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
                    // For development: proceed directly without confirmation
                    const logId = `${Date.now()}-${++logIdCounterRef.current}`;
                    setLogs(prev => [...prev, {
                      id: logId,
                      timestamp: new Date(),
                      type: 'info',
                      message: `⚡ Starting full refresh for "${table.tableName}" (will sync all data, not just changes)...`,
                      tableName: table.tableName
                    }]);
                    handleSync(table.tableName, true);
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
  const rootStyle = {
    padding: '8px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
    backgroundAttachment: 'fixed',
    minHeight: '100vh',
    position: 'relative',
    '--table-row-even': theme.colors.tableRowEven,
    '--table-row-odd': theme.colors.tableRowOdd,
    '--table-row-hover': theme.colors.tableRowHover,
    '--table-row-selected': theme.colors.tableRowSelected,
    '--table-row-selected-hover': theme.colors.tableRowSelectedHover,
    '--glass-border': theme.colors.glassBorder,
    '--foreground': theme.colors.foreground,
    '--text-secondary': theme.colors.textSecondary,
    '--text-muted': theme.colors.textMuted
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
              <table className="data-management-table" style={{
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
              <table className="data-management-table" style={{
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

      {/* Bottom Panel - Split into Client Activity Log, Server Logs, All Activity, and Server Status */}
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
        {/* Client Activity Log Panel */}
        <div style={{
          flex: 1,
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `1px solid ${theme.colors.glassBorder}`,
          borderRadius: '12px 12px 0 0',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.glassBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.foreground }}>
              📋 Client Activity
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

        {/* Server Detailed Logs Panel */}
        <div style={{
          flex: 1,
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `1px solid ${theme.colors.glassBorder}`,
          borderRadius: '12px 12px 0 0',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.glassBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.foreground }}>
              🔧 Server Logs
            </div>
            <button
              onClick={() => setServerLogs([])}
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
          ref={serverLogEndRef}
          >
            {serverLogs.length === 0 ? (
              <div style={{ color: theme.colors.textMuted, textAlign: 'center', padding: '20px' }}>
                No server logs yet
              </div>
            ) : (
              serverLogs.map(log => (
                <div
                  key={log.id}
                  style={{
                    padding: '4px 8px',
                    marginBottom: '2px',
                    borderRadius: '4px',
                    background: log.message.includes('[ERROR]') || log.message.includes('❌')
                      ? 'rgba(244, 67, 54, 0.1)' 
                      : log.message.includes('✅') || log.message.includes('Successfully')
                        ? 'rgba(76, 175, 80, 0.1)' 
                        : 'rgba(255, 255, 255, 0.02)',
                    color: log.message.includes('[ERROR]') || log.message.includes('❌')
                      ? '#f44336' 
                      : log.message.includes('✅') || log.message.includes('Successfully')
                        ? '#4caf50' 
                        : theme.colors.textSecondary,
                    borderLeft: `3px solid ${
                      log.message.includes('[ERROR]') || log.message.includes('❌')
                        ? '#f44336' 
                        : log.message.includes('✅') || log.message.includes('Successfully')
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

        {/* Server Status Panel */}
        <div style={{
          width: '300px',
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `1px solid ${theme.colors.glassBorder}`,
          borderRadius: '12px 12px 0 0',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header with title and refresh button */}
          <div style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.glassBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.foreground, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🖥️ Server Status
              {/* Compact summary */}
              <span style={{ 
                fontSize: '9px', 
                fontWeight: '400', 
                color: theme.colors.textSecondary,
                marginLeft: '4px'
              }}>
                ({SERVER_SERVICES.filter(service => serverStatus[service.id]?.online).length}/{SERVER_SERVICES.length} Online)
              </span>
            </div>
            <button
              onClick={checkServerStatus}
              disabled={isRefreshingStatus}
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                background: isRefreshingStatus ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.glassBorder}`,
                borderRadius: '4px',
                cursor: isRefreshingStatus ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
                minWidth: '24px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                if (!isRefreshingStatus) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                if (!isRefreshingStatus) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              title="Refresh Status"
            >
              <span style={{
                display: 'inline-block',
                transform: isRefreshingStatus ? 'rotate(360deg)' : 'rotate(0deg)',
                transition: 'transform 0.5s ease',
                transformOrigin: 'center'
              }}>
                ⟳
              </span>
            </button>
          </div>
          
          {/* Services List - Always visible, each service expandable */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            fontSize: '9px',
            maxHeight: '400px'
          }}>
            {/* Services - Rendered generically from configuration */}
            {SERVER_SERVICES.map(service => {
              const status = serverStatus[service.id] || { online: false };
              const isExpanded = expandedServices[service.id] || false;
              
              return (
                <div key={service.id} style={{
                  marginBottom: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.glassBorder}`,
                  overflow: 'hidden'
                }}>
                  {/* Service Header - Clickable */}
                  <div 
                    onClick={() => setExpandedServices(prev => ({ ...prev, [service.id]: !prev[service.id] }))}
                    style={{
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (e.currentTarget) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (e.currentTarget) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: 1
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: status.online ? '#4caf50' : '#f44336',
                        boxShadow: status.online ? '0 0 4px #4caf50' : 'none',
                        flexShrink: 0
                      }} />
                      <span style={{ fontWeight: '600', color: theme.colors.foreground }}>
                        {service.icon} {service.name}
                      </span>
                      <span style={{ 
                        fontSize: '8px', 
                        color: theme.colors.textSecondary,
                        marginLeft: '4px'
                      }}>
                        {status.online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '8px', 
                      color: theme.colors.textSecondary,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      marginLeft: '8px'
                    }}>
                      ▼
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ padding: '8px', paddingTop: '0', borderTop: `1px solid ${theme.colors.glassBorder}` }}>
                      {/* Display address */}
                      {service.display?.address && (
                        <div style={{ color: theme.colors.textSecondary, fontSize: '8px', marginTop: '4px' }}>
                          {typeof service.display.address === 'function' 
                            ? service.display.address(status)
                            : service.display.address}
                        </div>
                      )}
                      
                      {/* Last started/checked timestamp */}
                      {(status.lastStarted || status.lastChecked) && (
                        <div style={{ color: theme.colors.textMuted, fontSize: '8px', marginTop: '4px' }}>
                          {status.lastStarted 
                            ? `Last seen online: ${formatDateTime(status.lastStarted)}`
                            : `Last checked: ${formatDateTime(status.lastChecked)}`}
                        </div>
                      )}
                      
                      {/* Error message if offline */}
                      {!status.online && (
                        <div style={{ 
                          marginTop: '6px',
                          padding: '4px 6px',
                          background: 'rgba(244, 67, 54, 0.1)',
                          borderRadius: '4px',
                          fontSize: '8px',
                          color: '#f44336'
                        }}>
                          {typeof service.offlineMessage === 'function'
                            ? service.offlineMessage(status)
                            : service.offlineMessage}
                        </div>
                      )}
                      
                      {/* Service-specific actions */}
                      {service.actions && status.online && service.actions.map(action => {
                        if (action.handler === 'restartGraphQL') {
                          return (
                            <button
                              key={action.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                const logId = `${Date.now()}-${++logIdCounterRef.current}`;
                                setLogs(prev => [...prev, {
                                  id: logId,
                                  timestamp: new Date(),
                                  type: 'info',
                                  message: `🔄 Restarting ${service.name}...`,
                                  tableName: 'System'
                                }]);
                                handleRestartGraphQL();
                              }}
                              style={{
                                marginTop: '6px',
                                padding: '4px 8px',
                                fontSize: '8px',
                                background: 'rgba(255, 152, 0, 0.2)',
                                color: '#ff9800',
                                border: `1px solid #ff9800`,
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              {action.icon} {action.label}
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                <table className="review-table" style={{
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
                        className={idx % 2 === 0 ? 'review-row-even' : 'review-row-odd'}
                        style={{
                          borderBottom: `1px solid ${theme.colors.glassBorder}`
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

