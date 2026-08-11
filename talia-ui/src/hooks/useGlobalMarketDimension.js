/**
 * Global market dimension preference (header criteria).
 * Default: market_group (budget roll-up).
 */

import { useEffect, useState } from 'react';
import {
  DEFAULT_MARKET_DIMENSION,
  normalizeMarketDimension,
} from '../lib/marketRollup';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

export const MARKET_DIMENSION_OPTIONS = [
  { key: 'market_group', label: 'Group' },
  { key: 'market', label: 'Market' },
];

export { DEFAULT_MARKET_DIMENSION, normalizeMarketDimension };

export const readGlobalMarketDimension = () => {
  if (typeof window === 'undefined') return DEFAULT_MARKET_DIMENSION;
  return normalizeMarketDimension(window.__taliaGlobalCriteria?.marketDimension);
};

/**
 * Subscribe to StatusBar global criteria for market vs market_group.
 */
export const useGlobalMarketDimension = () => {
  const [marketDimension, setMarketDimension] = useState(readGlobalMarketDimension);

  useEffect(() => {
    const sync = (event) => {
      const next = normalizeMarketDimension(
        event?.detail?.criteria?.marketDimension
          ?? event?.detail?.marketDimension
          ?? window.__taliaGlobalCriteria?.marketDimension
      );
      setMarketDimension(next);
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return marketDimension;
};

export default useGlobalMarketDimension;
