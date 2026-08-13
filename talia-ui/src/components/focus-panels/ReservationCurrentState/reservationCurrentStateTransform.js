/**
 * Reservation Current State — status filtering and display helpers.
 */

import {
  isSyntheticGroupOfRow,
  RESERVATION_SOURCE_ORIGIN,
} from '../../../lib/deliveryProbability.js';
import { classifyPassengerType } from '../../../lib/reservationDimensions.js';

const NAMED_BOOKED_STATUSES = new Set(['BK', 'BOOKED', 'BKD']);
const OFFER_STATUSES = new Set(['OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT']);

export const isCancelledStatus = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'CX' || normalized === 'X';
};

/** @deprecated Prefer isNamedBookedRow — kept for callers that only have a status string. */
export const isBookedStatus = (value) => !isCancelledStatus(value);

export const isSyntheticReservationRow = (row) => {
  if (!row) return false;
  if (String(row.source_origin || '').trim() === RESERVATION_SOURCE_ORIGIN.FACT_GROUP_ALLOC) {
    return true;
  }
  return isSyntheticGroupOfRow(row);
};

/** Named / materialised bookings (excludes synthetic group-OF explode). */
export const isNamedBookedRow = (row) => {
  if (!row || isCancelledStatus(row?.res_status)) return false;
  if (isSyntheticReservationRow(row)) return false;
  const status = String(row?.res_status || '').trim().toUpperCase();
  return NAMED_BOOKED_STATUSES.has(status);
};

/** Groups + offers expected to deliver (face contracted / estimated pipeline). */
export const isExpectedGroupRow = (row) => {
  if (!row || isCancelledStatus(row?.res_status)) return false;
  if (isSyntheticReservationRow(row)) return true;
  const status = String(row?.res_status || '').trim().toUpperCase();
  if (OFFER_STATUSES.has(status)) return true;
  if (classifyPassengerType(row) === 'Group') return true;
  return false;
};

/**
 * Estimated view: named booked + expected groups/offers (incl. synthetic res_id).
 */
export const isEstimatedPipelineRow = (row) => (
  isNamedBookedRow(row) || isExpectedGroupRow(row)
);

export const filterByReservationStatus = (rows, statusFilter = 'all') => {
  const list = Array.isArray(rows) ? rows : [];
  if (statusFilter === 'cancelled') {
    return list.filter((row) => isCancelledStatus(row?.res_status));
  }
  if (statusFilter === 'booked') {
    return list.filter((row) => isNamedBookedRow(row));
  }
  if (statusFilter === 'synthetic') {
    return list.filter((row) => isSyntheticReservationRow(row) && !isCancelledStatus(row?.res_status));
  }
  if (statusFilter === 'estimated') {
    return list.filter((row) => isEstimatedPipelineRow(row));
  }
  return list;
};

export const buildShipSailTooltip = (row = {}) => {
  const parts = [];
  if (row.ship) parts.push(`Ship: ${row.ship}`);
  if (row.sail_code) parts.push(`Sail: ${row.sail_code}`);
  return parts.join(' · ');
};
