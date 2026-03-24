/**
 * Service for fetching booking targets supplied from central store
 * Data is imported via Data Management (booking_targets_supplied table)
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';
import { trackedApolloQuery } from './trackedGraphql';

const GET_BOOKING_TARGETS_SUPPLIED = gql`
  query GetBookingTargetsSupplied($sailCode: String) {
    bookingTargetsSupplied(sailCode: $sailCode) {
      id
      sailCode
      shipCode
      weekLabel
      weeksUntilSailing
      targetBookings
      targetGuests
      importBatchId
      importedAt
    }
  }
`;

/**
 * Fetch booking targets supplied (optionally filtered by sail code)
 * @param {string|null} sailCode - Optional sail code filter
 * @returns {Promise<Array>} Array of target curves
 */
export async function fetchBookingTargetsSupplied(sailCode = null) {
  const { data } = await trackedApolloQuery({
    client: apolloClient,
    query: GET_BOOKING_TARGETS_SUPPLIED,
    variables: { sailCode },
    component: 'Booking Targets Supplied',
    purpose: 'Fetch target data from central store',
    tableName: 'booking_targets_supplied',
    options: { fetchPolicy: 'network-only' },
  });
  return data?.bookingTargetsSupplied || [];
}

/**
 * Build bySailCode Map and sailCodes array for chart compatibility
 * @param {string|null} sailCode - Optional filter (null = all)
 */
export async function fetchBookingTargetsSuppliedGrouped(sailCode = null) {
  const rows = await fetchBookingTargetsSupplied(sailCode);
  const bySailCode = new Map();
  const metaBySailCode = new Map();
  rows.forEach((r) => {
    const code = r.sailCode;
    if (!code) return;
    const curve = {
      weekLabel: r.weekLabel,
      weeksUntilSailing: r.weeksUntilSailing,
      targetBookings: r.targetBookings,
      targetGuests: r.targetGuests,
    };
    if (!bySailCode.has(code)) bySailCode.set(code, []);
    bySailCode.get(code).push(curve);

    const existingMeta = metaBySailCode.get(code) || { latestImportedAt: null };
    const latestImportedAt = existingMeta.latestImportedAt && existingMeta.latestImportedAt > r.importedAt
      ? existingMeta.latestImportedAt
      : r.importedAt;
    metaBySailCode.set(code, { latestImportedAt });
  });
  return {
    bySailCode,
    metaBySailCode,
    sailCodes: Array.from(bySailCode.keys()).sort(),
  };
}
