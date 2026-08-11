/**
 * App-level booked composition: how FIT vs Group is reported.
 * Default: group_fit_expected (FIT booked + Group confirmed + GTY held expected).
 *
 * Probability: source via resolveDeliveryProbability (swap to Talia later).
 * FIT+Held uses alloc holds for occupancy; Agency value uses reservation facts
 * (including Fact group-OF explode rows) — do not sum both for the same hold.
 */

import { classifyPassengerType } from './reservationDimensions.js';
import { isGroupOwner, isGtyOnly } from './shipInventoryAlloc.js';
import {
  resolveDeliveryProbability,
  resolveGroupHoldProbability,
} from './deliveryProbability.js';

export { resolveGroupHoldProbability, resolveDeliveryProbability };

export const BOOKED_COMPOSITION = {
  BOOKED_ONLY: 'booked_only',
  THREE_WAY: 'three_way',
  GROUP_FIT_EXPECTED: 'group_fit_expected',
};

export const DEFAULT_BOOKED_COMPOSITION = BOOKED_COMPOSITION.GROUP_FIT_EXPECTED;

export const BOOKED_COMPOSITION_OPTIONS = [
  { key: BOOKED_COMPOSITION.BOOKED_ONLY, label: 'Booked' },
  { key: BOOKED_COMPOSITION.THREE_WAY, label: '3-way' },
  { key: BOOKED_COMPOSITION.GROUP_FIT_EXPECTED, label: 'FIT+Held' },
];

export const normalizeBookedComposition = (value) => {
  const key = String(value || '').trim();
  if (key === BOOKED_COMPOSITION.BOOKED_ONLY) return BOOKED_COMPOSITION.BOOKED_ONLY;
  if (key === BOOKED_COMPOSITION.THREE_WAY) return BOOKED_COMPOSITION.THREE_WAY;
  return BOOKED_COMPOSITION.GROUP_FIT_EXPECTED;
};

export const groupFitChartTitle = (mode) => {
  const normalized = normalizeBookedComposition(mode);
  if (normalized === BOOKED_COMPOSITION.THREE_WAY) return 'FIT / Group / Held';
  if (normalized === BOOKED_COMPOSITION.GROUP_FIT_EXPECTED) return 'Group / FIT (incl. held)';
  return 'Group / FIT';
};

const isActiveReservation = (row) => {
  const status = String(row?.res_status || '').toUpperCase();
  return status !== 'CX' && status !== 'CANCELLED' && status !== 'CANCELED';
};

const asNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Source delivery probability 0–100 (alloc hold or reservation).
 * Prefer resolveDeliveryProbability for new call sites.
 */
// resolveGroupHoldProbability imported from deliveryProbability.js above

/** GROUP + GTY ONLY holds (not yet confirmed named inventory). */
export const isGroupHoldAlloc = (row) => (
  isGroupOwner(row?.allocation_owner_type) && isGtyOnly(row?.inventory_request_type)
);

export const sumGroupHeldExpected = (allocRows = []) => {
  let sum = 0;
  (allocRows || []).forEach((row) => {
    if (!isGroupHoldAlloc(row)) return;
    const occ = asNumber(row?.occupancy);
    if (occ <= 0) return;
    sum += occ * (resolveGroupHoldProbability(row) / 100);
  });
  return Math.round(sum * 10) / 10;
};

export const allocScopeKey = (shipCode, sailDateFrom) => {
  const ship = String(shipCode || '').trim();
  const date = String(sailDateFrom || '').trim().slice(0, 10);
  if (!ship || !date) return null;
  return `${ship}|${date}`;
};

export const indexAllocRowsByShipDate = (allocRows = []) => {
  const map = new Map();
  (allocRows || []).forEach((row) => {
    const key = allocScopeKey(row?.ship_code, row?.sail_date_from);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
};

/**
 * Build Group/FIT (or three-way) slices from reservations + optional alloc holds.
 */
export const buildGroupFitSlices = ({
  reservations = [],
  allocRows = [],
  mode = DEFAULT_BOOKED_COMPOSITION,
  capacityBerths = null,
} = {}) => {
  const normalized = normalizeBookedComposition(mode);
  let fitGuests = 0;
  let groupBookedGuests = 0;
  let withPaxType = 0;
  let bookingCount = 0;

  (reservations || []).forEach((row) => {
    if (!isActiveReservation(row)) return;
    const guests = asNumber(row?.guest_count);
    if (guests <= 0) return;
    bookingCount += 1;
    if (String(row?.pax_type || '').trim()) withPaxType += 1;
    const kind = classifyPassengerType(row);
    if (kind === 'Group') groupBookedGuests += guests;
    else fitGuests += guests;
  });

  const groupHeldExpected = sumGroupHeldExpected(allocRows);
  const withCapacityShare = (slices) => {
    if (capacityBerths == null || !(capacityBerths > 0)) {
      return (slices || []).map((s) => ({ ...s, capacityPct: null }));
    }
    return (slices || []).map((s) => ({
      ...s,
      capacityPct: Math.round(((Number(s.value) || 0) / capacityBerths) * 1000) / 10,
    }));
  };

  let slices;
  if (normalized === BOOKED_COMPOSITION.THREE_WAY) {
    slices = withCapacityShare([
      { label: 'FIT', value: fitGuests },
      { label: 'Group booked', value: groupBookedGuests },
      { label: 'Group held', value: groupHeldExpected },
    ].filter((s) => Number(s.value) > 0));
  } else if (normalized === BOOKED_COMPOSITION.GROUP_FIT_EXPECTED) {
    const groupTotal = Math.round((groupBookedGuests + groupHeldExpected) * 10) / 10;
    slices = withCapacityShare([
      { label: 'Group', value: groupTotal },
      { label: 'FIT', value: fitGuests },
    ].filter((s) => Number(s.value) > 0));
  } else {
    slices = withCapacityShare([
      { label: 'Group', value: groupBookedGuests },
      { label: 'FIT', value: fitGuests },
    ].filter((s) => Number(s.value) > 0));
  }

  return {
    slices,
    meta: {
      bookedComposition: normalized,
      fitGuests,
      groupBookedGuests,
      groupHeldExpected,
      withPaxType,
      bookingCount,
      probabilitySource: 'alloc',
      groupFitLabel: groupFitChartTitle(normalized),
    },
  };
};

export default {
  BOOKED_COMPOSITION,
  DEFAULT_BOOKED_COMPOSITION,
  BOOKED_COMPOSITION_OPTIONS,
  normalizeBookedComposition,
  groupFitChartTitle,
  resolveDeliveryProbability,
  resolveGroupHoldProbability,
  isGroupHoldAlloc,
  sumGroupHeldExpected,
  allocScopeKey,
  indexAllocRowsByShipDate,
  buildGroupFitSlices,
};
