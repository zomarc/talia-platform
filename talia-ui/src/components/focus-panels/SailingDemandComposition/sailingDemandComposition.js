/**
 * Sailing demand composition: Booked (named) / Estimated / Contracted (groups + offers).
 * Pure helpers for guests + EUR revenue — keep in sync with sail_booking_summary rules.
 */

import {
  isSyntheticGroupOfRow,
  resolveDeliveryProbability,
  RESERVATION_SOURCE_ORIGIN,
} from '../../../lib/deliveryProbability.js';
import { classifyPassengerType } from '../../../lib/reservationDimensions.js';
import { isCancelledStatus } from '../GroupsExplorer/groupsMaterialisation.js';

const BOOKED_STATUSES = new Set(['BK', 'BOOKED', 'BKD']);
const OFFER_STATUSES = new Set(['OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT']);

const asNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const revenueEurOf = (row) => {
  const gross = asNum(row?.gross_ticket_revenue_eur);
  if (gross) return gross;
  const net = asNum(row?.net_ticket_revenue_eur);
  if (net) return net;
  return 0;
};

export const isCancelledReservation = (row) => (
  isCancelledStatus(row?.res_status)
);

/** Named / materialised booked cabins (not synthetic group-OF explode). */
export const isNamedBooked = (row) => {
  if (!row || isCancelledReservation(row)) return false;
  if (isSyntheticGroupOfRow(row)) return false;
  if (String(row?.source_origin || '').trim() === RESERVATION_SOURCE_ORIGIN.FACT_GROUP_ALLOC) {
    return false;
  }
  const status = String(row?.res_status || '').trim().toUpperCase();
  if (!BOOKED_STATUSES.has(status)) return false;
  // Soft offers are never "named booked".
  if (OFFER_STATUSES.has(status)) return false;
  return true;
};

/** All groups + offers (face contracted demand). */
export const isContractedDemand = (row) => {
  if (!row || isCancelledReservation(row)) return false;
  if (isSyntheticGroupOfRow(row)) return true;
  if (String(row?.source_origin || '').trim() === RESERVATION_SOURCE_ORIGIN.FACT_GROUP_ALLOC) {
    return true;
  }
  const status = String(row?.res_status || '').trim().toUpperCase();
  const kind = classifyPassengerType(row);
  if (kind === 'Group') return true;
  if (OFFER_STATUSES.has(status)) return true;
  return false;
};

/**
 * @param {object[]} reservationRows
 * @returns {{
 *   booked: { guests: number, cabins: number, revenueEur: number, rows: number },
 *   contracted: { guests: number, cabins: number, revenueEur: number, rows: number },
 *   estimated: { guests: number, cabins: number, revenueEur: number, rows: number },
 * }}
 */
export const buildSailingDemandComposition = (reservationRows = []) => {
  const empty = () => ({ guests: 0, cabins: 0, revenueEur: 0, rows: 0 });
  const booked = empty();
  const contracted = empty();
  const estimated = empty();

  (reservationRows || []).forEach((row) => {
    if (isCancelledReservation(row)) return;
    const guests = asNum(row?.guest_count);
    if (guests <= 0) return;
    const cabins = guests / 2;
    const rev = revenueEurOf(row);

    if (isNamedBooked(row)) {
      booked.guests += guests;
      booked.cabins += cabins;
      booked.revenueEur += rev;
      booked.rows += 1;
    }

    if (isContractedDemand(row)) {
      contracted.guests += guests;
      contracted.cabins += cabins;
      contracted.revenueEur += rev;
      contracted.rows += 1;

      const factor = resolveDeliveryProbability(row) / 100;
      estimated.guests += guests * factor;
      estimated.cabins += cabins * factor;
      estimated.revenueEur += rev * factor;
      estimated.rows += 1;
    }
  });

  const roundBucket = (b) => ({
    guests: Math.round(b.guests * 10) / 10,
    cabins: Math.round(b.cabins * 10) / 10,
    revenueEur: Math.round(b.revenueEur),
    rows: b.rows,
  });

  return {
    booked: roundBucket(booked),
    contracted: roundBucket(contracted),
    estimated: roundBucket(estimated),
  };
};

export default buildSailingDemandComposition;
