import React, { useEffect, useMemo, useRef } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import ReportSnapshot from '../../shared/ReportSnapshot';
import ReportProvenance from '../../shared/ReportProvenance';
import '../RmChecklist/rm-engine-panels.css';

const EngineActivityPresenter = ({
  status = null,
  runs = [],
  runMessage = null,
  onRun,
  onRefresh,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const { showSnapshot, showProvenance, reportShellClassName } = useReportShellOptions(
    panelComponentId || 'engine-activity',
    panelInstanceId
  );

  const columns = useMemo(() => ([
    { field: 'startedAt', title: 'Started', minWidth: 170 },
    { field: 'status', title: 'Status', width: 88 },
    { field: 'trigger', title: 'Trigger', width: 100 },
    { field: 'findingCount', title: 'Findings', hozAlign: 'right', width: 90 },
    {
      field: 'agentIds',
      title: 'RM Agents',
      minWidth: 220,
      formatter: (cell) => (cell.getValue() || []).join(', '),
    },
    { field: 'error', title: 'Error', minWidth: 180 },
  ]), []);

  useEffect(() => {
    let cancelled = false;
    const initTable = async () => {
      if (!tableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        instanceRef.current.replaceData(runs);
        return;
      }
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: runs,
        columns,
        layout: 'fitDataFill',
        placeholder: 'No engine runs stored yet',
        panelInstanceId,
        panelComponentId: panelComponentId || 'engine-activity',
        exportTitle: 'Engine Activity',
      }));
    };
    initTable();
    return () => { cancelled = true; };
  }, [columns, panelComponentId, panelInstanceId, runs]);

  return (
    <div className={`focus-panel talia-report engine-activity ${reportShellClassName}`} role="region" aria-label="Engine Activity">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Engine Activity</h2>
          <p className="talia-report__subtitle">
            talia-engine runtime on :4100 — independent of this UI process.
          </p>
        </div>
      </header>

      <div className="talia-report__actions-bar" aria-label="Engine actions">
        <button type="button" className="talia-btn talia-btn--primary" onClick={onRun}>
          Run now
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {runMessage ? (
        <div className="talia-callout engine-activity__callout" role="note">{runMessage}</div>
      ) : null}

      <ReportSnapshot
        visible={showSnapshot}
        items={[
          {
            key: 'online',
            label: 'Runtime',
            value: status?.online ? 'Online' : 'Offline',
            tone: status?.online ? 'positive' : 'negative',
          },
          { key: 'version', label: 'Engine', value: status?.version || '—' },
          {
            key: 'python',
            label: 'Python element',
            value: status?.pythonAvailable ? (status.pythonInterpreter || 'ready') : 'not available',
          },
          {
            key: 'lastrun',
            label: 'Last run',
            value: status?.lastRun?.status || '—',
          },
        ]}
      />

      <main className="talia-report__content talia-report__content--scroll">
        <div ref={tableRef} className="talia-table" role="grid" />
        <ReportProvenance visible={showProvenance}>
          <p>
            Run history is stored in <code>rm_engine_runs</code>. Live Online / Python
            status is probed from the independent talia-engine process on :4100
            (<code>cd talia-engine && npm run dev</code> or the Docker service).
            Stored runs remain visible if the runtime is down. Python is a discrete
            analysis hook, not an RM Agent.
          </p>
          {status?.error ? <p>Last probe: {status.error}</p> : null}
          {status?.url ? <p>Probe URL: {status.url}</p> : null}
        </ReportProvenance>
      </main>
    </div>
  );
};

export default EngineActivityPresenter;
