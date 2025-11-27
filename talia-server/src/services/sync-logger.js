/**
 * Structured logger for sync operations
 * This provides a clean interface for collecting logs from sync functions
 * and can be easily extended for future data sources
 */
export class SyncLogger {
  constructor() {
    this.logs = [];
    this.startTime = Date.now();
  }

  /**
   * Log an info message
   */
  info(...args) {
    const message = this.formatMessage(args);
    this.logs.push({ level: 'info', message, timestamp: new Date() });
    console.log(...args);
  }

  /**
   * Log an error message
   */
  error(...args) {
    const message = this.formatMessage(args);
    this.logs.push({ level: 'error', message, timestamp: new Date() });
    console.error(...args);
  }

  /**
   * Log a warning message
   */
  warn(...args) {
    const message = this.formatMessage(args);
    this.logs.push({ level: 'warn', message, timestamp: new Date() });
    console.warn(...args);
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

