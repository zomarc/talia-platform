/**
 * Shared pause/resume for Dockview report panels.
 * Used by P-key (Dashboard) and the tab Pause/Play chrome button.
 *
 * Framework path (prefer this):
 * - ReportShell → PanelShellProvider (identity + pause)
 * - usePanelRefreshGate / usePanelTrackedFetch / useTableDataWithContext
 *   / useReportPanelLoading / usePanelBusListener read that context
 * - Default: not paused. Source availability is a separate gate at fetch time.
 *
 * Custom panels: use usePanelTrackedFetch (or usePanelRefreshGate) and
 * usePanelBusListener so selection/refresh no-ops while paused.
 */

import { REPORT_PANEL_PAUSE_EVENT } from '../components/dockview/eventConstants';
import userActivityTracker from '../services/userActivityTracker';

export const isPanelPaused = (panelInstanceId, panelComponentId = null) => {
  const state = (typeof window !== 'undefined' && window.__taliaPanelPauseState) || {};
  if (panelInstanceId && Object.prototype.hasOwnProperty.call(state, panelInstanceId)) {
    return state[panelInstanceId] === true;
  }
  if (panelComponentId && Object.prototype.hasOwnProperty.call(state, panelComponentId)) {
    return state[panelComponentId] === true;
  }
  return false;
};

/**
 * Throw when a panel is paused so shared fetch helpers can fail closed.
 * Default (no pause state) allows refresh.
 */
export const assertPanelNotPaused = (panelInstanceId = null, panelComponentId = null) => {
  if (!isPanelPaused(panelInstanceId, panelComponentId)) return;
  const error = new Error('Panel paused — refresh skipped.');
  error.code = 'PANEL_PAUSED';
  throw error;
};

/**
 * Toggle pause for a panel instance. Returns the next paused state, or null if no id.
 * @param {string|null} panelInstanceId
 * @param {string|null} [panelComponent]
 */
export const togglePanelPause = (panelInstanceId, panelComponent = null) => {
  const panelId = panelInstanceId || null;
  if (!panelId || typeof window === 'undefined') return null;

  const current = window.__taliaPanelPauseState || {};
  const nextPaused = !(current[panelId] === true);
  window.__taliaPanelPauseState = {
    ...current,
    [panelId]: nextPaused,
  };
  window.dispatchEvent(
    new CustomEvent(REPORT_PANEL_PAUSE_EVENT, {
      detail: {
        panelId,
        panelComponent: panelComponent || null,
        paused: nextPaused,
      },
    })
  );

  userActivityTracker.recordHeaderAction('panel-pause-toggle', {
    status: nextPaused ? 'paused' : 'resumed',
    panelId,
    panelComponent: panelComponent || undefined,
  });

  return nextPaused;
};
