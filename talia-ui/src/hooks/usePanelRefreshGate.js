import { useCallback, useEffect, useRef, useState } from 'react';
import { REPORT_PANEL_PAUSE_EVENT } from '../components/dockview/eventConstants';
import { usePanelShell } from '../contexts/PanelShellContext';
import { isPanelPaused } from '../lib/panelPause';

/**
 * Framework pause gate for panel refresh paths.
 * Prefer ReportShell PanelShellContext when present so pause is one source of truth.
 * Default: not paused.
 */
const usePanelRefreshGate = (panelInstanceId = null, panelComponentId = null) => {
  const shell = usePanelShell();
  const instanceId = panelInstanceId || shell?.panelInstanceId || null;
  const componentId = panelComponentId || shell?.panelComponentId || null;

  // Inside ReportShell for this instance — reuse provider gate (framework path).
  const shellOwnsGate = Boolean(
    shell?.panelInstanceId
    && instanceId
    && shell.panelInstanceId === instanceId
    && typeof shell.shouldSkipRefresh === 'function'
  );

  const [isPausedLocal, setIsPausedLocal] = useState(() => (
    isPanelPaused(instanceId, componentId) === true
  ));
  const isPausedRefLocal = useRef(isPausedLocal);
  const pendingRefreshOnResumeRef = useRef(false);
  const resumeHandlerRef = useRef(null);

  useEffect(() => {
    if (shellOwnsGate) return undefined;
    isPausedRefLocal.current = isPausedLocal;
    return undefined;
  }, [isPausedLocal, shellOwnsGate]);

  useEffect(() => {
    if (shellOwnsGate) return undefined;

    const next = isPanelPaused(instanceId, componentId) === true;
    isPausedRefLocal.current = next;
    setIsPausedLocal(next);

    const onPauseChanged = (event) => {
      const detail = event?.detail || {};
      const targetPanelId = detail.panelId || null;
      const targetPanelComponent = detail.panelComponent || null;
      const matchedByInstance = Boolean(instanceId && targetPanelId === instanceId);
      const matchedByComponent = Boolean(
        !instanceId
        && componentId
        && targetPanelComponent === componentId
      );
      if (!matchedByInstance && !matchedByComponent) return;

      const nextPaused = detail.paused === true;
      isPausedRefLocal.current = nextPaused;
      setIsPausedLocal(nextPaused);

      if (!nextPaused && pendingRefreshOnResumeRef.current) {
        pendingRefreshOnResumeRef.current = false;
        const resumeFn = resumeHandlerRef.current;
        if (typeof resumeFn === 'function') resumeFn();
      }
    };

    window.addEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
    return () => window.removeEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
  }, [componentId, instanceId, shellOwnsGate]);

  const shouldSkipRefreshLocal = useCallback(() => {
    if (!isPausedRefLocal.current) return false;
    pendingRefreshOnResumeRef.current = true;
    return true;
  }, []);

  const onResumeLocal = useCallback((fn) => {
    resumeHandlerRef.current = typeof fn === 'function' ? fn : null;
  }, []);

  if (shellOwnsGate) {
    return {
      isPaused: shell.isPaused === true,
      isPausedRef: shell.isPausedRef,
      shouldSkipRefresh: shell.shouldSkipRefresh,
      // Returns unsubscribe — use as useEffect cleanup.
      onResume: (fn) => (
        typeof shell.subscribeResume === 'function'
          ? shell.subscribeResume(fn)
          : (shell.onResume(fn), () => {})
      ),
      panelInstanceId: instanceId,
      panelComponentId: componentId,
    };
  }

  return {
    isPaused: isPausedLocal,
    isPausedRef: isPausedRefLocal,
    shouldSkipRefresh: shouldSkipRefreshLocal,
    onResume: (fn) => {
      onResumeLocal(fn);
      return () => onResumeLocal(null);
    },
    panelInstanceId: instanceId,
    panelComponentId: componentId,
  };
};

export default usePanelRefreshGate;
