/**
 * Per-component Views / Operations catalog and helpers.
 * Views = non-restrictive personalization. Operations = role-gated capabilities.
 */

import { hasRole, canConfigureComponentOperations, normalizeRole } from '../utils/roleUtils';

/** @typedef {{ id: string, label: string, type?: 'boolean'|'choice', choices?: string[], default?: unknown, minRole?: string }} ComponentOptionDef */

/**
 * Default catalog keyed by panelComponentId (registry panelId).
 * Panels may also declare `options` on registry metadata; that wins when present.
 */
export const DEFAULT_COMPONENT_OPTIONS = {
  'master-sailing-explorer': {
    views: [
      { id: 'viewMode', label: 'Nested', type: 'choice', choices: ['nested', 'flat'], default: 'nested' },
      { id: 'segments', label: 'Segments', type: 'boolean', default: false },
      { id: 'details', label: 'Details', type: 'boolean', default: false },
    ],
    operations: [
      { id: 'showFilters', label: 'Show filters', type: 'boolean', default: true, minRole: 'USER' },
      { id: 'columnFilters', label: 'Column filters', type: 'boolean', default: true, minRole: 'USER' },
    ],
  },
  'reservation-current-state': {
    views: [
      { id: 'details', label: 'Details', type: 'boolean', default: false },
    ],
    operations: [
      { id: 'showFilters', label: 'Show filters', type: 'boolean', default: true, minRole: 'USER' },
      { id: 'columnFilters', label: 'Column filters', type: 'boolean', default: true, minRole: 'USER' },
    ],
  },
  'cabin-deck-inventory': {
    views: [
      { id: 'details', label: 'Details', type: 'boolean', default: false },
    ],
    operations: [
      { id: 'allocate', label: 'Allocate', type: 'boolean', default: true, minRole: 'MANAGER' },
      { id: 'showFilters', label: 'Show filters', type: 'boolean', default: true, minRole: 'USER' },
      { id: 'columnFilters', label: 'Column filters', type: 'boolean', default: true, minRole: 'USER' },
    ],
  },
};

export const getComponentOptionsCatalog = (componentId, registryOptions = null) => {
  const key = String(componentId || '');
  const fromRegistry = registryOptions && typeof registryOptions === 'object' ? registryOptions : null;
  const fallback = DEFAULT_COMPONENT_OPTIONS[key] || { views: [], operations: [] };
  return {
    views: Array.isArray(fromRegistry?.views) ? fromRegistry.views : (fallback.views || []),
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
