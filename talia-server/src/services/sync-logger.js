/**
 * Structured logger for sync operations
 * This provides a clean interface for collecting logs from sync functions
 * and can be easily extended for future data sources
 */
export class SyncLogger {
  constructor(tableName = null, eventEmitter = null) {
    this.logs = [];
    this.startTime = Date.now();
    this.tableName = tableName;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Log an info message
   */
  info(...args) {
    const message = this.formatMessage(args);
    this.logs.push({ level: 'info', message, timestamp: new Date() });
    console.log(...args);
    
    // Emit event if eventEmitter is available
    // CRITICAL: Always emit events for server logs - this is how the UI receives logs
    if (this.eventEmitter && this.tableName) {
      this.eventEmitter.emitLog(this.tableName, { level: 'info', message });
    } else {
      // Debug: Log when eventEmitter or tableName is missing (should never happen in production)
      console.error('[SyncLogger] ERROR: Cannot emit log event - missing eventEmitter or tableName:', {
        hasEventEmitter: !!this.eventEmitter,
        hasTableName: !!this.tableName,
        tableName: this.tableName,
        message
      });
    }
  }

  /**
   * Log an error message
   */
  error(...args) {
    const message = this.formatMessage(args);
    this.logs.push({ level: 'error', message, timestamp: new Date() });
    console.error(...args);
    
    // Emit event if eventEmitter is available
    if (this.eventEmitter && this.tableName) {
      this.eventEmitter.emitError(this.tableName, { message, error: message });
    }
  }

  /**
   * Log a warning message
   */
  warn(...args) {
    const message = this.formatMessage(args);
    this.logs.push({ level: 'warn', message, timestamp: new Date() });
    console.warn(...args);
    
    // Emit event if eventEmitter is available
    if (this.eventEmitter && this.tableName) {
      this.eventEmitter.emitLog(this.tableName, { level: 'warn', message });
    }
  }

  /**
   * Log a debug message (only collected, not printed to console)
   */
  debug(...args) {
    const message = this.formatMessage(args);
    this.logs.push({ level: 'debug', message, timestamp: new Date() });
  }

  /**
   * Format message arguments into a single string
   */
  formatMessage(args) {
    return args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
  }

  /**
   * Get all collected logs as an array of strings (for UI display)
   */
  getLogs() {
    return this.logs.map(log => {
      const prefix = log.level === 'error' ? '[ERROR]' : log.level === 'warn' ? '[WARN]' : '';
      return prefix ? `${prefix} ${log.message}` : log.message;
    });
  }

  /**
   * Get structured logs (for advanced use cases)
   */
  getStructuredLogs() {
    return this.logs;
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
  }

  /**
   * Get duration since logger was created
   */
  getDuration() {
    return Date.now() - this.startTime;
  }
}

