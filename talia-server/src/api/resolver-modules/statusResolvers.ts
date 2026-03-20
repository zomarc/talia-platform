import { supabaseDataService } from '../../services/supabase.js';
import { synapseSyncService } from '../../services/synapse-sync.js';

export const statusQueryResolvers = {
  syncStatus: async (_parent: any, args: any) => {
    const { tableName } = args;
    const status = synapseSyncService.getSyncStatus(tableName);

    if (!status) {
      return null; // No active sync
    }

    return {
      tableName: status.tableName,
      status: status.status,
      startTime: status.startTime,
      duration: status.duration,
      logs: status.logs,
      structuredLogs: status.structuredLogs.map((log: any) => ({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp.toISOString()
      }))
    };
  },

  synapseConnectionStatus: async () => {
    try {
      const result = await synapseSyncService.testConnectionDetailed();
      return {
        online: result.online,
        server: synapseSyncService.synapseConfig.server,
        database: synapseSyncService.synapseConfig.database,
        lastChecked: new Date().toISOString(),
        error: result.error || null
      };
    } catch (error: any) {
      return {
        online: false,
        server: synapseSyncService.synapseConfig.server,
        database: synapseSyncService.synapseConfig.database,
        lastChecked: new Date().toISOString(),
        error: error.message || 'Unknown error'
      };
    }
  },

  supabaseConnectionStatus: async () => {
    try {
      // Test Supabase connection by querying a simple table
      const { error } = await supabaseDataService.client
        .from('operation_metadata')
        .select('operation_name')
        .limit(1);

      const isOnline = !error;
      const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';

      return {
        online: isOnline,
        server: supabaseUrl,
        database: 'postgres',
        lastChecked: new Date().toISOString(),
        error: error ? error.message : null
      };
    } catch (error: any) {
      const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
      return {
        online: false,
        server: supabaseUrl,
        database: 'postgres',
        lastChecked: new Date().toISOString(),
        error: error.message || 'Unknown error'
      };
    }
  },
};
