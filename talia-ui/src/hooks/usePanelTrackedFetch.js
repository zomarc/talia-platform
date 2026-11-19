import { useCallback, useEffect, useRef } from 'react';
import { trackedFetchGraphql } from '../services/data/trackedGraphql';
import usePanelRefreshGate from './usePanelRefreshGate';

/**
 * Framework panel GraphQL fetch.
 * Pause + source gates apply automatically via PanelShellContext / usePanelRefreshGate.
 * Prefer calling with no ids when rendered under ReportShell.
 *
 * @param {string|null|undefined} [panelInstanceId]
 * @param {string|null|undefined} [panelComponentId]
 */
const usePanelTrackedFetch = (panelInstanceId = null, panelComponentId = null) => {
  const {
    isPaused,
    shouldSkipRefresh,
    onResume,
    panelInstanceId: resolvedInstanceId,
    panelComponentId: resolvedComponentId,
  } = usePanelRefreshGate(panelInstanceId, panelComponentId);
  const resumeHandlerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onResume(() => {
      const fn = resumeHandlerRef.current;
      if (typeof fn === 'function') fn();
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [onResume]);

  const fetchGraphql = useCallback(async (options = {}) => {
    if (shouldSkipRefresh()) {
      const error = new Error('Panel paused — refresh skipped.');
      error.code = 'PANEL_PAUSED';
      throw error;
    }
    return trackedFetchGraphql({
      ...options,
      panelInstanceId: options.panelInstanceId || resolvedInstanceId || null,
      panelComponentId: options.panelComponentId || resolvedComponentId || null,
      component: options.component || resolvedComponentId || 'Unknown',
    });
  }, [resolvedComponentId, resolvedInstanceId, shouldSkipRefresh]);

  const onResumeFetch = useCallback((fn) => {
    resumeHandlerRef.current = typeof fn === 'function' ? fn : null;
  }, []);

  return {
    isPaused,
    shouldSkipRefresh,
    fetchGraphql,
    onResumeFetch,
    panelInstanceId: resolvedInstanceId,
    panelComponentId: resolvedComponentId,
  };
};

export default usePanelTrackedFetch;
