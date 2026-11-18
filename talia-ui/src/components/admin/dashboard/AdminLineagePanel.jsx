/**
 * Admin Dashboard — Data Lineage key flags + coverage (inline).
 * Soft highlighting for source remapping; never fails the app.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import tableSources from '../../../config/tableSources';
import {
  SUGGESTED_KEY_SINCE_MINUTES,
  buildSuggestedKeySet,
  indexKeyPanels,
  summarizeLineageCoverage,
  withLineageCoverage,
} from '../../../lib/dataLineageCoverage';
import {
  buildKnownTableNames,
  buildPanelCatalog,
  generatedPanelTableColumns,
  generatedSyncTableColumns,
  invertFieldUsageCatalog,
} from '../../../lib/dataLineageCatalog';
import {
  buildComponentOrientationRows,
  buildSynapseEdges,
  buildTableOrientationRows,
  indexByTarget,
  indexUsageByPanel,
  withUsageIntensity,
} from '../../../lib/dataLineageView';
import { formatCompactDateTime, formatCompactRelativeAge } from '../../../lib/dateFormat';
import { getTabulatorOptions, initTabulator, captureTableScroll } from '../../../lib/tabulatorConfig';
import tabulatorFieldUsageCatalog from '../../../lib/tabulatorFieldUsageCatalog';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import componentRegistry from '../../focus-panels/registry';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';

const LINEAGE_ADMIN_QUERY = `
  query AdminLineageCoverage($suggestSinceMinutes: Int) {
    suggestedUsage: uiActivityPanelUsage(sinceMinutes: $suggestSinceMinutes) {
      panelComponent
      openCount
      lastAt
      roles
    }
    panelLineageFlags {
      panelComponent
      isKey
      updatedAt
      updatedBy
    }
  }
`;

const SET_KEY_MUTATION = `
  mutation SetPanelLineageKey($panelComponent: String!, $isKey: Boolean!) {
    setPanelLineageKey(panelComponent: $panelComponent, isKey: $isKey) {
      panelComponent
      isKey
      updatedAt
      updatedBy
    }
  }
`;

const AdminLineagePanel = () => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const rowsRef = useRef([]);
  const onToggleRef = useRef(null);

  const [flags, setFlags] = useState([]);
  const [usageRows, setUsageRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [issuesOnly, setIssuesOnly] = useState(false);

  const synapseEdges = useMemo(() => buildSynapseEdges(tableSources), []);
  const knownTables = useMemo(() => buildKnownTableNames(tableSources, []), []);
  const panelCatalog = useMemo(
    () => buildPanelCatalog(componentRegistry, knownTables),
    [knownTables],
  );
  const fieldByPanel = useMemo(
    () => invertFieldUsageCatalog(tabulatorFieldUsageCatalog),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: LINEAGE_ADMIN_QUERY,
        variables: { suggestSinceMinutes: SUGGESTED_KEY_SINCE_MINUTES },
        component: 'AdminLineagePanel',
        tableName: 'panel_lineage_flag',
        purpose: 'admin-lineage',
      });
      setFlags(Array.isArray(data?.panelLineageFlags) ? data.panelLineageFlags : []);
      setUsageRows(Array.isArray(data?.suggestedUsage) ? data.suggestedUsage : []);
    } catch (err) {
      setError(err?.message || String(err));
      setFlags([]);
      setUsageRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleKey = useCallback(async (panelComponent, isKey) => {
    const key = String(panelComponent || '').trim();
    if (!key) return;
    setSavingKey(key);
    try {
      const data = await trackedFetchGraphql({
        query: SET_KEY_MUTATION,
        variables: { panelComponent: key, isKey: Boolean(isKey) },
        component: 'AdminLineagePanel',
        tableName: 'panel_lineage_flag',
        purpose: 'set-key',
      });
      const next = data?.setPanelLineageKey;
      if (next?.panelComponent) {
        setFlags((prev) => {
          const others = (prev || []).filter((row) => row.panelComponent !== next.panelComponent);
          return [...others, next].sort((a, b) => a.panelComponent.localeCompare(b.panelComponent));
        });
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSavingKey(null);
    }
  }, []);

  onToggleRef.current = handleToggleKey;

  const { rows, summary } = useMemo(() => {
    const usageMap = indexUsageByPanel(usageRows, panelCatalog);
    const tableRows = buildTableOrientationRows({
      synapseEdges,
      panelCatalog,
      usageMap,
      etlByTarget: new Map(),
    });
    const tableByTarget = indexByTarget(tableRows);
    const components = withUsageIntensity(
      buildComponentOrientationRows(panelCatalog, usageMap, tableByTarget),
    );
    const covered = withLineageCoverage(components, {
      keySet: indexKeyPanels(flags),
      suggestedSet: buildSuggestedKeySet(usageRows),
      fieldByPanel,
      panelTableColumns: generatedPanelTableColumns,
      syncTableColumns: generatedSyncTableColumns,
    });
    const sorted = [...covered].sort((a, b) => {
      if (a.coverageIssue !== b.coverageIssue) return a.coverageIssue ? -1 : 1;
      if (a.isKey !== b.isKey) return a.isKey ? -1 : 1;
      if (a.isSuggested !== b.isSuggested) return a.isSuggested ? -1 : 1;
      return (b.usageCount || 0) - (a.usageCount || 0) || String(a.title).localeCompare(String(b.title));
    });
    return {
      rows: issuesOnly ? sorted.filter((row) => row.coverageIssue) : sorted,
      summary: summarizeLineageCoverage(sorted),
    };
  }, [panelCatalog, synapseEdges, usageRows, flags, fieldByPanel, issuesOnly]);

  rowsRef.current = rows;

  useEffect(() => {
    let cancelled = false;
    const initTable = async () => {
      if (!tableRef.current || cancelled) return;
      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;
        if (instanceRef.current) {
          try { instanceRef.current.destroy(); } catch { /* noop */ }
          instanceRef.current = null;
        }

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: [],
          height: '100%',
          pagination: false,
          selectableRows: false,
          panelComponentId: 'admin-dashboard',
          columns: [
            {
              field: 'title',
              title: 'Panel',
              headerFilter: 'input',
              minWidth: 160,
              widthGrow: 2,
            },
            {
              field: 'category',
              title: 'Category',
              headerFilter: 'list',
              headerFilterParams: { valuesLookup: true, autocomplete: true },
              width: 130,
            },
            {
              field: 'isKey',
              title: 'Key',
              width: 90,
              hozAlign: 'center',
              formatter: (cell) => {
                const row = cell.getRow()?.getData?.() || {};
                const wrap = document.createElement('label');
                wrap.className = 'admin-lineage-key';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = Boolean(row.isKey);
                input.disabled = savingKey === row.panelId || savingKey === row.componentKey;
                input.addEventListener('click', (event) => event.stopPropagation());
                input.addEventListener('change', (event) => {
                  const target = row.panelId || row.componentKey;
                  onToggleRef.current?.(target, event.target.checked);
                });
                wrap.appendChild(input);
                if (row.isSuggested && !row.isKey) {
                  const hint = document.createElement('span');
                  hint.className = 'admin-lineage-sug';
                  hint.title = 'Suggested from data refreshes in the last 4 weeks';
                  hint.textContent = 'Sug';
                  wrap.appendChild(hint);
                }
                return wrap;
              },
            },
            {
              field: 'coverageLabel',
              title: 'Coverage',
              width: 140,
              headerFilter: 'list',
              headerFilterParams: { valuesLookup: true, autocomplete: true },
              formatter: (cell) => {
                const row = cell.getRow()?.getData?.() || {};
                const el = document.createElement('span');
                el.className = row.coverageIssue ? 'dl-cov dl-cov--issue' : 'dl-cov';
                el.textContent = row.coverageLabel || '—';
                return el;
              },
            },
            {
              field: 'tableNames',
              title: 'Tables',
              headerFilter: 'input',
              minWidth: 180,
              widthGrow: 2,
            },
            {
              field: 'usageCount',
              title: 'Refs (28d)',
              headerTooltip: 'Tracked data refreshes / fetches in the last 4 weeks',
              hozAlign: 'right',
              width: 100,
              headerFilter: 'number',
            },
            {
              field: 'lastAt',
              title: 'Last',
              width: 72,
              hozAlign: 'right',
              formatter: (cell) => {
                const value = cell.getValue();
                const el = document.createElement('span');
                el.textContent = formatCompactRelativeAge(value);
                const full = formatCompactDateTime(value, '');
                if (full) el.title = full;
                return el;
              },
            },
          ],
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          const next = Array.isArray(rowsRef.current) ? rowsRef.current : [];
          const scroll = captureTableScroll(instanceRef.current);
          const refreshPromise = Promise.resolve(instanceRef.current.replaceData(next))
            .catch(() => { /* noop */ });
          afterTabulatorDataRefresh(instanceRef.current, refreshPromise, scroll);
        });
      } catch (err) {
        console.error('[AdminLineagePanel] table init failed:', err);
      }
    };

    initTable();
    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    const scroll = captureTableScroll(table);
    const refreshPromise = Promise.resolve(table.replaceData(rows)).catch(() => { /* noop */ });
    afterTabulatorDataRefresh(table, refreshPromise, scroll);
    try { table.redraw(true); } catch { /* noop */ }
  }, [rows, savingKey]);

  return (
    <div className="admin-lineage-panel" role="region" aria-label="Data lineage keys">
      <div className="admin-lineage-panel__toolbar">
        <div>
          <h3 className="admin-lineage-panel__title">Data Lineage keys</h3>
          <p className="admin-lineage-panel__subtitle">
            Flag key panels for source remapping. Gaps are highlighted — never fail the app.
            Suggested keys come from data refreshes in the last 4 weeks.
          </p>
        </div>
        <div className="admin-lineage-panel__actions">
          <label className="admin-lineage-panel__toggle">
            <input
              type="checkbox"
              checked={issuesOnly}
              onChange={(e) => setIssuesOnly(e.target.checked)}
            />
            Issues only
          </label>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="talia-callout talia-callout--warning" role="status">{error}</div>
      ) : null}

      {summary.keyIssueCount > 0 ? (
        <div className="talia-callout talia-callout--warning" role="status">
          {summary.keyIssueCount}
          {' '}
          key panel
          {summary.keyIssueCount === 1 ? '' : 's'}
          {' '}
          with lineage gaps
          {summary.keyCount ? ` (${summary.keyCount} key total)` : ''}
          .
        </div>
      ) : (
        <div className="talia-callout" role="status">
          {summary.keyCount || 0}
          {' '}
          key ·
          {' '}
          {summary.suggestedCount || 0}
          {' '}
          suggested ·
          {' '}
          {summary.total || 0}
          {' '}
          panels in catalog
          {loading ? ' · loading…' : ''}
        </div>
      )}

      <div className="admin-lineage-panel__table-wrap">
        <div ref={tableRef} className="focus-panel__table" />
      </div>
    </div>
  );
};

export default AdminLineagePanel;
