/**
 * Global departure-month preference (header criteria).
 * Default: all months.
 */

import { useEffect, useState } from 'react';
import {
  ALL_DEPARTURE_MONTH_KEY,
  normalizeGlobalDepartureMonth,
} from '../lib/globalDepartureMonth';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

export {
  ALL_DEPARTURE_MONTH_KEY,
  GLOBAL_DEPARTURE_MONTH_OPTIONS,
  normalizeGlobalDepartureMonth,
  resolveDepartureMonthBounds,
} from '../lib/globalDepartureMonth';

export const readGlobalDepartureMonth = () => {
  if (typeof window === 'undefined') return ALL_DEPARTURE_MONTH_KEY;
  return normalizeGlobalDepartureMonth(window.__taliaGlobalCriteria?.departureMonth);
};

/**
 * Subscribe to StatusBar global criteria for departure calendar month.
 */
export const useGlobalDepartureMonth = () => {
  const [departureMonth, setDepartureMonth] = useState(readGlobalDepartureMonth);

  useEffect(() => {
    const sync = (event) => {
      const next = normalizeGlobalDepartureMonth(
        event?.detail?.criteria?.departureMonth
          ?? event?.detail?.departureMonth
          ?? window.__taliaGlobalCriteria?.departureMonth
      );
      setDepartureMonth(next);
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return departureMonth;
};

export default useGlobalDepartureMonth;
