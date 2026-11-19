import React, { useEffect, useMemo, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  applyAxisLabelVisibility,
  getChartColors,
  getChartOptions,
  getSeriesColors,
} from '../../../lib/chartConfig';
import {
  buildHorizonSeries,
  fmtEuro,
  fmtPct,
  pairForwardFor,
  portfolioTotals,
} from '../../../lib/driverAnalysisView';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import ReportSnapshot from '../../shared/ReportSnapshot';
import ReportProvenance from '../../shared/ReportProvenance';
import ReportDataDetails from '../../shared/ReportDataDetails';
import '../RmChecklist/rm-engine-panels.css';
import './driver-analysis.css';

Chart.register(...registerables);

const nowMarkerPlugin = (nowIndex, ink) => ({
  id: 'driverAnalysisNow',
  afterDraw(chart) {
    if (nowIndex == null || nowIndex < 0) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales?.x?.getPixelForValue(nowIndex);
    if (!ctx || !chartArea || !Number.isFinite(x)) return;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = ink.accent || ink.text;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ink.accent || ink.text;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NOW', x, chartArea.top + 12);
    ctx.restore();
  },
});

const HorizonChart = ({ series, showLegends, showAxisLabels, showTooltip }) => {
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const points = series?.points || [];
    if (!canvas || !points.length) return undefined;

    const colors = getSeriesColors();
    const ink = getChartColors();
    const labels = points.map((p) => String(p.dtd));
    const nowIndex = points.findIndex((p) => p.isNow);

    const base = getChartOptions.line({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: showLegends, position: 'top', align: 'start', labels: { color: ink.text } },
        tooltip: {
          enabled: showTooltip,
          callbacks: {
            title(items) {
              const i = items?.[0]?.dataIndex;
              const p = points[i];
              return p ? `${p.dtd} days before departure (W-${p.weeks})` : '';
            },
            afterBody(items) {
              const i = items?.[0]?.dataIndex;
              const p = points[i];
              if (!p?.decision) return [];
              return [
                `Decision: ${p.decision.posture}`,
                `${p.decision.supportable_alternate}`,
                `Δ ${p.decision.material_delta_guests} guests / ${fmtEuro(p.decision.revenue_delta)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          reverse: true,
          title: { display: true, text: 'Days before departure' },
          ticks: { color: ink.text },
        },
        y: {
          min: 0,
          max: 1,
          title: { display: true, text: 'Load factor' },
          ticks: {
            color: ink.text,
            callback: (v) => `${Math.round(Number(v) * 100)}%`,
          },
        },
      },
    });

    const bandHigh = points.map((p) => p.bandHigh);
    const bandLow = points.map((p) => p.bandLow);
    const prior = points.map((p) => p.priorLf);
    const actual = points.map((p) => p.actualLf);
    const observedNow = points.map((p) => (p.isNow ? p.observedNow : null));

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Peerset prior band (high)',
            data: bandHigh,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Peerset prior band',
            data: bandLow,
            borderColor: 'transparent',
            backgroundColor: (colors[0] || '#5b9fd4') + '33',
            pointRadius: 0,
            fill: '-1',
          },
          {
            label: 'Peerset prior',
            data: prior,
            borderColor: colors[0] || '#5b9fd4',
            backgroundColor: colors[0] || '#5b9fd4',
            tension: 0.2,
            pointRadius: 2,
          },
          {
            label: 'Historic actual path',
            data: actual,
            borderColor: colors[2] || '#e8a838',
            backgroundColor: colors[2] || '#e8a838',
            tension: 0.15,
            pointRadius: points.map((p) => (p.decision ? 5 : 2)),
            pointStyle: points.map((p) => (p.decision ? 'triangle' : 'circle')),
          },
          {
            label: 'Observed at NOW',
            data: observedNow,
            borderColor: colors[3] || '#7dcea0',
            backgroundColor: colors[3] || '#7dcea0',
            showLine: false,
            pointRadius: points.map((p) => (p.isNow ? 7 : 0)),
            pointStyle: 'rectRot',
          },
        ],
      },
      options: applyAxisLabelVisibility(base, showAxisLabels),
      plugins: [nowMarkerPlugin(nowIndex >= 0 ? nowIndex : null, { ...ink, accent: colors[3] || '#7dcea0' })],
    });
    chartRef.current = chart;

    const host = hostRef.current;
    let observer;
    if (host && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(host);
    }
    const frame = requestAnimationFrame(() => chart.resize());
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect?.();
      chartRef.current = null;
      chart.destroy();
    };
  }, [series, showAxisLabels, showLegends, showTooltip]);

  if (!series?.points?.length) {
    return (
      <div className="driver-analysis__chart-empty">
        Run analysis to project peerset prior from historic sailings onto the live booking horizon.
      </div>
    );
  }

  return (
    <div ref={hostRef} className="driver-analysis__chart-host">
      <canvas ref={canvasRef} aria-label="Historic prior to now load-factor projection" />
    </div>
  );
};

const DriverAnalysisPresenter = ({
  rows = [],
  selected = null,
  status = null,
  runMessage = null,
  frameworkMessage = null,
  selectionFocus = null,
  running = false,
  loading = false,
  updating = false,
  onSelect,
  onRun,
  onPromote,
  onRefresh,
  panelInstanceId,
  panelComponentId,
}) => {
  const isUpdating = updating || loading || running;
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const {
    showSnapshot,
    showProvenance,
    showDetails,
    showLegends,
    showAxisLabels,
    showTooltip,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId || 'driver-analysis', panelInstanceId);

  const forwardPair = useMemo(() => pairForwardFor(selected, rows), [rows, selected]);
  const series = useMemo(
    () => (selected ? buildHorizonSeries(selected, forwardPair) : null),
    [forwardPair, selected]
  );
  const portfolio = useMemo(() => portfolioTotals(rows), [rows]);

  const sailOptions = useMemo(() => {
    const historic = rows.filter((r) => r?.subject?.horizon === 'historic');
    const forward = rows.filter((r) => r?.subject?.horizon === 'forward_now');
    return { historic, forward };
  }, [rows]);

  const ranks = selected?.covariateRanks || [];
  const reasons = selected?.reasons || [];
  const moments = selected?.decisionMoments || [];

  const columns = useMemo(() => ([
    { field: 'subjectId', title: 'Sail', width: 110 },
    {
      field: 'subject.horizon',
      title: 'Horizon',
      width: 110,
      formatter: (cell) => cell.getRow().getData()?.subject?.horizon || '—',
    },
    {
      field: 'revenueValue.amount',
      title: '€ value',
      hozAlign: 'right',
      width: 100,
      formatter: (cell) => fmtEuro(cell.getRow().getData()?.revenueValue?.amount),
    },
    {
      field: 'peerset.n',
      title: 'Peerset n',
      hozAlign: 'right',
      width: 90,
      formatter: (cell) => cell.getRow().getData()?.peerset?.n ?? '—',
    },
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
        placeholder: 'No Evidence artifacts',
        panelInstanceId,
        panelComponentId: panelComponentId || 'driver-analysis',
        exportTitle: 'Driver Analysis Evidence',
      }));
      instanceRef.current.on('rowClick', (_e, row) => {
        onSelect?.(row.getData()?.evidenceId);
      });
    };
    initTable();
    return () => { cancelled = true; };
  }, [columns, onSelect, panelComponentId, panelInstanceId, rows]);

  return (
    <div
      className={`focus-panel talia-report driver-analysis ${reportShellClassName}${isUpdating ? ' driver-analysis--updating' : ''}`}
      role="region"
      aria-label="Driver Analysis"
      aria-busy={isUpdating || undefined}
      data-panel-updating={isUpdating ? 'true' : undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Driver Analysis</h2>
          <p className="talia-report__subtitle">
            Historic peerset prior on the booking horizon — projected to NOW (Groups/MR book)
          </p>
        </div>
      </header>

      <div className="talia-report-filters" aria-label="Subject filters">
        <label className="driver-analysis__filter">
          <span>Historic proof</span>
          <select
            value={selected?.subject?.horizon === 'historic' ? selected.evidenceId : ''}
            onChange={(e) => onSelect?.(e.target.value || null)}
          >
            <option value="">Select sailed subject…</option>
            {sailOptions.historic.map((r) => (
              <option key={r.evidenceId} value={r.evidenceId}>
                {r.subjectId} · peerset {r.peerset?.n ?? 0} · {fmtEuro(r.revenueValue?.amount)}
              </option>
            ))}
          </select>
        </label>
        <label className="driver-analysis__filter">
          <span>Forward NOW</span>
          <select
            value={
              selected?.subject?.horizon === 'forward_now'
                ? selected.evidenceId
                : (forwardPair?.evidenceId || '')
            }
            onChange={(e) => onSelect?.(e.target.value || null)}
          >
            <option value="">Paired from historic ship…</option>
            {sailOptions.forward.map((r) => (
              <option key={r.evidenceId} value={r.evidenceId}>
                {r.subjectId} · W-{r.forwardNow?.weeks_until_sailing ?? '—'} · {fmtEuro(r.forwardNow?.revenue_at_stake ?? r.revenueValue?.amount)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="talia-report__actions-bar" aria-label="Driver analysis actions">
        <button
          type="button"
          className="talia-btn talia-btn--primary"
          onClick={onRun}
          disabled={running || status?.online === false}
        >
          {running ? 'Running…' : 'Run analysis'}
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} disabled={isUpdating}>
          {isUpdating ? 'Updating…' : 'Refresh'}
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={onPromote}
          disabled={isUpdating || !selected || selected.role === 'source'}
        >
          Promote to source
        </button>
      </div>

      {(isUpdating || frameworkMessage || runMessage) ? (
        <div
          className={`talia-callout driver-analysis__callout${isUpdating ? ' driver-analysis__callout--busy' : ''}`}
          role="status"
          aria-live="polite"
        >
          {isUpdating ? (
            <>
              <span className="driver-analysis__spinner" aria-hidden />
              <span className="driver-analysis__busy">Updating… </span>
            </>
          ) : null}
          {frameworkMessage || runMessage || (isUpdating ? 'Accepting framework message' : '')}
          {runMessage && frameworkMessage && runMessage !== frameworkMessage ? (
            <span className="driver-analysis__muted"> · {runMessage}</span>
          ) : null}
        </div>
      ) : null}

      {selectionFocus?.sailCodes?.length || selectionFocus?.shipCode ? (
        <div className="driver-analysis__focus" aria-label="Framework selection">
          <span className="driver-analysis__focus-label">Focus</span>
          {selectionFocus.sailCodes?.length ? (
            <span className="driver-analysis__focus-sail">{selectionFocus.sailCodes.join(', ')}</span>
          ) : null}
          {selectionFocus.shipCode ? (
            <span className="driver-analysis__focus-meta">ship {selectionFocus.shipCode}</span>
          ) : null}
        </div>
      ) : null}

      <ReportSnapshot
        visible={showSnapshot}
        items={[
          {
            key: 'update',
            label: 'Update',
            value: running ? 'Running' : (isUpdating ? 'Updating…' : 'Idle'),
            tone: isUpdating ? 'neutral' : 'positive',
          },
          {
            key: 'historic',
            label: 'Historic € gap',
            value: fmtEuro(series?.revenueHistoric ?? portfolio.historicEuro),
            tone: 'neutral',
          },
          {
            key: 'forward',
            label: 'NOW € at stake',
            value: fmtEuro(series?.revenueForward || portfolio.forwardEuro),
            tone: 'neutral',
          },
          {
            key: 'prior',
            label: 'Prior LF',
            value: fmtPct(selected?.prior?.pace?.mean_lf),
          },
          {
            key: 'peerset',
            label: 'Peerset n',
            value: String(series?.peersetN ?? selected?.peerset?.n ?? 0),
          },
          {
            key: 'engine',
            label: 'Engine',
            value: status?.online ? 'Online' : 'Offline',
            tone: status?.online ? 'positive' : 'negative',
          },
        ]}
      />

      <main className="talia-report__content">
        <section className="driver-analysis__story" aria-label="Historic to now projection">
          <HorizonChart
            series={series}
            showLegends={showLegends}
            showAxisLabels={showAxisLabels}
            showTooltip={showTooltip}
          />

          {selected ? (
            <div className="driver-analysis__story-rail">
              <div className="talia-card driver-analysis__card">
                <p className="driver-analysis__kicker">Framework</p>
                <ol className="driver-analysis__steps">
                  <li>
                    <strong>Historic</strong> — peerset prior band vs actual path; triangles mark decision windows.
                  </li>
                  <li>
                    <strong>NOW</strong> — same axis on the live book (Groups/MR manage operations).
                  </li>
                  <li>
                    <strong>Value</strong> — material/revenue gap then, euros at stake now.
                  </li>
                </ol>
                <p className="driver-analysis__muted">
                  {selected.subjectId}
                  {selected.subject?.horizon === 'historic' && forwardPair
                    ? ` → paired forward ${forwardPair.subjectId}`
                    : ''}
                  {' · '}{series?.clusterId}
                </p>
              </div>

              {series?.forward ? (
                <div className="talia-card driver-analysis__card">
                  <p className="driver-analysis__kicker">At NOW</p>
                  <p>
                    Observed {fmtPct(series.forward.observed_lf)} vs prior {fmtPct(series.forward.prior_lf)}
                    {' · '}
                    {series.forward.material_at_stake_guests} guests / {fmtEuro(series.forward.revenue_at_stake)}
                  </p>
                  <p className="driver-analysis__muted">
                    {(series.forward.drivers_of_gap || []).length
                      ? `Gap drivers: ${series.forward.drivers_of_gap.join(', ')}`
                      : 'Groups/MR own the book; this monetises the scientific gap.'}
                  </p>
                </div>
              ) : null}

              {moments.length ? (
                <div className="talia-card driver-analysis__card">
                  <p className="driver-analysis__kicker">Where / when decisions mattered</p>
                  <ul className="driver-analysis__list driver-analysis__list--compact">
                    {moments.map((m) => (
                      <li key={`${m.when_label}-${m.posture}`}>
                        <strong>{m.when_label}</strong> · {fmtPct(m.actual_lf)} vs prior {fmtPct(m.prior_lf)}
                        {' → '}{fmtEuro(m.revenue_delta)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {reasons[0] ? (
                <div className="talia-card driver-analysis__card">
                  <p className="driver-analysis__kicker">Why better future</p>
                  <p>{reasons[0].statement}</p>
                  <p className="driver-analysis__muted">{reasons[0].forward_implication}</p>
                </div>
              ) : null}

              {ranks.length ? (
                <div className="talia-card driver-analysis__card">
                  <p className="driver-analysis__kicker">Residual drivers</p>
                  <div className="driver-analysis__driver-bars">
                    {ranks.slice(0, 5).map((r) => (
                      <div key={r.feature} className="driver-analysis__driver-row">
                        <span className="driver-analysis__driver-label">{r.feature}</span>
                        <div className="driver-analysis__driver-track" aria-hidden>
                          <div
                            className="driver-analysis__driver-fill"
                            style={{ width: `${Math.round(Math.min(1, Number(r.importance) || 0) * 100)}%` }}
                          />
                        </div>
                        <span className="driver-analysis__driver-pct">
                          {Math.round((Number(r.importance) || 0) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <ReportDataDetails visible={showDetails} className="driver-analysis__details">
          <div className="talia-card driver-analysis__card">
            <p className="driver-analysis__kicker">Evidence artifacts</p>
            <div ref={tableRef} className="talia-table" role="grid" />
          </div>
          {ranks.length ? (
            <div className="talia-card driver-analysis__card">
              <p className="driver-analysis__kicker">Driver notes</p>
              <ul className="driver-analysis__list">
                {ranks.map((r) => (
                  <li key={`note-${r.feature}`}>
                    <strong>{r.feature}</strong> — {r.note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </ReportDataDetails>

        <ReportProvenance visible={showProvenance}>
          <p>
            Chart axis is the booking horizon (days before departure). Band = learned peerset prior;
            amber path = reconstructed historic actual; green marker = observed load at NOW on a
            paired forward sailing. Value KPIs are association-backed gaps, not causal proof.
            Engine: <code>science.driver_analysis.v0</code> → <code>rm_science_evidence</code>.
          </p>
          {selected?.diagnostics?.honesty ? <p>{selected.diagnostics.honesty}</p> : null}
          {status?.error ? <p>Engine probe: {status.error}</p> : null}
        </ReportProvenance>
      </main>
    </div>
  );
};

export default DriverAnalysisPresenter;
