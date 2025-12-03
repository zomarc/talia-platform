/**
 * Competitor Pricing Service
 * Fetches competitor pricing data from GraphQL API
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';

const GET_COMPETITOR_PRICING = gql`
  query GetCompetitorPricing($filters: CompetitorPricingFilters) {
    competitorPricing(filters: $filters) {
      id
      cruiseLine
      currency
      shipCode
      shipName
      cabinType
      departureDate
      departurePort
      destination
      market
      duration
      pppd
      totalRatePP
      snapshotDate
      availableOffer
      itineraryCode
    }
  }
`;

class CompetitorPricingService {
  /**
   * Fetch competitor pricing data with filters
   * @param {Object} filters - Filter options
   * @param {string} filters.currency - Currency code (e.g., "EUR")
   * @param {number} filters.duration - Cruise duration
   * @param {string} filters.destination - Destination (e.g., "Med")
   * @param {string} filters.cabinType - Cabin type ("ALL", "INSIDE", "OUTSIDE", "BALCONY", "SUITE")
   * @param {number} filters.departureMonth - Month number (1-12)
   * @param {boolean} filters.isLatest - Only latest snapshot
   * @param {string} filters.cruiseLine - Cruise line name
   * @param {string} filters.market - Market code
   * @returns {Promise<Array>} Array of competitor pricing data
   */
  async fetch(filters = {}) {
    try {
      // Remove null/undefined values from filters to avoid GraphQL errors
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== null && value !== undefined && value !== '')
      );
      
      // Only include filters in variables if there are actual filter values
      const variables = Object.keys(cleanFilters).length > 0 ? { filters: cleanFilters } : {};
      
      const { data, errors } = await apolloClient.query({
        query: GET_COMPETITOR_PRICING,
        variables,
        fetchPolicy: 'network-only',
        errorPolicy: 'all' // Return both data and errors
      });
      
      if (errors && errors.length > 0) {
        console.error('[CompetitorPricingService] GraphQL errors:', errors);
        throw new Error(`GraphQL errors: ${errors.map(e => e.message).join(', ')}`);
      }
      
      if (!data || !data.competitorPricing) {
        console.warn('[CompetitorPricingService] No data returned from query');
        return [];
      }
      
      return data.competitorPricing || [];
    } catch (error) {
      console.error('[CompetitorPricingService] Error fetching data:', error);
      if (error.graphQLErrors) {
        console.error('[CompetitorPricingService] GraphQL errors:', error.graphQLErrors);
      }
      if (error.networkError) {
        console.error('[CompetitorPricingService] Network error:', error.networkError);
      }
      throw error;
    }
  }
}

export default new CompetitorPricingService();

