type BuildTableCatalogResolversDeps = {
  supabaseDataService: any;
  configService: any;
  fetchActualDataRange: (tableName: string, rowCount: number) => Promise<{ min: string | null; max: string | null }>;
  fetchLatestAvailableData: (tableName: string, rowCount: number) => Promise<string | null>;
  getOperationMetadataKeysForTable: (tableName: string) => string[];
  getSyncTypeForTable: (tableName: string) => string;
  hasSyncConfigForTable: (tableName: string) => boolean;
};

export const buildTableCatalogQueryResolvers = ({
  supabaseDataService,
  configService,
  fetchActualDataRange,
  fetchLatestAvailableData,
  getOperationMetadataKeysForTable,
  getSyncTypeForTable,
  hasSyncConfigForTable
}: BuildTableCatalogResolversDeps) => ({
  databaseTables: async () => {
    try {
      const activeDateRange = await configService.getActiveDateRange('synapse_default');
      const configuredDateRange = activeDateRange ? {
        min: activeDateRange.date_from,
        max: activeDateRange.date_to
      } : { min: null, max: null };

      const knownTables = [
        'ship', 'cabin_availability', 'reservation', 'master_sail',
        'sail_by_cabin_occupancy', 'reservation_changes', 'reservation_current_state',
        'reservation_promotion', 'published_rates', 'published_rates_changes',
        'published_rates_current_state', 'competitor', 'competitor_current_state',
        'cabin_allocation', 'itinerary', 'gql_cabin_availability', 'sail_header',
        'ship_cabin', 'sync_metadata', 'focuses', 'google_trends_data',
        'google_trends_search_terms', 'data_refresh_metadata',
        'booking_targets_supplied', 'target_profiles', 'target_mapping_config',
        'inventory_item_profile_curve_point'
      ];

      const { data: syncData } = await supabaseDataService.client
        .from('operation_metadata')
        .select('*')
        .eq('operation_type', 'sync');

      const syncMetadataMap: Record<string, any> = {};
      if (syncData) {
        syncData.forEach((record: any) => {
          const key = record.operation_name;
          const existing = syncMetadataMap[key];
          const recordTime = record.last_run_at ? Date.parse(record.last_run_at) : 0;
          const existingTime = existing?.last_sync_at ? Date.parse(existing.last_sync_at) : 0;
          if (!existing || recordTime > existingTime) {
            syncMetadataMap[key] = {
              sync_type: record.operation_name,
              last_sync_at: record.last_run_at,
              duration_ms: record.duration_ms,
              records_processed: record.records_processed,
              changes_detected: record.changes_detected,
              status: record.status,
              error: record.error,
              last_processed_date: record.last_processed_date,
              latest_available_snapshot_date: record.metadata?.latest_available_snapshot_date || null
            };
          }
        });
      }

      const tablePromises = knownTables.map(async (tableName) => {
        try {
          const { count, error: countError } = await supabaseDataService.client
            .from(tableName)
            .select('*', { count: 'exact', head: true })
            .limit(0);

          if (countError) return null;

          const rowCount = count || 0;
          const actualDataRange = await fetchActualDataRange(tableName, rowCount);
          const latestAvailableData = await fetchLatestAvailableData(tableName, rowCount);
          const dateRange = configuredDateRange;

          const operationKeys = getOperationMetadataKeysForTable(tableName);
          const syncRecord = operationKeys
            .map((key) => syncMetadataMap[key])
            .find(Boolean);

          let latestSnapshotDate: string | null = null;
          if (syncRecord) {
            latestSnapshotDate = syncRecord.latest_available_snapshot_date ||
              (syncRecord.last_processed_date ? new Date(syncRecord.last_processed_date).toISOString() : null);
          }

          const lastSync = syncRecord?.last_sync_at || null;

          return {
            tableName,
            hasSyncConfig: hasSyncConfigForTable(tableName),
            source: null,
            type: null,
            loadMethod: null,
            rowCount,
            dateRange,
            actualDataRange,
            latestSnapshotDate,
            latestAvailableData,
            lastSync,
            syncDuration: syncRecord?.duration_ms || null,
            recordsProcessed: syncRecord?.records_processed || null,
            changesDetected: syncRecord?.changes_detected || null,
            lastError: syncRecord?.error || null,
            syncStatus: syncRecord ? (lastSync ? 'Synced' : 'Never Synced') : 'Not Synced',
            dataStatus: rowCount === 0 ? 'Empty' : 'Has Data',
            status: `${syncRecord ? (lastSync ? 'Synced' : 'Never Synced') : 'Not Synced'} • ${rowCount === 0 ? 'Empty' : 'Has Data'}`,
            syncType: getSyncTypeForTable(tableName)
          };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(tablePromises);
      return results.filter(Boolean);
    } catch (error: any) {
      console.error('Error in databaseTables resolver:', error);
      return [];
    }
  },

  tableMetadata: async (_parent: any, args: any) => {
    const { tableName } = args;
    try {
      const { count, error: countError } = await supabaseDataService.client
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw new Error(`Table ${tableName} not found or error: ${countError.message}`);
      }

      const rowCount = count || 0;
      const activeDateRange = await configService.getActiveDateRange('synapse_default');
      const dateRange = activeDateRange ? {
        min: activeDateRange.date_from,
        max: activeDateRange.date_to
      } : { min: null, max: null };

      const actualDataRange = await fetchActualDataRange(tableName, rowCount);
      const latestAvailableData = await fetchLatestAvailableData(tableName, rowCount);

      const operationKeys = getOperationMetadataKeysForTable(tableName);
      const { data: syncData } = await supabaseDataService.client
        .from('operation_metadata')
        .select('*')
        .eq('operation_type', 'sync')
        .in('operation_name', operationKeys)
        .order('last_run_at', { ascending: false, nullsFirst: false });

      const toTimestamp = (value: any) => {
        if (!value) return 0;
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const syncRecord = (syncData || []).reduce((latest: any, current: any) => {
        if (!latest) return current;
        const latestTs = Math.max(
          toTimestamp(latest.last_run_at),
          toTimestamp(latest.updated_at),
          toTimestamp(latest.created_at)
        );
        const currentTs = Math.max(
          toTimestamp(current.last_run_at),
          toTimestamp(current.updated_at),
          toTimestamp(current.created_at)
        );
        return currentTs > latestTs ? current : latest;
      }, null);

      let latestSnapshotDate: string | null = null;
      if (syncRecord) {
        latestSnapshotDate = syncRecord.metadata?.latest_available_snapshot_date ||
          (syncRecord.last_processed_date ? new Date(syncRecord.last_processed_date).toISOString() : null);
      }

      const lastSync = syncRecord?.last_run_at || null;

      return {
        tableName,
        hasSyncConfig: hasSyncConfigForTable(tableName),
        source: null,
        type: null,
        loadMethod: null,
        rowCount,
        dateRange,
        actualDataRange,
        latestSnapshotDate,
        latestAvailableData,
        lastSync,
        syncDuration: syncRecord?.duration_ms || null,
        recordsProcessed: syncRecord?.records_processed || null,
        changesDetected: syncRecord?.changes_detected || null,
        lastError: syncRecord?.error || null,
        syncStatus: syncRecord ? (lastSync ? 'Synced' : 'Never Synced') : 'Not Synced',
        dataStatus: rowCount === 0 ? 'Empty' : 'Has Data',
        status: `${syncRecord ? (lastSync ? 'Synced' : 'Never Synced') : 'Not Synced'} • ${rowCount === 0 ? 'Empty' : 'Has Data'}`,
        syncType: getSyncTypeForTable(tableName)
      };
    } catch (error: any) {
      console.error(`Error in tableMetadata resolver for ${tableName}:`, error);
      throw error;
    }
  },
});
