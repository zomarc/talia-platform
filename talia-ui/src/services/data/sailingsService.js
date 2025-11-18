/**
 * Sailing Data Service
 * Unified service for fetching sailing data via GraphQL
 */

const GRAPHQL_URL = 'http://localhost:4000/graphql';

class SailingsService {
  constructor() {
    this.graphqlUrl = GRAPHQL_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch sailings data via GraphQL
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Array of sailing records
   */
  async fetch(filters = {}) {
    try {
      const { sail_code, ship_name, limit = 100 } = filters;
      
      // Build GraphQL query
      const query = `
        query GetMasterSail($filters: MasterSailFilters) {
          masterSail(filters: $filters) {
            id
            sail_id
            ship_code
            ship_name
            sail_date_from
            port_from
            sail_date_to
            port_to
            package_id
            package_type
            sail_code
            package_name
            sail_days
            geog_area_code
            vacation_date
            season_code
            is_fake
            is_active
            is_package_active
            master_voyage_departure_date
            master_voyage1
            master_voyage1_length
            master_voyage1_sail_days
            master_voyage2
            master_voyage2_length
            master_voyage2_sail_days
            is_main
            is_primary
            created_at
          }
        }
      `;

      // Build variables object
      const variables = {
        filters: {
          ...(sail_code && { sail_code }),
          ...(ship_name && { ship_name }),
          limit
        }
      };

      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          query,
          variables
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      const data = result.data?.masterSail || [];
      console.log('[SailingsService] Fetched', data.length, 'records via GraphQL');
      
      return data;
    } catch (error) {
      console.error('[SailingsService] Error fetching data:', error);
      throw error;
    }
  }

  /**
   * Fetch a single sailing by ID
   * @param {string} sailId - Sail ID
   * @returns {Promise<Object>} Sailing record
   */
  async fetchById(sailId) {
    try {
      const query = `
        query GetMasterSailById($filters: MasterSailFilters) {
          masterSail(filters: $filters) {
            id
            sail_id
            ship_code
            ship_name
            sail_date_from
            port_from
            sail_date_to
            port_to
            package_id
            package_type
            sail_code
            package_name
            sail_days
            geog_area_code
            vacation_date
            season_code
            is_fake
            is_active
            is_package_active
            master_voyage_departure_date
            master_voyage1
            master_voyage1_length
            master_voyage1_sail_days
            master_voyage2
            master_voyage2_length
            master_voyage2_sail_days
            is_main
            is_primary
            created_at
          }
        }
      `;

      const variables = {
        filters: {
          sail_code: sailId,
          limit: 1
        }
      };

      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          query,
          variables
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      const data = result.data?.masterSail || [];
      return data[0] || null;
    } catch (error) {
      console.error('[SailingsService] Error fetching single sailing:', error);
      throw error;
    }
  }

  /**
   * Get available ship names
   * @returns {Promise<Array>} Array of unique ship names
   */
  async getShipNames() {
    try {
      const query = `
        query GetMasterSail {
          masterSail(filters: { limit: 1000 }) {
            ship_name
          }
        }
      `;

      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      const data = result.data?.masterSail || [];
      const uniqueShips = [...new Set(data.map(item => item.ship_name).filter(Boolean))];
      
      return uniqueShips;
    } catch (error) {
      console.error('[SailingsService] Error fetching ship names:', error);
      throw error;
    }
  }
}

// Export singleton instance
const sailingsService = new SailingsService();
export default sailingsService;

