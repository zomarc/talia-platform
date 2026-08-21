/**
 * Per-component Views / Operations catalog and helpers.
 * Views = non-restrictive personalization (Filters / Nested / Tooltip / …).
 * Operations = role-gated capabilities (Allocate, …) — admin Options only.
 */

import { hasRole, canConfigureComponentOperations, normalizeRole } from '../utils/roleUtils';

/** @typedef {{ id: string, label: string, type?: 'boolean'|'choice', choices?: string[], choiceLabels?: Record<string, string>, default?: unknown, minRole?: string }} ComponentOptionDef */

/** Shared view defs — panels opt in via catalog / registry.options */
export const VIEW_SNAPSHOT = { id: 'snapshot', label: 'Snapshot', type: 'boolean', default: true };
export const VIEW_DETAILS = { id: 'details', label: 'Details', type: 'boolean', default: true };
export const VIEW_FILTERS = { id: 'filters', label: 'Filters', type: 'boolean', default: true };
export const VIEW_COLUMN_FILTERS = { id: 'columnFilters', label: 'Column filters', type: 'boolean', default: true };
export const VIEW_CONTROLS = { id: 'controls', label: 'Controls', type: 'boolean', default: true };
/** Tabulator column-calc footer — opt in only on tables that use `withColumnTotal`. */
export const VIEW_TOTALS = { id: 'totals', label: 'Totals', type: 'boolean', default: true, minRole: 'USER' };
export const VIEW_LEGENDS = { id: 'legends', label: 'Legends', type: 'boolean', default: true };
export const VIEW_NESTED = {
  id: 'viewMode',
  label: 'Nested',
  type: 'choice',
  choices: ['nested', 'flat'],
  default: 'nested',
  choiceLabels: { nested: 'Nested', flat: 'Flat' },
};
export const VIEW_TOOLTIP = { id: 'tooltip', label: 'Tooltip', type: 'boolean', default: true };
export const VIEW_TOOLTIP_MSE = {
  id: 'tooltipView',
  label: 'Tooltip view',
  type: 'choice',
  choices: ['distribution', 'performance'],
  default: 'distribution',
  choiceLabels: { distribution: 'Distribution', performance: 'Performance' },
};
/** Ship × Day Pressure — bar fill: master/segment vs FIT/Group */
export const VIEW_BAR_SPLIT = {
  id: 'barSplit',
  label: 'Bar split',
  type: 'choice',
  choices: ['master_segment', 'fit_group'],
  default: 'master_segment',
  choiceLabels: { master_segment: 'Master / Segment', fit_group: 'FIT / Group' },
};

const VIEW_MENU_ORDER = [
  'viewMode',
  'filters',
  'columnFilters',
  'controls',
  'snapshot',
  'details',
  'totals',
  'legends',
  'tooltip',
  'tooltipView',
  'barSplit',
];
export const sortComponentViews = (views) => {
  const list = Array.isArray(views) ? [...views] : [];
  return list.sort((a, b) => {
    const ai = VIEW_MENU_ORDER.indexOf(a?.id);
    const bi = VIEW_MENU_ORDER.indexOf(b?.id);
    const ao = ai === -1 ? VIEW_MENU_ORDER.length : ai;
    const bo = bi === -1 ? VIEW_MENU_ORDER.length : bi;
    if (ao !== bo) return ao - bo;
    return String(a?.label || a?.id || '').localeCompare(String(b?.label || b?.id || ''));
  });
};

export const resolveChoiceLabel = (def, value) => {
  if (!def) return '';
  if (def.choiceLabels && value != null && def.choiceLabels[value]) return def.choiceLabels[value];
  if (def.id === 'viewMode') return value === 'flat' ? 'Flat' : 'Nested';
  return def.label || String(value || '');
};

export const buildReportShellClassName = (baseClassName, {
  showColumnFilters = true,
  showControls = true,
  showLegends = true,
} = {}) => {
  const parts = String(baseClassName || '').split(/\s+/).filter(Boolean);
  if (!showColumnFilters) parts.push('talia-report--column-filters-hidden');
  if (!showControls) parts.push('talia-report--controls-hidden');
  if (!showLegends) parts.push('talia-report--legends-hidden');
  return parts.join(' ');
};

/**
 * Default catalog keyed by panelComponentId (registry panelId).
 * Panels may also declare `options` on registry metadata; that wins when present.
 */
export const DEFAULT_COMPONENT_OPTIONS = {
  'master-sailing-explorer': {
    views: [
      VIEW_NESTED,
      { id: 'segments', label: 'Segments', type: 'boolean', default: false },
      VIEW_FILTERS,
      VIEW_COLUMN_FILTERS,
      VIEW_CONTROLS,
      VIEW_TOOLTIP,
      VIEW_TOOLTIP_MSE,
    ],
    operations: [],
  },
  'reservation-booking-curve': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS],
    operations: [],
  },
  'profile-compare': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS],
    operations: [],
  },
  'inventory-target-profile-editor': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS],
    operations: [],
  },
  'booking-profile': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS],
    operations: [],
  },
  'seasonal-trading-pack': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS],
    operations: [],
  },
  'reservation-current-state': {
    views: [VIEW_DETAILS, VIEW_FILTERS, VIEW_COLUMN_FILTERS, VIEW_TOTALS, VIEW_TOOLTIP],
    operations: [],
  },
  'cabin-deck-inventory': {
    views: [VIEW_DETAILS, VIEW_CONTROLS, VIEW_TOOLTIP, VIEW_LEGENDS],
    operations: [
      { id: 'allocate', label: 'Allocate', type: 'boolean', default: true, minRole: 'MANAGER' },
    ],
  },
  'ship-day-berth': {
    views: [VIEW_NESTED, VIEW_FILTERS, VIEW_COLUMN_FILTERS, VIEW_CONTROLS],
    operations: [],
  },
  'ship-day-pressure': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_CONTROLS, VIEW_TOOLTIP, VIEW_LEGENDS, VIEW_BAR_SPLIT],
    operations: [],
  },
  'distribution': {
    views: [VIEW_LEGENDS],
    operations: [],
  },
  'booking-target-chart': {
    views: [VIEW_LEGENDS],
    operations: [],
  },
  'occupancy-chart': {
    views: [VIEW_LEGENDS],
    operations: [],
  },
  'revenue-breakdown': {
    views: [VIEW_LEGENDS],
    operations: [],
  },
  'demand-heatmap': {
    views: [VIEW_LEGENDS],
    operations: [],
  },
  'demand-heatmap-with-trends': {
    views: [VIEW_LEGENDS],
    operations: [],
  },
  'published-rates-grid': {
    views: [VIEW_LEGENDS],
    operations: [],
  },
  'competitor-benchmark': {
    views: [VIEW_DETAILS, VIEW_COLUMN_FILTERS],
    operations: [],
  },
};

export const getComponentOptionsCatalog = (componentId, registryOptions = null) => {
  const key = String(componentId || '');
  const fromRegistry = registryOptions && typeof registryOptions === 'object' ? registryOptions : null;
  const fallback = DEFAULT_COMPONENT_OPTIONS[key] || { views: [], operations: [] };
  return {
    views: sortComponentViews(Array.isArray(fromRegistry?.views) ? fromRegistry.views : (fallback.views || [])),
    operations: Array.isArray(fromRegistry?.operations) ? fromRegistry.operations : (fallback.operations || []),
  };
};

/**
 * Whether an Operations capability is allowed for the user's role.
 * Role allow-list (opsAllow[componentId][opId] === false) can deny; otherwise minRole applies.
 */
export const isOperationAllowedForRole = (opDef, role, roleOpsAllow = null, componentId = null) => {
  if (!opDef?.id) return false;
  const allowMap = roleOpsAllow && typeof roleOpsAllow === 'object' ? roleOpsAllow : null;
  const componentAllow = componentId && allowMap ? allowMap[componentId] : null;
  if (componentAllow && Object.prototype.hasOwnProperty.call(componentAllow, opDef.id)) {
    return componentAllow[opDef.id] !== false;
  }
  const minRole = opDef.minRole || 'USER';
  return hasRole(role, minRole);
};

export const filterOperationsForRole = (operations, role, roleOpsAllow = null, componentId = null) => (
  (Array.isArray(operations) ? operations : []).filter((op) => (
    isOperationAllowedForRole(op, role, roleOpsAllow, componentId)
  ))
);

/** Same allow-list / minRole rules as Operations (roleOpsAllow[componentId][viewId]). */
export const isViewAllowedForRole = isOperationAllowedForRole;

export const filterViewsForRole = (views, role, roleOpsAllow = null, componentId = null) => (
  (Array.isArray(views) ? views : []).filter((view) => (
    isViewAllowedForRole(view, role, roleOpsAllow, componentId)
  ))
);

export const canShowOperationsOptionsMenu = (role) => canConfigureComponentOperations(role);

export const resolveViewValue = (viewsState, def) => {
  const state = viewsState && typeof viewsState === 'object' ? viewsState : {};
  if (Object.prototype.hasOwnProperty.call(state, def.id)) return state[def.id];
  return def.default;
};

export const resolveOperationEnabled = (opsState, def, role, roleOpsAllow, componentId) => {
  if (!isOperationAllowedForRole(def, role, roleOpsAllow, componentId)) return false;
  const state = opsState && typeof opsState === 'object' ? opsState : {};
  // End users: capability on if role allows (unless admin saved an explicit false in role ops).
  // Admin chrome may store per-user ops overrides under componentOptions.*.operations.
  if (Object.prototype.hasOwnProperty.call(state, def.id)) return state[def.id] !== false;
  return def.default !== false;
};

export const normalizeRoleForOptions = normalizeRole;
