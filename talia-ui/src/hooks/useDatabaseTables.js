import { useState, useEffect, useCallback } from 'react';
import { getTableSource } from '../config/tableSources';

// GraphQL endpoint - uses Vite proxy to route to backend
const GRAPHQL_URL = '/api/graphql';

/**
 * Hook to fetch database table metadata including sync status and data ranges
 * Now uses GraphQL backend instead of direct Supabase calls (works from external URLs)
 */
export const useDatabaseTables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncMetadata, setSyncMetadata] = useState({});

  // GraphQL query helper
  const graphqlQuery = useCallback(async (query, variables = {}) => {
    try {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
      }

      return result.data;
    } catch (err) {
      console.error('GraphQL query error:', err);
      throw err;
    }
  }, []);

  // Fetch sync metadata from GraphQL
  const fetchSyncMetadata = useCallback(async () => {
    try {
      const query = `
        query {
          syncMetadata {
            sync_type
            last_sync_at
            duration_ms
            records_processed
            changes_detected
            status
            error
          }
        }
      `;

      const data = await graphqlQuery(query);
      
      // Index by sync_type for easy lookup
      const metadataMap = {};
      if (data?.syncMetadata) {
        data.syncMetadata.forEach(record => {
          metadataMap[record.sync_type] = record;
        });
      }
      return metadataMap;
    } catch (err) {
      console.warn('Error fetching sync metadata:', err);
      return {};
    }
  }, [graphqlQuery]);

  // Fetch all table information via GraphQL
  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch sync metadata first
      const metadata = await fetchSyncMetadata();
      setSyncMetadata(metadata);

      // Fetch all database tables metadata from GraphQL
      const query = `
        query {
          databaseTables {
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

      const data = await graphqlQuery(query);
      
      if (!data?.databaseTables) {
        throw new Error('No database tables data returned');
      }

      // Map GraphQL response to expected format and enrich with table config
      // Frontend calculates loadMethod from tableSources config (backend doesn't have this)
      const tablesData = data.databaseTables.map(table => {
        const tableConfig = getTableSource(table.tableName);
        
        // Calculate loadMethod based on tableSources config (original logic)
        // Batch = derived tables OR direct tables with isLargeDataset
        // Direct = small direct tables loaded all at once
        const loadMethod = tableConfig.type === 'derived' ? 'Batch' : 
                          (tableConfig.isLargeDataset ? 'Batch' : 'Direct');
        
        return {
          tableName: table.tableName,
          source: tableConfig?.source || table.source || 'N/A',
          type: tableConfig?.type || table.type || 'direct',
          loadMethod, // Calculated from tableConfig, not from GraphQL
          rowCount: table.rowCount || 0,
          dateRange: table.dateRange || { min: null, max: null },
          actualDataRange: table.actualDataRange || { min: null, max: null },
          latestSnapshotDate: table.latestSnapshotDate || table.dateRange?.max || null,
          lastSync: table.lastSync,
          syncDuration: table.syncDuration,
          recordsProcessed: table.recordsProcessed,
          changesDetected: table.changesDetected,
          lastError: table.lastError || null,
          syncStatus: table.syncStatus || 'Not Synced',
          dataStatus: table.dataStatus || 'Empty',
          status: table.status || `${table.syncStatus || 'Not Synced'} • ${table.dataStatus || 'Empty'}`,
          syncType: tableConfig?.syncType || table.syncType
        };
      });

      setTables(tablesData);
    } catch (err) {
      console.error('Error fetching tables:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchSyncMetadata, graphqlQuery]);

  // Update a single table's data without full refetch
  const updateTable = useCallback(async (tableName) => {
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

      const data = await graphqlQuery(query, { tableName });
      
      if (!data?.tableMetadata) {
        throw new Error(`Table ${tableName} not found`);
      }

      const table = data.tableMetadata;
      const tableConfig = getTableSource(table.tableName);

      // Calculate loadMethod from tableConfig (not from GraphQL response)
      const loadMethod = tableConfig.type === 'derived' ? 'Batch' : 
                        (tableConfig.isLargeDataset ? 'Batch' : 'Direct');

      // Update the specific table in the tables array
      setTables(prev => prev.map(t => 
        t.tableName === tableName 
          ? {
              ...t,
              loadMethod,
              rowCount: table.rowCount || 0,
              dateRange: table.dateRange || { min: null, max: null },
              actualDataRange: table.actualDataRange || { min: null, max: null },
              latestSnapshotDate: table.latestSnapshotDate || table.dateRange?.max || null,
              lastSync: table.lastSync,
              syncDuration: table.syncDuration,
              recordsProcessed: table.recordsProcessed,
              changesDetected: table.changesDetected,
              lastError: table.lastError || null,
              syncStatus: table.syncStatus || 'Not Synced',
              dataStatus: table.dataStatus || 'Empty',
              status: table.status || `${table.syncStatus || 'Not Synced'} • ${table.dataStatus || 'Empty'}`
            }
          : t
      ));
    } catch (err) {
      console.error(`Error updating table ${tableName}:`, err);
      throw err;
    }
  }, [graphqlQuery]);

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
