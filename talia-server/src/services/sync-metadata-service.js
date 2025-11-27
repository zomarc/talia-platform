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
    let pool = null;
    try {
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
    } finally {
      if (pool) {
        await pool.close();
      }
    }
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
      .from('sync_metadata')
      .select('*')
      .eq('sync_type', syncType)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to get sync metadata: ${error.message}`);
    }

    return data || null;
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
    if (!metadata?.last_processed_snapshot_date) {
      return null;
    }
    // Ensure it's returned as ISO string
    return new Date(metadata.last_processed_snapshot_date).toISOString();
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
    
    const { error } = await supabaseClient
      .from('sync_metadata')
      .upsert({
        sync_type: syncType,
        last_processed_snapshot_date: formatSnapshotDate(lastProcessedSnapshotDate),
        latest_available_snapshot_date: formatSnapshotDate(latestAvailableSnapshotDate),
        dataset: dataset,
        records_processed: recordsProcessed,
        changes_detected: changesDetected,
        duration_ms: durationMs,
        last_sync_at: now,
        updated_at: now
      }, {
        onConflict: 'sync_type'
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

