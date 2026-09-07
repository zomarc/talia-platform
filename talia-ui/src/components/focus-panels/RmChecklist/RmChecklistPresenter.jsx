import React, { useEffect, useMemo, useRef } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import ReportSnapshot from '../../shared/ReportSnapshot';
import ReportDataDetails from '../../shared/ReportDataDetails';
import './rm-engine-panels.css';

const formatPct = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
};

const RmChecklistPresenter = ({
  rows = [],
  sailCode = null,
  runMessage = null,
  onRun,
  onAcknowledge,
  onDismiss,
  onRefresh,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const { showSnapshot, showDetails, reportShellClassName } = useReportShellOptions(
    panelComponentId || 'rm-checklist',
    panelInstanceId
  );

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
    { field: 'actionType', title: 'Recommended action', width: 180, headerFilter: 'input' },
    { field: 'rationale', title: 'Rationale', minWidth: 220 },
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

  useEffect(() => {
    let cancelled = false;
    const initTable = async () => {
      if (!tableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        instanceRef.current.replaceData(rows);
        return;
      }
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: rows,
        columns,
        layout: 'fitDataFill',
        placeholder: 'No open Findings',
        panelInstanceId,
        panelComponentId: panelComponentId || 'rm-checklist',
        exportTitle: 'RM Checklist',
      }));
    };
    initTable();
    return () => { cancelled = true; };
  }, [columns, panelComponentId, panelInstanceId, rows]);

  const selectedFindingId = () => instanceRef.current?.getSelectedData?.()?.[0]?.findingId || rows[0]?.findingId;

  const openCount = rows.length;
  const actionCount = rows.filter((row) => row.severity === 'action' || row.severity === 'critical').length;

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

      <div className="talia-report__actions-bar" aria-label="Checklist actions">
        <button type="button" className="talia-btn talia-btn--primary" onClick={onRun}>
          Run Regulator
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
          Refresh
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => selectedFindingId() && onAcknowledge(selectedFindingId())}
        >
          Acknowledge
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => selectedFindingId() && onDismiss(selectedFindingId())}
        >
          Dismiss
        </button>
        {sailCode ? <span className="rm-checklist__scope">Sailing {sailCode}</span> : <span className="rm-checklist__scope">All upcoming</span>}
      </div>

      {runMessage ? (
        <div className="talia-callout rm-checklist__callout" role="note">{runMessage}</div>
      ) : null}

      <ReportSnapshot
        visible={showSnapshot}
        items={[
          { key: 'open', label: 'Open', value: openCount },
          { key: 'action', label: 'Need action', value: actionCount, tone: actionCount ? 'negative' : 'neutral' },
        ]}
      />

      <main className="talia-report__content talia-report__content--scroll">
        <div ref={tableRef} className="talia-table" role="grid" />
        <ReportDataDetails visible={showDetails} as="section">
          <p>
            Findings are produced by RM Agents in talia-engine, stored in <code>rm_findings</code>,
            and shown here. The Talia Assistant is not part of this panel.
          </p>
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default RmChecklistPresenter;
