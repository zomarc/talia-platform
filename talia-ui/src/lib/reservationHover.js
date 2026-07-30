/**
 * Precompute dense hover cards for Reservation Current State.
 * O(n) once per sail load; O(1) lookup on row hover.
 */

import { classifyPassengerType } from './reservationDimensions.js';

const asNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const agencyKey = (id) => (id == null || id === '' ? null : String(id).trim());

const resKey = (id) => (id == null || id === '' ? null : String(id));

const isCancelledStatus = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'CX' || normalized === 'X';
};

/** Normalize source PROBABILITY to 0–100. Missing → 100 (treat as firm). */
export const normalizeProbabilityPct = (value) => {
  if (value == null || value === '') return null;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return Math.round(n * 1000) / 10;
  return Math.min(100, Math.max(0, n));
};

const expectedGuests = (row) => {
  const guests = asNumber(row?.guest_count);
  if (guests <= 0) return 0;
  const pct = normalizeProbabilityPct(row?.res_probability);
  const weight = pct == null ? 1 : pct / 100;
  return guests * weight;
};

/**
 * @param {object[]} rows - sail-scoped merged reservation rows (before UI status filter)
 * @param {Map<string, object>|object} [agencyById]
 * @returns {Map<string, object>} res_id → hover card payload
 */
export const buildReservationHoverIndex = (rows = [], agencyById = null) => {
  const list = Array.isArray(rows) ? rows : [];
  const agencyLookup = agencyById instanceof Map
    ? agencyById
    : new Map(Object.entries(agencyById || {}));

  /** @type {Map<string, object[]>} */
  const byAgency = new Map();
  list.forEach((row) => {
    const aKey = agencyKey(row?.agency_id);
    if (!aKey) return;
    if (!byAgency.has(aKey)) byAgency.set(aKey, []);
    byAgency.get(aKey).push(row);
  });

  const agencyRollup = (aKey, selfResId) => {
    const peers = byAgency.get(aKey) || [];
    let bookingCount = 0;
    let guestTotal = 0;
    let netRevenueEur = 0;
    let otherBookingCount = 0;
    let otherExpectedPax = 0;

    peers.forEach((row) => {
      if (isCancelledStatus(row?.res_status)) return;
      const id = resKey(row?.res_id);
      bookingCount += 1;
      guestTotal += asNumber(row?.guest_count);
      netRevenueEur += asNumber(row?.net_ticket_revenue_eur);
      if (id && selfResId && id === selfResId) return;
      otherBookingCount += 1;
      otherExpectedPax += expectedGuests(row);
    });

    return {
      bookingCount,
      guestTotal,
      netRevenueEur: Math.round(netRevenueEur * 100) / 100,
      otherBookingCount,
      otherExpectedPax: Math.round(otherExpectedPax * 10) / 10,
    };
  };

  const index = new Map();
  list.forEach((row) => {
    const id = resKey(row?.res_id);
    if (!id || index.has(id)) return;

    const aKey = agencyKey(row?.agency_id);
    const agencyRow = aKey ? agencyLookup.get(aKey) : null;
    const agencyName = agencyRow?.agency_name
      || agencyRow?.name
      || agencyRow?.agency_desc
      || null;

    index.set(id, {
      resId: id,
      status: row?.res_status != null ? String(row.res_status).trim() : '',
      composition: classifyPassengerType(row),
      agencyId: aKey,
      agencyName: agencyName ? String(agencyName) : null,
      probabilityPct: normalizeProbabilityPct(row?.res_probability),
      guestCount: asNumber(row?.guest_count) || null,
      currency: row?.currency != null && row.currency !== '' ? String(row.currency) : null,
      netTicketRevenueEur: row?.net_ticket_revenue_eur != null
        ? asNumber(row.net_ticket_revenue_eur)
        : null,
      grossSellingFare: row?.gross_selling_fare != null
        ? asNumber(row.gross_selling_fare)
        : null,
      netSellingFare: row?.net_selling_fare != null
        ? asNumber(row.net_selling_fare)
        : null,
      cabinCategory: row?.cabin_category != null && row.cabin_category !== ''
        ? String(row.cabin_category)
        : null,
      cabinType: row?.cabin_type != null && row.cabin_type !== ''
        ? String(row.cabin_type)
        : null,
      // Future allocation / upgrade module — placeholders only.
      bookedCabin: null,
      upgradeValue: null,
      agencyOnSail: aKey
        ? agencyRollup(aKey, id)
        : {
          bookingCount: 0,
          guestTotal: 0,
          netRevenueEur: 0,
          otherBookingCount: 0,
          otherExpectedPax: 0,
        },
      ship: row?.ship != null && row.ship !== '' ? String(row.ship) : null,
      sailCode: row?.sail_code != null && row.sail_code !== '' ? String(row.sail_code) : null,
    });
  });

  return index;
};
