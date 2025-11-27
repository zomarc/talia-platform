/**
 * SyncOperation - Wraps sync functions with logging, error handling, and metadata tracking
 * 
 * This class separates logging concerns from sync logic:
 * - Sync functions focus only on data transformation
 * - Logging happens at the wrapper level
 * - Same sync function works in UI and terminal contexts
 */

import { SyncLogger } from './sync-logger.js';

export class SyncOperation {
  constructor(syncFunction, logger = null, context = {}) {
    this.syncFunction = syncFunction;
    this.logger = logger || new SyncLogger();
    this.context = context; // { tableName, syncType, etc. }
  }

  /**
   * Execute the sync function with logging wrapper
   * @param {Object} params - Parameters to pass to sync function
   * @returns {Promise<Object>} Sync result with logging attached
   */
  async execute(params) {
    const startTime = Date.now();
    const { tableName, syncType } = this.context;
    
    // Pre-execution logging
    this.logger.info(`🔄 Starting sync for table: ${tableName || syncType || 'unknown'}`);
    if (params.dateRange) {
      this.logger.info(`📅 Date range: ${params.dateRange.from} to ${params.dateRange.to}`);
    }
    if (params.forceFullSync) {
      this.logger.info(`⚡ Force full sync enabled`);
    }

    try {
      // Execute sync function
      // Pass logger so sync functions can define local log functions (per SYNC_PRINCIPLES.md)
      // Sync functions should define log functions but not use them - SyncOperation handles all logging
      const result = await this.syncFunction({
        ...params,
        logger: this.logger // Pass logger for consistency, but sync functions shouldn't use it
      });

      const duration = Date.now() - startTime;
      
      // Post-execution logging
      if (result.success) {
        const details = [];
        if (result.recordsProcessed !== null && result.recordsProcessed !== undefined) {
          details.push(`${result.recordsProcessed.toLocaleString()} records processed`);
        }
        if (result.recordsUpdated !== null && result.recordsUpdated !== undefined) {
          details.push(`${result.recordsUpdated.toLocaleString()} changes detected`);
        }
        if (result.changesDetected !== null && result.changesDetected !== undefined) {
          details.push(`${result.changesDetected.toLocaleString()} changes detected`);
        }
        details.push(`duration: ${duration}ms`);
        
        this.logger.info(`✅ Sync completed successfully: ${details.join(', ')}`);
      } else {
        this.logger.error(`❌ Sync failed: ${result.message || result.error || 'Unknown error'}`);
      }

      // Attach logs to result
      return {
        ...result,
        detailedLogs: this.logger.getLogs(),
        duration: result.duration || duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Error logging - ensure logger exists
      if (this.logger) {
        try {
          this.logger.error(`❌ Sync failed with exception:`, error.message);
          if (error.stack) {
            this.logger.debug(`Stack trace:`, error.stack);
          }
        } catch (logError) {
          // If logging fails, at least log to console
          console.error(`❌ Sync failed with exception:`, error.message);
          console.error(`❌ Logging error:`, logError.message);
        }
      } else {
        console.error(`❌ Sync failed with exception:`, error.message);
      }

      // Return error result with logs
      return {
        success: false,
        tableName: tableName || params.tableName,
        recordsProcessed: 0,
        duration,
        error: error.message,
        message: `Sync failed: ${error.message}`,
        detailedLogs: this.logger ? this.logger.getLogs() : [`Sync failed: ${error.message}`]
      };
    }
  }

  /**
   * Get the logger instance (for progress updates during sync)
   */
  getLogger() {
    return this.logger;
  }
}

