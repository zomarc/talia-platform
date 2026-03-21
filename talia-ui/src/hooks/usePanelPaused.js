import { useEffect, useState } from 'react';
import { REPORT_PANEL_PAUSE_EVENT } from '../components/dockview/eventConstants';

const getInitialPausedState = (panelInstanceId, panelComponentId) => {
  const state = window.__taliaPanelPauseState || {};
  if (panelInstanceId && Object.prototype.hasOwnProperty.call(state, panelInstanceId)) {
    return state[panelInstanceId] === true;
  }
  if (panelComponentId && Object.prototype.hasOwnProperty.call(state, panelComponentId)) {
    return state[panelComponentId] === true;
  }
  return false;
};

const usePanelPaused = (panelInstanceId, panelComponentId = null) => {
  const [isPaused, setIsPaused] = useState(() => getInitialPausedState(panelInstanceId, panelComponentId));

  useEffect(() => {
    setIsPaused(getInitialPausedState(panelInstanceId, panelComponentId));

    const onPauseChanged = (event) => {
      const detail = event?.detail || {};
      const targetPanelId = detail.panelId || null;
      const targetPanelComponent = detail.panelComponent || null;
      if (panelInstanceId && targetPanelId === panelInstanceId) {
        setIsPaused(detail.paused === true);
        return;
      }
      if (!panelInstanceId && panelComponentId && targetPanelComponent === panelComponentId) {
        setIsPaused(detail.paused === true);
      }
    };

    window.addEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
    return () => window.removeEventListener(REPORT_PANEL_PAUSE_EVENT, onPauseChanged);
  }, [panelComponentId, panelInstanceId]);

  return isPaused;
};

export default usePanelPaused;

