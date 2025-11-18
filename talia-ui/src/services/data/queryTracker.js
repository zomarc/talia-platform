/**
 * Query Tracker Service
 * Intercepts and tracks GraphQL queries for monitoring and debugging
 */

class QueryTracker {
  constructor() {
    this.queries = [];
    this.maxQueries = 50;
    this.listeners = new Set();
  }

  /**
   * Track a GraphQL query
   * @param {Object} queryInfo - Query information
   * @param {string} queryInfo.query - GraphQL query string
   * @param {Object} queryInfo.variables - Query variables
   * @param {string} queryInfo.component - Component name making the query
   * @param {string} queryInfo.purpose - Purpose of the query
   * @returns {Function} Function to call when query completes
   */
  trackQuery({ query, variables = {}, component = 'Unknown', purpose = 'Data fetch' }) {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    const queryId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

    const queryRecord = {
      id: queryId,
      query: query.trim(),
      variables,
      component,
      purpose,
      timestamp,
      startTime,
      status: 'pending',
      duration: null,
      responseSize: null,
      error: null
    };

    this.queries.unshift(queryRecord);
    if (this.queries.length > this.maxQueries) {
      this.queries.pop();
    }

    this.notifyListeners();

    // Return completion function
    return (result) => {
      const endTime = performance.now();
      queryRecord.duration = endTime - startTime;
      queryRecord.status = result.error ? 'error' : 'success';
      
      if (result.error) {
        queryRecord.error = result.error.message || String(result.error);
      } else {
        const responseString = JSON.stringify(result.data || result);
        queryRecord.responseSize = new Blob([responseString]).size;
      }

      this.notifyListeners();
      return queryRecord;
    };
  }

  /**
   * Get all queries
   */
  getQueries() {
    return [...this.queries];
  }

  /**
   * Get queries filtered by component
   */
  getQueriesByComponent(componentName) {
    return this.queries.filter(q => q.component === componentName);
  }

  /**
   * Get recent queries (last N)
   */
  getRecentQueries(count = 10) {
    return this.queries.slice(0, count);
  }

  /**
   * Clear all queries
   */
  clearQueries() {
    this.queries = [];
    this.notifyListeners();
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const successfulQueries = this.queries.filter(q => q.status === 'success' && q.duration !== null);
    const failedQueries = this.queries.filter(q => q.status === 'error');

    const avgDuration = successfulQueries.length > 0
      ? successfulQueries.reduce((sum, q) => sum + q.duration, 0) / successfulQueries.length
      : 0;

    const totalSize = successfulQueries.reduce((sum, q) => sum + (q.responseSize || 0), 0);

    return {
      totalQueries: this.queries.length,
      successfulQueries: successfulQueries.length,
      failedQueries: failedQueries.length,
      successRate: this.queries.length > 0 
        ? (successfulQueries.length / this.queries.length * 100).toFixed(1)
        : 0,
      avgDuration: Math.round(avgDuration),
      totalDataSize: totalSize,
      avgDataSize: successfulQueries.length > 0 
        ? Math.round(totalSize / successfulQueries.length)
        : 0
    };
  }

  /**
   * Subscribe to query updates
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.queries);
      } catch (error) {
        console.error('QueryTracker listener error:', error);
      }
    });
  }

  /**
   * Format query for display
   */
  formatQuery(queryString) {
    try {
      // Simple formatting - indent based on braces
      let indent = 0;
      const indentSize = 2;
      return queryString
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          
          // Decrease indent before closing braces
          if (trimmed.startsWith('}')) indent = Math.max(0, indent - indentSize);
          
          const formatted = ' '.repeat(indent) + trimmed;
          
          // Increase indent after opening braces
          if (trimmed.endsWith('{')) indent += indentSize;
          
          return formatted;
        })
        .filter(line => line.length > 0)
        .join('\n');
    } catch (error) {
      return queryString;
    }
  }
}

// Export singleton instance
const queryTracker = new QueryTracker();
export default queryTracker;

