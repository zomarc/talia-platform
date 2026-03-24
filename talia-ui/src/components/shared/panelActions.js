export const PANEL_ACTION_IDS = Object.freeze({
  STATUS: 'status',
  REVIEW: 'review',
  SYNC: 'sync',
  FULL: 'full',
  UPDATE: 'update',
  DETAIL: 'detail',
});

export const PANEL_ACTION_SEQUENCE = Object.freeze([
  PANEL_ACTION_IDS.STATUS,
  PANEL_ACTION_IDS.REVIEW,
  PANEL_ACTION_IDS.SYNC,
  PANEL_ACTION_IDS.FULL,
  PANEL_ACTION_IDS.UPDATE,
  PANEL_ACTION_IDS.DETAIL,
]);

export const PANEL_ACTION_DEFINITIONS = Object.freeze({
  [PANEL_ACTION_IDS.STATUS]: {
    id: PANEL_ACTION_IDS.STATUS,
    label: 'Status',
    icon: '🧾',
    tone: 'neutral',
    title: 'View status details',
  },
  [PANEL_ACTION_IDS.REVIEW]: {
    id: PANEL_ACTION_IDS.REVIEW,
    label: 'Review',
    icon: '👁️',
    tone: 'success',
    title: 'Review table rows',
  },
  [PANEL_ACTION_IDS.SYNC]: {
    id: PANEL_ACTION_IDS.SYNC,
    label: 'Sync',
    icon: '🔄',
    tone: 'primary',
    title: 'Run incremental sync',
  },
  [PANEL_ACTION_IDS.FULL]: {
    id: PANEL_ACTION_IDS.FULL,
    label: 'Full',
    icon: '⚡',
    tone: 'warning',
    title: 'Run full refresh',
  },
  [PANEL_ACTION_IDS.UPDATE]: {
    id: PANEL_ACTION_IDS.UPDATE,
    label: 'Update',
    icon: '↻',
    tone: 'primary',
    title: 'Refresh panel data',
  },
  [PANEL_ACTION_IDS.DETAIL]: {
    id: PANEL_ACTION_IDS.DETAIL,
    label: 'Detail',
    icon: '⋯',
    tone: 'neutral',
    title: 'Toggle detail sections',
  },
});

export const getPanelActionDefinition = (actionId) => (
  PANEL_ACTION_DEFINITIONS[actionId] || null
);

