/**
 * Market roll-up helpers — agency.market → lkp.MARKET_ROLL_UP.new_budget_roll_up.
 */

export const DEFAULT_MARKET_DIMENSION = 'market_group';

export const normalizeMarketDimension = (value) => (
  value === 'market' ? 'market' : 'market_group'
);

export const indexMarketRollUpByAgencyMarket = (rows = []) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const market = String(row?.agency_market || '').trim();
    if (!market) return;
    const active = row?.active_record_flag;
    if (active != null && Number(active) !== 1) return;
    if (map.has(market)) return;
    map.set(market, {
      agency_market: market,
      market_group: String(row?.new_budget_roll_up || '').trim() || null,
      effective_from: row?.effective_from || null,
      effective_to: row?.effective_to || null,
    });
  });
  return map;
};

/** Resolve budget market group for an agency market code. */
export const resolveMarketGroup = (agencyMarket, rollUpIndex) => {
  const market = String(agencyMarket || '').trim();
  if (!market) return null;
  const hit = rollUpIndex?.get?.(market);
  return hit?.market_group || null;
};

export default {
  indexMarketRollUpByAgencyMarket,
  resolveMarketGroup,
  normalizeMarketDimension,
  DEFAULT_MARKET_DIMENSION,
};
