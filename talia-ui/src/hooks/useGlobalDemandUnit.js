/**
 * Subscribe to StatusBar global demand presentation unit (pax vs cabins).
 */

import { useEffect, useState } from 'react';
import {
  DEFAULT_DEMAND_UNIT,
  DEMAND_UNIT_OPTIONS,
  normalizeDemandUnit,
} from '../lib/demandUnit';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

export { DEFAULT_DEMAND_UNIT, DEMAND_UNIT_OPTIONS, normalizeDemandUnit };

export const readGlobalDemandUnit = () => {
  if (typeof window === 'undefined') return DEFAULT_DEMAND_UNIT;
  return normalizeDemandUnit(window.__taliaGlobalCriteria?.demandUnit);
};

/**
 * Presentation unit only — demand math stays at guests.
 */
export const useGlobalDemandUnit = () => {
  const [demandUnit, setDemandUnit] = useState(readGlobalDemandUnit);

  useEffect(() => {
    const sync = (event) => {
      const next = normalizeDemandUnit(
        event?.detail?.criteria?.demandUnit
          ?? event?.detail?.demandUnit
          ?? window.__taliaGlobalCriteria?.demandUnit
      );
      setDemandUnit(next);
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return demandUnit;
};

export default useGlobalDemandUnit;
