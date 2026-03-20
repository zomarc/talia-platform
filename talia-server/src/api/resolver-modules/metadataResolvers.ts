import { supabaseDataService } from '../../services/supabase.js';

export const metadataQueryResolvers = {
  syncMetadata: async () => {
    try {
      // Get all sync operations from unified table
      const { data, error } = await supabaseDataService.client
        .from('operation_metadata')
        .select('*')
        .eq('operation_type', 'sync');

      if (error) {
        console.error('Error fetching sync metadata:', error);
        return [];
      }

      // Map unified schema to legacy format for backward compatibility
      return (data || []).map((record: any) => ({
        sync_type: record.operation_name,
        last_sync_at: record.last_run_at,
        duration_ms: record.duration_ms,
        records_processed: record.records_processed,
        changes_detected: record.changes_detected,
        status: record.status,
        error: record.error
      }));
    } catch (error: any) {
      console.error('Error in syncMetadata resolver:', error);
      return [];
    }
  },
};
