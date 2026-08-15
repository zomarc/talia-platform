/**
 * Global demand presentation unit (Pax vs Cabins).
 *
 * Canonical demand math is always guests/berths (pax). This module only
 * converts for display — never branch densify/sync on presentation unit.
 */

export const DEMAND_UNIT_PAX = 'pax';
export const DEMAND_UNIT_CABINS = 'cabins';

/** Default matches company load language (Cap / LF). */
export const DEFAULT_DEMAND_UNIT = DEMAND_UNIT_CABINS;

export const DEMAND_UNIT_OPTIONS = [
  { key: DEMAND_UNIT_PAX, label: 'Pax' },
  { key: DEMAND_UNIT_CABINS, label: 'Cabins' },
];

export const normalizeDemandUnit = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === DEMAND_UNIT_PAX || key === 'guests' || key === 'berths' || key === 'guest') {
    return DEMAND_UNIT_PAX;
  }
  if (key === DEMAND_UNIT_CABINS || key === 'cabin') {
    return DEMAND_UNIT_CABINS;
  }
  return DEFAULT_DEMAND_UNIT;
};

/** Presentation convert: guests → cabins (same rule as guaranteed_cabins). */
export const guestsToCabins = (guests) => {
  const n = Number(guests);
  if (!Number.isFinite(n)) return null;
  return n / 2;
};

/**
 * Present a guest volume in the active unit.
 * @param {number|null|undefined} guests - canonical guest/berth count
 * @param {string} unit - pax | cabins
 * @returns {number|null}
 */
export const toDemandVolume = (guests, unit = DEFAULT_DEMAND_UNIT) => {
  if (guests == null || guests === '') return null;
  const n = Number(guests);
  if (!Number.isFinite(n)) return null;
  const mode = normalizeDemandUnit(unit);
  if (mode === DEMAND_UNIT_CABINS) return guestsToCabins(n);
  return n;
};

export const demandUnitNoun = (unit = DEFAULT_DEMAND_UNIT) => (
  normalizeDemandUnit(unit) === DEMAND_UNIT_CABINS ? 'cabins' : 'guests'
);

export const demandUnitShortLabel = (unit = DEFAULT_DEMAND_UNIT) => (
  normalizeDemandUnit(unit) === DEMAND_UNIT_CABINS ? 'Cabins' : 'Pax'
);

export const demandUnitAxisTitle = (unit = DEFAULT_DEMAND_UNIT, { monday = false } = {}) => {
  const noun = demandUnitNoun(unit);
  if (monday) return `${noun[0].toUpperCase()}${noun.slice(1)} (Monday snapshots)`;
  return noun[0].toUpperCase() + noun.slice(1);
};
