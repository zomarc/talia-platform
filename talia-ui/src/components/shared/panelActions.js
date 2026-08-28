import { panelActionIconMarkup } from './StatusBarIcons';

export const PANEL_ACTION_IDS = Object.freeze({
  STATUS: 'status',
  REVIEW: 'review',
  SYNC: 'sync',
  FULL: 'full',
  STOP: 'stop',
  UPDATE: 'update',
  DETAIL: 'detail',
});

export const PANEL_ACTION_SEQUENCE = Object.freeze([
  PANEL_ACTION_IDS.STATUS,
  PANEL_ACTION_IDS.REVIEW,
  PANEL_ACTION_IDS.SYNC,
  PANEL_ACTION_IDS.FULL,
  PANEL_ACTION_IDS.STOP,
  PANEL_ACTION_IDS.UPDATE,
  PANEL_ACTION_IDS.DETAIL,
]);

export const PANEL_ACTION_DEFINITIONS = Object.freeze({
  [PANEL_ACTION_IDS.STATUS]: {
    id: PANEL_ACTION_IDS.STATUS,
    label: 'Status',
    iconKey: 'status',
    tone: 'neutral',
    title: 'View status details',
  },
  [PANEL_ACTION_IDS.REVIEW]: {
    id: PANEL_ACTION_IDS.REVIEW,
    label: 'Review',
    iconKey: 'eye',
    tone: 'success',
    title: 'Review table rows',
  },
  [PANEL_ACTION_IDS.SYNC]: {
    id: PANEL_ACTION_IDS.SYNC,
    label: 'Sync',
    iconKey: 'refresh',
    tone: 'primary',
    title: 'Run incremental sync',
  },
  [PANEL_ACTION_IDS.FULL]: {
    id: PANEL_ACTION_IDS.FULL,
    label: 'Full',
    iconKey: 'bolt',
    tone: 'warning',
    title: 'Run full refresh',
  },
  [PANEL_ACTION_IDS.STOP]: {
    id: PANEL_ACTION_IDS.STOP,
    label: 'Stop',
    iconKey: 'stop',
    tone: 'danger',
    title: 'Stop the running table sync',
  },
  [PANEL_ACTION_IDS.UPDATE]: {
    id: PANEL_ACTION_IDS.UPDATE,
    label: 'Update',
    iconKey: 'refresh',
    tone: 'primary',
    title: 'Refresh panel data',
  },
  [PANEL_ACTION_IDS.DETAIL]: {
    id: PANEL_ACTION_IDS.DETAIL,
    label: 'Detail',
    iconKey: 'detail',
    tone: 'neutral',
    title: 'Toggle detail sections',
  },
});

export const getPanelActionDefinition = (actionId) => (
  PANEL_ACTION_DEFINITIONS[actionId] || null
);

/** HTML icon for Tabulator / string formatters (never emoji). */
export const getPanelActionIconMarkup = (actionId, { busy = false } = {}) => (
  panelActionIconMarkup(actionId, { busy })
);
