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

      // Get list of tables from Supabase
      // We'll use the MCP tool or query information_schema
      // For now, we'll use a known list of tables and fetch their metadata
      const knownTables = [
        'ship',
        'cabin_availability',
        'reservation',
        'master_sail',
        'sail_by_cabin_occupancy',
        'reservation_changes',
        'reservation_current_state',
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
        'focuses'
      ];

      // Fetch metadata for each table in parallel
      const tablePromises = knownTables.map(async (tableName) => {
        const tableConfig = getTableSource(tableName);
        const rowCount = await getRowCount(tableName);
        const dateRange = await getDateRange(tableName, tableConfig.dateColumns);
        
        const syncStatus = calculateSyncStatus(tableConfig, metadata);
        const dataStatus = calculateDataStatus(rowCount, dateRange);
        
        // Get last sync time
        let lastSync = null;
        if (tableConfig.syncType && metadata[tableConfig.syncType]) {
          lastSync = metadata[tableConfig.syncType].last_sync_at;
        }

        return {
          tableName,
          source: tableConfig.source || 'N/A',
          type: tableConfig.type,
          rowCount,
          dateRange,
          lastSync,
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
    syncMetadata
  };
};

export default useDatabaseTables;

