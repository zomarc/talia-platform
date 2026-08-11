/**
 * Subscribe to StatusBar global cabin category mode (real vs group).
 */

import { useEffect, useState } from 'react';
import {
  CABIN_CATEGORY_MODE_OPTIONS,
  DEFAULT_CABIN_CATEGORY_MODE,
  normalizeCabinCategoryMode,
} from '../lib/cabinCategoryGroups';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

export { CABIN_CATEGORY_MODE_OPTIONS, DEFAULT_CABIN_CATEGORY_MODE, normalizeCabinCategoryMode };

export const readGlobalCabinCategoryMode = () => {
  if (typeof window === 'undefined') return DEFAULT_CABIN_CATEGORY_MODE;
  return normalizeCabinCategoryMode(window.__taliaGlobalCriteria?.cabinCategoryMode);
};

export const useGlobalCabinCategoryMode = () => {
  const [cabinCategoryMode, setCabinCategoryMode] = useState(readGlobalCabinCategoryMode);

  useEffect(() => {
    const sync = (event) => {
      const next = normalizeCabinCategoryMode(
        event?.detail?.criteria?.cabinCategoryMode
          ?? event?.detail?.cabinCategoryMode
          ?? window.__taliaGlobalCriteria?.cabinCategoryMode
      );
      setCabinCategoryMode(next);
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return cabinCategoryMode;
};

export default useGlobalCabinCategoryMode;
