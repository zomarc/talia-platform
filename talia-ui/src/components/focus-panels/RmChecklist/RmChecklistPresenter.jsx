import React, { useEffect, useMemo, useRef } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { formatDayMonYy } from '../../../lib/dateFormat';
import { chainRowFormatters, createReferenceRowFormatter } from '../../../lib/tabulatorReferenceSelection';
import ReportSnapshot from '../../shared/ReportSnapshot';
import ReportProvenance from '../../shared/ReportProvenance';
import RmChecklistHeatmap from './RmChecklistHeatmap.jsx';
import {
  CHECKLIST_SCOPE_ALL,
  CHECKLIST_SCOPE_NEIGHBORS,
  CHECKLIST_SCOPE_THIS,
  findingSailCode,
} from './rmChecklistScope';
import { formatActionLabel, buildFindingExplanation } from './rmChecklistHeatmapTransform.js';
import './rm-engine-panels.css';

const formatPct = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
};

const withTitleTooltip = (text, title) => {
  const el = document.createElement('span');
  el.className = 'rm-checklist-cell-tip';
  el.textContent = text == null || text === '' ? '—' : String(text);
  if (title) el.title = title;
  return el;
};

const SCOPE_MODES = [
  { id: CHECKLIST_SCOPE_THIS, label: 'This', title: 'Recommendations for the selected sailing only' },
  { id: CHECKLIST_SCOPE_NEIGHBORS, label: 'Neighbors', title: 'Same ship, two departures either side of the selected sailing' },
  { id: CHECKLIST_SCOPE_ALL, label: 'All', title: 'Every open recommendation in the StatusBar horizon' },
];

const DISPLAY_MODES = [
  { id: 'table', label: 'Table' },
  { id: 'heatmap', label: 'Heatmap' },
];

const RmChecklistPresenter = ({
  rows = [],
  selectedSailCode = null,
  selectedShipName = null,
  selectedSailDate = null,
  selectedFindingId = null,
  neighborSailCodes = [],
  scope = CHECKLIST_SCOPE_ALL,
  horizonSummary = 'Global horizon',
  shipCode = null,
  runMessage = null,
  onRun,
  onScopeChange,
  onSelectFinding,
  onAcknowledge,
  onDismiss,
  onRefresh,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const selectedSailCodeRef = useRef(selectedSailCode);
  const selectedFindingIdRef = useRef(selectedFindingId);
  const onSelectFindingRef = useRef(onSelectFinding);
  selectedSailCodeRef.current = selectedSailCode;
  selectedFindingIdRef.current = selectedFindingId;
  onSelectFindingRef.current = onSelectFinding;
  const {
    viewsState,
    setView,
    showSnapshot,
    showFilters,
    showProvenance,
    reportShellClassName,
  } = useReportShellOptions(
    panelComponentId || 'rm-checklist',
    panelInstanceId
  );
  const display = viewsState.display === 'heatmap' ? 'heatmap' : 'table';

  const columns = useMemo(() => ([
    { field: 'severity', title: 'Severity', width: 96, headerFilter: 'list', headerFilterParams: { valuesLookup: true } },
    {
      field: 'score',
      title: 'Urgency',
      hozAlign: 'right',
      width: 88,
      formatter: (cell) => Number(cell.getValue() || 0).toFixed(2),
    },
    { field: 'subjectId', title: 'Sailing', width: 130, headerFilter: 'input' },
    {
      field: 'actionType',
      title: 'Recommended action',
      width: 180,
      headerFilter: 'input',
      formatter: (cell) => {
        const row = cell.getRow()?.getData?.() || {};
        const label = formatActionLabel(cell.getValue());
        return withTitleTooltip(label, buildFindingExplanation(row));
      },
    },
    {
      field: 'rationale',
      title: 'Rationale',
      minWidth: 220,
      formatter: (cell) => {
        const row = cell.getRow()?.getData?.() || {};
        return withTitleTooltip(cell.getValue(), buildFindingExplanation(row));
      },
    },
    {
      field: 'loadFactor',
      title: 'LF',
      hozAlign: 'right',
      width: 72,
      formatter: (cell) => formatPct(cell.getValue()),
    },
    {
      field: 'targetLoadFactor',
      title: 'Target LF',
      hozAlign: 'right',
      width: 88,
      formatter: (cell) => formatPct(cell.getValue()),
    },
    { field: 'daysToSail', title: 'DTS', hozAlign: 'right', width: 64 },
    { field: 'agentId', title: 'RM Agent', width: 220 },
  ]), []);

  const hasFocus = Boolean(selectedSailCode);
  const isThis = scope === CHECKLIST_SCOPE_THIS && hasFocus;
  const isNeighbors = scope === CHECKLIST_SCOPE_NEIGHBORS && hasFocus;
  const neighborLabels = neighborSailCodes.filter((code) => code !== selectedSailCode);
  const placeholder = isThis
    ? `No open Findings for ${selectedSailCode}`
    : isNeighbors
      ? `No open Findings for ${selectedSailCode} or its neighbors`
      : 'No open Findings in the global horizon';
  const isFocusRow = (data) => {
    const focus = selectedSailCodeRef.current;
    if (!focus) return false;
    const sail = findingSailCode(data);
    const reference = String(data?.subject?.reference_sail_code || '').trim();
    return sail === String(focus) || reference === String(focus);
  };

  const syncTableSelection = (table) => {
    if (!table) return;
    const findingId = selectedFindingIdRef.current;
    const current = table.getSelectedData?.()?.[0]?.findingId || null;
    if (current === findingId) return;
    table.deselectRow?.();
    if (!findingId) return;
    const match = (table.getRows?.() || []).find((row) => row.getData?.()?.findingId === findingId);
    if (match) table.selectRow(match);
  };

  useEffect(() => {
    let cancelled = false;
    if (display !== 'table') {
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
      return () => { cancelled = true; };
    }
    const initTable = async () => {
      if (!tableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        instanceRef.current.replaceData(rows);
        syncTableSelection(instanceRef.current);
        return;
      }
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: rows,
        columns,
        layout: 'fitDataFill',
        placeholder,
        selectableRows: 1,
        panelInstanceId,
        panelComponentId: panelComponentId || 'rm-checklist',
        exportTitle: 'RM Checklist',
        rowFormatter: chainRowFormatters(createReferenceRowFormatter(isFocusRow)),
      }));
      instanceRef.current.on('rowClick', (_event, row) => {
        const data = row?.getData?.();
        if (!data?.findingId) return;
        onSelectFindingRef.current?.(data);
      });
      instanceRef.current.on('tableBuilt', () => {
        syncTableSelection(instanceRef.current);
      });
    };
    initTable();
    return () => { cancelled = true; };
  }, [columns, display, panelComponentId, panelInstanceId, placeholder, rows]);

  useEffect(() => {
    if (display !== 'table') return;
    syncTableSelection(instanceRef.current);
  }, [display, selectedFindingId]);

  const activeFindingId = selectedFindingId
    || null;
  const openCount = rows.length;
  const actionCount = rows.filter((row) => row.severity === 'action' || row.severity === 'critical').length;
  const emptyPinned = isThis && rows.length === 0;

  return (
    <div className={`focus-panel talia-report rm-checklist ${reportShellClassName}`} role="region" aria-label="RM Checklist">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">RM Checklist</h2>
          <p className="talia-report__subtitle">
            Open Findings from talia-engine. Advise only — no reservation writes.
          </p>
        </div>
      </header>

      <div
        className={`rm-checklist__filters talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
      >
        <div className="rm-checklist__scope" aria-label="Checklist scope">
          {hasFocus ? (
            <div className="rm-checklist__focus">
              <span className="rm-checklist__focus-label">Focus</span>
              <span className="rm-checklist__focus-sail">{selectedSailCode}</span>
              {selectedShipName || selectedSailDate ? (
                <span className="rm-checklist__focus-meta">
                  {[
                    selectedShipName,
                    selectedSailDate ? formatDayMonYy(selectedSailDate, '') : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="ms-berth-criteria__item">
              <span className="ms-berth-criteria__label">Scope</span>
              <span className="ms-berth-criteria__value">{horizonSummary}</span>
            </div>
          )}
          {hasFocus ? (
            <div className="rm-checklist__scope-modes" role="group" aria-label="Recommendation range">
              {SCOPE_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  title={mode.title}
                  className={`talia-btn ${scope === mode.id ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
                  aria-pressed={scope === mode.id}
                  onClick={() => onScopeChange?.(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          ) : null}
          {isNeighbors && neighborLabels.length ? (
            <p className="rm-checklist__neighbors">
              Also {neighborLabels.join(' · ')}
            </p>
          ) : null}
          {scope === CHECKLIST_SCOPE_ALL && hasFocus ? (
            <p className="rm-checklist__neighbors">{horizonSummary}</p>
          ) : null}
          {shipCode && scope === CHECKLIST_SCOPE_ALL ? (
            <div className="ms-berth-criteria__item">
              <span className="ms-berth-criteria__label">Ship</span>
              <span className="ms-berth-criteria__value">{shipCode}</span>
            </div>
          ) : null}
        </div>
      </div>

      {runMessage ? (
        <div className="talia-callout rm-checklist__callout" role="note">{runMessage}</div>
      ) : null}
      {emptyPinned ? (
        <div className="talia-callout rm-checklist__callout" role="note">
          No open Findings for {selectedSailCode}. Neighbors widens to the same ship’s adjacent departures. All returns to the horizon without clearing Explorer.
        </div>
      ) : null}

      <div className="talia-report__actions-bar" aria-label="Checklist actions">
        <div className="rm-checklist__display" role="group" aria-label="Checklist display">
          {DISPLAY_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`talia-btn ${display === mode.id ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
              aria-pressed={display === mode.id}
              onClick={() => setView('display', mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <button type="button" className="talia-btn talia-btn--primary" onClick={onRun}>
          Run Regulator
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
          Refresh
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={!activeFindingId}
          onClick={() => activeFindingId && onAcknowledge(activeFindingId)}
        >
          Acknowledge
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={!activeFindingId}
          onClick={() => activeFindingId && onDismiss(activeFindingId)}
        >
          Dismiss
        </button>
      </div>

      <ReportSnapshot
        visible={showSnapshot}
        items={[
          { key: 'open', label: 'Open', value: openCount },
          { key: 'action', label: 'Need action', value: actionCount, tone: actionCount ? 'negative' : 'neutral' },
        ]}
      />

      <main className="talia-report__content talia-report__content--scroll">
        {display === 'heatmap' ? (
          <RmChecklistHeatmap
            rows={rows}
            selectedSailCode={selectedSailCode}
            selectedFindingId={selectedFindingId}
            onSelectFinding={onSelectFinding}
          />
        ) : (
          <div ref={tableRef} className="talia-table" role="grid" />
        )}
        <ReportProvenance visible={showProvenance}>
          <p>
            Findings are produced by RM Agents in talia-engine, stored in <code>rm_findings</code>,
            and read through talia-server GraphQL. Regulator compares occupancy to inventory
            load-factor targets. The Talia Assistant is not part of this panel.
          </p>
        </ReportProvenance>
      </main>
    </div>
  );
};

export default RmChecklistPresenter;
