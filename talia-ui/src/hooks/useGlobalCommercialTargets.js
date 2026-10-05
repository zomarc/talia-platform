/**
 * Header switch for commercial book targets. Default off, so panels do not
 * query commercial_book_targets until it is turned on.
 */

import { useEffect, useState } from 'react';
import {
  COMMERCIAL_TARGETS_OFF,
  commercialTargetsEnabled,
  normalizeCommercialTargets,
} from '../lib/commercialBookTargets';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

export { COMMERCIAL_TARGETS_OFF, normalizeCommercialTargets, commercialTargetsEnabled };

export const readGlobalCommercialTargets = () => {
  if (typeof window === 'undefined') return false;
  return commercialTargetsEnabled(window.__taliaGlobalCriteria?.commercialTargets);
};

export const useGlobalCommercialTargets = () => {
  const [enabled, setEnabled] = useState(readGlobalCommercialTargets);

  useEffect(() => {
    const sync = (event) => {
      const raw = event?.detail?.criteria?.commercialTargets
        ?? event?.detail?.commercialTargets
        ?? window.__taliaGlobalCriteria?.commercialTargets;
      setEnabled(commercialTargetsEnabled(raw));
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return enabled;
};
