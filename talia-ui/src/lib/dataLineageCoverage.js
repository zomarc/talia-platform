/**
 * Soft lineage coverage for key panels (D015).
 * Gaps are highlighted — never fail the app or CI.
 */

import { normalizeFieldKey } from './dataLineageColumns.js';

/** Suggested-key guide window: last 4 weeks. */
export const SUGGESTED_KEY_SINCE_MINUTES = 28 * 24 * 60;

/** Minimum opens in the guide window to suggest a key panel. */
export const SUGGESTED_KEY_MIN_OPENS = 3;

/** Cap how many usage-based suggestions we surface. */
export const SUGGESTED_KEY_TOP_N = 12;

export const KEY_FILTER_ALL = 'all';
export const KEY_FILTER_KEY = 'key';
export const KEY_FILTER_SUGGESTED = 'suggested';
export const KEY_FILTER_DEFAULT = KEY_FILTER_ALL;

export const COVERAGE_FILTER_ALL = 'all';
export const COVERAGE_FILTER_ISSUES = 'issues';
export const COVERAGE_FILTER_DEFAULT = COVERAGE_FILTER_ALL;

export const KEY_FILTER_OPTIONS = Object.freeze([
  { id: KEY_FILTER_ALL, label: 'All panels' },
  { id: KEY_FILTER_KEY, label: 'Key only' },
  { id: KEY_FILTER_SUGGESTED, label: 'Suggested' },
]);

export const COVERAGE_FILTER_OPTIONS = Object.freeze([
  { id: COVERAGE_FILTER_ALL, label: 'All coverage' },
  { id: COVERAGE_FILTER_ISSUES, label: 'Issues only' },
]);

/**
 * Index Admin key flags by panelComponent (panelId or componentKey).
 * @param {Array<{ panelComponent?: string, isKey?: boolean }>} flags
 * @returns {Set<string>}
 */
export function indexKeyPanels(flags = []) {
  const set = new Set();
  (flags || []).forEach((row) => {
    if (!row?.isKey) return;
    const key = String(row.panelComponent || '').trim();
    if (key) set.add(key);
  });
  return set;
}

const matchesKeySet = (row, keySet) => {
  if (!keySet || keySet.size === 0) return false;
  const panelId = String(row?.panelId || '').trim();
  const componentKey = String(row?.componentKey || '').trim();
  return (panelId && keySet.has(panelId)) || (componentKey && keySet.has(componentKey));
};

/**
 * Build suggested key set from 28d usage (guide only).
 * @param {Array<{ panelComponent?: string, openCount?: number }>} usageRows
 * @param {{ minOpens?: number, topN?: number }} [opts]
 * @returns {Set<string>}
 */
export function buildSuggestedKeySet(usageRows = [], opts = {}) {
  const minOpens = Number.isFinite(opts.minOpens) ? opts.minOpens : SUGGESTED_KEY_MIN_OPENS;
  const topN = Number.isFinite(opts.topN) ? opts.topN : SUGGESTED_KEY_TOP_N;
  const ranked = [...(usageRows || [])]
    .map((row) => ({
      panelComponent: String(row?.panelComponent || '').trim(),
      openCount: Number(row?.openCount) || 0,
    }))
    .filter((row) => row.panelComponent && row.openCount >= minOpens)
    .sort((a, b) => b.openCount - a.openCount || a.panelComponent.localeCompare(b.panelComponent))
    .slice(0, topN);
  return new Set(ranked.map((row) => row.panelComponent));
}

/**
 * Count fields that can be attributed to the panel's tables.
 * Override / scraped fetch columns always count; Tabulator fields count when
 * they match a known sync or fetch column on the panel's tables.
 */
export function countAttributedColumns({
  tables = [],
  panelColumns = [],
  tabulatorFields = [],
  panelTableColumns = {},
  syncTableColumns = {},
} = {}) {
  const matchIndex = new Set();
  const seen = new Set();
  let count = 0;

  const addCount = (raw) => {
    const name = String(raw || '').trim();
    if (!name) return;
    const key = normalizeFieldKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    count += 1;
  };

  (tables || []).forEach((table) => {
    const name = String(typeof table === 'string' ? table : table?.taliaTable || '').trim().toLowerCase();
    if (!name) return;
    const declared = panelTableColumns?.[name] || panelTableColumns?.[table] || [];
    const syncCols = syncTableColumns?.[name] || [];
    [...declared, ...syncCols].forEach((col) => {
      const key = normalizeFieldKey(col);
      if (key) matchIndex.add(key);
    });
    declared.forEach((col) => addCount(col));
  });

  (panelColumns || []).forEach((col) => {
    addCount(typeof col === 'string' ? col : col?.name);
  });

  (tabulatorFields || []).forEach((field) => {
    const key = normalizeFieldKey(field);
    if (!key || seen.has(key)) return;
    if (matchIndex.has(key)) addCount(field);
  });

  return count;
}

/**
 * Soft coverage assessment for a component (or table) row.
 * @returns {{ status: string, label: string, isIssue: boolean }}
 */
export function assessLineageCoverage({
  kind = 'component',
  tableCount = 0,
  tables = [],
  attributedColumnCount = 0,
  synapseSource = null,
} = {}) {
  if (kind === 'table') {
    const source = String(synapseSource || '').trim();
    if (!source || source === '—') {
      return { status: 'missing_source', label: 'No Synapse source', isIssue: true };
    }
    return { status: 'ok', label: 'Mapped', isIssue: false };
  }

  const count = Number(tableCount) || (tables || []).length || 0;
  if (count <= 0) {
    return { status: 'missing_tables', label: 'No tables', isIssue: true };
  }

  const missingSource = (tables || []).every((edge) => {
    const label = String(edge?.sourceLabel || edge?.synapseSource || '').trim();
    return !label || label === '—';
  });
  if (missingSource) {
    return { status: 'missing_source', label: 'No Synapse source', isIssue: true };
  }

  if ((Number(attributedColumnCount) || 0) <= 0) {
    return { status: 'missing_columns', label: 'No field mappings', isIssue: true };
  }

  return { status: 'ok', label: 'Covered', isIssue: false };
}

/**
 * Attach isKey / suggested / coverage to component rows.
 */
export function withLineageCoverage(rows = [], {
  keySet = new Set(),
  suggestedSet = new Set(),
  fieldByPanel = new Map(),
  panelTableColumns = {},
  syncTableColumns = {},
} = {}) {
  return (rows || []).map((row) => {
    if (row?.kind === 'table') {
      const coverage = assessLineageCoverage({
        kind: 'table',
        synapseSource: row.synapseSource || row.sourceLabel,
      });
      return {
        ...row,
        isKey: false,
        isSuggested: false,
        coverageStatus: coverage.status,
        coverageLabel: coverage.label,
        coverageIssue: coverage.isIssue,
      };
    }

    const isKey = matchesKeySet(row, keySet);
    const isSuggested = !isKey && (
      matchesKeySet(row, suggestedSet)
      || suggestedSet.has(String(row?.panelId || ''))
      || suggestedSet.has(String(row?.componentKey || ''))
    );

    const tables = row.tables || [];
    const tabulatorFields = fieldByPanel.get(row.panelId)
      || fieldByPanel.get(row.componentKey)
      || [];
    const declaredForPanel = panelTableColumns?.[row.componentKey]
      || panelTableColumns?.[row.panelId]
      || {};

    const attributedColumnCount = countAttributedColumns({
      tables,
      panelColumns: row.columns || [],
      tabulatorFields,
      panelTableColumns: declaredForPanel,
      syncTableColumns,
    });

    const coverage = assessLineageCoverage({
      kind: 'component',
      tableCount: row.tableCount || tables.length,
      tables,
      attributedColumnCount,
    });

    // Key panels with gaps are issues; non-key gaps stay informational.
    const coverageIssue = isKey ? coverage.isIssue : false;

    return {
      ...row,
      isKey,
      isSuggested,
      attributedColumnCount,
      coverageStatus: coverage.status,
      coverageLabel: coverage.label,
      coverageIssue,
      coverageGap: coverage.isIssue,
    };
  });
}

export function filterRowsByKey(rows = [], keyFilter = KEY_FILTER_DEFAULT) {
  const mode = String(keyFilter || KEY_FILTER_DEFAULT);
  if (mode === KEY_FILTER_KEY) return (rows || []).filter((row) => row.isKey);
  if (mode === KEY_FILTER_SUGGESTED) {
    return (rows || []).filter((row) => row.isKey || row.isSuggested);
  }
  return [...(rows || [])];
}

export function filterRowsByCoverage(rows = [], coverageFilter = COVERAGE_FILTER_DEFAULT) {
  const mode = String(coverageFilter || COVERAGE_FILTER_DEFAULT);
  if (mode === COVERAGE_FILTER_ISSUES) {
    return (rows || []).filter((row) => row.coverageIssue || (row.isKey && row.coverageGap));
  }
  return [...(rows || [])];
}

/**
 * Summary strip for callouts.
 */
export function summarizeLineageCoverage(rows = []) {
  const list = rows || [];
  const keyRows = list.filter((row) => row.isKey);
  const suggested = list.filter((row) => row.isSuggested && !row.isKey);
  const keyIssues = keyRows.filter((row) => row.coverageGap);
  const gaps = list.filter((row) => row.coverageGap);
  return {
    total: list.length,
    keyCount: keyRows.length,
    suggestedCount: suggested.length,
    keyIssueCount: keyIssues.length,
    gapCount: gaps.length,
  };
}
