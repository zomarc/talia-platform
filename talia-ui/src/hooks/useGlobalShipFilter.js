/**
 * Subscribe to / publish StatusBar global ship filter (All | ship_code).
 */

import { useEffect, useState } from 'react';
import { publishDashboardGlobalConfig } from '../services/dashboardUiState';
import {
  SHIP_FILTER_ALL,
  isShipFilterActive,
  normalizeGlobalShipCode,
} from '../lib/globalShipFilter';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

export {
  SHIP_FILTER_ALL,
  isShipFilterActive,
  normalizeGlobalShipCode,
};

export const readGlobalShipCode = () => {
  if (typeof window === 'undefined') return SHIP_FILTER_ALL;
  return normalizeGlobalShipCode(window.__taliaGlobalCriteria?.shipCode);
};

/** Patch global criteria shipCode and notify subscribers (StatusBar + panels). */
export const setGlobalShipCode = (shipCode) => {
  if (typeof window === 'undefined') return SHIP_FILTER_ALL;
  const next = normalizeGlobalShipCode(shipCode);
  const prev = (
    window.__taliaGlobalCriteria && typeof window.__taliaGlobalCriteria === 'object'
      ? window.__taliaGlobalCriteria
      : {}
  );
  if (normalizeGlobalShipCode(prev.shipCode) === next) return next;
  const criteria = { ...prev, shipCode: next };
  window.__taliaGlobalCriteria = criteria;
  publishDashboardGlobalConfig({ criteria });
  return next;
};

export const useGlobalShipFilter = () => {
  const [shipCode, setShipCode] = useState(readGlobalShipCode);

  useEffect(() => {
    const sync = (event) => {
      const next = normalizeGlobalShipCode(
        event?.detail?.criteria?.shipCode
          ?? event?.detail?.shipCode
          ?? window.__taliaGlobalCriteria?.shipCode
      );
      setShipCode((prev) => (prev === next ? prev : next));
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return shipCode;
};

export default useGlobalShipFilter;
