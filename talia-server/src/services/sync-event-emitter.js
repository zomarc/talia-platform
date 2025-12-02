/**
 * Sync Event Emitter
 * 
 * Provides event emission for sync operations to enable real-time updates
 * via Server-Sent Events (SSE) or GraphQL Subscriptions.
 * 
 * Events are emitted per table name, allowing multiple clients to subscribe
 * to specific table syncs.
 */

import { EventEmitter } from 'events';

class SyncEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent listeners
  }

  /**
   * Emit a sync log event
   * @param {string} tableName - The table being synced
   * @param {object} logData - Log data { level: 'info'|'error'|'warn', message: string }
   */
  emitLog(tableName, logData) {
    this.emit(`sync-${tableName}`, {
      type: 'log',
      tableName,
      timestamp: new Date().toISOString(),
      data: logData
    });
  }

  /**
   * Emit a sync progress event
   * @param {string} tableName - The table being synced
   * @param {object} progressData - Progress data { current: number, total: number, percentage: number, type: string }
   */
  emitProgress(tableName, progressData) {
    this.emit(`sync-${tableName}`, {
      type: 'progress',
      tableName,
      timestamp: new Date().toISOString(),
      data: progressData
    });
  }

  /**
   * Emit a sync complete event
   * @param {string} tableName - The table being synced
   * @param {object} completeData - Complete data { success: boolean, recordsProcessed: number, duration: number }
   */
  emitComplete(tableName, completeData) {
    this.emit(`sync-${tableName}`, {
      type: 'complete',
      tableName,
      timestamp: new Date().toISOString(),
      data: completeData
    });
  }

  /**
   * Emit a sync error event
   * @param {string} tableName - The table being synced
   * @param {object} errorData - Error data { message: string, error: string }
   */
  emitError(tableName, errorData) {
    this.emit(`sync-${tableName}`, {
      type: 'error',
      tableName,
      timestamp: new Date().toISOString(),
      data: errorData
    });
  }

  /**
   * Subscribe to events for a specific table
   * @param {string} tableName - The table to subscribe to
   * @param {function} callback - Callback function(event)
   * @returns {function} Unsubscribe function
   */
  subscribe(tableName, callback) {
    const eventName = `sync-${tableName}`;
    this.on(eventName, callback);
    
    // Return unsubscribe function
    return () => {
      this.off(eventName, callback);
    };
  }
}

// Export singleton instance
export const syncEventEmitter = new SyncEventEmitter();

