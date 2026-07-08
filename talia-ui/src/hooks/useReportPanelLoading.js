import { useEffect, useId } from 'react';
import { syncPanelLoadingSource } from '../services/panelLoadingState';

/**
 * Publish a panel's loading state to the Dockview tab header.
 * Safe to call from multiple hooks in the same panel (merged by source id).
 */
const useReportPanelLoading = (panelInstanceId, panelComponentId, loading) => {
  const sourceId = useId();

  useEffect(() => {
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
