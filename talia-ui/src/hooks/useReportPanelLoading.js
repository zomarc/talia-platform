import { useId, useLayoutEffect } from 'react';
import { syncPanelLoadingSource } from '../services/panelLoadingState';

/**
 * Publish a panel's in-flight loading state to the Dockview tab + ReportShell.
 * Pass the raw fetch busy flag (not `loading && !data`) so refreshes that keep
 * prior content still show the tab spinner / shell overlay.
 * Safe to call from multiple hooks in the same panel (merged by source id).
 */
const useReportPanelLoading = (panelInstanceId, panelComponentId, loading) => {
  const sourceId = useId();

  useLayoutEffect(() => {
    if (!panelInstanceId && !panelComponentId) {
      return undefined;
    }
    syncPanelLoadingSource(panelInstanceId, panelComponentId, sourceId, loading === true);
    return () => {
      syncPanelLoadingSource(panelInstanceId, panelComponentId, sourceId, false);
    };
  }, [panelInstanceId, panelComponentId, loading, sourceId]);
};

export default useReportPanelLoading;
