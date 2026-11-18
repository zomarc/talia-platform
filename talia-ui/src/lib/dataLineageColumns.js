/**
 * Generic column ↔ table attribution for Data Lineage Details.
 */

/** Normalize field/column names for fuzzy matching (camelCase ↔ snake_case). */
export function normalizeFieldKey(value) {
  return String(value || '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/**
 * Build a lookup of normalized column → preferred Talia table.
 * Prefer panel-declared fetch columns, then sync.config columns for the panel's tables.
 */
export function buildColumnTableIndex({
  panelTables = [],
  panelTableColumns = {},
  syncTableColumns = {},
} = {}) {
  const index = new Map(); // norm → { table, source }

  const add = (table, column, source) => {
    const tableName = String(table || '').trim().toLowerCase();
    const col = String(column || '').trim();
    if (!tableName || !col) return;
    const key = normalizeFieldKey(col);
    if (!key) return;
    const existing = index.get(key);
    // Prefer panel fetch columns over sync schema lists.
    if (existing && existing.source === 'panel-fetch' && source !== 'panel-fetch') return;
    index.set(key, { table: tableName, column: col, source });
  };

  (panelTables || []).forEach((table) => {
    const declared = panelTableColumns?.[table] || panelTableColumns?.[String(table).toLowerCase()] || [];
    declared.forEach((col) => add(table, col, 'panel-fetch'));
  });

  (panelTables || []).forEach((table) => {
    const syncCols = syncTableColumns?.[table] || syncTableColumns?.[String(table).toLowerCase()] || [];
    syncCols.forEach((col) => add(table, col, 'sync-config'));
  });

  return index;
}

/**
 * Attribute UI fields / override columns into groups by Talia table.
 *
 * @returns {{
 *   groups: Array<{ table: string, synapseSource: string|null, columns: Array<{ name: string, label?: string, provenance: string }> }>,
 *   unmapped: Array<{ name: string, label?: string, provenance: string }>
 * }}
 */
export function groupColumnsByTable({
  fields = [],
  panelColumns = [],
  panelTables = [],
  panelTableColumns = {},
  syncTableColumns = {},
  tableSourcesMap = {},
  fieldLabels = {},
} = {}) {
  const index = buildColumnTableIndex({ panelTables, panelTableColumns, syncTableColumns });
  const byTable = new Map();
  const unmapped = [];

  const ensureGroup = (table) => {
    const key = String(table || '').toLowerCase();
    if (!byTable.has(key)) {
      const meta = tableSourcesMap?.[key] || tableSourcesMap?.[table] || {};
      byTable.set(key, {
        table: key,
        synapseSource: meta.source || null,
        columns: [],
      });
    }
    return byTable.get(key);
  };

  const seen = new Set();

  const pushColumn = (name, provenanceHint) => {
    const raw = String(name || '').trim();
    if (!raw || raw === '—') return;
    const key = normalizeFieldKey(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);

    const label = fieldLabels?.[raw]?.long || fieldLabels?.[raw]?.short || null;
    const hit = index.get(key);
    if (hit) {
      const group = ensureGroup(hit.table);
      const synapse = group.synapseSource;
      const provenance = provenanceHint
        || (hit.source === 'panel-fetch'
          ? `Fetched from ${hit.table}${synapse ? ` ← ${synapse}` : ''}`
          : `Sync column on ${hit.table}${synapse ? ` ← ${synapse}` : ''}`);
      group.columns.push({ name: raw, label, provenance });
      return;
    }

    unmapped.push({
      name: raw,
      label,
      provenance: provenanceHint || 'Presenter / computed field (no matching table column)',
    });
  };

  // Explicit panel override columns first (may already carry provenance).
  (panelColumns || []).forEach((col) => {
    if (typeof col === 'string') pushColumn(col, null);
    else pushColumn(col?.name, col?.provenance || null);
  });

  // Tabulator / UI fields.
  (fields || []).forEach((field) => pushColumn(field, null));

  // Also surface declared fetch columns even if not in Tabulator catalog.
  (panelTables || []).forEach((table) => {
    const declared = panelTableColumns?.[table] || [];
    declared.forEach((col) => pushColumn(col, null));
  });

  const groups = [...byTable.values()]
    .map((group) => ({
      ...group,
      columns: group.columns.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.columns.length)
    .sort((a, b) => a.table.localeCompare(b.table));

  unmapped.sort((a, b) => a.name.localeCompare(b.name));

  return { groups, unmapped };
}
