import { supabaseDataService } from '../../services/supabase.js';

export const refreshQueryResolvers = {
  refreshMetadata: async (_parent: any, args: any) => {
    const { dataSource } = args;
    try {
      const metadata = await supabaseDataService.getRefreshMetadata(dataSource);
      if (!metadata) {
        // Return default metadata if not found (table may not exist yet)
        return {
          dataSource,
          lastRefreshedAt: null,
          refreshStatus: 'idle',
          refreshError: null,
          recordsUpdated: 0,
          metadata: {}
        };
      }
      return {
        dataSource: metadata.data_source || metadata.operation_name,
        lastRefreshedAt: metadata.last_refreshed_at || metadata.last_run_at,
        refreshStatus: metadata.refresh_status || metadata.status || 'idle',
        refreshError: metadata.refresh_error || metadata.error,
        recordsUpdated: metadata.records_updated || 0,
        metadata: metadata.metadata || {}
      };
    } catch (error: any) {
      // Don't throw - return default metadata instead
      console.warn('Error fetching refresh metadata (table may not exist yet):', error.message);
      return {
        dataSource,
        lastRefreshedAt: null,
        refreshStatus: 'idle',
        refreshError: null,
        recordsUpdated: 0,
        metadata: {}
      };
    }
  },
};
