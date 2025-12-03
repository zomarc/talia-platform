/**
 * Google Trends Service
 * Handles fetching Google Trends data (what people are searching for) via GraphQL
 */

import queryTracker from './queryTracker';

const GRAPHQL_URL = '/api/graphql';

class GoogleTrendsService {
  constructor() {
    this.graphqlUrl = GRAPHQL_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch Google Trends data for generic cruise holiday search terms
   * @param {Object} filters - Filter options
   * @param {Array<string>} filters.queries - Array of queries to fetch trends for
   * @param {string} filters.startDate - Start date (YYYY-MM-DD)
   * @param {string} filters.endDate - End date (YYYY-MM-DD)
   * @param {string} filters.region - Geographic region ('' = worldwide, 'US', 'GB', 'GR', etc.)
   * @param {string} filters.granularity - 'daily', 'weekly', 'monthly' (default: 'daily')
   * @returns {Promise<Object>} Trends data
   */
  async getTrends(filters = {}) {
    const graphqlQuery = `
      query GetGoogleTrends($filters: GoogleTrendsFilters!) {
        googleTrends(filters: $filters) {
          queries
          series {
            query
            dataPoints {
              id
              searchQuery
              date
              interestScore
              region
              category
            }
            minScore
            maxScore
            avgScore
          }
          dateRange {
            from
            to
          }
          region
          totalDataPoints
        }
      }
    `;

    const variables = {
      filters: {
        queries: filters.queries || ['cruise holidays'],
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.region !== undefined && { region: filters.region || '' }),
        ...(filters.granularity && { granularity: filters.granularity }),
        ...(filters.limit && { limit: filters.limit })
      }
    };

    const completeQuery = queryTracker.trackQuery({
      query: graphqlQuery,
      variables,
      component: 'GoogleTrends',
      purpose: 'Fetch Google Trends data'
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
            console.error('[GoogleTrendsService] GraphQL errors:', errorBody.errors);
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
        console.error('[GoogleTrendsService] GraphQL errors:', result.errors);
        const error = new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
        completeQuery({ error });
        throw error;
      }

      const trendsData = result.data?.googleTrends;

      if (!trendsData) {
        throw new Error('No trends data returned from GraphQL');
      }

      console.log('[GoogleTrendsService] Trends fetched:', {
        queriesCount: trendsData.queries?.length || 0,
        seriesCount: trendsData.series?.length || 0,
        totalDataPoints: trendsData.totalDataPoints || 0
      });

      completeQuery({ data: trendsData });

      return trendsData;
    } catch (error) {
      console.error('[GoogleTrendsService] Error fetching trends:', error);
      completeQuery({ error });
      throw error;
    }
  }

  /**
   * Get list of queries we have trends data for
   * @returns {Promise<Array<string>>} Array of query strings
   */
  async getQueries() {
    const graphqlQuery = `
      query GetGoogleTrendsQueries {
        googleTrendsQueries
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
        console.error('[GoogleTrendsService] GraphQL errors:', result.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
      }

      return result.data?.googleTrendsQueries || [];
    } catch (error) {
      console.error('[GoogleTrendsService] Error fetching queries:', error);
      throw error;
    }
  }

  /**
   * Fetch and store Google Trends data
   * @param {Object} options - Fetch options
   * @param {Array<string>} options.queries - Queries to fetch
   * @param {string} options.startDate - Start date (YYYY-MM-DD)
   * @param {string} options.endDate - End date (YYYY-MM-DD)
   * @param {string} options.region - Geographic region
   * @param {boolean} options.storeResults - Whether to store results in database
   * @returns {Promise<Object>} Trends data
   */
  async fetchTrends(options = {}) {
    const {
      queries = ['cruise holidays'],
      startDate,
      endDate,
      region = '',
      storeResults = true
    } = options;

    const graphqlQuery = `
      mutation FetchGoogleTrends($queries: [String!]!, $startDate: String, $endDate: String, $region: String, $storeResults: Boolean) {
        fetchGoogleTrends(queries: $queries, startDate: $startDate, endDate: $endDate, region: $region, storeResults: $storeResults) {
          queries
          series {
            query
            dataPoints {
              date
              interestScore
            }
            minScore
            maxScore
            avgScore
          }
          dateRange {
            from
            to
          }
          region
          totalDataPoints
        }
      }
    `;

    const variables = {
      queries,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(region && { region }),
      storeResults
    };

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: graphqlQuery, variables }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        console.error('[GoogleTrendsService] GraphQL errors:', result.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
      }

      return result.data?.fetchGoogleTrends;
    } catch (error) {
      console.error('[GoogleTrendsService] Error fetching trends:', error);
      throw error;
    }
  }

  /**
   * Backfill Google Trends data for queries
   * @param {Object} options - Backfill options
   * @param {Array<string>} options.queries - Queries to backfill
   * @param {string} options.startDate - Start date (YYYY-MM-DD)
   * @param {string} options.endDate - End date (YYYY-MM-DD)
   * @param {string} options.region - Geographic region
   * @returns {Promise<Object>} Backfill result
   */
  async backfillTrends(options = {}) {
    const {
      queries = ['cruise holidays'],
      startDate,
      endDate,
      region = ''
    } = options;

    const graphqlQuery = `
      mutation BackfillGoogleTrends($queries: [String!]!, $startDate: String, $endDate: String, $region: String) {
        backfillGoogleTrends(queries: $queries, startDate: $startDate, endDate: $endDate, region: $region) {
          query
          dataPointsStored
          dateRange {
            from
            to
          }
        }
      }
    `;

    const variables = {
      queries,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(region && { region })
    };

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: graphqlQuery, variables }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        console.error('[GoogleTrendsService] GraphQL errors:', result.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
      }

      return result.data?.backfillGoogleTrends;
    } catch (error) {
      console.error('[GoogleTrendsService] Error backfilling trends:', error);
      throw error;
    }
  }
}

// Export singleton instance
const googleTrendsService = new GoogleTrendsService();
export default googleTrendsService;

