/**
 * Data Lineage — panel→table catalog.
 *
 * Precedence for tables:
 * 1. registry.meta.tables (explicit)
 * 2. DATA_LINEAGE_PANEL_OVERRIDES
 * 3. scraped tableName usages (generated)
 * 4. free-text dataRequirements extract (last resort; guarded)
 */

import {
  DATA_LINEAGE_PANEL_TABLES as generatedPanelTables,
  DATA_LINEAGE_PANEL_TABLE_COLUMNS as generatedPanelTableColumns,
  DATA_LINEAGE_SYNC_TABLE_COLUMNS as generatedSyncTableColumns,
} from './dataLineagePanelTables.generated.js';
import { DATA_LINEAGE_PANEL_OVERRIDES } from './dataLineagePanelOverrides.js';

export {
  generatedPanelTables,
  generatedPanelTableColumns,
  generatedSyncTableColumns,
};

/** Tables used in Talia that may not appear in etl_table_parameters. */
export const EXTRA_KNOWN_TABLES = Object.freeze([
  'inventory_item',
  'inventory_item_memo',
  'sailing_hierarchy',
  'ship_day_capacity',
  'sail_booking_summary',
  'reservation_current_state',
  'published_rates_current_state',
  'market_roll_up',
  'new_budget_roll_up',
  'ship_cabin_reserve',
  'ship_cabin_ctg_link',
  'cabin_availability',
  'inventory_status_by_day',
  'sail_by_cabin_occupancy',
  'sw_etl_group',
  'sw_etl_group_header',
  'sw_etl_group_ship',
  'sw_etl_extract_load',
  'sw_etl_mr_path_holds',
  'sw_etl_mr_path_days',
  'rm_science_evidence',
  'project_document',
  'project_document_link',
  'talia_requirement_item',
  'functionality_matrix_item',
  'risk_register_item',
  'etl_table_parameters',
  'column_terminology_definition',
  'ui_activity_events',
  'port_city',
]);

/** Short English words that also exist as table names — never match from prose. */
const BLOCKED_TEXT_TOKENS = new Set(['ship', 'focuses']);

const SKIP_REQUIREMENT = /\b(mock data|no network fetch|local json)\b/i;

/**
 * Build a case-insensitive lookup of known table tokens (longest first for matching).
 * Prefer Synapse/Talia names from tableSources; ETL rows are optional extras.
 * @param {Record<string, object>|string[]} tableSourcesOrNames
 * @param {Array<{ target_tablename?: string, source_tablename?: string }>} [etlRows]
 * @returns {string[]}
 */
export function buildKnownTableNames(tableSourcesOrNames = {}, etlRows = []) {
  const set = new Set(EXTRA_KNOWN_TABLES.map((t) => String(t).toLowerCase()));

  if (Array.isArray(tableSourcesOrNames)) {
    tableSourcesOrNames.forEach((name) => {
      const t = String(name || '').trim();
      if (t) set.add(t.toLowerCase());
    });
  } else {
    Object.keys(tableSourcesOrNames || {}).forEach((name) => {
      const t = String(name || '').trim();
      if (t) set.add(t.toLowerCase());
    });
  }

  (etlRows || []).forEach((row) => {
    const target = String(row?.target_tablename || '').trim();
    if (target) set.add(target.toLowerCase());
  });

  return [...set].sort((a, b) => b.length - a.length);
}

/**
 * Extract known table names mentioned in free-text dataRequirements.
 * Skips ambiguous short tokens like "ship" / "focuses".
 * @param {string} text
 * @param {string[]} knownTables lower-case tokens, longest first
 * @returns {string[]}
 */
export function extractTablesFromRequirements(text, knownTables = []) {
  const raw = String(text || '');
  if (!raw.trim() || SKIP_REQUIREMENT.test(raw)) return [];
  const lower = raw.toLowerCase();
  const hit = [];
  const usedSpans = [];

  const overlaps = (start, end) => usedSpans.some(([s, e]) => start < e && end > s);

  knownTables.forEach((token) => {
    const needle = String(token || '').toLowerCase();
    if (!needle || BLOCKED_TEXT_TOKENS.has(needle)) return;
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      const before = idx === 0 ? '' : lower[idx - 1];
      const after = end >= lower.length ? '' : lower[end];
      const boundaryOk = !/[a-z0-9_]/.test(before) && !/[a-z0-9_]/.test(after);
      if (boundaryOk && !overlaps(idx, end)) {
        hit.push(needle);
        usedSpans.push([idx, end]);
      }
      from = idx + 1;
    }
  });

  return [...new Set(hit)];
}

const normalizeTables = (list = []) => [...new Set(
  (list || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean),
)];

/**
 * Resolve tables for one registry component.
 */
export function resolvePanelTables(componentKey, meta = {}, knownTables = []) {
  const explicit = normalizeTables(meta?.tables);
  if (explicit.length) return explicit;

  const override = DATA_LINEAGE_PANEL_OVERRIDES[componentKey];
  const fromOverride = normalizeTables(override?.tables);
  if (fromOverride.length) return fromOverride;

  const scraped = normalizeTables(generatedPanelTables?.[componentKey]);
  if (scraped.length) return scraped;

  return extractTablesFromRequirements(meta?.dataRequirements, knownTables);
}

/**
 * Resolve column provenance rows for a component (override wins, else empty for caller merge).
 */
export function resolvePanelColumns(componentKey, meta = {}) {
  const override = DATA_LINEAGE_PANEL_OVERRIDES[componentKey];
  if (Array.isArray(override?.columns) && override.columns.length) {
    return override.columns.map((col) => (
      typeof col === 'string'
        ? { name: col, provenance: 'panel lineage override' }
        : { name: col.name, provenance: col.provenance || 'panel lineage override' }
    ));
  }
  if (Array.isArray(meta?.columns) && meta.columns.length) {
    return meta.columns.map((col) => (
      typeof col === 'string'
        ? { name: col, provenance: 'registry columns' }
        : { name: col.name, provenance: col.provenance || 'registry columns' }
    ));
  }
  return [];
}

/**
 * Build panel catalog entries from the component registry.
 * @param {Record<string, object>} registry
 * @param {string[]} knownTables
 * @returns {Array<object>}
 */
export function buildPanelCatalog(registry = {}, knownTables = []) {
  return Object.entries(registry || {})
    .map(([componentKey, meta]) => {
      if (!meta || meta.showInReports === false) return null;
      const requirements = String(meta.dataRequirements || '');
      const tables = resolvePanelTables(componentKey, meta, knownTables);
      if (!tables.length) return null;
      return {
        componentKey,
        panelId: String(meta.panelId || componentKey),
        title: String(meta.title || componentKey),
        category: String(meta.category || ''),
        tables,
        columns: resolvePanelColumns(componentKey, meta),
        dataRequirements: requirements,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Invert field→panels catalog into panelId → fields[].
 * @param {Record<string, string[]>} fieldCatalog
 * @returns {Map<string, string[]>}
 */
export function invertFieldUsageCatalog(fieldCatalog = {}) {
  const byPanel = new Map();
  Object.entries(fieldCatalog || {}).forEach(([field, panels]) => {
    (panels || []).forEach((panelId) => {
      const key = String(panelId || '');
      if (!key) return;
      const list = byPanel.get(key) || [];
      list.push(field);
      byPanel.set(key, list);
    });
  });
  byPanel.forEach((list, key) => {
    byPanel.set(key, [...new Set(list)].sort((a, b) => a.localeCompare(b)));
  });
  return byPanel;
}

/**
 * Merge override/registry columns with Tabulator field-usage fields.
 * @returns {Array<{ name: string, provenance: string }>}
 */
export function mergePanelColumnProvenance({
  panelColumns = [],
  tabulatorFields = [],
} = {}) {
  const byName = new Map();
  (panelColumns || []).forEach((col) => {
    const name = String(col?.name || '').trim();
    if (!name || name === '—') return;
    byName.set(name, {
      name,
      provenance: col.provenance || 'panel lineage override',
    });
  });
  (tabulatorFields || []).forEach((field) => {
    const name = String(field || '').trim();
    if (!name) return;
    if (!byName.has(name)) {
      byName.set(name, { name, provenance: 'Tabulator field usage catalog' });
    }
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
