/**
 * Inventory Reference Service — the canonical translation layer for selections.
 *
 * Talia's inventory_item is the source-independent canonical layer. Any component
 * that ISSUES a selection (sail.select / ship.select) routes the raw detail through
 * this service, which translates it (via inventory_item.reference_sail_code) into a
 * canonical scope. The enriched event then carries consistent fields so any LISTENING
 * component can respond by data refresh and/or filtering, regardless of which field
 * (reference_sail_code, ship_code, sail_codes) it cares about.
 *
 * The index is primed by whichever panels already load inventory_item (no duplicate
 * fetch); a GraphQL fallback loads it on demand if nothing has primed it yet.
 */

import {
  buildInventoryReferenceIndex,
  resolveSelectionScope,
} from '../../lib/inventoryReference.js';

const TABLE_DATA_QUERY = `
  query GetInventoryItemsForReference($tableName: String!, $limit: Int, $filters: TableDataFilters) {
    tableData(tableName: $tableName, limit: $limit, filters: $filters)
  }
`;

const state = {
  index: buildInventoryReferenceIndex([]),
  itemCount: 0,
  loadedAt: 0,
  loadPromise: null,
};

const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => {
    try { listener(state.index); } catch { /* noop */ }
  });
};

/** Subscribe to index updates. Returns an unsubscribe function. */
export const onInventoryIndexChange = (listener) => {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** True once the index has any inventory_item rows to translate against. */
export const isInventoryIndexReady = () => state.itemCount > 0;

export const getInventoryIndex = () => state.index;

/**
 * Prime (or refresh) the shared index from inventory_item rows a component already
 * loaded. Safe to call repeatedly; only rebuilds when there is data.
 */
export const setInventoryItems = (rows) => {
  const items = Array.isArray(rows) ? rows : [];
  if (items.length === 0) return state.index;
  state.index = buildInventoryReferenceIndex(items);
  state.itemCount = items.length;
  state.loadedAt = Date.now();
  notify();
  return state.index;
};

/** For tests: reset all cached state. */
export const __resetInventoryReferenceService = () => {
  state.index = buildInventoryReferenceIndex([]);
  state.itemCount = 0;
  state.loadedAt = 0;
  state.loadPromise = null;
};

/**
 * Ensure the index is loaded. If a component has primed it, resolves immediately.
 * Otherwise performs a single shared GraphQL fetch of operational inventory_item.
 */
export const ensureInventoryIndex = async ({ force = false } = {}) => {
  if (!force && isInventoryIndexReady()) return state.index;
  if (state.loadPromise) return state.loadPromise;

  state.loadPromise = (async () => {
    try {
      const { trackedFetchGraphql } = await import('./trackedGraphql.js');
      const data = await trackedFetchGraphql({
        query: TABLE_DATA_QUERY,
        variables: {
          tableName: 'inventory_item',
          limit: 5000,
          filters: { is_operational: true },
        },
        component: 'Inventory Reference Service',
        purpose: 'Canonical selection translation index',
        tableName: 'inventory_item',
      });
      const rows = data?.tableData || [];
      if (rows.length > 0) setInventoryItems(rows);
      return state.index;
    } catch (error) {
      console.warn('[inventoryReferenceService] Failed to load inventory_item index:', error?.message || error);
      return state.index;
    } finally {
      state.loadPromise = null;
    }
  })();

  return state.loadPromise;
};

/** Synchronous resolution using the currently cached index (may be empty). */
export const resolveScopeSync = (detail) => resolveSelectionScope(detail, state.index);

/** Async resolution that ensures the index is loaded first. */
export const resolveScope = async (detail) => {
  if (!isInventoryIndexReady()) {
    await ensureInventoryIndex();
  }
  return resolveScopeSync(detail);
};

/**
 * Merge the canonical scope into a raw selection detail so the dispatched event
 * carries consistent fields for every listener.
 */
export const enrichSelectionDetail = (rawDetail) => {
  if (rawDetail === null || rawDetail === undefined) return rawDetail;
  const base = typeof rawDetail === 'string' ? { sail_code: rawDetail } : { ...rawDetail };
  const scope = resolveScopeSync(rawDetail);
  if (!scope) return base;
  return {
    ...base,
    reference_sail_code: base.reference_sail_code || scope.reference_sail_code || null,
    ship_code: base.ship_code || scope.ship_code || null,
    ship_name: base.ship_name || scope.ship_name || null,
    sail_codes: scope.sail_codes && scope.sail_codes.length ? scope.sail_codes : base.sail_codes,
    canonical_scope: scope,
  };
};

export default {
  onInventoryIndexChange,
  isInventoryIndexReady,
  getInventoryIndex,
  setInventoryItems,
  ensureInventoryIndex,
  resolveScope,
  resolveScopeSync,
  enrichSelectionDetail,
};
