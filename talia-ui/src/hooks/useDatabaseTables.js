import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getTableSource } from '../config/tableSources';

/**
 * Hook to fetch database table metadata including sync status and data ranges
 */
export const useDatabaseTables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncMetadata, setSyncMetadata] = useState({});

  // Fetch sync metadata from sync_metadata table
  const fetchSyncMetadata = useCallback(async () => {
    try {
      const { data, error: syncError } = await supabase
        .from('sync_metadata')
        .select('*');

      if (syncError) {
        console.warn('Error fetching sync metadata:', syncError);
        return {};
      }

      // Index by sync_type for easy lookup
      const metadataMap = {};
      if (data) {
        data.forEach(record => {
          metadataMap[record.sync_type] = record;
        });
      }
      return metadataMap;
    } catch (err) {
      console.warn('Error fetching sync metadata:', err);
      return {};
    }
  }, []);

  // Get row count for a table
  const getRowCount = useCallback(async (tableName) => {
    try {
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.warn(`Error getting row count for ${tableName}:`, countError);
        return 0;
      }
      return count || 0;
    } catch (err) {
      console.warn(`Error getting row count for ${tableName}:`, err);
      return 0;
    }
  }, []);

  // Get date range for a table
  const getDateRange = useCallback(async (tableName, dateColumns) => {
    if (!dateColumns || dateColumns.length === 0) {
      return { min: null, max: null };
    }

    try {
      // Try to get min/max for the first date column
      const dateColumn = dateColumns[0];
      
      // First check if table has any rows
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!count || count === 0) {
        return { min: null, max: null };
      }

      // Use a SQL query to get min and max dates
      // We'll use order/limit as Supabase doesn't support aggregate functions in select
      const { data: minData, error: minError } = await supabase
        .from(tableName)
        .select(dateColumn)
        .order(dateColumn, { ascending: true })
        .limit(1);

      const { data: maxData, error: maxError } = await supabase
        .from(tableName)
        .select(dateColumn)
        .order(dateColumn, { ascending: false })
        .limit(1);

      if (minError || maxError) {
        // If error, try without ordering (table might not have that column)
        console.warn(`Error getting date range for ${tableName}:`, minError || maxError);
        return { min: null, max: null };
      }

      const min = minData && minData.length > 0 ? minData[0][dateColumn] : null;
      const max = maxData && maxData.length > 0 ? maxData[0][dateColumn] : null;

      return { min, max };
    } catch (err) {
      console.warn(`Error getting date range for ${tableName}:`, err);
      return { min: null, max: null };
    }
  }, []);

  // Get latest snapshot date from source table (if it has snapshot_date column)
  const getLatestSnapshotDate = useCallback(async (tableName, tableConfig) => {
    // Only check for snapshot_date if the table has it in dateColumns
    const hasSnapshotDate = tableConfig.dateColumns && tableConfig.dateColumns.includes('snapshot_date');
    if (!hasSnapshotDate) {
      return null;
    }

    try {
      // First check if table has any rows
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!count || count === 0) {
        return null;
      }

      // Get the latest snapshot_date
      const { data, error } = await supabase
        .from(tableName)
        .select('snapshot_date')
        .order('snapshot_date', { ascending: false })
        .limit(1);

      if (error) {
        console.warn(`Error getting latest snapshot date for ${tableName}:`, error);
        return null;
      }

      return data && data.length > 0 ? data[0].snapshot_date : null;
    } catch (err) {
      console.warn(`Error getting latest snapshot date for ${tableName}:`, err);
      return null;
    }
  }, []);

  // Calculate sync status
  const calculateSyncStatus = useCallback((tableConfig, metadata) => {
    if (!tableConfig.syncType) {
      return 'Not Synced';
    }

    const syncRecord = metadata[tableConfig.syncType];
    if (!syncRecord) {
      return 'Never Synced';
    }

    if (syncRecord.last_sync_at) {
      const lastSync = new Date(syncRecord.last_sync_at);
      const now = new Date();
      const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);

      if (hoursSinceSync < 24) {
        return 'Synced';
      } else {
        return 'Outdated';
      }
    }

    return 'Never Synced';
  }, []);

  // Calculate data status
  const calculateDataStatus = useCallback((rowCount, dateRange) => {
    if (rowCount === 0) {
      return 'Empty';
    }

    if (!dateRange.max) {
      return 'Has Data';
    }

    const maxDate = new Date(dateRange.max);
    const now = new Date();
    const daysSinceMaxDate = (now - maxDate) / (1000 * 60 * 60 * 24);

    if (daysSinceMaxDate > 30) {
      return 'Stale';
    }

    return 'Has Data';
  }, []);

  // Fetch all table information
  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch sync metadata first
      const metadata = await fetchSyncMetadata();
      setSyncMetadata(metadata);

      // Dynamically discover tables by trying to query known tables and checking for existence
      // Start with a comprehensive list that includes all known tables
      const baseTableList = [
        'ship',
        'cabin_availability',
        'reservation',
        'master_sail',
        'sail_by_cabin_occupancy',
        'reservation_changes',
        'reservation_current_state',
        'reservation_promotion',
        'published_rates',
        'published_rates_changes',
        'published_rates_current_state',
        'competitor',
        'competitor_current_state',
        'cabin_allocation',
        'itinerary',
        'gql_cabin_availability',
        'sail_header',
        'ship_cabin',
        'sync_metadata',
        'focuses',
        'google_trends_data',
        'google_trends_search_terms',
        'data_refresh_metadata'
      ];

      // Check which tables actually exist by attempting to query them
      const tableExistenceChecks = await Promise.allSettled(
        baseTableList.map(async (tableName) => {
          try {
            const { error } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true })
              .limit(0);
            
            // If no error, table exists (even if empty)
            return { tableName, exists: !error };
          } catch (err) {
            return { tableName, exists: false };
          }
        })
      );

      // Filter to only tables that exist
      const knownTables = tableExistenceChecks
        .filter(result => result.status === 'fulfilled' && result.value.exists)
        .map(result => result.value.tableName);

      // Fetch metadata for each table in parallel
      const tablePromises = knownTables.map(async (tableName) => {
        const tableConfig = getTableSource(tableName);
        const rowCount = await getRowCount(tableName);
        const dateRange = await getDateRange(tableName, tableConfig.dateColumns);
        const latestSnapshotDate = await getLatestSnapshotDate(tableName, tableConfig);
        
        const syncStatus = calculateSyncStatus(tableConfig, metadata);
        const dataStatus = calculateDataStatus(rowCount, dateRange);
        
        // Get last sync time, duration, and stats
        let lastSync = null;
        let syncDuration = null;
        let recordsProcessed = null;
        let changesDetected = null;
        if (tableConfig.syncType && metadata[tableConfig.syncType]) {
          const syncMeta = metadata[tableConfig.syncType];
          lastSync = syncMeta.last_sync_at;
          syncDuration = syncMeta.duration_ms;
          recordsProcessed = syncMeta.records_processed;
          changesDetected = syncMeta.changes_detected;
        }

        // Determine load method: batch vs direct
        // Batch = derived tables OR direct tables with isLargeDataset
        // Direct = small direct tables loaded all at once
        const loadMethod = tableConfig.type === 'derived' ? 'Batch' : 
                          (tableConfig.isLargeDataset ? 'Batch' : 'Direct');

        return {
          tableName,
          source: tableConfig.source || 'N/A',
          type: tableConfig.type,
          loadMethod, // Add load method
          rowCount,
          dateRange,
          latestSnapshotDate,
          lastSync,
          syncDuration,
          recordsProcessed,
          changesDetected,
          syncStatus,
          dataStatus,
          status: `${syncStatus} • ${dataStatus}`,
          syncType: tableConfig.syncType
        };
      });

      const tablesData = await Promise.all(tablePromises);
      setTables(tablesData);
    } catch (err) {
      console.error('Error fetching tables:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchSyncMetadata, getRowCount, getDateRange, calculateSyncStatus, calculateDataStatus]);

  // Update a single table's data without full refetch
  const updateTable = useCallback(async (tableName) => {
    try {
      const tableConfig = getTableSource(tableName);
      
      // Get row count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.warn(`Error getting row count for ${tableName}:`, countError);
      }
      const rowCount = count || 0;
      
      // Get date range
      let dateRange = { min: null, max: null };
      if (tableConfig.dateColumns && tableConfig.dateColumns.length > 0) {
        try {
          const dateColumn = tableConfig.dateColumns[0];
          const { data: minData, error: minError } = await supabase
            .from(tableName)
            .select(dateColumn)
            .order(dateColumn, { ascending: true })
            .limit(1);
          const { data: maxData, error: maxError } = await supabase
            .from(tableName)
            .select(dateColumn)
            .order(dateColumn, { ascending: false })
            .limit(1);
          
          if (!minError && !maxError) {
            dateRange.min = minData && minData.length > 0 ? minData[0][dateColumn] : null;
            dateRange.max = maxData && maxData.length > 0 ? maxData[0][dateColumn] : null;
          }
        } catch (err) {
          console.warn(`Error getting date range for ${tableName}:`, err);
        }
      }
      
      // Get latest snapshot date
      let latestSnapshotDate = null;
      if (tableConfig.dateColumns && tableConfig.dateColumns.includes('snapshot_date')) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('snapshot_date')
            .order('snapshot_date', { ascending: false })
            .limit(1);
          
          if (!error && data && data.length > 0) {
            latestSnapshotDate = data[0].snapshot_date;
          }
        } catch (err) {
          console.warn(`Error getting latest snapshot date for ${tableName}:`, err);
        }
      }
      
      // Fetch updated sync metadata
      const { data: metadataData, error: metadataError } = await supabase
        .from('sync_metadata')
        .select('*')
        .eq('sync_type', tableConfig.syncType || tableName);
      
      if (metadataError) {
        console.warn(`Error fetching sync metadata for ${tableName}:`, metadataError);
      }
      
      const metadataMap = {};
      if (metadataData && metadataData.length > 0) {
        metadataData.forEach(record => {
          metadataMap[record.sync_type] = record;
        });
      }
      
      // Calculate sync status
      const syncRecord = metadataMap[tableConfig.syncType || tableName];
      let syncStatus = 'Not Synced';
      if (syncRecord) {
        if (syncRecord.last_sync_at) {
          const lastSync = new Date(syncRecord.last_sync_at);
          const now = new Date();
          const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);
          syncStatus = hoursSinceSync < 24 ? 'Synced' : 'Outdated';
        } else {
          syncStatus = 'Never Synced';
        }
      }
      
      // Calculate data status
      let dataStatus = 'Empty';
      if (rowCount > 0) {
        if (!dateRange.max) {
          dataStatus = 'Has Data';
        } else {
          const maxDate = new Date(dateRange.max);
          const now = new Date();
          const daysSinceMaxDate = (now - maxDate) / (1000 * 60 * 60 * 24);
          dataStatus = daysSinceMaxDate > 30 ? 'Stale' : 'Has Data';
        }
      }
      
      let lastSync = null;
      let syncDuration = null;
      let recordsProcessed = null;
      let changesDetected = null;
      if (syncRecord) {
        lastSync = syncRecord.last_sync_at;
        syncDuration = syncRecord.duration_ms;
        recordsProcessed = syncRecord.records_processed;
        changesDetected = syncRecord.changes_detected;
      }
      
      // Recalculate load method
      const loadMethod = tableConfig.type === 'derived' ? 'Batch' : 
                        (tableConfig.isLargeDataset ? 'Batch' : 'Direct');
      
      // Update the specific table in the tables array
      setTables(prev => prev.map(t => 
        t.tableName === tableName 
          ? {
              ...t,
              loadMethod,
              rowCount,
              dateRange,
              latestSnapshotDate,
              lastSync,
              syncDuration,
              recordsProcessed,
              changesDetected,
              syncStatus,
              dataStatus,
              status: `${syncStatus} • ${dataStatus}`
            }
          : t
      ));
    } catch (err) {
      console.error(`Error updating table ${tableName}:`, err);
      throw err;
    }
  }, [calculateSyncStatus, calculateDataStatus]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const refetch = useCallback(() => {
    fetchTables();
  }, [fetchTables]);

  return {
    tables,
    loading,
    error,
    refetch,
    updateTable,
    syncMetadata
  };
};

export default useDatabaseTables;

