/**
 * Per-component Views / Operations catalog and helpers.
 * Views = non-restrictive personalization (Filters / Nested / Tooltip / …).
 * Operations = role-gated capabilities (Allocate, …) — admin Options only.
 */

import { hasRole, canConfigureComponentOperations, normalizeRole } from '../utils/roleUtils';

/** @typedef {{ id: string, label: string, type?: 'boolean'|'choice'|'text', choices?: string[], choiceLabels?: Record<string, string>, default?: unknown, placeholder?: string, maxLength?: number, minRole?: string }} ComponentOptionDef */

/** Shared view defs — panels opt in via catalog / registry.options */
export const VIEW_SNAPSHOT = { id: 'snapshot', label: 'Snapshot', type: 'boolean', default: true };
/** Primary chart. Opt in on panels whose main body is a graph (Reservation Profile). */
export const VIEW_GRAPH = { id: 'graph', label: 'Graph', type: 'boolean', default: true };
/** Source MR review: departure-month comparison. Off until the view is turned on. */
export const VIEW_SOURCE_MR_MONTH = { id: 'monthGraph', label: 'By month', type: 'boolean', default: false };
/** Historic MR path: one group's change days. Off until the view is turned on. */
export const VIEW_HISTORIC_MR_PATH = { id: 'pathGraph', label: 'Group path', type: 'boolean', default: false };
/** Historic MR path: the written method. On until the view is turned off. */
export const VIEW_ASSUMPTIONS = { id: 'assumptions', label: 'Assumptions', type: 'boolean', default: true };
export const VIEW_DETAILS = { id: 'details', label: 'Details', type: 'boolean', default: true };
/** Admin+ (and SUPER_USER): where this report’s data comes from. Off by default; Views → Provenance. */
export const VIEW_PROVENANCE = {
  id: 'provenance',
  label: 'Provenance',
  type: 'boolean',
  default: false,
  minRole: 'ADMIN',
};
export const VIEW_FILTERS = { id: 'filters', label: 'Filters', type: 'boolean', default: true };
export const VIEW_COLUMN_FILTERS = { id: 'columnFilters', label: 'Column filters', type: 'boolean', default: true };
export const VIEW_CONTROLS = { id: 'controls', label: 'Controls', type: 'boolean', default: true };
/** Tabulator column-calc footer — opt in only on tables that use `withColumnTotal`. */
export const VIEW_TOTALS = { id: 'totals', label: 'Totals', type: 'boolean', default: true, minRole: 'USER' };
export const VIEW_LEGENDS = { id: 'legends', label: 'Legends', type: 'boolean', default: true };
/** Chart axis titles and tick labels. Off reclaims space on small report tiles. */
export const VIEW_AXIS_LABELS = { id: 'axisLabels', label: 'Axis Labels', type: 'boolean', default: true };
/**
 * Table column fit. Unset instances follow the header/theme default.
 * An explicit choice is stored on the dock instance with the other Views.
 */
export const VIEW_TABLE_FIT = {
  id: 'tableFit',
  label: 'Fit',
  type: 'choice',
  choices: ['best', 'width', 'data'],
  default: 'best',
  choiceLabels: { best: 'Best Fit', width: 'Fit Width', data: 'Fit Data' },
};
/** Place Holder panel — caption stored on the dock instance. */
export const VIEW_PLACEHOLDER_CAPTION = {
  id: 'caption',
  label: 'Label',
  type: 'text',
  default: 'Place Holder',
  placeholder: 'Text shown in the panel',
  maxLength: 80,
};
/** Place Holder panel — corner-to-corner wireframe. */
export const VIEW_WIREFRAME = { id: 'wireframe', label: 'Wireframe', type: 'boolean', default: true };
export const VIEW_NESTED = {
  id: 'viewMode',
  label: 'Nested',
  type: 'choice',
  choices: ['nested', 'flat'],
  default: 'nested',
  choiceLabels: { nested: 'Nested', flat: 'Flat' },
};
/** Shared Full / Compact density — opt in via registry Views (MSE, Groups, Promo, …). */
export const VIEW_DENSITY = {
  id: 'density',
  label: 'Density',
  type: 'choice',
  choices: ['full', 'compact'],
  default: 'full',
  choiceLabels: { full: 'Full', compact: 'Compact' },
};
/** @deprecated Prefer VIEW_DENSITY — same id/choices for Master Sailing Explorer. */
export const VIEW_MSE_DENSITY = VIEW_DENSITY;
/** RM Checklist — findings table vs date × action heatmap. */
export const VIEW_CHECKLIST_DISPLAY = {
  id: 'display',
  label: 'Display',
  type: 'choice',
  choices: ['table', 'heatmap'],
  default: 'table',
  choiceLabels: { table: 'Table', heatmap: 'Heatmap' },
};
/** Requirements Log — table vs milestone board overview. */
export const VIEW_REQUIREMENTS_DISPLAY = {
  id: 'display',
  label: 'Display',
  type: 'choice',
  choices: ['table', 'board'],
  default: 'table',
  choiceLabels: { table: 'Table', board: 'Board' },
};
/** Functionality Matrix — compact grid vs list. Not a Tabulator, so Fit is excluded. */
export const VIEW_MATRIX_DISPLAY = {
  id: 'display',
  label: 'Display',
  type: 'choice',
  choices: ['grid', 'list'],
  default: 'grid',
  choiceLabels: { grid: 'Grid', list: 'List' },
};
/** Risk register — list of statements vs the likelihood × impact heat map. */
export const VIEW_RISK_DISPLAY = {
  id: 'display',
  label: 'Display',
  type: 'choice',
  choices: ['list', 'heat'],
  default: 'list',
  choiceLabels: { list: 'List', heat: 'Heat map' },
};
export const VIEW_PORT_CITY_DISPLAY = {
  id: 'display',
  label: 'Display',
  type: 'choice',
  choices: ['table', 'map'],
  default: 'table',
  choiceLabels: { table: 'Table', map: 'Map' },
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
/** Ship × Day Pressure — sailing dates only vs the full criteria window. */
export const VIEW_ROW_SCOPE = {
  id: 'rowScope',
  label: 'Rows',
  type: 'choice',
  choices: ['narrow', 'wide'],
  default: 'narrow',
  choiceLabels: { narrow: 'Narrow', wide: 'Wide' },
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
/** Admin Dashboard — which administration section this instance shows. */
export const VIEW_ADMIN_SECTION = {
  id: 'section',
  label: 'Section',
  type: 'choice',
  choices: ['access', 'users', 'mapping', 'themes', 'role-criteria', 'logs'],
  default: 'access',
  choiceLabels: {
    access: 'Focus Access',
    users: 'Talia Users',
    mapping: 'User Mappings',
    themes: 'Themes',
    'role-criteria': 'Role Criteria',
    logs: 'Logs',
  },
};
/** Data Management — which integration section this instance shows. */
export const VIEW_DATA_SECTION = {
  id: 'section',
  label: 'Section',
  type: 'choice',
  choices: [
    'table-integration',
    'external-integration',
    'internal-integration',
    'backup-status',
    'architecture-overview',
    'instance-connection',
    'operations',
  ],
  default: 'table-integration',
  choiceLabels: {
    'table-integration': 'Table Integration',
    'external-integration': 'External Integration',
    'internal-integration': 'Internal Integration',
    'backup-status': 'Backup and Status',
    'architecture-overview': 'Architecture',
    'instance-connection': 'Instance & keys',
    operations: 'Operations',
  },
};
/** Component Interaction Map — overview, channel detail, or full catalog. */
export const VIEW_INTERACTION_DISPLAY = {
  id: 'display',
  label: 'Display',
  type: 'choice',
  choices: ['presentation', 'detailed', 'catalog'],
  default: 'presentation',
  choiceLabels: { presentation: 'Presentation', detailed: 'Detailed', catalog: 'Catalog' },
};

const VIEW_MENU_ORDER = [
  'section',
  'viewMode',
  'density',
  'display',
  'filters',
  'columnFilters',
  'controls',
  'snapshot',
  'graph',
  'details',
  'tableFit',
  'provenance',
  'totals',
  'legends',
  'axisLabels',
  'tooltip',
  'tooltipView',
  'rowScope',
  'barSplit',
  'wireframe',
  'caption',
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
  if (def.id === 'density') return value === 'compact' ? 'Compact' : 'Full';
  if (def.id === 'tableFit') {
    if (value === 'width') return 'Fit Width';
    if (value === 'data') return 'Fit Data';
    return 'Best Fit';
  }
  if (def.id === 'display') {
    if (value === 'heatmap') return 'Heatmap';
    if (value === 'board') return 'Board';
    if (value === 'map') return 'Map';
    return 'Table';
  }
  return def.label || String(value || '');
};

export const buildReportShellClassName = (baseClassName, {
  showColumnFilters = true,
  showControls = true,
  showLegends = true,
  optionsPending = false,
} = {}) => {
  const parts = String(baseClassName || '').split(/\s+/).filter(Boolean);
  if (optionsPending) parts.push('talia-report--options-pending');
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
      VIEW_MSE_DENSITY,
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
    views: [VIEW_SNAPSHOT, VIEW_GRAPH, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS, VIEW_AXIS_LABELS],
    operations: [],
  },
  'profile-compare': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS, VIEW_AXIS_LABELS],
    operations: [],
  },
  'inventory-target-profile-editor': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS, VIEW_AXIS_LABELS],
    operations: [],
  },
  'booking-profile': {
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS, VIEW_AXIS_LABELS],
    operations: [],
  },
  'inventory-memo': {
    views: [VIEW_DETAILS, VIEW_DENSITY],
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
    views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_CONTROLS, VIEW_TOOLTIP, VIEW_LEGENDS, VIEW_ROW_SCOPE, VIEW_BAR_SPLIT],
    operations: [],
  },
  'distribution': {
    views: [VIEW_LEGENDS, VIEW_AXIS_LABELS],
    operations: [],
  },
  'booking-target-chart': {
    views: [VIEW_LEGENDS, VIEW_AXIS_LABELS],
    operations: [],
  },
  'occupancy-chart': {
    views: [VIEW_LEGENDS, VIEW_AXIS_LABELS],
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
  'booking-current-data-simple': {
    views: [VIEW_AXIS_LABELS],
    operations: [],
  },
  'booking-target-data-simple': {
    views: [VIEW_AXIS_LABELS],
    operations: [],
  },
  'booking-combined-data-simple': {
    views: [VIEW_AXIS_LABELS],
    operations: [],
  },
  'booking-target-profile-editor-simple': {
    views: [VIEW_AXIS_LABELS],
    operations: [],
  },
  'competitor-pricing': {
    views: [VIEW_AXIS_LABELS],
    operations: [],
  },
  'groups-explorer': {
    views: [VIEW_DENSITY, VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_COLUMN_FILTERS, VIEW_PROVENANCE],
    operations: [],
  },
  'source-mr-review': {
    views: [
      VIEW_SNAPSHOT,
      VIEW_GRAPH,
      VIEW_SOURCE_MR_MONTH,
      VIEW_DETAILS,
      VIEW_FILTERS,
      VIEW_TOOLTIP,
      VIEW_LEGENDS,
      VIEW_AXIS_LABELS,
      VIEW_PROVENANCE,
    ],
    operations: [],
  },
  'talia-mr-method': {
    views: [
      VIEW_SNAPSHOT,
      VIEW_GRAPH,
      VIEW_DETAILS,
      VIEW_FILTERS,
      VIEW_TOOLTIP,
      VIEW_LEGENDS,
      VIEW_AXIS_LABELS,
      VIEW_PROVENANCE,
    ],
    operations: [],
  },
  'historic-mr-path': {
    views: [
      VIEW_SNAPSHOT,
      VIEW_ASSUMPTIONS,
      VIEW_GRAPH,
      VIEW_HISTORIC_MR_PATH,
      VIEW_DETAILS,
      VIEW_FILTERS,
      VIEW_TOOLTIP,
      VIEW_LEGENDS,
      VIEW_AXIS_LABELS,
      VIEW_PROVENANCE,
    ],
    operations: [],
  },
  'promo-explorer': {
    views: [VIEW_DENSITY, VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_COLUMN_FILTERS, VIEW_PROVENANCE],
    operations: [],
  },
  'competitor-benchmark': {
    views: [VIEW_DETAILS, VIEW_COLUMN_FILTERS],
    operations: [],
  },
  'ui-placeholder': {
    views: [VIEW_WIREFRAME, VIEW_PLACEHOLDER_CAPTION],
    operations: [],
  },
  'data-management-panel': {
    views: [
      VIEW_DATA_SECTION,
      VIEW_DETAILS,
      VIEW_FILTERS,
      VIEW_CONTROLS,
      VIEW_COLUMN_FILTERS,
    ],
    operations: [],
  },
};

const TABLE_FIT_TRIGGER_IDS = new Set([
  'columnFilters',
  'totals',
  'viewMode',
  'density',
  'filters',
  'details',
  'snapshot',
  'controls',
  'tooltip',
  'tooltipView',
  'display',
]);

/**
 * Tabulator reports whose other Views do not already imply Fit
 * (legends / axis labels only). Fit is still per dock instance.
 */
const TABLE_FIT_EXCLUDED_PANEL_IDS = new Set([
  'functionality-matrix',
  'risk-register',
  'document-repository',
  'project-plan',
  'source-mr-review',
  'talia-mr-method',
  'historic-mr-path',
]);

const TABLE_FIT_PANEL_IDS = new Set([
  'competitor-pricing',
  'demand-heatmap',
  'demand-heatmap-with-trends',
]);

/**
 * Non-legacy reports that had no Views menu. Each entry is a control the
 * report already renders (filters, column filters, controls, or display).
 * Column filters also add Fit.
 */
const UNCONFIGURED_REPORT_VIEWS = {
  'sailing-table': [VIEW_COLUMN_FILTERS],
  'agency-directory': [VIEW_FILTERS, VIEW_COLUMN_FILTERS],
  'published-rates': [VIEW_COLUMN_FILTERS],
  'sailing-summary': [VIEW_COLUMN_FILTERS],
  'sailing-cabin-category': [VIEW_COLUMN_FILTERS],
  'group-booking-review': [VIEW_CONTROLS, VIEW_COLUMN_FILTERS],
  'data-match': [VIEW_FILTERS, VIEW_COLUMN_FILTERS],
  'master-voyage-performance-summary': [VIEW_COLUMN_FILTERS],
  'direct-source-request': [VIEW_FILTERS, VIEW_CONTROLS, VIEW_COLUMN_FILTERS],
  'direct-availability': [VIEW_CONTROLS, VIEW_COLUMN_FILTERS],
  'column-terminology-panel': [VIEW_COLUMN_FILTERS],
  'etl-table-parameters-panel': [VIEW_COLUMN_FILTERS],
  'itinerary-extract': [VIEW_FILTERS],
  'profile-aggregations': [VIEW_FILTERS],
  'google-trends': [VIEW_FILTERS, VIEW_CONTROLS],
  'ship-tracker-map': [VIEW_FILTERS, VIEW_CONTROLS],
  'component-interaction-map': [VIEW_INTERACTION_DISPLAY, VIEW_CONTROLS],
};

const appendTableFitView = (views, componentId) => {
  const list = Array.isArray(views) ? views : [];
  if (TABLE_FIT_EXCLUDED_PANEL_IDS.has(String(componentId || ''))) return list;
  if (list.some((view) => view?.id === 'tableFit')) return list;
  const isTable = TABLE_FIT_PANEL_IDS.has(componentId);
  if (!isTable && !list.some((view) => TABLE_FIT_TRIGGER_IDS.has(view?.id))) return list;
  return [...list, VIEW_TABLE_FIT];
};

export const getComponentOptionsCatalog = (componentId, registryOptions = null) => {
  const key = String(componentId || '');
  const fromRegistry = registryOptions && typeof registryOptions === 'object' ? registryOptions : null;
  const fallback = DEFAULT_COMPONENT_OPTIONS[key] || { views: [], operations: [] };
  const declared = Array.isArray(fromRegistry?.views) ? fromRegistry.views : (fallback.views || []);
  const views = declared.length > 0 ? declared : (UNCONFIGURED_REPORT_VIEWS[key] || []);
  return {
    views: sortComponentViews(appendTableFitView(views, key)),
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
  if (def?.id === 'tableFit') {
    const globalMode = typeof window !== 'undefined' ? window.__taliaTableLayoutMode : null;
    if (globalMode === 'best' || globalMode === 'width' || globalMode === 'data') return globalMode;
  }
  return def.default;
};

export {
  mergeComponentOptionsMaps,
  resolveStoredComponentViews,
} from './componentOptionsInstance.js';

export const resolveOperationEnabled = (opsState, def, role, roleOpsAllow, componentId) => {
  if (!isOperationAllowedForRole(def, role, roleOpsAllow, componentId)) return false;
  const state = opsState && typeof opsState === 'object' ? opsState : {};
  // End users: capability on if role allows (unless admin saved an explicit false in role ops).
  // Admin chrome may store per-user ops overrides under componentOptions.*.operations.
  if (Object.prototype.hasOwnProperty.call(state, def.id)) return state[def.id] !== false;
  return def.default !== false;
};

export const normalizeRoleForOptions = normalizeRole;
