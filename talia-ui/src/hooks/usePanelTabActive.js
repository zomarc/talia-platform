import { useEffect, useState } from 'react';
import { REPORT_ACTIVE_PANEL_EVENT } from '../components/dockview/eventConstants';

const readActivePanelId = () => {
  try {
    if (typeof window === 'undefined') return null;
    return window.__taliaActivePanelId || null;
  } catch {
    return null;
  }
};

const getInitialState = (panelInstanceId) => {
  if (!panelInstanceId) return true;
  const activePanelId = readActivePanelId();
  if (!activePanelId) return true;
  return activePanelId === panelInstanceId;
};

const usePanelTabActive = (panelInstanceId) => {
  const [isActive, setIsActive] = useState(() => getInitialState(panelInstanceId));

  useEffect(() => {
    if (!panelInstanceId) {
      setIsActive(true);
      return undefined;
    }
    setIsActive(getInitialState(panelInstanceId));

    const onPanelActivityChanged = (event) => {
      const activePanelId = event?.detail?.activePanelId || null;
      if (!activePanelId) {
        setIsActive(true);
        return;
      }
      setIsActive(activePanelId === panelInstanceId);
    };

    const syncFromDockviewApi = () => {
      const activePanelId = window?.dockviewApi?.activePanel?.id || null;
      if (!activePanelId) {
        setIsActive(true);
        return;
      }
      setIsActive(activePanelId === panelInstanceId);
    };

    const syncAfterInteraction = () => {
      // Defer until after Dockview processes tab focus changes.
      window.requestAnimationFrame(() => {
        window.setTimeout(syncFromDockviewApi, 0);
      });
    };

    window.addEventListener(REPORT_ACTIVE_PANEL_EVENT, onPanelActivityChanged);
    // Fallback for environments where active-panel event emission is delayed.
    window.addEventListener('pointerup', syncAfterInteraction);
    window.addEventListener('click', syncAfterInteraction);
    window.addEventListener('visibilitychange', syncFromDockviewApi);
    return () => {
      window.removeEventListener(REPORT_ACTIVE_PANEL_EVENT, onPanelActivityChanged);
      window.removeEventListener('pointerup', syncAfterInteraction);
      window.removeEventListener('click', syncAfterInteraction);
      window.removeEventListener('visibilitychange', syncFromDockviewApi);
    };
  }, [panelInstanceId]);

  return isActive;
};

export default usePanelTabActive;
