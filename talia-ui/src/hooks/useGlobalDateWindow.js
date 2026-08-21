/**
 * Subscribe to StatusBar global dateFrom / dateTo from __taliaGlobalCriteria.
 */

import { useEffect, useState } from 'react';

export const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

const normalizeDate = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const readGlobalDateWindow = () => {
  if (typeof window === 'undefined') return { dateFrom: null, dateTo: null };
  const criteria = window.__taliaGlobalCriteria;
  if (!criteria || typeof criteria !== 'object') return { dateFrom: null, dateTo: null };
  return {
    dateFrom: normalizeDate(criteria.dateFrom),
    dateTo: normalizeDate(criteria.dateTo),
  };
};

export const useGlobalDateWindow = () => {
  const [windowDates, setWindowDates] = useState(readGlobalDateWindow);

  useEffect(() => {
    const sync = (event) => {
      const next = {
        dateFrom: normalizeDate(
          event?.detail?.criteria?.dateFrom
            ?? event?.detail?.dateFrom
            ?? window.__taliaGlobalCriteria?.dateFrom
        ),
        dateTo: normalizeDate(
          event?.detail?.criteria?.dateTo
            ?? event?.detail?.dateTo
            ?? window.__taliaGlobalCriteria?.dateTo
        ),
      };
      setWindowDates((prev) => (
        prev.dateFrom === next.dateFrom && prev.dateTo === next.dateTo
          ? prev
          : next
      ));
    };
    sync();
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, sync);
  }, []);

  return windowDates;
};

export default useGlobalDateWindow;
