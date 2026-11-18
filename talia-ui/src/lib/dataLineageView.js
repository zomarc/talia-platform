/**
 * Pure join / sort / filter helpers for the Data Lineage admin panel.
 *
 * Primary edge: Synapse source → Talia table (from tableSources / sync.config).
 * etl_table_parameters is only a secondary Seaware/original reference.
 */

import { groupColumnsByTable } from './dataLineageColumns.js';

export const RECENCY_OPTIONS = Object.freeze([
  { id: '7d', label: '7 days', sinceMinutes: 7 * 24 * 60 },
  { id: '30d', label: '30 days', sinceMinutes: 30 * 24 * 60 },
  { id: '90d', label: '90 days', sinceMinutes: 90 * 24 * 60 },
  { id: 'all', label: 'All time', sinceMinutes: null },
]);

/** Scope: used by components (default), opened in window, or all mapped tables. */
export const SCOPE_OPTIONS = Object.freeze([
  { id: 'used', label: 'Used by components' },
  { id: 'opened', label: 'Opened in window' },
  { id: 'all', label: 'All mapped tables' },
]);

export const ROLE_FILTER_OPTIONS = Object.freeze([
  '',
  'USER',
  'MANAGER',
  'ADMIN',
  'SUPER_USER',
]);

/** Category buckets: Application = all non-Admin panel categories. */
export const CATEGORY_FILTER_ALL = 'all';
export const CATEGORY_FILTER_APPLICATION = 'application';
export const CATEGORY_FILTER_ADMIN = 'admin';
export const CATEGORY_FILTER_DEFAULT = CATEGORY_FILTER_APPLICATION;

const isAdminCategory = (value) => String(value || '').trim().toLowerCase() === 'admin';

/**
 * Unique panel categories for the Category filter dropdown (after All/Application/Admin).
 * @param {Array<{ category?: string }>} rows
 * @returns {string[]}
 */
export function listLineageCategories(rows = []) {
  const set = new Set();
  (rows || []).forEach((row) => {
    const cat = String(row?.category || '').trim();
    if (cat) set.add(cat);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Filter component rows by category bucket or exact category name.
 * @param {Array<{ category?: string }>} rows
 * @param {string} categoryFilter
 */
export function filterRowsByCategory(rows = [], categoryFilter = CATEGORY_FILTER_DEFAULT) {
  const mode = String(categoryFilter || CATEGORY_FILTER_DEFAULT);
  if (mode === CATEGORY_FILTER_ALL) return [...(rows || [])];
  if (mode === CATEGORY_FILTER_APPLICATION) {
    return (rows || []).filter((row) => !isAdminCategory(row?.category));
  }
  if (mode === CATEGORY_FILTER_ADMIN) {
    return (rows || []).filter((row) => isAdminCategory(row?.category));
  }
  return (rows || []).filter((row) => String(row?.category || '').trim() === mode);
}

/**
 * @param {string|null|undefined} recencyId
 * @returns {number|null}
 */
export function sinceMinutesForRecency(recencyId) {
  const hit = RECENCY_OPTIONS.find((o) => o.id === recencyId);
  return hit ? hit.sinceMinutes : RECENCY_OPTIONS[1].sinceMinutes;
}

/**
 * @param {number} count
 * @param {number} max
 * @returns {'none'|'low'|'mid'|'high'}
 */
export function usageIntensity(count, max) {
  const n = Number(count) || 0;
  const m = Number(max) || 0;
  if (n <= 0 || m <= 0) return 'none';
  const ratio = n / m;
  if (ratio >= 0.66) return 'high';
  if (ratio >= 0.33) return 'mid';
  return 'low';
}

/**
 * Index usage rows by panel component key / panelId / title.
 * Query-tracker labels are noisy (titles, Options:<id>, PascalCase keys) — fold onto
 * catalog aliases so refresh counts join to lineage rows.
 *
 * @param {Array<{ panelComponent?: string, openCount?: number, lastAt?: string, roles?: string[] }>} usageRows
 * @param {Array<{ componentKey?: string, panelId?: string, title?: string }>} [panelCatalog]
 */
export function indexUsageByPanel(usageRows = [], panelCatalog = []) {
  const aliasToCanonical = new Map();
  const registerAlias = (alias, canonical) => {
    const raw = String(alias || '').trim();
    const canon = String(canonical || '').trim();
    if (!raw || !canon) return;
    aliasToCanonical.set(raw, canon);
    aliasToCanonical.set(raw.toLowerCase(), canon);
  };

  (panelCatalog || []).forEach((panel) => {
    const canonical = String(panel?.panelId || panel?.componentKey || '').trim();
    if (!canonical) return;
    registerAlias(panel.panelId, canonical);
    registerAlias(panel.componentKey, canonical);
    registerAlias(panel.title, canonical);
    if (panel.panelId) registerAlias(`Options:${panel.panelId}`, canonical);
  });

  const resolveCanonical = (raw) => {
    let key = String(raw || '').trim();
    if (!key) return '';
    if (key.toLowerCase().startsWith('options:')) {
      key = key.slice('options:'.length).trim();
    }
    return aliasToCanonical.get(key)
      || aliasToCanonical.get(key.toLowerCase())
      || key;
  };

  const map = new Map();
  (usageRows || []).forEach((row) => {
    const canonical = resolveCanonical(row?.panelComponent);
    if (!canonical) return;
    const nextCount = Number(row.openCount) || 0;
    const nextRoles = Array.isArray(row.roles) ? row.roles : [];
    const existing = map.get(canonical);
    if (!existing) {
      map.set(canonical, {
        openCount: nextCount,
        lastAt: row.lastAt || null,
        roles: [...nextRoles],
      });
      return;
    }
    // Same logical panel may arrive under several aliases from the server aggregate.
    existing.openCount += nextCount;
    if (row.lastAt && (!existing.lastAt || row.lastAt > existing.lastAt)) {
      existing.lastAt = row.lastAt;
    }
    const roleSet = new Set([...(existing.roles || []), ...nextRoles]);
    existing.roles = [...roleSet].sort();
  });
  return map;
}

const usageForPanel = (usageMap, panel) => {
  if (!panel || !usageMap) return { openCount: 0, lastAt: null, roles: [] };
  const empty = { openCount: 0, lastAt: null, roles: [] };
  return (
    usageMap.get(panel.panelId)
    || usageMap.get(panel.componentKey)
    || usageMap.get(panel.title)
    || empty
  );
};

/**
 * Build Synapse → Talia edges from tableSources (sync.config mirror).
 * @param {Record<string, { source?: string|null, type?: string, syncType?: string|null, dateColumns?: string[], loadMethod?: string }>} tableSourcesMap
 */
export function buildSynapseEdges(tableSourcesMap = {}) {
  return Object.entries(tableSourcesMap || {}).map(([taliaTable, meta]) => {
    const source = meta?.source ? String(meta.source).trim() : '';
    return {
      taliaTable,
      synapseSource: source || null,
      sourceType: String(meta?.type || 'unknown'),
      syncType: meta?.syncType || null,
      dateColumns: Array.isArray(meta?.dateColumns) ? meta.dateColumns : [],
      loadMethod: meta?.loadMethod || null,
    };
  });
}

/**
 * Index etl_table_parameters by Talia target for optional Seaware reference.
 * @param {Array<object>} etlRows
 * @returns {Map<string, { sources: string[], upsertId: string, loadType: string }>}
 */
export function indexEtlReferenceByTarget(etlRows = []) {
  const map = new Map();
  (etlRows || []).forEach((row) => {
    const target = String(row?.target_tablename || '').trim();
    if (!target) return;
    const key = target.toLowerCase();
    const existing = map.get(key) || {
      sources: [],
      upsertId: String(row?.upsert_id || '').trim(),
      loadType: String(row?.load_type || '').trim(),
    };
    const sourceSchema = String(row?.source_schema || '').trim();
    const sourceTable = String(row?.source_tablename || '').trim();
    const sourceLabel = [sourceSchema, sourceTable].filter(Boolean).join('.');
    if (sourceLabel && !existing.sources.includes(sourceLabel)) {
      existing.sources.push(sourceLabel);
    }
    if (!existing.upsertId && row?.upsert_id) existing.upsertId = String(row.upsert_id).trim();
    if (!existing.loadType && row?.load_type) existing.loadType = String(row.load_type).trim();
    map.set(key, existing);
  });
  return map;
}

/**
 * Table-first rows: Synapse → Talia, enriched with consumers + optional ETL reference.
 * Starts from component-used tables + synapse-mapped tables (filterScope trims later).
 */
export function buildTableOrientationRows({
  synapseEdges = [],
  panelCatalog = [],
  usageMap = new Map(),
  etlByTarget = new Map(),
} = {}) {
  const byTarget = new Map();

  const ensure = (table, seed = {}) => {
    const key = String(table || '').toLowerCase();
    if (!key) return null;
    if (!byTarget.has(key)) {
      byTarget.set(key, {
        id: `table:${key}`,
        kind: 'table',
        taliaTable: table,
        synapseSource: seed.synapseSource || null,
        sourceType: seed.sourceType || 'unknown',
        syncType: seed.syncType || null,
        dateColumns: seed.dateColumns || [],
        loadMethod: seed.loadMethod || null,
        etlSources: [],
        upsertId: '',
        loadType: '',
        consumers: [],
        consumerCount: 0,
        topConsumers: '',
        usageCount: 0,
        lastAt: null,
        roles: [],
        sourceLabel: '—',
      });
    }
    return byTarget.get(key);
  };

  (synapseEdges || []).forEach((edge) => {
    const row = ensure(edge.taliaTable, edge);
    if (!row) return;
    if (edge.synapseSource) row.synapseSource = edge.synapseSource;
    if (edge.sourceType) row.sourceType = edge.sourceType;
    if (edge.syncType) row.syncType = edge.syncType;
    if (edge.dateColumns?.length) row.dateColumns = edge.dateColumns;
    if (edge.loadMethod) row.loadMethod = edge.loadMethod;
  });

  (panelCatalog || []).forEach((panel) => {
    (panel.tables || []).forEach((table) => {
      ensure(table);
    });
  });

  byTarget.forEach((edge, key) => {
    const etl = etlByTarget.get(key);
    if (etl) {
      edge.etlSources = etl.sources || [];
      edge.upsertId = etl.upsertId || '';
      edge.loadType = etl.loadType || '';
    }

    const consumers = (panelCatalog || []).filter((p) => (p.tables || []).includes(key));
    const roleSet = new Set();
    let usageCount = 0;
    let lastAt = null;
    consumers.forEach((panel) => {
      const usage = usageForPanel(usageMap, panel);
      usageCount += usage.openCount;
      if (usage.lastAt && (!lastAt || usage.lastAt > lastAt)) lastAt = usage.lastAt;
      (usage.roles || []).forEach((r) => roleSet.add(r));
    });
    edge.consumers = consumers.map((p) => ({
      componentKey: p.componentKey,
      panelId: p.panelId,
      title: p.title,
      openCount: usageForPanel(usageMap, p).openCount,
    })).sort((a, b) => b.openCount - a.openCount || a.title.localeCompare(b.title));
    edge.consumerCount = edge.consumers.length;
    edge.topConsumers = edge.consumers.slice(0, 3).map((c) => c.title).join(', ');
    edge.sourceLabel = edge.synapseSource || '—';
    edge.usageCount = usageCount;
    edge.lastAt = lastAt;
    edge.roles = [...roleSet].sort();
  });

  return sortByUsage([...byTarget.values()]);
}

/**
 * Build component-first rows.
 */
export function buildComponentOrientationRows(panelCatalog = [], usageMap = new Map(), tableByTarget = new Map()) {
  const rows = (panelCatalog || []).map((panel) => {
    const usage = usageForPanel(usageMap, panel);
    const tables = (panel.tables || []).map((table) => {
      const edge = tableByTarget.get(String(table).toLowerCase());
      return {
        taliaTable: table,
        sourceLabel: edge?.synapseSource || edge?.sourceLabel || '—',
      };
    });
    return {
      id: `component:${panel.componentKey}`,
      kind: 'component',
      componentKey: panel.componentKey,
      panelId: panel.panelId,
      title: panel.title,
      category: panel.category,
      tables,
      tableNames: tables.map((t) => t.taliaTable).join(', ') || '—',
      tableCount: tables.length,
      columns: Array.isArray(panel.columns) ? panel.columns : [],
      dataRequirements: panel.dataRequirements,
      usageCount: usage.openCount,
      lastAt: usage.lastAt,
      roles: usage.roles || [],
      rolesLabel: (usage.roles || []).join(', ') || '—',
      consumerCount: tables.length,
    };
  });
  return sortByUsage(rows);
}

/**
 * Index table rows by lower-case Talia table name.
 */
export function indexByTarget(tableRows = []) {
  const map = new Map();
  (tableRows || []).forEach((row) => {
    const key = String(row?.taliaTable || row?.target_tablename || '').toLowerCase();
    if (key) map.set(key, row);
  });
  return map;
}

/** @deprecated use indexByTarget */
export const indexEtlByTarget = indexByTarget;

/**
 * Filter rows by used-data scope.
 * - used: has ≥1 component consumer (tables) or has tables (components)
 * - opened: usageCount > 0 in the current role/user/recency window
 * - all: no trim
 */
export function filterRowsByScope(rows = [], scope = 'used', orientation = 'tables') {
  const mode = String(scope || 'used');
  if (mode === 'all') return [...(rows || [])];
  if (mode === 'opened') {
    return (rows || []).filter((row) => (Number(row?.usageCount) || 0) > 0);
  }
  // used (default)
  if (orientation === 'components') {
    return (rows || []).filter((row) => (Number(row?.tableCount) || 0) > 0);
  }
  return (rows || []).filter((row) => (Number(row?.consumerCount) || 0) > 0);
}

export function sortByUsage(rows = []) {
  return [...(rows || [])].sort((a, b) => {
    const ua = Number(a?.usageCount) || 0;
    const ub = Number(b?.usageCount) || 0;
    if (ub !== ua) return ub - ua;
    const ca = Number(a?.consumerCount) || 0;
    const cb = Number(b?.consumerCount) || 0;
    if (cb !== ca) return cb - ca;
    const ta = String(a?.title || a?.taliaTable || a?.id || '');
    const tb = String(b?.title || b?.taliaTable || b?.id || '');
    return ta.localeCompare(tb);
  });
}

/**
 * Attach intensity tier relative to max usage in the current row set.
 */
export function withUsageIntensity(rows = []) {
  const max = Math.max(0, ...rows.map((r) => Number(r?.usageCount) || 0));
  return rows.map((row) => ({
    ...row,
    usageMax: max,
    intensity: usageIntensity(row?.usageCount, max),
  }));
}

const formatWhenIso = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Detail model for Details panel — summary + lineage + columns grouped by table.
 */
export function buildSelectionDetail({
  selection,
  fieldByPanel = new Map(),
  panelTableColumns = {},
  syncTableColumns = {},
  tableSourcesMap = {},
  fieldLabels = {},
} = {}) {
  if (!selection) return null;

  if (selection.kind === 'table') {
    const tableName = selection.taliaTable;
    const syncCols = syncTableColumns?.[tableName] || syncTableColumns?.[String(tableName).toLowerCase()] || [];
    const grouped = groupColumnsByTable({
      fields: [
        ...(selection.dateColumns || []),
        ...(selection.upsertId ? [selection.upsertId] : []),
        ...syncCols,
      ],
      panelTables: [tableName],
      panelTableColumns: { [tableName]: syncCols },
      syncTableColumns,
      tableSourcesMap,
      fieldLabels,
    });

    return {
      kind: 'table',
      title: selection.taliaTable,
      subtitle: selection.synapseSource || 'No Synapse source mapped',
      summary: [
        { label: 'Consumers', value: String(selection.consumerCount || 0) },
        { label: 'Refreshes', value: String(selection.usageCount || 0) },
        { label: 'Last refresh', value: formatWhenIso(selection.lastAt) },
      ],
      notes: [
        selection.sourceType ? `Sync type: ${selection.sourceType}` : null,
        selection.loadMethod ? `Load: ${selection.loadMethod}` : null,
        selection.etlSources?.length
          ? `ETL / Seaware reference: ${selection.etlSources.join(', ')}`
          : null,
        selection.dataRequirements || null,
      ].filter(Boolean),
      lineage: [{
        taliaTable: selection.taliaTable,
        sourceLabel: selection.synapseSource || '—',
      }],
      columnGroups: grouped.groups,
      unmappedColumns: grouped.unmapped,
      columns: [
        ...grouped.groups.flatMap((g) => g.columns),
        ...grouped.unmapped,
      ],
      consumers: selection.consumers || [],
      tables: [{
        taliaTable: selection.taliaTable,
        sourceLabel: selection.synapseSource || '—',
      }],
    };
  }

  const fields = fieldByPanel.get(selection.panelId) || fieldByPanel.get(selection.componentKey) || [];
  const panelTables = (selection.tables || []).map((t) => t.taliaTable || t);
  const componentKey = selection.componentKey;
  const declaredForPanel = panelTableColumns?.[componentKey] || {};

  const grouped = groupColumnsByTable({
    fields,
    panelColumns: selection.columns || [],
    panelTables,
    panelTableColumns: declaredForPanel,
    syncTableColumns,
    tableSourcesMap,
    fieldLabels,
  });

  return {
    kind: 'component',
    title: selection.title,
    subtitle: selection.panelId,
    summary: [
      { label: 'Tables', value: String(selection.tableCount || panelTables.length || 0) },
      { label: 'Refreshes', value: String(selection.usageCount || 0) },
      { label: 'Last refresh', value: formatWhenIso(selection.lastAt) },
    ],
    notes: [
      selection.dataRequirements || null,
    ].filter(Boolean),
    lineage: selection.tables || [],
    columnGroups: grouped.groups,
    unmappedColumns: grouped.unmapped,
    columns: [
      ...grouped.groups.flatMap((g) => g.columns),
      ...grouped.unmapped,
    ],
    tables: selection.tables || [],
  };
}
