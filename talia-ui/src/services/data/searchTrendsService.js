/**
 * Search Trends Service
 * Handles fetching Google search trends data via GraphQL
 */

import queryTracker from './queryTracker';

const GRAPHQL_URL = '/api/graphql';

class SearchTrendsService {
  constructor() {
    this.graphqlUrl = GRAPHQL_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch search trends data
   * @param {Object} filters - Filter options
   * @param {Array<string>} filters.queries - Array of queries to track
   * @param {string} filters.query - Single query to track
   * @param {string} filters.dateFrom - Start date (YYYY-MM-DD)
   * @param {string} filters.dateTo - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Trends data
   */
  async getTrends(filters = {}) {
    const graphqlQuery = `
      query GetSearchTrends($filters: GoogleSearchTrendFilters!) {
        googleSearchTrends(filters: $filters) {
          queries
          series {
            query
            dataPoints {
              date
              totalResults
              searchTime
              timestamp
            }
            latestCount
            change
            changePercent
          }
          dateRange {
            from
            to
          }
          totalDataPoints
        }
      }
    `;

    const variables = {
      filters: {
        ...(filters.queries && { queries: filters.queries }),
        ...(filters.query && { query: filters.query }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.limit && { limit: filters.limit })
      }
    };

    const completeQuery = queryTracker.trackQuery({
      query: graphqlQuery,
      variables,
      component: 'SearchTrends',
      purpose: 'Fetch Google search trends'
    });

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: graphqlQuery, variables }),
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorBody = await response.clone().json();
          if (errorBody.errors) {
            errorDetails = ` GraphQL errors: ${JSON.stringify(errorBody.errors, null, 2)}`;
            console.error('[SearchTrendsService] GraphQL errors:', errorBody.errors);
          }
        } catch (e) {
          const errorText = await response.clone().text();
          errorDetails = ` Response: ${errorText.substring(0, 200)}`;
        }
        const error = new Error(`HTTP error! status: ${response.status}${errorDetails}`);
        completeQuery({ error });
        throw error;
      }

      const result = await response.json();

      if (result.errors) {
        console.error('[SearchTrendsService] GraphQL errors:', result.errors);
        const error = new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
        completeQuery({ error });
        throw error;
      }

      const trendsData = result.data?.googleSearchTrends;

      if (!trendsData) {
        throw new Error('No trends data returned from GraphQL');
      }

      console.log('[SearchTrendsService] Trends fetched:', {
        queriesCount: trendsData.queries?.length || 0,
        seriesCount: trendsData.series?.length || 0,
        totalDataPoints: trendsData.totalDataPoints || 0
      });

      completeQuery({ data: trendsData });

      return trendsData;
    } catch (error) {
      console.error('[SearchTrendsService] Error fetching trends:', error);
      completeQuery({ error });
      throw error;
    }
  }

  /**
   * Get list of tracked queries
   * @returns {Promise<Array<string>>} Array of query strings
   */
  async getTrackedQueries() {
    const graphqlQuery = `
      query GetTrackedQueries {
        trackedSearchQueries
      }
    `;

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: graphqlQuery }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        console.error('[SearchTrendsService] GraphQL errors:', result.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
      }

      return result.data?.trackedSearchQueries || [];
    } catch (error) {
      console.error('[SearchTrendsService] Error fetching tracked queries:', error);
      throw error;
    }
  }
}

// Export singleton instance
const searchTrendsService = new SearchTrendsService();
export default searchTrendsService;

