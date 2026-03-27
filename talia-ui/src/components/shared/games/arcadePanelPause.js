import { REPORT_PANEL_PAUSE_EVENT } from '../../dockview/eventConstants';

/**
 * Clears user-initiated panel pause (P key) for a focus-panel game instance.
 * Isolated from Dashboard — only uses the same event channel as the rest of the shell.
 */
export const resumeArcadePanelFromUserPause = (panelInstanceId, panelComponentId) => {
  if (!panelInstanceId) return;
  const current = window.__taliaPanelPauseState || {};
  if (current[panelInstanceId] !== true) return;
  window.__taliaPanelPauseState = {
    ...current,
    [panelInstanceId]: false,
  };
  window.dispatchEvent(
    new CustomEvent(REPORT_PANEL_PAUSE_EVENT, {
      detail: {
        panelId: panelInstanceId,
        panelComponent: panelComponentId || null,
        paused: false,
      },
    })
  );
};
