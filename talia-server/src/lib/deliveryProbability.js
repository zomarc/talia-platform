/**
 * Delivery probability — shared with UI (source vs future Talia).
 * Keep in sync with talia-ui/src/lib/deliveryProbability.js
 */

export const PROBABILITY_SOURCE = {
  SOURCE: 'source',
  TALIA: 'talia',
};

export const DEFAULT_PROBABILITY_SOURCE = PROBABILITY_SOURCE.SOURCE;

export const RESERVATION_SOURCE_ORIGIN = {
  RES_HEADER: 'res_header',
  FACT_GROUP_ALLOC: 'fact_group_alloc',
};

export const normalizeProbabilitySource = (value) => (
  String(value || '').trim() === PROBABILITY_SOURCE.TALIA
    ? PROBABILITY_SOURCE.TALIA
    : PROBABILITY_SOURCE.SOURCE
);

const normalizeProbabilityPct = (raw) => {
  let prob = Number(raw);
  if (!Number.isFinite(prob)) return null;
  if (prob >= 0 && prob <= 1) prob *= 100;
  return Math.max(0, Math.min(100, prob));
};

const classifyPassengerType = (row) => {
  const pax = String(row?.pax_type || '').trim().toUpperCase();
  if (pax.startsWith('G') || pax === 'GROUP') return 'Group';
  if (pax.startsWith('F') || pax === 'FIT') return 'FIT';
  if (row?.group_id != null && String(row.group_id).trim() !== '') return 'Group';
  return 'FIT';
};

export const isSyntheticGroupOfRow = (row) => {
  if (!row) return false;
  const origin = String(row.source_origin || '').trim();
  if (origin === RESERVATION_SOURCE_ORIGIN.FACT_GROUP_ALLOC) return true;

  const groupId = row.group_id != null ? String(row.group_id).trim() : '';
  const resId = row.res_id != null ? String(row.res_id).trim() : '';
  if (!groupId || !resId) return false;
  if (!/^\d+$/.test(groupId) || !/^\d+$/.test(resId)) return false;
  if (!resId.startsWith(groupId) || resId.length < groupId.length + 4) return false;

  const status = String(row.res_status || '').trim().toUpperCase();
  return status === 'OF' || status === 'OPTION' || status === 'QT' || status === 'QUOTE';
};

export const resolveDeliveryProbability = (row, options = {}) => {
  const mode = normalizeProbabilitySource(options.probabilitySource);

  if (mode === PROBABILITY_SOURCE.TALIA) {
    const talia = normalizeProbabilityPct(row?.talia_probability);
    if (talia != null) return talia;
  }

  const allocProb = normalizeProbabilityPct(row?.probability);
  const kind = classifyPassengerType(row);

  if (kind === 'Group') {
    const groupProb = normalizeProbabilityPct(row?.group_probability);
    if (groupProb != null) return groupProb;
    const resProb = normalizeProbabilityPct(row?.res_probability);
    if (resProb != null) return resProb;
    if (allocProb != null) return allocProb;
    return 100;
  }

  const resProb = normalizeProbabilityPct(row?.res_probability);
  if (resProb != null) return resProb;
  if (allocProb != null) return allocProb;
  return 100;
};

export const resolveGroupHoldProbability = (row, options) => (
  resolveDeliveryProbability(row, options)
);

export default {
  PROBABILITY_SOURCE,
  DEFAULT_PROBABILITY_SOURCE,
  RESERVATION_SOURCE_ORIGIN,
  normalizeProbabilitySource,
  isSyntheticGroupOfRow,
  resolveDeliveryProbability,
  resolveGroupHoldProbability,
};
