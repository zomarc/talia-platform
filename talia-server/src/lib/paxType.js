/**
 * Canonical Group / FIT classification for reservation facts.
 * Source of truth: pax_type from dwh.Fact_Reservation (F / G).
 * group_id is a sparse fallback only when pax_type is missing.
 */

export const PAX_TYPE_ORDER = ['Group', 'FIT'];

const cleanPax = (paxType) => String(paxType || '').trim().toUpperCase();

/** True when pax_type is FIT (F / FIT / starts with F). */
export function isFitPaxType(paxType) {
  const t = cleanPax(paxType);
  return t.startsWith('F') || t === 'FIT';
}

/** True when pax_type is Group (G / GROUP / starts with G). */
export function isGroupPaxType(paxType) {
  const t = cleanPax(paxType);
  return t.startsWith('G') || t === 'GROUP';
}

/**
 * Classify a reservation-like row as Group or FIT.
 * Prefer pax_type; fall back to non-null group_id only when pax_type is absent.
 */
export function classifyPassengerType(row) {
  const pax = cleanPax(row?.pax_type);
  if (isGroupPaxType(pax)) return 'Group';
  if (isFitPaxType(pax)) return 'FIT';
  if (row?.group_id != null && String(row.group_id).trim() !== '') return 'Group';
  return 'FIT';
}

export default {
  PAX_TYPE_ORDER,
  isFitPaxType,
  isGroupPaxType,
  classifyPassengerType,
};
