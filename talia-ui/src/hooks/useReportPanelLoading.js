import { useId, useLayoutEffect } from 'react';
import { usePanelShell } from '../contexts/PanelShellContext';
import { isPanelPaused } from '../lib/panelPause';
import { syncPanelLoadingSource } from '../services/panelLoadingState';

/**
 * Publish a panel's in-flight loading state to the Dockview tab + ReportShell.
 * Pass the raw fetch busy flag (not `loading && !data`) so refreshes that keep
 * prior content still show the tab spinner / shell overlay.
 *
 * Framework: while paused, never publish loading (no wash / tab spinner).
 */
const useReportPanelLoading = (panelInstanceId, panelComponentId, loading) => {
  const sourceId = useId();
  const shell = usePanelShell();
  const instanceId = panelInstanceId || shell?.panelInstanceId || null;
  const componentId = panelComponentId || shell?.panelComponentId || null;
  const paused = shell?.isPaused === true
    || isPanelPaused(instanceId, componentId) === true;
  const effectiveLoading = paused ? false : loading === true;

  useLayoutEffect(() => {
    if (!instanceId && !componentId) {
      return undefined;
    }
    syncPanelLoadingSource(instanceId, componentId, sourceId, effectiveLoading);
    return () => {
      syncPanelLoadingSource(instanceId, componentId, sourceId, false);
    };
  }, [instanceId, componentId, effectiveLoading, sourceId]);
};

export default useReportPanelLoading;
