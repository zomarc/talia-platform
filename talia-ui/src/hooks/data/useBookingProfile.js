/**
 * Hooks for booking profile (dimensional REAL + optional YoY + budget).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import bookingProfileService from '../../services/data/bookingProfileService';
import { REPORT_REFRESH_EVENT } from '../../components/dockview/eventConstants';
import usePanelRefreshGate from '../usePanelRefreshGate';
import useReportPanelLoading from '../useReportPanelLoading';

/**
 * Primary hook: inventory-scoped dimensional profile.
 */
export const useBookingProfileDimensional = (sailCode, options = {}) => {
  const {
    breakdown = 'none',
    includeComparison = false,
    previousYearSailCode = null,
    includeBudget = false,
    budgetBreakdown = null,
    panelInstanceId = null,
    panelComponentId = null,
  } = options;

  const [data, setData] = useState(null);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchDataRef = useRef(null);
  const { shouldSkipRefresh, onResume } = usePanelRefreshGate(panelInstanceId, panelComponentId);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading);

  const fetchData = useCallback(async () => {
    if (shouldSkipRefresh()) return;
    if (!sailCode) {
      setLoading(false);
      setData(null);
      setBudget(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let profileResult;
      if (includeComparison) {
        profileResult = await bookingProfileService.fetchDimensionalYoY(
          sailCode,
          breakdown,
          previousYearSailCode
        );
      } else {
        profileResult = await bookingProfileService.fetchDimensional(sailCode, breakdown);
      }
      setData(profileResult);

      if (includeBudget) {
        const budBreak = budgetBreakdown || (breakdown === 'none' ? 'market_group' : breakdown);
        try {
          const budgetResult = await bookingProfileService.fetchBudgetComparison(
            sailCode,
            budBreak
          );
          setBudget(budgetResult);
        } catch (budgetErr) {
          console.warn('[useBookingProfileDimensional] budget:', budgetErr);
          setBudget(null);
        }
      } else {
        setBudget(null);
      }
    } catch (err) {
      console.error('[useBookingProfileDimensional] Error:', err);
      setError(err);
      setData(null);
      setBudget(null);
    } finally {
      setLoading(false);
    }
  }, [
    breakdown,
    budgetBreakdown,
    includeBudget,
    includeComparison,
    previousYearSailCode,
    sailCode,
    shouldSkipRefresh,
  ]);

  fetchDataRef.current = fetchData;

  useEffect(() => {
    const unsubscribe = onResume(() => { fetchDataRef.current?.(); });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [onResume]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, budget, loading, error, refetch: fetchData };
};

/**
 * Reservation-only booking curve: original book date, MSE-aligned cabins, market stack.
 */
export const useReservationBookingCurve = (sailCode, options = {}) => {
  const {
    marketBreakdown = 'market_group',
    seriesMode = 'market',
    includeCompetitor = false,
    panelInstanceId = null,
    panelComponentId = null,
  } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchDataRef = useRef(null);
  const { shouldSkipRefresh, onResume } = usePanelRefreshGate(panelInstanceId, panelComponentId);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading);

  const fetchData = useCallback(async () => {
    if (shouldSkipRefresh()) return;
    if (!sailCode) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await bookingProfileService.fetchReservationCurve(sailCode, {
        marketBreakdown,
        seriesMode,
        includeCompetitor,
      });
      setData(result);
    } catch (err) {
      console.error('[useReservationBookingCurve] Error:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sailCode, marketBreakdown, seriesMode, includeCompetitor, shouldSkipRefresh]);

  fetchDataRef.current = fetchData;

  useEffect(() => {
    const unsubscribe = onResume(() => { fetchDataRef.current?.(); });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [onResume]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleRefresh = (event) => {
      const detail = event?.detail || {};
      const targetPanel = detail.panelId;
      const targetInstance = detail.panelInstanceId;
      const targetComponent = detail.panelComponent;
      const scope = detail.scope;
      const isGlobal = scope === 'all' || (!targetPanel && !targetInstance && !targetComponent);
      const isMatch = (
        (panelComponentId && (targetPanel === panelComponentId || targetComponent === panelComponentId))
        || (panelInstanceId && (targetInstance === panelInstanceId || targetPanel === panelInstanceId))
      );
      if (!isGlobal && !isMatch) return;
      fetchData();
    };
    window.addEventListener(REPORT_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(REPORT_REFRESH_EVENT, handleRefresh);
  }, [fetchData, panelComponentId, panelInstanceId]);

  return { data, loading, error, refetch: fetchData };
};

/** @deprecated Prefer useBookingProfileDimensional */
export const useBookingProfile = (sailCode, options = {}) => {
  const { includeComparison = false, previousYearSailCode = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!sailCode) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let result;
      if (includeComparison) {
        const prev =
          previousYearSailCode ||
          bookingProfileService.generatePreviousYearSailCode(sailCode);
        result = await bookingProfileService.fetchWithComparison(sailCode, prev);
      } else {
        result = await bookingProfileService.fetch(sailCode);
      }
      setData(result);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sailCode, includeComparison, previousYearSailCode]);

  return { data, loading, error, refetch: fetchData };
};

/** @deprecated Prefer useBookingProfileDimensional */
export const useBookingProfileWithCurves = (sailCode, options = {}) => {
  const { includeComparison = false, previousYearSailCode = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!sailCode) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let result;
      if (includeComparison) {
        const prev =
          previousYearSailCode ||
          bookingProfileService.generatePreviousYearSailCode(sailCode);
        result = await bookingProfileService.fetchWithComparison(sailCode, prev);
      } else {
        result = await bookingProfileService.fetchWithBuildCurves(sailCode);
      }
      setData(result);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sailCode, includeComparison, previousYearSailCode]);

  return { data, loading, error, refetch: fetchData };
};
