/**
 * MR Retrospect presenter — DTD stepper, suggested vs actual chart, Details card.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { SHIP_FILTER_ALL } from '../../../hooks/useGlobalShipFilter';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  applyAxisLabelVisibility,
  getChartColors,
  getChartOptions,
  getSeriesColors,
} from '../../../lib/chartConfig';
import { formatDayMonYear } from '../../../lib/dateFormat';
import { formatMrPctPrecise } from '../GroupsExplorer/groupsMaterialisation';
import { pickStep } from '../../../lib/mrRetrospect';
import {
  buildMrRetrospectExport,
  buildMrRetrospectExportRows,
  MR_RETROSPECT_EXPORT_COLUMNS,
} from '../../../lib/mrRetrospectPrint';
import { captureMrRetrospectCharts } from '../../../lib/mrRetrospectPrintCharts';
import { payloadFromReport, registerPanelDataExport } from '../../../lib/panelDataExport';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import ReportSnapshot from '../../shared/ReportSnapshot';
import './mr-retrospect.css';

Chart.register(...registerables);

const formatInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-GB');
};

const formatPct = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return formatMrPctPrecise(value);
};

const nearestStepIndex = (steps, dtd) => {
  if (!steps.length) return -1;
  let best = 0;
  let bestGap = Infinity;
  steps.forEach((step, index) => {
    const gap = Math.abs(Number(step.dtd) - Number(dtd));
    if (gap < bestGap) {
      bestGap = gap;
      best = index;
    }
  });
  return best;
};

const buildMarkerPlugin = (annotations, steps, colors) => ({
  id: 'mrRetrospectMarkers',
  // afterDraw runs outside the dataset clip rect — vertical labels were being clipped.
  afterDraw(chart) {
    if (!annotations?.length) return;
    const { ctx, chartArea, scales } = chart;
    const xScale = scales?.x;
    if (!ctx || !chartArea || !xScale) return;

    annotations.forEach((mark, markIndex) => {
      const index = nearestStepIndex(steps, mark.dtd);
      if (index < 0) return;
      const x = xScale.getPixelForValue(index);
      if (!Number.isFinite(x) || x < chartArea.left - 2 || x > chartArea.right + 2) return;
      const isNamed = mark.kind === 'named';
      const stroke = isNamed ? (colors[2] || colors[0]) : colors[0];
      const label = mark.label || (isNamed ? 'Named' : 'Source');

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash(isNamed ? [2, 3] : [5, 4]);
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1;
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = stroke;
      ctx.font = '8px sans-serif';
      // Vertical label rising from the bottom of the plot.
      ctx.translate(x, chartArea.bottom - 4);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 2, markIndex % 2 === 0 ? -4 : 4);
      ctx.restore();
    });
  },
});

const MARKER_HIT_PX = 10;

const DtdChart = ({
  steps,
  annotations = [],
  selectedDtd,
  showLegends,
  showAxisLabels,
  showTooltip,
}) => {
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const [markerTip, setMarkerTip] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !steps.length) return undefined;
    const colors = getSeriesColors();
    const ink = getChartColors();
    const labels = steps.map((step) => `${step.dtd}`);
    const base = getChartOptions.line({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: showLegends, position: 'top', align: 'start', labels: { color: ink.text } },
        tooltip: { enabled: showTooltip },
      },
      scales: {
        x: {
          reverse: true,
          title: { display: true, text: 'Days before departure' },
          ticks: { color: ink.text },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Guests' },
          ticks: { color: ink.text },
        },
      },
    });
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Source expected',
            data: steps.map((step) => step.sourceExpectedGuests),
            borderColor: colors[0],
            backgroundColor: colors[0],
            tension: 0.15,
            pointRadius: steps.map((step) => (step.dtd === selectedDtd ? 5 : 3)),
          },
          {
            label: 'Talia expected',
            data: steps.map((step) => step.taliaExpectedGuests),
            borderColor: colors[1] || colors[0],
            backgroundColor: colors[1] || colors[0],
            tension: 0.15,
            pointRadius: steps.map((step) => (step.dtd === selectedDtd ? 5 : 3)),
          },
          {
            label: 'Named (outcome)',
            data: steps.map((step) => step.outcomeNamed),
            borderColor: colors[2] || colors[0],
            backgroundColor: colors[2] || colors[0],
            borderDash: [5, 4],
            tension: 0,
            pointRadius: 0,
          },
        ],
      },
      options: applyAxisLabelVisibility(base, showAxisLabels),
      plugins: [buildMarkerPlugin(annotations, steps, colors)],
    });
    chartRef.current = chart;

    const host = hostRef.current;
    let observer;
    if (host && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        chart.resize();
      });
      observer.observe(host);
    }
    const frame = requestAnimationFrame(() => chart.resize());
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect?.();
      chartRef.current = null;
      chart.destroy();
      setMarkerTip(null);
    };
  }, [annotations, steps, selectedDtd, showLegends, showAxisLabels, showTooltip]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !annotations.length) return undefined;

    const resolveTip = (clientX, clientY) => {
      const chart = chartRef.current;
      const xScale = chart?.scales?.x;
      const area = chart?.chartArea;
      if (!chart || !xScale || !area) return null;
      const rect = host.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      if (localY < area.top || localY > area.bottom) return null;

      let best = null;
      let bestGap = MARKER_HIT_PX;
      annotations.forEach((mark) => {
        const index = nearestStepIndex(steps, mark.dtd);
        if (index < 0) return;
        const x = xScale.getPixelForValue(index);
        if (!Number.isFinite(x)) return;
        const gap = Math.abs(x - localX);
        if (gap <= bestGap) {
          bestGap = gap;
          best = {
            text: mark.tip || mark.label || (mark.kind === 'named' ? 'Named' : 'Source'),
            x: Math.min(Math.max(x + 12, area.left + 8), area.right - 8),
            y: Math.min(Math.max(localY - 8, area.top + 8), area.bottom - 8),
          };
        }
      });
      return best;
    };

    const onMove = (event) => {
      setMarkerTip(resolveTip(event.clientX, event.clientY));
    };
    const onLeave = () => setMarkerTip(null);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, [annotations, steps]);

  return (
    <div className="mr-retrospect__chart" ref={hostRef}>
      <canvas ref={canvasRef} aria-label="Talia expected, source expected, and named guests by days before departure" />
      {markerTip ? (
        <div
          className="mr-retrospect__marker-tip"
          style={{ left: markerTip.x, top: markerTip.y }}
          role="tooltip"
        >
          {markerTip.text}
        </div>
      ) : null}
    </div>
  );
};

const MrRetrospectPresenter = ({
  path,
  retrospect,
  annotations = [],
  groups = [],
  selectedGroupId,
  seriesLoading = false,
  onSelectGroup,
  scopeMode,
  onScopeMode,
  selectedDtd,
  onSelectedDtd,
  shipChoice,
  ships = [],
  onShipChoice,
  globalShip,
  dateFrom,
  dateTo,
  datesFollowGlobal,
  onDateFrom,
  onDateTo,
  onUseHeaderDates,
  onFullHistory,
  criteriaSummary,
  panelInstanceId,
  panelComponentId,
}) => {
  const {
    showSnapshot,
    showDetails,
    showFilters,
    showProvenance,
    showGraph,
    showTooltip,
    showLegends,
    showAxisLabels,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId, panelInstanceId);

  const steps = retrospect?.steps || [];
  const step = useMemo(() => pickStep(retrospect, selectedDtd), [retrospect, selectedDtd]);
  const dtdOptions = useMemo(() => steps.map((row) => row.dtd), [steps]);
  const globalShipLabel = !globalShip || globalShip === SHIP_FILTER_ALL ? 'All' : globalShip;

  useEffect(() => {
    if (!dtdOptions.length) return;
    if (!dtdOptions.includes(selectedDtd)) onSelectedDtd?.(dtdOptions[0]);
  }, [dtdOptions, selectedDtd, onSelectedDtd]);

  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId,
    getPayload: () => {
      const charts = captureMrRetrospectCharts({
        steps,
        selectedDtd,
        showLegends,
        showAxisLabels,
      });
      const shipLabel = shipChoice === 'global'
        ? globalShipLabel
        : (shipChoice === SHIP_FILTER_ALL ? 'All' : shipChoice);
      return payloadFromReport({
        title: 'MR Retrospect',
        html: buildMrRetrospectExport({
          path,
          retrospect,
          annotations,
          charts,
          scopeMode,
          selectedGroupId,
          selectedDtd,
          shipLabel,
          dateFrom,
          dateTo,
          criteriaSummary,
        }),
        columns: MR_RETROSPECT_EXPORT_COLUMNS,
        rows: buildMrRetrospectExportRows(retrospect),
      });
    },
  }), [
    panelInstanceId,
    panelComponentId,
    steps,
    selectedDtd,
    showLegends,
    showAxisLabels,
    shipChoice,
    globalShipLabel,
    path,
    retrospect,
    annotations,
    scopeMode,
    selectedGroupId,
    dateFrom,
    dateTo,
    criteriaSummary,
  ]);

  const maxDtd = dtdOptions[0] ?? 0;
  const minDtd = dtdOptions.length ? dtdOptions[dtdOptions.length - 1] : 0;

  return (
    <article className={['focus-panel', 'talia-report', 'mr-retrospect', reportShellClassName].filter(Boolean).join(' ')}>
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">MR Retrospect</h2>
          <p className="talia-report__subtitle">
            What Talia MR would have suggested at each days-before-departure step, versus the named outcome.
          </p>
        </div>
      </header>

      {showFilters ? (
        <div className="talia-report-filters" aria-label="Ship, dates, group, and scope">
          <div className="talia-report-filters__group">
            <span className="talia-report-filters__label">Header</span>
            <span>{criteriaSummary} · Ship {globalShipLabel}</span>
          </div>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Ship</span>
            <select
              className="talia-report-filters__input"
              value={shipChoice === 'global' ? 'global' : (shipChoice === SHIP_FILTER_ALL ? 'all' : shipChoice)}
              onChange={(event) => onShipChoice?.(event.target.value === 'all' ? SHIP_FILTER_ALL : event.target.value)}
            >
              <option value="global">Follow global ({globalShipLabel})</option>
              <option value="all">All ships</option>
              {ships.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">From</span>
            <input type="date" className="talia-report-filters__input" value={dateFrom || ''} onChange={(event) => onDateFrom?.(event.target.value)} />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">To</span>
            <input type="date" className="talia-report-filters__input" value={dateTo || ''} onChange={(event) => onDateTo?.(event.target.value)} />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Scope</span>
            <select
              className="talia-report-filters__input"
              value={scopeMode}
              onChange={(event) => onScopeMode?.(event.target.value)}
            >
              <option value="group">One group</option>
              <option value="sail">All groups in window</option>
            </select>
          </label>
          {scopeMode === 'group' ? (
            <label className="talia-report-filters__group">
              <span className="talia-report-filters__label">Group</span>
              <select
                className="talia-report-filters__input"
                value={selectedGroupId || ''}
                onChange={(event) => onSelectGroup?.(event.target.value || null)}
              >
                {!groups.length && !selectedGroupId ? (
                  <option value="">No sailed groups in this window</option>
                ) : null}
                {selectedGroupId && !groups.some((group) => group.groupId === selectedGroupId) ? (
                  <option value={selectedGroupId}>
                    {selectedGroupId} · focused (not in sailed list)
                  </option>
                ) : null}
                {groups.map((group) => (
                  <option key={group.groupId} value={group.groupId}>
                    {group.groupId} · {group.shipCode || '—'} · {group.sailDateFrom || '—'} · req {group.requestedGuests}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onFullHistory}>Full sailed history</button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onUseHeaderDates}>Use header dates</button>
          {datesFollowGlobal ? null : (
            <p className="mr-retrospect__filter-note">
              {dateFrom || dateTo
                ? 'Limited to these sail dates.'
                : 'Showing every sailed group in the extract.'}
            </p>
          )}
        </div>
      ) : null}

      {showSnapshot && step ? (
        <ReportSnapshot
          items={[
            { key: 'dtd', label: 'DTD', value: String(step.dtd) },
            { key: 'source', label: 'Source expected', value: formatInt(step.sourceExpectedGuests) },
            { key: 'talia', label: 'Talia expected', value: formatInt(step.taliaExpectedGuests) },
            { key: 'named', label: 'Named outcome', value: formatInt(step.outcomeNamed) },
            { key: 'gap', label: 'Talia gap', value: formatInt(step.taliaGap) },
          ]}
        />
      ) : null}

      <div className="talia-report__controls mr-retrospect__stepper" aria-label="Days before departure">
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={!dtdOptions.length || selectedDtd >= maxDtd}
          onClick={() => {
            const idx = dtdOptions.indexOf(selectedDtd);
            if (idx > 0) onSelectedDtd?.(dtdOptions[idx - 1]);
          }}
        >
          Earlier
        </button>
        <input
          type="range"
          min={minDtd}
          max={maxDtd}
          step={1}
          value={Math.min(Math.max(selectedDtd, minDtd), maxDtd)}
          disabled={!dtdOptions.length}
          aria-label="Days before departure"
          onChange={(event) => {
            const raw = Number(event.target.value);
            const nearest = dtdOptions.reduce((best, dtd) => (
              Math.abs(dtd - raw) < Math.abs(best - raw) ? dtd : best
            ), dtdOptions[0]);
            onSelectedDtd?.(nearest);
          }}
        />
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={!dtdOptions.length || selectedDtd <= minDtd}
          onClick={() => {
            const idx = dtdOptions.indexOf(selectedDtd);
            if (idx >= 0 && idx < dtdOptions.length - 1) onSelectedDtd?.(dtdOptions[idx + 1]);
          }}
        >
          Closer
        </button>
        <span className="mr-retrospect__step-label">{selectedDtd} days before departure</span>
      </div>

      <div className="mr-retrospect__body">
        <div className="talia-report__content">
          {showGraph && steps.length ? (
            <DtdChart
              steps={steps}
              annotations={annotations}
              selectedDtd={selectedDtd}
              showLegends={showLegends}
              showAxisLabels={showAxisLabels}
              showTooltip={showTooltip}
            />
          ) : (
            <p className="mr-retrospect__filter-note">
              {seriesLoading
                ? 'Loading the DTD path…'
                : scopeMode === 'group' && selectedGroupId
                  ? `No header history yet for group ${selectedGroupId}.`
                  : scopeMode === 'group'
                    ? 'Select a group to see the DTD path.'
                    : 'No sailed groups in this window yet.'}
            </p>
          )}
          {annotations.length ? (
            <p className="mr-retrospect__chart-caption">
              Vertical marks: source hold changes
              {annotations.some((row) => row.kind === 'named') ? '; first named guests on the header' : ''}.
            </p>
          ) : null}
          {retrospect?.namesFromHistory === false ? (
            <p className="talia-callout">
              Header versions here have no as-of named count: booked holds use requested size as evidence;
              quotes and offers stay at 0 named. The orange line is the final named outcome for comparison only.
            </p>
          ) : null}
        </div>

        <ReportDataDetails visible={showDetails} className="mr-retrospect__details">
          {step ? (
            <div className="mr-retrospect__card talia-card">
              <h3>
                {scopeMode === 'sail'
                  ? `Window · ${step.groupCount ?? retrospect?.groupCount ?? 0} of ${retrospect?.groupCount || 0} groups`
                  : `Group ${retrospect?.groupId || '—'}`}
                {' · '}
                {selectedDtd} DTD
              </h3>
              <dl>
                <dt>As of</dt>
                <dd>{formatDayMonYear(step.asOfDate, step.asOfDate || '—')}</dd>
                <dt>Hold used</dt>
                <dd>
                  {step.holdDate
                    ? `${formatDayMonYear(step.holdDate, step.holdDate)} (${step.holdDtd} DTD)`
                    : 'Mixed holds'}
                </dd>
                <dt>Status</dt>
                <dd>{step.status || '—'}</dd>
                <dt>Requested</dt>
                <dd>{formatInt(step.requestedGuests)}</dd>
                <dt>Source MR</dt>
                <dd>{formatPct(step.sourceMr)}</dd>
                <dt>Talia MR</dt>
                <dd>{formatPct(step.taliaMr)}</dd>
                <dt>Source expected</dt>
                <dd>{formatInt(step.sourceExpectedGuests)}</dd>
                <dt>Talia expected</dt>
                <dd>{formatInt(step.taliaExpectedGuests)}</dd>
                <dt>Named outcome</dt>
                <dd>{formatInt(step.outcomeNamed)}</dd>
                <dt>Source − named</dt>
                <dd>{formatInt(step.sourceGap)}</dd>
                <dt>Talia − named</dt>
                <dd>{formatInt(step.taliaGap)}</dd>
              </dl>
            </div>
          ) : (
            <p className="mr-retrospect__filter-note">No checkpoint at this DTD.</p>
          )}
        </ReportDataDetails>
      </div>

      <ReportProvenance visible={showProvenance}>
        <p>
          Replay uses frozen SW_ETL group header history via <code>sourceMrPath</code> /
          <code>sourceMrPathDays</code>. At each days-before-departure step, Talia MR is the same
          method as Groups Explorer on the last hold on or before that date. Named outcome is the
          final group named count. Feed through {formatDayMonYear(path?.feedThrough, path?.feedThrough || '—')}.
        </p>
        {(retrospect?.assumptions || path?.assumptions || []).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </ReportProvenance>
    </article>
  );
};

export default MrRetrospectPresenter;
