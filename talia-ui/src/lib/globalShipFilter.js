/**
 * Global ship filter (StatusBar criteria): All ships or one ship_code.
 */

export const SHIP_FILTER_ALL = 'all';

export const normalizeGlobalShipCode = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === SHIP_FILTER_ALL || raw.toLowerCase() === '*') {
    return SHIP_FILTER_ALL;
  }
  return raw;
};

export const isShipFilterActive = (value) => {
  const code = normalizeGlobalShipCode(value);
  return Boolean(code && code !== SHIP_FILTER_ALL);
};

export const rowMatchesGlobalShip = (row, shipCode = null) => {
  const wanted = normalizeGlobalShipCode(shipCode ?? (
    typeof window !== 'undefined' ? window.__taliaGlobalCriteria?.shipCode : null
  ));
  if (!isShipFilterActive(wanted)) return true;
  if (!row || typeof row !== 'object') return true;
  const code = String(row.ship_code ?? row.Ship_Code ?? '').trim();
  // Keep rows with no ship field (non-ship datasets).
  if (!code) return true;
  return code === wanted;
};

export default {
  SHIP_FILTER_ALL,
  normalizeGlobalShipCode,
  isShipFilterActive,
  rowMatchesGlobalShip,
};
