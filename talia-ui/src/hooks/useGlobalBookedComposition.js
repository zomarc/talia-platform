/**
 * Global booked composition preference (header criteria).
 * Default: group_fit_expected (FIT booked + Group confirmed + GTY held).
 */

import { useEffect, useState } from 'react';
import {
  DEFAULT_BOOKED_COMPOSITION,
  normalizeBookedComposition,
  BOOKED_COMPOSITION_OPTIONS,
} from '../lib/bookedComposition';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

export { DEFAULT_BOOKED_COMPOSITION, normalizeBookedComposition, BOOKED_COMPOSITION_OPTIONS };

export const readGlobalBookedComposition = () => {
  if (typeof window === 'undefined') return DEFAULT_BOOKED_COMPOSITION;
  return normalizeBookedComposition(window.__taliaGlobalCriteria?.bookedComposition);
};

/**
 * Subscribe to StatusBar global criteria for FIT/Group composition mode.
 */
export const useGlobalBookedComposition = () => {
  const [bookedComposition, setBookedComposition] = useState(readGlobalBookedComposition);

  useEffect(() => {
    const sync = (event) => {
      const next = normalizeBookedComposition(
        event?.detail?.criteria?.bookedComposition
          ?? event?.detail?.bookedComposition
          ?? window.__taliaGlobalCriteria?.bookedComposition
      );
      setBookedComposition(next);
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return bookedComposition;
};

export default useGlobalBookedComposition;
