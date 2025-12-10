import sql from 'mssql';

/**
 * Generic Sync Metadata Service
 * 
 * Handles all metadata operations for data synchronization.
 * This service is generic and reusable across all table syncs.
 * 
 * Key Principles:
 * - Always check source for latest snapshot date first
 * - Store latest available snapshot date for reference
 * - Track last processed snapshot date (not departure date)
 * - Always update last_sync_at when sync runs (even if no data)
 */
export class SyncMetadataService {
  /**
   * Get the latest snapshot date available in the source table
   * This should be called FIRST before any sync operation
   * Returns datetime at midnight (00:00:00) for the date
   * 
   * @param {Object} synapseConfig - Azure Synapse connection config
   * @param {string} sourceTable - Source table name (e.g., 'stg.COMPETITOR')
   * @param {string} snapshotColumn - Snapshot date column name (e.g., 'Snapshot_Date')
   * @returns {Promise<string|null>} Latest snapshot datetime as ISO string (YYYY-MM-DDTHH:mm:ss.sssZ) or null
   */
  static async getLatestSnapshotDate(synapseConfig, sourceTable, snapshotColumn) {
    // CRITICAL: sql.connect() creates/returns a GLOBAL connection pool singleton
    // We should reuse the existing pool if available, or let the caller manage it
    // DO NOT close the pool here - it will break subsequent operations
    let pool = null;
    try {
      // Check if a pool already exists for this config
      // sql.connect() returns the existing global pool if one exists
      pool = await sql.connect(synapseConfig);
      
      const query = `
        SELECT MAX(${snapshotColumn}) as latest_snapshot_date
        FROM ${sourceTable}
      `;
      
      const result = await pool.request().query(query);
      const latestDate = result.recordset[0]?.latest_snapshot_date;
      
      if (!latestDate) {
        return null;
      }
      
      // Convert to datetime at midnight (00:00:00) for the date
      const date = new Date(latestDate);
      date.setHours(0, 0, 0, 0); // Set to midnight
      return date.toISOString();
    } catch (error) {
      console.error(`Error getting latest snapshot date from ${sourceTable}:`, error.message);
      throw error;
    }
    // DO NOT close the pool - sql.connect() returns a global singleton
    // Closing it here would break the main sync operation that uses the same pool
  }

  /**
   * Get sync metadata for a specific sync type
   * 
   * @param {Object} supabaseClient - Supabase client instance
   * @param {string} syncType - Sync type identifier (e.g., 'competitor')
   * @returns {Promise<Object|null>} Metadata record or null
   */
  static async getSyncMetadata(supabaseClient, syncType) {
    const { data, error } = await supabaseClient
      .from('operation_metadata')
      .select('*')
      .eq('operation_type', 'sync')
      .eq('operation_name', syncType)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to get sync metadata: ${error.message}`);
    }

    // Map unified schema back to legacy format for backward compatibility
    if (data) {
      return {
        sync_type: data.operation_name,
        last_processed_date: data.last_processed_date,
        last_processed_snapshot_date: data.last_processed_date ? new Date(data.last_processed_date).toISOString() : null,
        last_sync_at: data.last_run_at,
        records_processed: data.records_processed,
        changes_detected: data.changes_detected,
        duration_ms: data.duration_ms,
        status: data.status,
        error: data.error,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    }

    return null;
  }

  /**
   * Get the last processed snapshot date
   * 
   * @param {Object} supabaseClient - Supabase client instance
   * @param {string} syncType - Sync type identifier
   * @returns {Promise<string|null>} Last processed snapshot datetime (ISO string) or null
   */
  static async getLastProcessedSnapshotDate(supabaseClient, syncType) {
    const metadata = await this.getSyncMetadata(supabaseClient, syncType);
    if (!metadata?.last_processed_date) {
      return null;
    }
    // Ensure it's returned as ISO string
    const date = new Date(metadata.last_processed_date);
    date.setHours(0, 0, 0, 0); // Set to midnight
    return date.toISOString();
  }

  /**
   * Update sync metadata after a sync operation
   * 
   * @param {Object} supabaseClient - Supabase client instance
   * @param {string} syncType - Sync type identifier
   * @param {string} lastProcessedSnapshotDate - Last snapshot datetime actually processed (ISO string)
   * @param {string} latestAvailableSnapshotDate - Latest snapshot datetime available in source (ISO string)
   * @param {number} recordsProcessed - Number of records processed
   * @param {number} changesDetected - Number of changes detected (for derived tables)
   * @param {number} durationMs - Sync duration in milliseconds
   * @param {string} dataset - Dataset name that was synced
   */
  static async updateSyncMetadata(
    supabaseClient,
    syncType,
    lastProcessedSnapshotDate,
    latestAvailableSnapshotDate,
    recordsProcessed,
    changesDetected = 0,
    durationMs = null,
    dataset = null
  ) {
    const now = new Date().toISOString();
    
    // Ensure snapshot dates are datetime at midnight if they're date strings
    const formatSnapshotDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0); // Set to midnight
      return date.toISOString();
    };
    
    // Convert snapshot dates to DATE format for last_processed_date
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    const { error } = await supabaseClient
      .from('operation_metadata')
      .upsert({
        operation_type: 'sync',
        operation_name: syncType,
        last_run_at: now,
        status: 'completed',
        duration_ms: durationMs,
        last_processed_date: formatDate(lastProcessedSnapshotDate),
        records_processed: recordsProcessed,
        changes_detected: changesDetected,
        metadata: {
          latest_available_snapshot_date: formatSnapshotDate(latestAvailableSnapshotDate),
          dataset: dataset
        },
        updated_at: now
      }, {
        onConflict: 'operation_type,operation_name'
      });

    if (error) {
      throw new Error(`Failed to update sync metadata: ${error.message}`);
    }
  }

  /**
   * Update sync metadata even when no data was processed
   * This ensures last_sync_at is always updated
   * 
   * @param {Object} supabaseClient - Supabase client instance
   * @param {string} syncType - Sync type identifier
   * @param {string} latestAvailableSnapshotDate - Latest snapshot datetime available in source (ISO string)
   * @param {string} lastProcessedSnapshotDate - Last processed snapshot datetime (may be same as before) (ISO string)
   * @param {number} durationMs - Sync duration in milliseconds
   * @param {string} dataset - Dataset name that was synced
   */
  static async updateSyncMetadataNoData(
    supabaseClient,
    syncType,
    latestAvailableSnapshotDate,
    lastProcessedSnapshotDate,
    durationMs = null,
    dataset = null
  ) {
    await this.updateSyncMetadata(
      supabaseClient,
      syncType,
      lastProcessedSnapshotDate,
      latestAvailableSnapshotDate,
      0,
      0,
      durationMs,
      dataset
    );
  }
}

