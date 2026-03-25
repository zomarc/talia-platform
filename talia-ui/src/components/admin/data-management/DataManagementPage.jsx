/**
 * Data Management Page
 * Displays database table information including sources, sync status, and data ranges
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDatabaseTables } from '../../../hooks/useDatabaseTables';
import { LoadingSpinner, ErrorMessage } from '../../../components/shared';
// Supabase import removed - all database operations now route through GraphQL backend
import { SERVER_SERVICES } from '../../../config/serverServices';
import DataManagementActionHeader from './DataManagementActionHeader.jsx';
import BackupStatusBar from './BackupStatusBar.jsx';
import FiltersBar from './FiltersBar.jsx';
import StatusModal from './StatusModal.jsx';
import ReviewModal from './ReviewModal.jsx';
import LogsPanel from './LogsPanel.jsx';
import ServerStatusPanel from './ServerStatusPanel.jsx';
import DataManagementTable from './DataManagementTable.jsx';
import TargetImportSection from './TargetImportSection.jsx';
import { createTableActions } from './tableActions.js';
import { formatDayMon } from '../../../lib/dateFormat';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';
import SubpanelExpandButton from '../../shared/SubpanelExpandButton.jsx';
import { enforceDashboardUiState } from '../../../services/dashboardUiState';
import {
  DATA_MANAGEMENT_STATE_EVENT,
  DATA_MANAGEMENT_SET_RANGE_EVENT,
  DATA_MANAGEMENT_SYNC_ALL_EVENT,
  DATA_MANAGEMENT_BACKUP_EVENT,
  DATA_MANAGEMENT_REFRESH_EVENT,
  DATA_MANAGEMENT_SELECT_TABLE_EVENT,
  DATA_MANAGEMENT_TABLE_ACTION_EVENT,
} from '../../dockview/eventConstants';
import '../../../themes/dataMode.css';
import '../admin.css';
import './dataManagement.css';

const INTERNAL_TALIA_TABLE_NAMES = new Set([
  'booking_targets_supplied',
  'target_profiles',
  'target_mapping_config',
  'inventory_item_profile_curve_point',
  'focuses',
  'operation_metadata',
  'sync_metadata',
  'data_refresh_metadata',
]);

const filterTablesByTextAndView = (sourceTables, filterText, viewMode) => {
  const searchText = String(filterText || '').toLowerCase();
  const searchFiltered = (sourceTables || []).filter((table) => {
    if (!searchText) return true;
    return (
      table.tableName.toLowerCase().includes(searchText) ||
      (table.source && table.source.toLowerCase().includes(searchText)) ||
      String(table.status || '').toLowerCase().includes(searchText)
    );
  });
  if (viewMode === 'no-data') return searchFiltered.filter((t) => t.rowCount === 0);
  if (viewMode === 'has-data') return searchFiltered.filter((t) => t.rowCount > 0);
  if (viewMode === 'synced') return searchFiltered.filter((t) => t.syncStatus === 'Synced');
  if (viewMode === 'outdated') return searchFiltered.filter((t) => t.syncStatus === 'Outdated');
  if (viewMode === 'top-five') {
    return [...searchFiltered].sort((a, b) => b.rowCount - a.rowCount).slice(0, 5);
  }
  return searchFiltered;
};

const getTableCardTitle = (viewMode) => {
  if (viewMode === 'top-five') return 'Top Five Tables';
  if (viewMode === 'no-data') return 'No Data Tables';
  if (viewMode === 'has-data') return 'Has Data Tables';
  if (viewMode === 'synced') return 'Synced Tables';
  if (viewMode === 'outdated') return 'Outdated Tables';
  return 'All Tables';
};

export const DataManagementPanelCore = ({
  embedded = false,
  panelInstanceId = null,
  panelComponentId = 'data-management-panel',
}) => {
  const { tables, loading, error, refetch, updateTable } = useDatabaseTables();
  const [filterText, setFilterText] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'top-five', 'no-data', 'has-data', 'synced', 'outdated'
  const [internalFilterText, setInternalFilterText] = useState('');
  const [internalViewMode, setInternalViewMode] = useState('all');
  const [syncingTables, setSyncingTables] = useState(new Set());
  const [syncProgress, setSyncProgress] = useState({}); // { tableName: { current: 0, total: 0, percentage: 0 } }
  const [syncBlock, setSyncBlock] = useState(null); // { tableName, message, timestamp }
  const [logs, setLogs] = useState([]);
  const [serverLogs, setServerLogs] = useState([]);
  const [allActivityLogs, setAllActivityLogs] = useState([]); // Unified activity log
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedInternalTable, setSelectedInternalTable] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [statusTable, setStatusTable] = useState(null);
  const [statusLoadingTable, setStatusLoadingTable] = useState(null);
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [globalRange, setGlobalRange] = useState(null);
  const [rangeDraft, setRangeDraft] = useState({ from: '', to: '' });
  const [rangeSaving, setRangeSaving] = useState(false);
  const [rangeError, setRangeError] = useState(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkMode, setBulkMode] = useState(null);
  const [bulkSummary, setBulkSummary] = useState(null);
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
  const tableActionsRef = useRef(null);

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
  const rootRef = useRef(null);
  const [activeSection, setActiveSection] = useState('table-integration');
  const { expandedKey: expandedDataKey, toggleExpandedKey: toggleExpandedDataKey } = useSubpanelExpansion('tables');
  const [opsPanelsOpen, setOpsPanelsOpen] = useState({
    backup: true,
    status: true,
    'client-logs': true,
    'server-logs': true,
  });
  const toggleOpsPanel = useCallback((panelKey) => {
    setOpsPanelsOpen((prev) => ({ ...prev, [panelKey]: !prev[panelKey] }));
  }, []);

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

  // Format date for display (condensed)
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return formatDayMon(dateString, String(dateString));
    } catch {
      return dateString;
    }
  };

  // Format date and time for display
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return String(dateString);
      const dateLabel = formatDayMon(date, String(dateString));
      const timeLabel = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${dateLabel} ${timeLabel}`;
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

  const internalTables = React.useMemo(
    () => tables.filter((table) => INTERNAL_TALIA_TABLE_NAMES.has(table.tableName) || table.type === 'application' || table.type === 'system'),
    [tables]
  );
  const externalTables = React.useMemo(
    () => tables.filter((table) => !internalTables.some((entry) => entry.tableName === table.tableName)),
    [internalTables, tables]
  );
  const displayedTables = React.useMemo(
    () => filterTablesByTextAndView(externalTables, filterText, viewMode),
    [externalTables, filterText, viewMode]
  );
  const displayedInternalTables = React.useMemo(
    () => filterTablesByTextAndView(internalTables, internalFilterText, internalViewMode),
    [internalFilterText, internalTables, internalViewMode]
  );
  const tableCardTitle = React.useMemo(() => getTableCardTitle(viewMode), [viewMode]);
  const internalTableCardTitle = React.useMemo(() => getTableCardTitle(internalViewMode), [internalViewMode]);

  const runningSyncTables = Array.from(syncingTables);
  const runningSyncCount = runningSyncTables.length;
  const runningProgress = runningSyncCount
    ? Math.round(runningSyncTables.reduce((total, tableName) => {
        const progress = syncProgress[tableName]?.percentage || 0;
        return total + progress;
      }, 0) / runningSyncCount)
    : 0;

  const syncableTableNames = React.useMemo(
    () => externalTables.filter((t) => t?.hasSyncConfig === true).map((t) => t.tableName),
    [externalTables]
  );
  const internalSyncableTableNames = React.useMemo(
    () => internalTables.filter((t) => t?.hasSyncConfig === true).map((t) => t.tableName),
    [internalTables]
  );
  const parseSyncBlockError = useCallback((message, fallbackTableName = null) => {
    const text = String(message || '');
    if (!/already in progress/i.test(text)) return null;
    const matched = text.match(/already in progress for\s+([A-Za-z0-9_]+)/i);
    return {
      tableName: matched?.[1] || fallbackTableName || null,
      message: text,
      timestamp: new Date(),
    };
  }, []);
  const lastActivityLog = React.useMemo(
    () => (allActivityLogs.length > 0 ? allActivityLogs[allActivityLogs.length - 1] : null),
    [allActivityLogs]
  );
  const selectableTableNames = React.useMemo(
    () => displayedTables
      .map((t) => t.tableName)
      .sort((a, b) => String(a).localeCompare(String(b))),
    [displayedTables]
  );
  const selectableInternalTableNames = React.useMemo(
    () => displayedInternalTables
      .map((t) => t.tableName)
      .sort((a, b) => String(a).localeCompare(String(b))),
    [displayedInternalTables]
  );

  // Get GraphQL endpoint (same logic as Apollo client)
  // Use relative path - Vite proxy handles routing to localhost:4000
  const getGraphQLEndpoint = () => {
    return '/api/graphql';
  };

  const graphqlRequest = async (query, variables = {}) => {
    const response = await fetch(getGraphQLEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const result = await response.json();
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message || 'GraphQL error');
    }
    return result.data;
  };

  const queryReviewTable = useCallback(async ({ tableName, limit = 100, filters = {} }) => {
    const cleanedFilters = Object.entries(filters || {}).reduce((acc, [key, value]) => {
      if (value === null || value === undefined) return acc;
      if (typeof value === 'string' && value.trim() === '') return acc;
      acc[key] = value;
      return acc;
    }, {});
    const query = `
      query GetTableData($tableName: String!, $limit: Int, $filters: TableDataFilters) {
        tableData(tableName: $tableName, limit: $limit, filters: $filters)
      }
    `;
    const data = await graphqlRequest(query, {
      tableName,
      limit: Number(limit) || 100,
      filters: cleanedFilters,
    });
    const rows = Array.isArray(data?.tableData) ? data.tableData : [];
    addClientLog({
      id: `${Date.now()}-${++logIdCounterRef.current}`,
      timestamp: new Date(),
      type: 'info',
      message: `Loaded ${rows.length} rows from ${tableName}`,
      tableName,
    });
    return { tableName, data: rows, limit: Number(limit) || 100, filters: cleanedFilters };
  }, [graphqlRequest]);

  const loadGlobalRange = async () => {
    try {
      setRangeError(null);
      const query = `
        query {
          integrationDateRanges {
            id
            integrationName
            displayName
            description
            dateFrom
            dateTo
            dateColumn
            isActive
            isDefault
          }
        }
      `;
      const data = await graphqlRequest(query);
      const ranges = data?.integrationDateRanges || [];
      const active = ranges.find(r => r.integrationName === 'synapse_default' && r.isActive) ||
                     ranges.find(r => r.isDefault && r.isActive) ||
                     ranges.find(r => r.isActive) ||
                     ranges[0];
      if (active) {
        setGlobalRange(active);
        setRangeDraft({ from: active.dateFrom || '', to: active.dateTo || '' });
      }
    } catch (err) {
      setRangeError(err.message || 'Failed to load date range');
    }
  };

  useEffect(() => {
    loadGlobalRange();
  }, []);

  const getGlobalActualRange = (list) => {
    let min = null;
    let max = null;
    list.forEach((table) => {
      const range = table.actualDataRange;
      if (!range?.min || !range?.max) return;
      const minTime = Date.parse(range.min);
      const maxTime = Date.parse(range.max);
      if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) return;
      if (!min || minTime < Date.parse(min)) min = range.min;
      if (!max || maxTime > Date.parse(max)) max = range.max;
    });
    return min || max ? { min, max } : null;
  };

  const globalActualRange = React.useMemo(() => getGlobalActualRange(tables), [tables]);
  const globalLastSync = React.useMemo(() => {
    let latest = null;
    tables.forEach((table) => {
      if (!table.lastSync) return;
      const time = Date.parse(table.lastSync);
      if (!Number.isFinite(time)) return;
      if (!latest || time > Date.parse(latest)) {
        latest = table.lastSync;
      }
    });
    return latest;
  }, [tables]);
  const configuredRange = React.useMemo(() => {
    if (globalRange?.dateFrom || globalRange?.dateTo) {
      return { min: globalRange.dateFrom || null, max: globalRange.dateTo || null };
    }
    return tables[0]?.dateRange || null;
  }, [globalRange, tables]);

  useEffect(() => {
    if (window.__taliaStatus?.setDataStatus) {
      window.__taliaStatus.setDataStatus({
        globalRange: configuredRange,
        actualRange: globalActualRange,
        lastSync: globalLastSync
      });
    }
  }, [configuredRange, globalActualRange, globalLastSync]);

  const saveRangeValues = async ({ from, to }) => {
    if (!globalRange?.id) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      setRangeError('Date range must be YYYY-MM-DD');
      return false;
    }
    setRangeSaving(true);
    setRangeError(null);
    try {
      const mutation = `
        mutation UpdateRange($id: Int!, $input: IntegrationDateRangeInput!) {
          updateIntegrationDateRange(id: $id, input: $input) {
            id
            integrationName
            displayName
            description
            dateFrom
            dateTo
            dateColumn
            isActive
            isDefault
          }
        }
      `;
      const input = {
        integrationName: globalRange.integrationName,
        displayName: globalRange.displayName,
        description: globalRange.description,
        dateFrom: from,
        dateTo: to,
        dateColumn: globalRange.dateColumn,
        isActive: globalRange.isActive !== false,
        isDefault: globalRange.isDefault !== false
      };
      const data = await graphqlRequest(mutation, { id: globalRange.id, input });
      const updated = data?.updateIntegrationDateRange;
      if (updated) {
        setGlobalRange(updated);
        setRangeDraft({ from: updated.dateFrom || '', to: updated.dateTo || '' });
        refetch();
        return true;
      }
    } catch (err) {
      setRangeError(err.message || 'Failed to update range');
      return false;
    } finally {
      setRangeSaving(false);
    }
    return false;
  };

  const handleOpenStatus = async (table) => {
    if (!table?.tableName) return;
    setStatusLoadingTable(table.tableName);
    try {
      const query = `
        query GetTableMetadata($tableName: String!) {
          tableMetadata(tableName: $tableName) {
            tableName
            source
            type
            loadMethod
            rowCount
            dateRange {
              min
              max
            }
            actualDataRange {
              min
              max
            }
            latestSnapshotDate
            latestAvailableData
            lastSync
            syncDuration
            recordsProcessed
            changesDetected
            lastError
            syncStatus
            dataStatus
            status
            syncType
          }
        }
      `;
      const data = await graphqlRequest(query, { tableName: table.tableName });
      const freshStatus = data?.tableMetadata || null;
      if (freshStatus) {
        // Preserve UI-enriched display fields when backend returns null placeholders.
        setStatusTable({
          ...table,
          ...freshStatus,
          source: freshStatus.source || table.source,
          type: freshStatus.type || table.type,
          loadMethod: freshStatus.loadMethod || table.loadMethod
        });
        return;
      }
      setStatusTable(table);
    } catch (err) {
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'warning',
        message: `⚠️ Could not load fresh status for ${table.tableName}: ${err.message || 'Unknown error'}`,
        tableName: table.tableName
      });
      setStatusTable(table);
    } finally {
      setStatusLoadingTable(null);
    }
  };

  const handleSyncAll = async (forceFullSync) => {
    if (bulkSyncing) return;
    const syncableTables = tables.filter((t) => t?.hasSyncConfig === true);
    if (syncableTables.length === 0) return;
    setBulkSummary(null);
    setBulkSyncing(true);
    setBulkMode(forceFullSync ? 'full' : 'sync');
    addClientLog({
      id: `${Date.now()}-${++logIdCounterRef.current}`,
      timestamp: new Date(),
      type: 'info',
      message: `🔄 Starting ${forceFullSync ? 'full update' : 'sync'} for ${syncableTables.length} tables`,
      tableName: 'System'
    });
    const startedAt = Date.now();
    const results = [];
    for (const table of syncableTables) {
      // Sequential to avoid overlapping syncs
      // Capture per-table result to produce an explicit integration summary.
      // This keeps failures visible even when logs are noisy.
      const result = await handleSync(table.tableName, forceFullSync, { enforceUiState: false });
      results.push({
        tableName: table.tableName,
        ...(result || { success: false, error: 'No result returned by sync handler' })
      });
    }
    const successCount = results.filter((entry) => entry.success).length;
    const failed = results.filter((entry) => !entry.success);
    const completedAt = Date.now();
    const summary = {
      mode: forceFullSync ? 'full' : 'sync',
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      total: results.length,
      successCount,
      failedCount: failed.length,
      failed,
      results
    };
    setBulkSummary(summary);
    if (failed.length > 0) {
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'error',
        message: `❌ ${summary.mode === 'full' ? 'Full update' : 'Sync'} finished with ${failed.length}/${summary.total} table failures. See Integration Result for details.`,
        tableName: 'System'
      });
      failed.forEach((entry) => {
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'error',
          message: `• ${entry.tableName}: ${entry.error || 'Unknown error'}`,
          tableName: 'System'
        });
      });
    } else {
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'success',
        message: `✅ ${summary.mode === 'full' ? 'Full update' : 'Sync'} completed for all ${summary.total} tables in ${formatDuration(summary.durationMs)}.`,
        tableName: 'System'
      });
    }
    setBulkSyncing(false);
    setBulkMode(null);
    if (forceFullSync) {
      enforceDashboardUiState({ dispatchEvents: true });
    }
  };

  useEffect(() => {
    const syncableTableNames = tables
      .filter((table) => table?.hasSyncConfig === true)
      .map((table) => table.tableName);
    window.dispatchEvent(new CustomEvent(DATA_MANAGEMENT_STATE_EVENT, {
      detail: {
        panelComponentId,
        rangeDraft,
        rangeSaving,
        rangeError,
        selectedTable: selectedTable || '',
        syncableTableNames,
        bulkSyncing,
        bulkMode,
        backupStatus: {
          loading: backupStatus.loading,
          lastBackup: backupStatus.lastBackup,
          status: backupStatus.status,
          error: backupStatus.error,
        },
      },
    }));
  }, [
    panelComponentId,
    rangeDraft,
    rangeSaving,
    rangeError,
    selectedTable,
    tables,
    bulkSyncing,
    bulkMode,
    backupStatus.loading,
    backupStatus.lastBackup,
    backupStatus.status,
    backupStatus.error,
  ]);

  useEffect(() => {
    const handleSetRange = async (event) => {
      const detail = event?.detail || {};
      const targetComponent = detail.panelComponent || null;
      if (targetComponent && targetComponent !== panelComponentId) return;
      const nextFrom = typeof detail.from === 'string' ? detail.from : rangeDraft.from;
      const nextTo = typeof detail.to === 'string' ? detail.to : rangeDraft.to;
      setRangeDraft({ from: nextFrom, to: nextTo });
      if (detail.save === true) {
        await saveRangeValues({ from: nextFrom, to: nextTo });
      }
    };

    const handleSyncAllEvent = (event) => {
      const detail = event?.detail || {};
      const targetComponent = detail.panelComponent || null;
      if (targetComponent && targetComponent !== panelComponentId) return;
      const mode = detail.mode === 'full' ? 'full' : 'sync';
      handleSyncAll(mode === 'full');
    };

    const handleBackupEvent = (event) => {
      const detail = event?.detail || {};
      const targetComponent = detail.panelComponent || null;
      if (targetComponent && targetComponent !== panelComponentId) return;
      triggerBackup();
    };

    const handleRefreshEvent = (event) => {
      const detail = event?.detail || {};
      const targetComponent = detail.panelComponent || null;
      if (targetComponent && targetComponent !== panelComponentId) return;
      refetch();
      fetchBackupStatus();
      loadGlobalRange();
    };

    const handleSelectTableEvent = (event) => {
      const detail = event?.detail || {};
      const targetComponent = detail.panelComponent || null;
      if (targetComponent && targetComponent !== panelComponentId) return;
      const tableName = typeof detail.tableName === 'string' ? detail.tableName : '';
      setSelectedTable(tableName || null);
    };

    const handleTableActionEvent = async (event) => {
      const detail = event?.detail || {};
      const targetComponent = detail.panelComponent || null;
      if (targetComponent && targetComponent !== panelComponentId) return;
      const tableName = typeof detail.tableName === 'string' ? detail.tableName : '';
      const action = detail.action;
      if (!tableName) return;
      const table = tables.find((item) => item.tableName === tableName);
      if (!table) {
        addClientLog({
          id: `${Date.now()}-${++logIdCounterRef.current}`,
          timestamp: new Date(),
          type: 'warning',
          message: `⚠️ Table "${tableName}" is not available.`,
          tableName,
        });
        return;
      }
      if (action === 'status') {
        await handleOpenStatus(table);
      } else if (action === 'review') {
        await tableActionsRef.current?.handleReview?.(table);
      } else if (action === 'sync') {
        if (table.hasSyncConfig !== true) {
          addClientLog({
            id: `${Date.now()}-${++logIdCounterRef.current}`,
            timestamp: new Date(),
            type: 'warning',
            message: `⚠️ Table "${tableName}" does not support sync.`,
            tableName,
          });
          return;
        }
        await tableActionsRef.current?.handleIncrementalSync?.(table);
      } else if (action === 'full') {
        if (table.hasSyncConfig !== true) {
          addClientLog({
            id: `${Date.now()}-${++logIdCounterRef.current}`,
            timestamp: new Date(),
            type: 'warning',
            message: `⚠️ Table "${tableName}" does not support full update.`,
            tableName,
          });
          return;
        }
        await tableActionsRef.current?.handleFullSync?.(table);
      }
    };

    window.addEventListener(DATA_MANAGEMENT_SET_RANGE_EVENT, handleSetRange);
    window.addEventListener(DATA_MANAGEMENT_SYNC_ALL_EVENT, handleSyncAllEvent);
    window.addEventListener(DATA_MANAGEMENT_BACKUP_EVENT, handleBackupEvent);
    window.addEventListener(DATA_MANAGEMENT_REFRESH_EVENT, handleRefreshEvent);
    window.addEventListener(DATA_MANAGEMENT_SELECT_TABLE_EVENT, handleSelectTableEvent);
    window.addEventListener(DATA_MANAGEMENT_TABLE_ACTION_EVENT, handleTableActionEvent);
    return () => {
      window.removeEventListener(DATA_MANAGEMENT_SET_RANGE_EVENT, handleSetRange);
      window.removeEventListener(DATA_MANAGEMENT_SYNC_ALL_EVENT, handleSyncAllEvent);
      window.removeEventListener(DATA_MANAGEMENT_BACKUP_EVENT, handleBackupEvent);
      window.removeEventListener(DATA_MANAGEMENT_REFRESH_EVENT, handleRefreshEvent);
      window.removeEventListener(DATA_MANAGEMENT_SELECT_TABLE_EVENT, handleSelectTableEvent);
      window.removeEventListener(DATA_MANAGEMENT_TABLE_ACTION_EVENT, handleTableActionEvent);
    };
  }, [panelComponentId, rangeDraft.from, rangeDraft.to, handleSyncAll, refetch, tables]);

  // Handle sync button click
  const handleSync = async (tableName, forceFullSync = false, options = {}) => {
    const shouldEnforceUiState = options?.enforceUiState !== false;
    setSyncBlock(null);
    // Check if table has a sync configuration
    const table = tables.find(t => t.tableName === tableName);
    if (!table || table.hasSyncConfig !== true) {
      const errorMsg = `Table "${tableName}" does not have a sync configuration.`;
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'error',
        message: `❌ ${errorMsg}`,
        tableName
      });
      return {
        success: false,
        error: errorMsg
      };
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
      void parseProgressFromLog;

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
        const blockingGraphQLError = result.errors.find((error) => /already in progress/i.test(error?.message || ''));
        if (blockingGraphQLError) {
          const block = parseSyncBlockError(blockingGraphQLError.message, tableName);
          if (block) {
            setSyncBlock(block);
            addClientLog({
              id: `${Date.now()}-${++logIdCounterRef.current}`,
              timestamp: new Date(),
              type: 'warning',
              message: `⏳ Sync is blocked because "${block.tableName || tableName}" is already running on the server. Wait for it to finish, then retry.`,
              tableName: block.tableName || tableName
            });
          }
        }
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
        return {
          success: true,
          message: syncResult?.message || successMessage,
          recordsProcessed: syncResult?.recordsProcessed ?? null,
          duration: syncResult?.duration ?? null
        };
      } else {
        // Sync failed on server side
        const syncResult = result.data?.syncTable;
        const errorMsg = syncResult?.error || syncResult?.message || 'Unknown error from server';
        
        // Trust the server's error classification - don't re-enhance
        // Server already handles connection error enhancement appropriately
        // Only add context if it's clearly a connection error from server
        const errorMsgLower = errorMsg.toLowerCase();
        const isConnectionError = errorMsgLower.includes('connection closed') ||
                                  errorMsgLower.includes('connection timeout') ||
                                  errorMsgLower.includes('connection refused') ||
                                  errorMsgLower.includes('cannot resolve server');
        const isUpstreamError = errorMsgLower.includes('invalid response was received from the upstream server') ||
                                errorMsgLower.includes('upstream server') ||
                                errorMsgLower.includes('bad gateway') ||
                                errorMsgLower.includes('502') ||
                                errorMsgLower.includes('503') ||
                                errorMsgLower.includes('504');
        
        const detailedError = isConnectionError 
          ? `🔌 ${errorMsg}` 
          : isUpstreamError
            ? `Upstream service error: ${errorMsg}`
            : `Sync failed: ${errorMsg}`;
        const block = parseSyncBlockError(errorMsg, tableName);
        if (block) {
          setSyncBlock(block);
        }
        
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
          message: block
            ? `⏳ Sync blocked: "${block.tableName || tableName}" is already running on the server. This panel is not stuck; the backend lock is active.`
            : isUpstreamError
              ? `🌐 Upstream service returned an invalid response while syncing "${tableName}". This usually means a temporary gateway/service issue (not a client UI issue). Check Server Status and retry in 30-60 seconds.`
            : `❌ ${detailedError}${isConnectionError ? ' Check the Server Status panel for connection details.' : ' Check the activity log and server logs for more details.'}`,
          tableName
        });
        return {
          success: false,
          error: detailedError,
          rawError: errorMsg
        };
      }
    } catch (err) {
      // Unexpected error
      const errorName = err.name || 'Error';
      const errorMessage = err.message || 'Unknown error occurred';

      console.error('Sync error:', err);
      
      addClientLog({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type: 'error',
        message: `❌ Unexpected Error [${errorName}]: ${errorMessage}. Check the browser console and activity log for details.`,
        tableName
      });
      return {
        success: false,
        error: `${errorName}: ${errorMessage}`
      };
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
        if (forceFullSync && shouldEnforceUiState) {
          enforceDashboardUiState({ dispatchEvents: true });
        }
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

  const tableActions = createTableActions({
    setReviewLoading,
    setReviewData,
    addClientLog,
    handleSync,
    logIdCounterRef
  });
  tableActionsRef.current = tableActions;


  const renderExpandedPanel = () => {
    if (!expandedPanel) return null;
    const commonProps = { onMinimize: () => setExpandedPanel(null), isMaximized: true, fullHeight: true };
    let content = null;
    if (expandedPanel === 'client') {
      content = (
        <LogsPanel
          {...commonProps}
          title="📋 Client Activity"
          logs={logs}
          emptyMessage="No activity yet"
          onClear={() => setLogs([])}
          logRef={logEndRef}
        />
      );
    } else if (expandedPanel === 'server') {
      content = (
        <LogsPanel
          {...commonProps}
          title="🔧 Server Logs"
          logs={serverLogs}
          emptyMessage="No server logs yet"
          onClear={() => setServerLogs([])}
          logRef={serverLogEndRef}
        />
      );
    } else if (expandedPanel === 'status') {
      content = (
        <ServerStatusPanel
          {...commonProps}
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
      );
    }
    return (
      <div
        onClick={() => setExpandedPanel(null)}
        className="dm-overlay"
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="dm-overlay__panel"
        >
          {content}
        </div>
      </div>
    );
  };

  const renderIntegrationSection = ({
    sectionKey,
    sectionTitle,
    sectionSubtitle,
    sectionTables,
    sectionDisplayedTables,
    sectionCardTitle,
    sectionSelectedTable,
    sectionSetSelectedTable,
    sectionTableNames,
    sectionSyncableTableNames,
    sectionViewMode,
    sectionSetViewMode,
    sectionFilterText,
    sectionSetFilterText,
  }) => (
    <section className="dm-table-integration">
      <header className="talia-report__header dm-section-header">
        <div className="talia-report__header-left">
          <h3 className="talia-report__title dm-section-header__title">{sectionTitle}</h3>
          <span className="talia-report__subtitle dm-section-header__subtitle">{sectionSubtitle}</span>
        </div>
      </header>
      <DataManagementActionHeader
        panelComponentId={panelComponentId}
        tables={sectionTables}
        selectedTable={sectionSelectedTable}
        syncableTableNames={sectionSyncableTableNames}
        bulkSyncing={bulkSyncing}
        runningSyncCount={runningSyncCount}
        runningProgress={runningProgress}
        bulkSummary={bulkSummary}
        backupStatus={backupStatus}
        configuredRange={configuredRange}
        globalActualRange={globalActualRange}
        formatDateTime={formatDateTime}
        formatDateRange={formatDateRange}
        lastActivityLog={lastActivityLog}
        syncBlock={syncBlock}
      />

      <FiltersBar
        tables={sectionTables}
        selectedTable={sectionSelectedTable}
        setSelectedTable={sectionSetSelectedTable}
        tableNames={sectionTableNames}
        syncableTableNames={sectionSyncableTableNames}
        rangeDraft={rangeDraft}
        setRangeDraft={setRangeDraft}
        rangeSaving={rangeSaving}
        rangeError={rangeError}
        onSaveRange={() => saveRangeValues(rangeDraft)}
        viewMode={sectionViewMode}
        setViewMode={sectionSetViewMode}
        filterText={sectionFilterText}
        setFilterText={sectionSetFilterText}
      />

      {!loading && !error && sectionDisplayedTables.length > 0 && (
        <div className={`talia-card talia-card--expandable dm-table-card dm-table-section--spaced ${expandedDataKey === sectionKey ? 'talia-card--expanded' : ''}`}>
          <SubpanelExpandButton
            className="talia-card__expand-toggle"
            expanded={expandedDataKey === sectionKey}
            onToggle={() => toggleExpandedDataKey(sectionKey)}
            label="tables"
          />
          <div className="talia-card__header dm-table-card__header">
            <h3 className="talia-card__title">{sectionCardTitle} ({sectionDisplayedTables.length})</h3>
          </div>
          <div className="talia-card__content dm-table-card__body">
            <DataManagementTable
              tableId={`dm-main-table-${sectionKey}`}
              data={sectionDisplayedTables}
              configuredRange={configuredRange}
              selectedTable={sectionSelectedTable}
              onSelectedTableChange={sectionSetSelectedTable}
              syncingTables={syncingTables}
              syncProgress={syncProgress}
              blockedTableName={syncBlock?.tableName || null}
              statusLoadingTable={statusLoadingTable}
              reviewLoading={reviewLoading}
              onOpenStatus={handleOpenStatus}
              tableActions={tableActions}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="dm-card">
          <LoadingSpinner size="small" message="Loading table information..." />
        </div>
      )}

      {error && (
        <div className="dm-card dm-card--error">
          <ErrorMessage error={error} title="Error loading tables" onRetry={refetch} />
        </div>
      )}

      {!loading && !error && sectionDisplayedTables.length === 0 && (
        <div className="dm-card dm-card--empty">
          {sectionFilterText || sectionViewMode !== 'all' ? 'No tables match your selected view' : 'No tables found'}
        </div>
      )}
    </section>
  );

  return (
    <div
      ref={rootRef}
      className={`talia-report admin-dashboard-panel data-management-root ${embedded ? 'data-management-root--panel' : ''}`.trim()}
      role="region"
      aria-label="Data integration management panel"
    >
      <div className="dm-container">
        <header className="talia-report__header dm-header dm-header--primary">
          <div className="dm-header__row">
            <div className="talia-report__header-left">
              <h2 className="talia-report__title dm-header__title">Data Management</h2>
              <span className="talia-report__subtitle dm-header__subtitle">
                Standard integration component with shared framework controls
              </span>
            </div>
          </div>
        </header>

        <div className="admin-tabs admin-dashboard-panel__tabs dm-dashboard-tabs">
          <button className={`admin-tab ${activeSection === 'table-integration' ? 'admin-tab-active' : ''}`} onClick={() => setActiveSection('table-integration')}>
            Table Integration
          </button>
          <button className={`admin-tab ${activeSection === 'external-integration' ? 'admin-tab-active' : ''}`} onClick={() => setActiveSection('external-integration')}>
            External Integration
          </button>
          <button className={`admin-tab ${activeSection === 'internal-integration' ? 'admin-tab-active' : ''}`} onClick={() => setActiveSection('internal-integration')}>
            Internal Integration
          </button>
          <button className={`admin-tab ${activeSection === 'backup-status' ? 'admin-tab-active' : ''}`} onClick={() => setActiveSection('backup-status')}>
            Backup and Status
          </button>
          <button className={`admin-tab ${activeSection === 'operations' ? 'admin-tab-active' : ''}`} onClick={() => setActiveSection('operations')}>
            Operations
          </button>
        </div>

        <main className={`talia-report__content admin-dashboard-panel__content dm-dashboard-content ${activeSection === 'operations' ? 'dm-dashboard-content--operations' : ''}`.trim()}>
          {activeSection === 'table-integration' && (
            renderIntegrationSection({
              sectionKey: 'tables',
              sectionTitle: 'Table Integration',
              sectionSubtitle: 'External source tables and sync controls',
              sectionTables: externalTables,
              sectionDisplayedTables: displayedTables,
              sectionCardTitle: tableCardTitle,
              sectionSelectedTable: selectedTable,
              sectionSetSelectedTable: setSelectedTable,
              sectionTableNames: selectableTableNames,
              sectionSyncableTableNames: syncableTableNames,
              sectionViewMode: viewMode,
              sectionSetViewMode: setViewMode,
              sectionFilterText: filterText,
              sectionSetFilterText: setFilterText,
            })
          )}

          {activeSection === 'external-integration' && (
            <div className="dm-tab-stack">
              <header className="talia-report__header dm-section-header">
                <div className="talia-report__header-left">
                  <h3 className="talia-report__title dm-section-header__title">External Integration</h3>
                  <span className="talia-report__subtitle dm-section-header__subtitle">
                    Import external CSV target data and map into Talia structures
                  </span>
                </div>
              </header>
              <TargetImportSection
                addClientLog={addClientLog}
                logIdCounterRef={logIdCounterRef}
                onImportComplete={() => updateTable('booking_targets_supplied')}
              />
            </div>
          )}

          {activeSection === 'internal-integration' && (
            renderIntegrationSection({
              sectionKey: 'internal',
              sectionTitle: 'Internal Integration',
              sectionSubtitle: 'Talia-owned tables, mappings, targets, and profile data',
              sectionTables: internalTables,
              sectionDisplayedTables: displayedInternalTables,
              sectionCardTitle: internalTableCardTitle,
              sectionSelectedTable: selectedInternalTable,
              sectionSetSelectedTable: setSelectedInternalTable,
              sectionTableNames: selectableInternalTableNames,
              sectionSyncableTableNames: internalSyncableTableNames,
              sectionViewMode: internalViewMode,
              sectionSetViewMode: setInternalViewMode,
              sectionFilterText: internalFilterText,
              sectionSetFilterText: setInternalFilterText,
            })
          )}

          {activeSection === 'backup-status' && (
            <div className="dm-bottom-panels dm-bottom-panels--collapsible">
              <div className={`talia-card talia-card--expandable dm-panel-card ${opsPanelsOpen.backup ? 'talia-card--expanded' : ''}`}>
                <SubpanelExpandButton
                  className="talia-card__expand-toggle"
                  expanded={opsPanelsOpen.backup}
                  onToggle={() => toggleOpsPanel('backup')}
                  label="backup"
                />
                <div className="talia-card__header">
                  <h3 className="talia-card__title">💾 Backup</h3>
                </div>
                <div className="talia-card__content">
                  <BackupStatusBar
                    compact
                    backupStatus={backupStatus}
                    formatDateTime={formatDateTime}
                    triggerBackup={triggerBackup}
                    fetchBackupStatus={fetchBackupStatus}
                  />
                </div>
              </div>
              <div className={`talia-card talia-card--expandable dm-panel-card ${opsPanelsOpen.status ? 'talia-card--expanded' : ''}`}>
                <SubpanelExpandButton
                  className="talia-card__expand-toggle"
                  expanded={opsPanelsOpen.status}
                  onToggle={() => toggleOpsPanel('status')}
                  label="server status"
                />
                <div className="talia-card__header">
                  <h3 className="talia-card__title">
                    🖥️ Server Status
                    <span className="dm-status-count">
                      ({SERVER_SERVICES.filter(s => serverStatus[s.id]?.online).length}/{SERVER_SERVICES.length} Online)
                    </span>
                  </h3>
                </div>
                <div className="talia-card__content">
                  <ServerStatusPanel
                    hideTitle
                    embedded
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
                    onMaximize={() => setExpandedPanel('status')}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'operations' && (
            <div className="dm-bottom-panels dm-bottom-panels--collapsible dm-operations-tab">
              <div className={`talia-card talia-card--expandable dm-panel-card ${opsPanelsOpen['client-logs'] ? 'talia-card--expanded' : ''}`}>
                <SubpanelExpandButton
                  className="talia-card__expand-toggle"
                  expanded={opsPanelsOpen['client-logs']}
                  onToggle={() => toggleOpsPanel('client-logs')}
                  label="client activity"
                />
                <div className="talia-card__header">
                  <h3 className="talia-card__title">📋 Client Activity</h3>
                </div>
                <div className="talia-card__content">
                  <LogsPanel
                    title=""
                    logs={logs}
                    emptyMessage="No activity yet"
                    onClear={() => setLogs([])}
                    logRef={logEndRef}
                    onMaximize={() => setExpandedPanel('client')}
                    onMinimize={() => setExpandedPanel(null)}
                    hideTitle
                    embedded
                  />
                </div>
              </div>
              <div className={`talia-card talia-card--expandable dm-panel-card ${opsPanelsOpen['server-logs'] ? 'talia-card--expanded' : ''}`}>
                <SubpanelExpandButton
                  className="talia-card__expand-toggle"
                  expanded={opsPanelsOpen['server-logs']}
                  onToggle={() => toggleOpsPanel('server-logs')}
                  label="server logs"
                />
                <div className="talia-card__header">
                  <h3 className="talia-card__title">🔧 Server Logs</h3>
                </div>
                <div className="talia-card__content">
                  <LogsPanel
                    title=""
                    logs={serverLogs}
                    emptyMessage="No server logs yet"
                    onClear={() => setServerLogs([])}
                    logRef={serverLogEndRef}
                    onMaximize={() => setExpandedPanel('server')}
                    onMinimize={() => setExpandedPanel(null)}
                    hideTitle
                    embedded
                  />
                </div>
              </div>
              <div className={`talia-card talia-card--expandable dm-panel-card ${opsPanelsOpen.backup ? 'talia-card--expanded' : ''}`}>
                <SubpanelExpandButton
                  className="talia-card__expand-toggle"
                  expanded={opsPanelsOpen.backup}
                  onToggle={() => toggleOpsPanel('backup')}
                  label="backup"
                />
                <div className="talia-card__header">
                  <h3 className="talia-card__title">💾 Backup</h3>
                </div>
                <div className="talia-card__content">
                  <BackupStatusBar
                    compact
                    backupStatus={backupStatus}
                    formatDateTime={formatDateTime}
                    triggerBackup={triggerBackup}
                    fetchBackupStatus={fetchBackupStatus}
                  />
                </div>
              </div>
              <div className={`talia-card talia-card--expandable dm-panel-card ${opsPanelsOpen.status ? 'talia-card--expanded' : ''}`}>
                <SubpanelExpandButton
                  className="talia-card__expand-toggle"
                  expanded={opsPanelsOpen.status}
                  onToggle={() => toggleOpsPanel('status')}
                  label="server status"
                />
                <div className="talia-card__header">
                  <h3 className="talia-card__title">
                    🖥️ Server Status
                    <span className="dm-status-count">
                      ({SERVER_SERVICES.filter(s => serverStatus[s.id]?.online).length}/{SERVER_SERVICES.length} Online)
                    </span>
                  </h3>
                </div>
                <div className="talia-card__content">
                  <ServerStatusPanel
                    hideTitle
                    embedded
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
                    onMaximize={() => setExpandedPanel('status')}
                    onMinimize={() => setExpandedPanel(null)}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {renderExpandedPanel()}

      <StatusModal
        statusTable={statusTable}
        configuredRange={configuredRange}
        onClose={() => setStatusTable(null)}
        formatDateRange={formatDateRange}
        formatDateTime={formatDateTime}
      />

      <ReviewModal
        reviewData={reviewData}
        onQuery={queryReviewTable}
        onClose={() => setReviewData(null)}
      />
    </div>
  );
};

const DataManagementPage = () => (
  <DataManagementPanelCore embedded={false} panelComponentId="data-management-panel" />
);

export default DataManagementPage;

