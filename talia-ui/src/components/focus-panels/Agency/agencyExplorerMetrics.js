/**
 * Agency Explorer metrics — sail-scoped value + PPD (current vs expected).
 *
 * Current: BK face (named res_header rows only).
 * Expected: BK + soft (OF/QT/WL including Fact group-OF explode) × resolveDeliveryProbability.
 */

import { classifyPassengerType } from '../../../lib/reservationDimensions.js';
import {
  CABIN_CATEGORY_MODE,
  normalizeCabinCategoryMode,
  resolveCabinCategoryLabel,
} from '../../../lib/cabinCategoryGroups.js';
import {
  isSyntheticGroupOfRow,
  resolveDeliveryProbability,
  RESERVATION_SOURCE_ORIGIN,
} from '../../../lib/deliveryProbability.js';

const BOOKED_STATUSES = new Set(['BK', 'BOOKED', 'BKD']);
const SOFT_STATUSES = new Set(['OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT']);
const CANCELLED_STATUSES = new Set(['CX', 'CANCELLED', 'CANCELED', 'X']);

export const isBookedReservation = (row) => {
  const status = String(row?.res_status || '').trim().toUpperCase();
  if (!BOOKED_STATUSES.has(status)) return false;
  // Fact group-OF explode rows are never "current booked".
  if (isSyntheticGroupOfRow(row)) return false;
  const origin = String(row?.source_origin || '').trim();
  if (origin === RESERVATION_SOURCE_ORIGIN.FACT_GROUP_ALLOC) return false;
  return true;
};

export const isSoftReservation = (row) => {
  const status = String(row?.res_status || '').trim().toUpperCase();
  return SOFT_STATUSES.has(status);
};

export const isExpectedPipelineReservation = (row) => {
  const status = String(row?.res_status || '').trim().toUpperCase();
  if (!status || CANCELLED_STATUSES.has(status)) return false;
  return BOOKED_STATUSES.has(status) || SOFT_STATUSES.has(status);
};

export const resolveRevenueEur = (row) => {
  const gross = Number(row?.gross_ticket_revenue_eur);
  if (Number.isFinite(gross)) return gross;
  const net = Number(row?.net_ticket_revenue_eur);
  return Number.isFinite(net) ? net : 0;
};

/**
 * Effective delivery probability 0–100 (shared deliveryProbability module).
 */
export const resolveEffectiveProbabilityPct = (row) => resolveDeliveryProbability(row);

/** @deprecated use resolveEffectiveProbabilityPct */
export const resolveResProbabilityPct = (row) => resolveDeliveryProbability(row);

export const guestNights = (row) => {
  const guests = Number(row?.guest_count) || 0;
  let nights = Number(row?.sail_duration) || 0;
  if (!nights) {
    const from = String(row?.sail_from_date || '').slice(0, 10);
    const to = String(row?.sail_to_date || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const ms = Date.parse(to) - Date.parse(from);
      if (Number.isFinite(ms) && ms > 0) nights = Math.round(ms / 86400000);
    }
  }
  return guests * Math.max(0, nights);
};

const emptyBucket = () => ({
  current_guests: 0,
  current_value_eur: 0,
  current_guest_nights: 0,
  expected_guests: 0,
  expected_value_eur: 0,
  expected_guest_nights: 0,
  fit_current_guests: 0,
  fit_current_value_eur: 0,
  group_current_guests: 0,
  group_current_value_eur: 0,
  booking_count: 0,
});

const finalizeBucket = (bucket) => {
  const current_ppd = bucket.current_guest_nights > 0
    ? Math.round((bucket.current_value_eur / bucket.current_guest_nights) * 100) / 100
    : null;
  const expected_ppd = bucket.expected_guest_nights > 0
    ? Math.round((bucket.expected_value_eur / bucket.expected_guest_nights) * 100) / 100
    : null;
  return {
    ...bucket,
    current_guests: Math.round(bucket.current_guests * 10) / 10,
    expected_guests: Math.round(bucket.expected_guests * 10) / 10,
    current_value_eur: Math.round(bucket.current_value_eur * 100) / 100,
    expected_value_eur: Math.round(bucket.expected_value_eur * 100) / 100,
    current_ppd,
    expected_ppd,
  };
};

const accumulate = (bucket, row) => {
  const guests = Number(row?.guest_count) || 0;
  const rev = resolveRevenueEur(row);
  const nights = guestNights(row);
  const prob = resolveEffectiveProbabilityPct(row) / 100;
  const kind = classifyPassengerType(row);
  const booked = isBookedReservation(row);
  const inExpected = isExpectedPipelineReservation(row);

  if (!booked && !inExpected) return;

  bucket.booking_count += 1;

  if (booked) {
    bucket.current_guests += guests;
    bucket.current_value_eur += rev;
    bucket.current_guest_nights += nights;
    if (kind === 'Group') {
      bucket.group_current_guests += guests;
      bucket.group_current_value_eur += rev;
    } else {
      bucket.fit_current_guests += guests;
      bucket.fit_current_value_eur += rev;
    }
  }

  if (inExpected) {
    bucket.expected_guests += guests * prob;
    bucket.expected_value_eur += rev * prob;
    bucket.expected_guest_nights += nights * prob;
  }
};

/**
 * Build per-agency metrics (+ optional category breakdown for one agency).
 */
export const buildAgencyExplorerMetrics = ({
  reservationRows = [],
  cabinCtgIndex = null,
  cabinCategoryMode = CABIN_CATEGORY_MODE.REAL,
  selectedAgencyId = null,
} = {}) => {
  const mode = normalizeCabinCategoryMode(cabinCategoryMode);
  const byAgency = new Map();
  const byCategory = new Map();
  const selectedId = selectedAgencyId != null && String(selectedAgencyId).trim() !== ''
    ? String(selectedAgencyId).trim()
    : null;

  (reservationRows || []).forEach((row) => {
    if (!isExpectedPipelineReservation(row) && !isBookedReservation(row)) return;
    const agencyId = row?.agency_id != null ? String(row.agency_id).trim() : '';
    if (!agencyId) return;

    if (!byAgency.has(agencyId)) byAgency.set(agencyId, emptyBucket());
    accumulate(byAgency.get(agencyId), row);

    if (selectedId && agencyId === selectedId) {
      const label = resolveCabinCategoryLabel(row?.cabin_category, cabinCtgIndex, mode);
      if (!byCategory.has(label)) byCategory.set(label, emptyBucket());
      accumulate(byCategory.get(label), row);
    }
  });

  const agencies = new Map();
  byAgency.forEach((bucket, agencyId) => {
    agencies.set(agencyId, finalizeBucket(bucket));
  });

  const categoryBreakdown = [...byCategory.entries()]
    .map(([category, bucket]) => ({
      category,
      ...finalizeBucket(bucket),
    }))
    .sort((a, b) => b.current_value_eur - a.current_value_eur);

  return {
    byAgency: agencies,
    categoryBreakdown,
    cabinCategoryMode: mode,
  };
};

/** Merge metrics onto agency directory rows. */
export const enrichAgenciesWithExplorerMetrics = (agencies = [], metricsByAgency) => (
  (agencies || []).map((agency) => {
    const id = agency?.agency_id != null ? String(agency.agency_id).trim() : '';
    const metrics = metricsByAgency?.get?.(id) || null;
    if (!metrics) {
      return {
        ...agency,
        current_guests: null,
        current_value_eur: null,
        current_ppd: null,
        expected_guests: null,
        expected_value_eur: null,
        expected_ppd: null,
        fit_current_guests: null,
        group_current_guests: null,
      };
    }
    return {
      ...agency,
      current_guests: metrics.current_guests,
      current_value_eur: metrics.current_value_eur,
      current_ppd: metrics.current_ppd,
      expected_guests: metrics.expected_guests,
      expected_value_eur: metrics.expected_value_eur,
      expected_ppd: metrics.expected_ppd,
      fit_current_guests: metrics.fit_current_guests,
      group_current_guests: metrics.group_current_guests,
    };
  })
);

export default {
  isBookedReservation,
  isSoftReservation,
  isExpectedPipelineReservation,
  resolveRevenueEur,
  resolveEffectiveProbabilityPct,
  resolveResProbabilityPct,
  guestNights,
  buildAgencyExplorerMetrics,
  enrichAgenciesWithExplorerMetrics,
};
