/**
 * Published Rates Data Service
 * Unified service for fetching published rates data via GraphQL
 */

import queryTracker from './queryTracker';

// Use relative path - Vite proxy handles routing to localhost:4000
const GRAPHQL_URL = '/api/graphql';

class PublishedRatesService {
  constructor() {
    this.graphqlUrl = GRAPHQL_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
    this.tableName = 'published_rates_current_state';
  }

  /**
   * Fetch published rates data via GraphQL tableData query
   * @param {Object} filters - Query filters (sail_code, ship_code, etc.)
   * @returns {Promise<Array>} Array of published rate records
   */
  async fetch(filters = {}) {
    const { sail_code, ship_code, limit = 1000 } = filters;
    
    // Use GraphQL tableData query (generic table access)
    const query = `
      query GetPublishedRates($tableName: String!, $limit: Int) {
        tableData(tableName: $tableName, limit: $limit)
      }
    `;

    const variables = {
      tableName: this.tableName,
      limit
    };

    const trackQuery = queryTracker.trackQuery({
      query,
      variables: { ...variables, filters },
      component: 'PublishedRates',
      purpose: 'Fetch published rates data'
    });

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        trackQuery({ error });
        throw error;
      }

      const result = await response.json();

      if (result.errors) {
        const error = new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        trackQuery({ error });
        throw error;
      }

      // Get raw data from tableData query
      let data = result.data?.tableData || [];

      // Apply client-side filtering (since tableData doesn't support filters)
      if (sail_code) {
        data = data.filter(row => row.sail_code === sail_code);
      }
      if (ship_code) {
        data = data.filter(row => row.ship_code === ship_code);
      }

      // Sort by snapshot_date descending
      data.sort((a, b) => {
        const dateA = new Date(a.snapshot_date || 0);
        const dateB = new Date(b.snapshot_date || 0);
        return dateB - dateA;
      });

      // Limit results
      if (limit) {
        data = data.slice(0, limit);
      }

      // Transform data to match expected format (uppercase field names)
      const transformedData = data.map(row => ({
        SNAPSHOT_DATE: row.snapshot_date,
        SAIL_CODE: row.sail_code,
        SHIP_CODE: row.ship_code,
        PACKAGE_NAME: row.package_name,
        REGION: row.region,
        RATE_TYPE: row.rate_type,
        SAIL_DAYS: row.sail_days,
        DEPARTURE_DATE: row.departure_date,
        CABIN_CATEGORY: row.cabin_category,
        PROMO_NAME: row.promo_name,
        PROMO_TYPE: row.promo_type,
        CURRENCY_CODE: row.currency_code,
        FARE_PER_PERSON: row.fare_per_person,
        PORT_TAXES_SERVICES: row.port_taxes_services,
        EXTRA_ADULT: row.extra_adult,
        EXTRA_CHILD: row.extra_child,
        DISCOUNT: row.discount
      }));

      console.log('[PublishedRatesService] Fetched', transformedData.length, 'records via GraphQL');
      trackQuery({ data: transformedData });
      return transformedData;
    } catch (error) {
      console.error('[PublishedRatesService] Error fetching data:', error);
      trackQuery({ error });
      throw error;
    }
  }

  /**
   * Fetch published rates filtered by sail code
   * @param {string} sailCode - Sail code to filter by
   * @returns {Promise<Array>} Array of published rate records
   */
  async fetchBySailCode(sailCode) {
    return this.fetch({ sail_code: sailCode });
  }
}

// Export singleton instance
const publishedRatesService = new PublishedRatesService();
export default publishedRatesService;

