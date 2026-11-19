import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { REPORT_PANEL_PAUSE_EVENT } from '../components/dockview/eventConstants';
import { isPanelPaused } from '../lib/panelPause';

/**
 * Framework panel identity + pause. Provided by ReportShell so shared hooks
 * (fetch, loading wash, bus listeners) gate refresh without each panel
 * re-implementing pause checks.
 */
export const PanelShellContext = createContext({
  panelInstanceId: null,
  panelComponentId: null,
  isPaused: false,
  isPausedRef: { current: false },
  shouldSkipRefresh: () => false,
  /** @param {() => void} fn @returns {() => void} unsubscribe */
  subscribeResume: () => () => {},
  /** @deprecated prefer subscribeResume — kept for hook compatibility */
  onResume: () => {},
});

export const usePanelShell = () => useContext(PanelShellContext);

/**
 * Provider used by ReportShell. Default: not paused.
 */
export const PanelShellProvider = ({
  panelInstanceId = null,
  panelComponentId = null,
  children,
}) => {
  const [isPaused, setIsPaused] = useState(() => (
    isPanelPaused(panelInstanceId, panelComponentId) === true
  ));
  const isPausedRef = useRef(isPaused);
  const pendingRefreshOnResumeRef = useRef(false);
  const resumeHandlersRef = useRef(new Set());

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const next = isPanelPaused(panelInstanceId, panelComponentId) === true;
    isPausedRef.current = next;
    setIsPaused(next);

    const onPauseChanged = (event) => {
      const detail = event?.detail || {};
      const targetPanelId = detail.panelId || null;
      if (!panelInstanceId || !targetPanelId || targetPanelId !== panelInstanceId) return;

      const nextPaused = detail.paused === true;
      isPausedRef.current = nextPaused;
      setIsPaused(nextPaused);

      if (!nextPaused && pendingRefreshOnResumeRef.current) {
        pendingRefreshOnResumeRef.current = false;
        resumeHandlersRef.current.forEach((fn) => {
          try { fn(); } catch { /* ignore listener errors */ }
        });
      }
    };

    window.addEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
    return () => window.removeEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
  }, [panelComponentId, panelInstanceId]);

  const value = useMemo(() => {
    const shouldSkipRefresh = () => {
      if (!isPausedRef.current) return false;
      pendingRefreshOnResumeRef.current = true;
      return true;
    };
    const subscribeResume = (fn) => {
      if (typeof fn !== 'function') return () => {};
      resumeHandlersRef.current.add(fn);
      return () => {
        resumeHandlersRef.current.delete(fn);
      };
    };
    // Compatibility: onResume(fn) subscribes; onResume(null) is a no-op
    // (cleanup must use the unsubscribe from a prior subscribe via effect).
    const onResume = (fn) => {
      if (typeof fn !== 'function') return;
      resumeHandlersRef.current.add(fn);
    };
    return {
      panelInstanceId,
      panelComponentId,
      isPaused,
      isPausedRef,
      shouldSkipRefresh,
      subscribeResume,
      onResume,
    };
  }, [isPaused, panelComponentId, panelInstanceId]);

  return (
    <PanelShellContext.Provider value={value}>
      {children}
    </PanelShellContext.Provider>
  );
};

export default PanelShellContext;
