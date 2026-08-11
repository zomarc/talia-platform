/**
 * Seasonal Trading Pack GraphQL client.
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';
import { trackedApolloQuery } from './trackedGraphql';

const GET_SEASONAL_TRADING_PACK = gql`
  query GetSeasonalTradingPack($filters: SeasonalTradingPackFilters) {
    seasonalTradingPack(filters: $filters)
  }
`;

const seasonalTradingPackService = {
  async fetchPack(filters = {}) {
    // Prefer throwing on GraphQL errors so cold-start / gateway failures are
    // retryable instead of silently becoming a null pack (Apollo default
    // errorPolicy is 'all').
    const result = await trackedApolloQuery({
      client: apolloClient,
      query: GET_SEASONAL_TRADING_PACK,
      variables: { filters },
      tableName: 'seasonal_trading_pack',
      component: 'Seasonal Trading Pack',
      purpose: 'Fetch seasonal trading pack matrix and narrative',
      options: { fetchPolicy: 'network-only', errorPolicy: 'none' },
    });
    const graphqlError = result?.errors?.[0];
    if (graphqlError) {
      throw new Error(graphqlError.message || 'Seasonal trading pack GraphQL error');
    }
    const pack = result?.data?.seasonalTradingPack;
    if (!pack) {
      throw new Error('No seasonal trading pack returned');
    }
    // JSON scalar may arrive as a string depending on Apollo link config.
    if (typeof pack === 'string') {
      try {
        return JSON.parse(pack);
      } catch {
        throw new Error('Seasonal trading pack payload was not valid JSON');
      }
    }
    return pack;
  },
};

export default seasonalTradingPackService;
