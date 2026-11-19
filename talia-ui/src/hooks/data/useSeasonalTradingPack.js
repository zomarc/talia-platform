/**
 * Hook for Seasonal Trading Pack (fleet commercial weekly pack).
 *
 * Cold browser starts (and slower devices) often race the heavy GraphQL pack
 * query: Apollo errorPolicy:'all' can yield a null pack, and Strict Mode /
 * remounts can let a late failure overwrite a later success. We retry with
 * backoff while staying in loading, and ignore stale request results.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import seasonalTradingPackService from '../../services/data/seasonalTradingPackService';
import { REPORT_REFRESH_EVENT } from '../../components/dockview/eventConstants';
import usePanelRefreshGate from '../usePanelRefreshGate';
import useReportPanelLoading from '../useReportPanelLoading';

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 600;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (err) => {
  if (!err) return false;
  if (err.networkError) return true;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('no seasonal trading pack returned')
    || msg.includes('network')
    || msg.includes('failed to fetch')
    || msg.includes('fetch failed')
    || msg.includes('timeout')
    || msg.includes('timed out')
    || msg.includes('econnrefused')
    || msg.includes('econnreset')
    || msg.includes('503')
    || msg.includes('502')
    || msg.includes('504')
    || msg.includes('gateway')
    || msg.includes('temporarily')
    || msg.includes('overload')
  );
};

export const useSeasonalTradingPack = (filters = {}, options = {}) => {
  const { panelInstanceId = null, panelComponentId = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const fetchDataRef = useRef(null);
  const { shouldSkipRefresh, onResume } = usePanelRefreshGate(panelInstanceId, panelComponentId);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading);

  const filtersKey = JSON.stringify(filters || {});

  const fetchData = useCallback(async () => {
    if (shouldSkipRefresh()) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    let lastError = null;

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        if (requestId !== requestIdRef.current) return;

        try {
          const result = await seasonalTradingPackService.fetchPack(filters);
          if (requestId !== requestIdRef.current) return;
          setData(result);
          setError(null);
          return;
        } catch (err) {
          lastError = err;
          const canRetry = attempt < MAX_ATTEMPTS && isRetryableError(err);
          if (!canRetry) break;
          // Exponential backoff; keep loading UI visible (no error flash).
          await sleep(BASE_DELAY_MS * (2 ** (attempt - 1)));
        }
      }

      if (requestId !== requestIdRef.current) return;
      console.error('[useSeasonalTradingPack] Error:', lastError);
      setError(lastError || new Error('Failed to load seasonal trading pack'));
      // Keep prior successful data if present (manual refresh failure).
      setData((prev) => prev ?? null);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filtersKey, shouldSkipRefresh]); // eslint-disable-line react-hooks/exhaustive-deps -- filters serialized

  fetchDataRef.current = fetchData;

  useEffect(() => {
    const unsubscribe = onResume(() => { fetchDataRef.current?.(); });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [onResume]);

  useEffect(() => {
    fetchData();
    return () => {
      // Invalidate in-flight work so remounts / filter changes don't apply stale results.
      requestIdRef.current += 1;
    };
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

export default useSeasonalTradingPack;
