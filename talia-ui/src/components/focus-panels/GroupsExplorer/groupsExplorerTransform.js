/**
 * Groups Explorer — roll reservation rows into group-centric GRM rows.
 */

import {
  isSyntheticGroupOfRow,
  resolveDeliveryProbability,
  RESERVATION_SOURCE_ORIGIN,
} from '../../../lib/deliveryProbability.js';
import { classifyPassengerType } from '../../../lib/reservationDimensions.js';
import {
  isCancelledReservation,
  isContractedDemand,
  isNamedBooked,
  revenueEurOf,
} from '../SailingDemandComposition/sailingDemandComposition.js';
import {
  computeTaliaMaterialisation,
  evaluateGroupPerformance,
  isDistressedRemaining,
} from './groupsMaterialisation.js';

const asNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const guestsToCabins = (guests) => (guests > 0 ? guests / 2 : 0);

const OFFER_STATUSES = new Set(['OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT']);

const isGroupRelatedRow = (row) => {
  if (!row || isCancelledReservation(row)) return false;
  if (isSyntheticGroupOfRow(row)) return true;
  if (String(row?.source_origin || '').trim() === RESERVATION_SOURCE_ORIGIN.FACT_GROUP_ALLOC) {
    return true;
  }
  if (row?.group_id != null && String(row.group_id).trim() !== '') return true;
  return classifyPassengerType(row) === 'Group';
};

const resolveGroupKey = (row) => {
  const groupId = row?.group_id != null ? String(row.group_id).trim() : '';
  if (groupId) return groupId;
  if (isSyntheticGroupOfRow(row)) {
    const resId = String(row?.res_id || '').trim();
    if (resId) return `synth:${resId}`;
  }
  const resId = String(row?.res_id || '').trim();
  return resId ? `res:${resId}` : null;
};

/**
 * @param {object[]} reservationRows
 * @param {{
 *   agenciesById?: Map<string, object>|Record<string, object>,
 *   sellableRemainingPct?: number|null,
 *   sailBookingByCode?: Map<string, object>,
 * }} [options]
 */
export const buildGroupsExplorerRows = (reservationRows = [], options = {}) => {
  const agenciesById = options.agenciesById instanceof Map
    ? options.agenciesById
    : new Map(Object.entries(options.agenciesById || {}));
  const distressedSailing = isDistressedRemaining(options.sellableRemainingPct);

  const buckets = new Map();

  (reservationRows || []).forEach((row) => {
    if (!isGroupRelatedRow(row)) return;
    const groupKey = resolveGroupKey(row);
    if (!groupKey) return;

    let bucket = buckets.get(groupKey);
    if (!bucket) {
      bucket = {
        group_key: groupKey,
        group_id: row?.group_id != null ? String(row.group_id).trim() : groupKey.replace(/^(synth|res):/, ''),
        agency_id: null,
        sail_codes: new Set(),
        ship_codes: new Set(),
        sail_date_from: null,
        statuses: new Map(),
        source_probs: [],
        requested_pax: 0,
        reserved_pax: 0,
        booked_pax: 0,
        offer_pax: 0,
        group_value_eur: 0,
        row_count: 0,
      };
      buckets.set(groupKey, bucket);
    }

    const guests = asNum(row?.guest_count);
    if (guests <= 0) return;

    bucket.row_count += 1;
    const sailCode = String(row?.sail_code || '').trim();
    if (sailCode) bucket.sail_codes.add(sailCode);
    const ship = String(row?.ship_code || row?.ship || '').trim();
    if (ship) bucket.ship_codes.add(ship);

    const sailDate = row?.sail_from_date || row?.sail_date_from || null;
    if (sailDate && (!bucket.sail_date_from || String(sailDate) < String(bucket.sail_date_from))) {
      bucket.sail_date_from = sailDate;
    }

    if (bucket.agency_id == null && row?.agency_id != null && String(row.agency_id).trim() !== '') {
      bucket.agency_id = String(row.agency_id).trim();
    }

    const status = String(row?.res_status || '').trim().toUpperCase() || 'UNK';
    bucket.statuses.set(status, (bucket.statuses.get(status) || 0) + guests);

    const sourceProb = resolveDeliveryProbability(row, { probabilitySource: 'source' });
    if (Number.isFinite(sourceProb)) bucket.source_probs.push(sourceProb / 100);

    bucket.group_value_eur += revenueEurOf(row);

    // Requested ≈ contracted face for the group; reserved ≈ held/named progress.
    if (isContractedDemand(row) || isSyntheticGroupOfRow(row) || classifyPassengerType(row) === 'Group') {
      bucket.requested_pax += guests;
    }
    if (isNamedBooked(row)) {
      bucket.booked_pax += guests;
      bucket.reserved_pax += guests;
    } else if (OFFER_STATUSES.has(status) || isSyntheticGroupOfRow(row)) {
      bucket.offer_pax += guests;
      // Partial credit toward reserved when offer carries probability holds — use face for reserved display.
      bucket.reserved_pax += guests * 0; // reserved column = named booked only for clarity
    }
  });

  const rows = [];
  buckets.forEach((bucket) => {
    if (bucket.requested_pax <= 0 && bucket.booked_pax <= 0) return;

    const requestedPax = Math.max(bucket.requested_pax, bucket.booked_pax);
    const reservedPax = bucket.booked_pax;
    const requestedCabins = guestsToCabins(requestedPax);
    const reservedCabins = guestsToCabins(reservedPax);
    const sourceMr = bucket.source_probs.length
      ? bucket.source_probs.reduce((a, b) => a + b, 0) / bucket.source_probs.length
      : null;

    const mr = computeTaliaMaterialisation({
      requestedPax,
      reservedPax,
      requestedCabins,
      reservedCabins,
      sourceMr,
      hasNamedBooked: reservedPax > 0,
      offerHeavy: bucket.offer_pax > reservedPax,
      distressedSailing,
      useSourceNudge: options.useSourceNudge !== false,
    });

    const impact = evaluateGroupPerformance({
      talia_mr: mr.talia_mr,
      source_mr: mr.source_mr,
      requestedPax,
      requestedCabins,
      groupValueEur: bucket.group_value_eur,
      distressedSailing,
      sellableRemainingPct: options.sellableRemainingPct,
    });

    const agency = bucket.agency_id ? agenciesById.get(String(bucket.agency_id)) : null;
    const statusBits = [...bucket.statuses.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, guests]) => `${code}:${Math.round(guests)}`)
      .join(' ');

    rows.push({
      group_key: bucket.group_key,
      group_id: bucket.group_id,
      agency_id: bucket.agency_id,
      agency_name: agency?.agency_name || agency?.name || '',
      sail_code: [...bucket.sail_codes][0] || '',
      sail_codes: [...bucket.sail_codes],
      ship_code: [...bucket.ship_codes][0] || '',
      sail_date_from: bucket.sail_date_from,
      status_mix: statusBits,
      requested_pax: Math.round(requestedPax),
      reserved_pax: Math.round(reservedPax),
      booked_pax: Math.round(bucket.booked_pax),
      requested_cabins: Math.round(requestedCabins),
      reserved_cabins: Math.round(reservedCabins),
      group_value_eur: Math.round(bucket.group_value_eur),
      source_mr: mr.source_mr,
      talia_mr: mr.talia_mr,
      offer_heavy: bucket.offer_pax > reservedPax,
      has_named_booked: reservedPax > 0,
      mr_reasons: mr.reasons,
      mr_reason: mr.reasons.join(' · '),
      potential_pax: Math.round(impact.potential_pax),
      cabins_at_risk: Math.round(impact.cabins_at_risk),
      value_at_risk: Math.round(impact.value_at_risk),
      non_performant: impact.non_performant,
      performance_flags: impact.flags,
      distressed_sailing: distressedSailing,
      row_count: bucket.row_count,
    });
  });

  return rows.sort((a, b) => {
    if (a.non_performant !== b.non_performant) return a.non_performant ? -1 : 1;
    return (b.value_at_risk || 0) - (a.value_at_risk || 0);
  });
};

export const buildGroupsExplorerSnapshot = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  const requestedCabins = list.reduce((sum, row) => sum + asNum(row.requested_cabins), 0);
  const reservedCabins = list.reduce((sum, row) => sum + asNum(row.reserved_cabins), 0);
  const worth = list.reduce((sum, row) => sum + asNum(row.group_value_eur), 0);
  const valueAtRisk = list.reduce((sum, row) => sum + asNum(row.value_at_risk), 0);
  const requestedPax = list.reduce((sum, row) => sum + asNum(row.requested_pax), 0);
  const potentialPax = list.reduce((sum, row) => sum + asNum(row.potential_pax), 0);
  const portfolioMr = requestedPax > 0 ? potentialPax / requestedPax : null;
  const weakCount = list.filter((row) => row.non_performant).length;

  return {
    group_count: list.length,
    requested_cabins: Math.round(requestedCabins),
    reserved_cabins: Math.round(reservedCabins),
    portfolio_mr: portfolioMr,
    worth_eur: Math.round(worth),
    value_at_risk_eur: Math.round(valueAtRisk),
    weak_count: weakCount,
  };
};

export const indexAgenciesById = (agencies = []) => {
  const map = new Map();
  (agencies || []).forEach((row) => {
    const id = row?.agency_id != null ? String(row.agency_id).trim() : '';
    if (id) map.set(id, row);
  });
  return map;
};

export default {
  buildGroupsExplorerRows,
  buildGroupsExplorerSnapshot,
  indexAgenciesById,
};
