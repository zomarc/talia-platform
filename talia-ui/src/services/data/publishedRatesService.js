/**
 * Published Rates Data Service
 * Service for fetching published rates data from Supabase
 * TODO: Migrate to GraphQL when publishedRates query is available
 */

import { supabase } from '../../lib/supabase';
import queryTracker from './queryTracker';

class PublishedRatesService {
  constructor() {
    this.tableName = 'published_rates';
  }

  /**
   * Fetch published rates data from Supabase
   * @param {Object} filters - Query filters (sail_code, ship_code, etc.)
   * @returns {Promise<Array>} Array of published rate records
   */
  async fetch(filters = {}) {
    const { sail_code, ship_code, limit = 1000 } = filters;
    
    const trackQuery = queryTracker.trackQuery({
      query: `SELECT * FROM ${this.tableName}`,
      variables: filters,
      component: 'PublishedRates',
      purpose: 'Fetch published rates data'
    });

    try {
      let query = supabase
        .from(this.tableName)
        .select('*')
        .order('snapshot_date', { ascending: false });

      // Apply filters
      if (sail_code) {
        query = query.eq('sail_code', sail_code);
      }
      if (ship_code) {
        query = query.eq('ship_code', ship_code);
      }
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        trackQuery({ error });
        throw error;
      }

      // Transform data to match expected format (uppercase field names)
      const transformedData = (data || []).map(row => ({
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

      console.log('[PublishedRatesService] Fetched', transformedData.length, 'records from Supabase');
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

