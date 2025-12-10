/**
 * Reservations Data Service
 * Unified service for fetching reservation data via GraphQL
 */

import queryTracker from './queryTracker';

// Use relative path - Vite proxy handles routing to localhost:4000
const GRAPHQL_URL = '/api/graphql';

class ReservationsService {
  constructor() {
    this.graphqlUrl = GRAPHQL_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch reservations data via GraphQL
   * @param {Object} filters - Query filters (sail_code, ship, res_status, etc.)
   * @returns {Promise<Array>} Array of reservation records
   */
  async fetch(filters = {}) {
    const { sail_code, ship, res_status, limit = 1000 } = filters;
    
    // Build GraphQL query
    const query = `
      query GetReservations($filters: ReservationFilters) {
        reservations(filters: $filters) {
          id
          res_id
          res_status
          source_code
          res_probability
          pax_type
          pax_status
          ship
          sail_code
          sail_duration
          sail_from_date
          sail_to_date
          agency_id
          sec_agency_id
          agency_channel
          agency_country_code
          agency_market
          cabin_type
          cabin_category
          ticket_type
          promo_code
          currency
          currency_rate
          guest_count
          foc_guest_count
          gross_published_fare
          gross_selling_fare
          net_selling_fare
          cruise_fare_comm
          published_discount
          promotional_discounts
          total_discounts
          gross_ticket_revenue
          net_ticket_revenue
          net_invoice_revenue
          gross_ticket_revenue_eur
          net_ticket_revenue_eur
          net_invoice_revenue_eur
          total_discounts_eur
          created_at
        }
      }
    `;

    const variables = {
      filters: {
        ...(sail_code && { sail_code }),
        ...(ship && { ship }),
        ...(res_status && { res_status }),
        limit
      }
    };

    const trackQuery = queryTracker.trackQuery({
      query,
      variables,
      component: 'ReservationCurrentState',
      purpose: 'Fetch reservation data'
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

      const data = result.data?.reservations || [];
      console.log('[ReservationsService] Fetched', data.length, 'reservations');
      trackQuery({ data });
      return data;
    } catch (error) {
      trackQuery({ error });
      console.error('[ReservationsService] Error:', error);
      throw error;
    }
  }
}

export default new ReservationsService();

