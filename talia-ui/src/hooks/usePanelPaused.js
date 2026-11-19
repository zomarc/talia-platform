import { useEffect, useState } from 'react';
import { REPORT_PANEL_PAUSE_EVENT } from '../components/dockview/eventConstants';
import { isPanelPaused } from '../lib/panelPause';

/**
 * Reactive pause flag for a panel. Default is not paused.
 * Prefer usePanelRefreshGate when gating network refresh.
 */
const usePanelPaused = (panelInstanceId, panelComponentId = null) => {
  const [isPaused, setIsPaused] = useState(() => (
    isPanelPaused(panelInstanceId, panelComponentId) === true
  ));

  useEffect(() => {
    setIsPaused(isPanelPaused(panelInstanceId, panelComponentId) === true);

    const onPauseChanged = (event) => {
      const detail = event?.detail || {};
      const targetPanelId = detail.panelId || null;
      const targetPanelComponent = detail.panelComponent || null;
      const matchedByInstance = Boolean(panelInstanceId && targetPanelId === panelInstanceId);
      const matchedByComponent = Boolean(
        !panelInstanceId
        && panelComponentId
        && targetPanelComponent === panelComponentId
      );
      if (!matchedByInstance && !matchedByComponent) return;
      setIsPaused(detail.paused === true);
    };

    window.addEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
    return () => window.removeEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
  }, [panelComponentId, panelInstanceId]);

  return isPaused;
};

export default usePanelPaused;

