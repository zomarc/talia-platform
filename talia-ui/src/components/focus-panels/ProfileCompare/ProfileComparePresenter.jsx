/**
 * Sailing Profile — REAL vs model prior (+ target overlay, budget gap).
 * Change model overlays history curves; click a line or legend to select.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { formatDayMon } from '../../../lib/dateFormat';
import { useTheme } from '../../../contexts/ThemeContext';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  getOverlayLegendOptions,
  getProfileSeriesColors,
  taliaVerticalReferenceLinePlugin,
  resolveTodayWeekIndex,
} from '../../../lib/chartConfig';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportSnapshot from '../../shared/ReportSnapshot';
import { interpolateLfOntoWeeks } from '../../../hooks/data/useProfileCompare';

Chart.register(...registerables);
if (!Chart.registry.plugins.get('taliaVerticalReferenceLine')) {
  Chart.register(taliaVerticalReferenceLinePlugin);
}

const fmt = (n, digits = 1) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  });
};

const mergeWeekAxis = (...seriesLists) => {
  const weeks = new Set();
  seriesLists.flat().forEach((p) => {
    if (p?.weeksUntilSailing != null) weeks.add(Number(p.weeksUntilSailing));
  });
  const sorted = [...weeks].sort((a, b) => b - a);
  if (!sorted.length) return { labels: [], weeks: [] };
  return {
    weeks: sorted,
    labels: sorted.map((w) => (w === 0 ? 'Sail' : `W-${w}`)),
  };
};

const lfAtWeek = (series, week, endLf = null) => {
  const hit = (series || []).find((p) => Number(p.weeksUntilSailing) === week);
  if (!hit) return null;
  if (hit.lfPct != null) return Number(hit.lfPct);
  const last = [...(series || [])].reverse().find((p) => p?.bookings != null);
  const lastBookings = last ? Number(last.bookings) || 0 : 0;
  if (endLf != null && lastBookings > 0 && hit.bookings != null) {
    return Math.round(((Number(endLf) * Number(hit.bookings)) / lastBookings) * 100) / 100;
  }
  return null;
};

const EMPTY_OVERLAYS = [];

const ProfileComparePresenter = ({
  data,
  sailCode,
  error,
  busy,
  picking = false,
  overlays = [],
  onBeginPick,
  onCancelPick,
  onSelectModel,
  onResetLazy,
  panelInstanceId,
  panelComponentId,
}) => {
  const { fontSize, fontFamily, chartLegendsVisible } = useTheme();
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [typedModel, setTypedModel] = useState('');
  const componentKey = panelComponentId || 'profile-compare';
  const { showSnapshot, showDetails, showFilters, showLegends, reportShellClassName } = useReportShellOptions(
    componentKey,
    panelInstanceId
  );
  const realSeries = data?.real?.series || [];
  const modelSeries = data?.model?.series || [];
  const targetSeries = data?.targetSeries || [];
  const budget = data?.budget;
  const overlaySeries = picking ? overlays : EMPTY_OVERLAYS;
  const selectModelRef = useRef(onSelectModel);
  selectModelRef.current = onSelectModel;
  const targetEndLf = targetSeries.length
    ? targetSeries[targetSeries.length - 1]?.lfPct
    : null;

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return undefined;
    const frame = window.requestAnimationFrame(() => {
      try { chart.resize(); } catch { /* ignore */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showSnapshot, showDetails]);

  useEffect(() => {
    return registerPanelDataExport({
      panelInstanceId,
      panelComponentId: componentKey,
      getPayload: () => {
        let chartImage = null;
        try {
          const chart = chartInstanceRef.current;
          if (chart && typeof chart.toBase64Image === 'function') {
            chartImage = chart.toBase64Image('image/png', 1);
          }
        } catch {
          chartImage = null;
        }

        const weeks = mergeWeekAxis(realSeries, modelSeries, targetSeries).weeks;
        if (!weeks.length && !chartImage) return null;
        return {
          title: `Sailing Profile ${sailCode || ''}`.trim(),
          chartImage,
          columns: [
            { field: 'week', title: 'Week' },
            { field: 'realLf', title: 'REAL LF%' },
            { field: 'modelLf', title: 'Model LF%' },
            { field: 'targetLf', title: 'Target LF%' },
          ],
          rows: weeks.map((w) => ({
            week: w === 0 ? 'Sail' : `W-${w}`,
            realLf: lfAtWeek(realSeries, w, data?.real?.loadFactorPct),
            modelLf: lfAtWeek(modelSeries, w, data?.model?.loadFactorPct),
            targetLf: lfAtWeek(targetSeries, w),
          })),
        };
      },
    });
  }, [componentKey, data, modelSeries, panelInstanceId, realSeries, sailCode, targetSeries]);

  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    let axis = mergeWeekAxis(
      realSeries,
      modelSeries,
      targetSeries,
      ...overlaySeries.map((o) => o.series || [])
    );
    if (!axis.weeks.length && data?.real?.loadFactorPct != null) {
      axis = { weeks: [0], labels: ['Sail'] };
    }
    const palette = getProfileSeriesColors().filter(
      (c) => String(c).toLowerCase() !== '#2563eb'
    );
    // Prefer warmer/greener accents for alternatives so they don't blend with REAL blue.
    const altPalette = palette.length ? palette : getProfileSeriesColors();
    const realEndLf = data?.real?.loadFactorPct;
    const realData = axis.weeks.map((w) => lfAtWeek(realSeries, w, realEndLf));
    const modelData = axis.weeks.map((w) => lfAtWeek(modelSeries, w, data?.model?.loadFactorPct));
    const visibleCount = [...realData, ...modelData].filter((v) => v != null).length;
    const pointRadius = visibleCount < 4 ? 3 : 0;
    const datasets = [
      {
        label: 'REAL',
        sailCode: null,
        selectable: false,
        data: realData,
        borderColor: '#2563eb',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        tension: 0.2,
        pointRadius,
        pointHoverRadius: 4,
        spanGaps: true,
      },
    ];

    if (!picking && (modelData.some((v) => v != null) || data?.modelSailCode)) {
      datasets.push({
        label: data?.modelSailCode ? `Model ${data.modelSailCode}` : 'Model prior',
        sailCode: data?.modelSailCode || null,
        selectable: false,
        data: modelData,
        borderColor: '#64748b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [4, 3],
        tension: 0.2,
        pointRadius,
        pointHoverRadius: 4,
        spanGaps: true,
      });
    }

    if (!picking && targetSeries.length) {
      const suggested = data?.targetSource === 'suggested';
      datasets.push({
        label: suggested
          ? 'Suggested target'
          : data?.activeTarget?.name
            ? `Target: ${data.activeTarget.name}`
            : 'Target',
        sailCode: null,
        selectable: false,
        data: axis.weeks.map((w) => lfAtWeek(targetSeries, w)),
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.08)',
        borderWidth: 2.5,
        borderDash: suggested ? [6, 4] : [2, 3],
        tension: 0.2,
        pointRadius: suggested ? 2 : 4,
        pointBackgroundColor: '#d97706',
        spanGaps: true,
        fill: false,
      });
    }

    overlaySeries.forEach((overlay, idx) => {
      const isCurrent = overlay.sailCode && overlay.sailCode === data?.modelSailCode;
      const plotted = interpolateLfOntoWeeks(overlay.series || [], axis.weeks);
      const hasLine = plotted.some((v) => v != null);
      if (!hasLine) return;
      datasets.push({
        label: `${overlay.sailCode}${isCurrent ? ' · current' : ''}`,
        sailCode: overlay.sailCode,
        selectable: true,
        data: plotted,
        borderColor: altPalette[idx % altPalette.length],
        backgroundColor: 'transparent',
        borderWidth: isCurrent ? 2.75 : 2,
        borderDash: isCurrent ? [] : [5, 3],
        tension: 0.25,
        pointRadius: hasLine && plotted.filter((v) => v != null).length < 4 ? 3 : 0,
        pointHoverRadius: 5,
        spanGaps: true,
      });
    });

    const todayIdx = resolveTodayWeekIndex(
      axis.weeks.map((w) => ({ weeksUntilSailing: w })),
      data?.real?.daysUntilSailing
    );

    const selectFromEvent = (chart, elements) => {
      if (!picking || !elements?.length) return;
      const ds = chart.data.datasets[elements[0].datasetIndex];
      if (ds?.selectable && ds.sailCode) selectModelRef.current?.(ds.sailCode);
    };

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels: axis.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false, axis: 'xy' },
        onClick: (evt, elements, chart) => selectFromEvent(chart, elements),
        plugins: {
          legend: {
            ...getOverlayLegendOptions({ visible: (chartLegendsVisible && showLegends) || picking }),
            onClick: (evt, legendItem, legend) => {
              const chart = legend.chart;
              const ds = chart.data.datasets[legendItem.datasetIndex];
              if (picking && ds?.selectable && ds.sailCode) {
                selectModelRef.current?.(ds.sailCode);
                return;
              }
              if (typeof Chart.defaults.plugins.legend.onClick === 'function') {
                Chart.defaults.plugins.legend.onClick(evt, legendItem, legend);
              }
            },
          },
          taliaVerticalReferenceLine: todayIdx != null ? { index: todayIdx } : false,
        },
        scales: {
          x: {
            ticks: { maxRotation: 0, autoSkip: true },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: 'LF %' },
            suggestedMin: 0,
            suggestedMax: 100,
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [
    data,
    realSeries,
    modelSeries,
    targetSeries,
    overlaySeries,
    picking,
    chartLegendsVisible,
    showLegends,
    fontSize,
    fontFamily,
  ]);

  const modelLabel = data?.modelSailCode
    ? `${data.modelSailCode}${data.matchMode === 'manual' ? ' (manual)' : ' (lazy)'}`
    : 'No peer found';

  const snapshotItems = sailCode && (data?.real || data)
    ? [
        {
          key: 'real-lf',
          label: 'REAL LF',
          value: `${fmt(data?.real?.loadFactorPct)}%`,
          hint: `${fmt(data?.real?.bookedCabins, 0)} / ${fmt(data?.real?.totalCabins, 0)} cabins`,
        },
        {
          key: 'model-lf',
          label: 'Model LF',
          value: `${fmt(data?.model?.loadFactorPct)}%`,
          hint: data?.modelSailCode || 'no peer',
        },
        {
          key: 'target-lf',
          label: data?.targetSource === 'suggested' ? 'Suggested LF' : 'Target LF',
          value: `${fmt(targetEndLf)}%`,
          hint: data?.activeTarget?.name || data?.targetSource || '—',
        },
        budget
          ? {
              key: 'budget-gap',
              label: 'Budget gap',
              value: fmt(budget.totalGapGuests, 0),
              hint: `${fmt(budget.totalActualGuests, 0)} vs ${fmt(budget.totalBudgetPassengers, 0)} pax`,
              tone: Number(budget.totalGapGuests) < 0 ? 'negative' : 'neutral',
            }
          : null,
      ].filter(Boolean)
    : [];

  return (
    <div className={`focus-panel talia-report profile-compare${reportShellClassName ? ` ${reportShellClassName}` : ''}`} role="region" aria-label="Sailing Profile">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Sailing Profile</h2>
          <p className="talia-report__subtitle">
            {sailCode
              ? [
                  sailCode,
                  data?.sailDate ? formatDayMon(data.sailDate) : null,
                  data?.shipName || data?.shipCode,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Select a sail to compare REAL vs model prior'}
          </p>
        </div>
      </header>

      {picking ? (
        <div
          className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
          aria-label="Optional model sail code"
        >
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Or type a sail</span>
            <input
              type="text"
              className="talia-report-filters__input"
              value={typedModel}
              onChange={(e) => setTypedModel(e.target.value)}
              placeholder="Sail code"
              aria-label="Model sail code"
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            disabled={busy || !typedModel.trim()}
            onClick={() => {
              const code = typedModel.trim();
              if (!code) return;
              onSelectModel?.(code);
              setTypedModel('');
            }}
          >
            Use sail
          </button>
        </div>
      ) : null}

      {sailCode ? (
        <div className="talia-callout" role="note">
          {picking
            ? busy && !overlays.length
              ? 'Loading history curves…'
              : overlays.length
                ? 'Click a history curve (or its legend) to use it as the model prior.'
                : 'No same-ship history curves yet — type a sail code above.'
            : (
              <>
                Model prior: <strong>{modelLabel}</strong>
                {data?.peerSource ? ` · ${data.peerSource}` : ''}
                {busy ? ' · saving…' : ''}
                {data?.targetSource === 'suggested'
                  ? ' · amber curve is a suggested target (save in Target Profile Editor).'
                  : data?.activeTarget
                    ? ` · target ${data.activeTarget.perspective} / ${data.activeTarget.name}`
                    : ''}
              </>
            )}
        </div>
      ) : null}

      {error ? (
        <div className="talia-callout talia-callout--warning" role="alert">
          {error.message || String(error)}
        </div>
      ) : null}

      <div className="talia-report__actions-bar" aria-label="Sailing profile actions">
        {picking ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={onCancelPick}
            disabled={busy}
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={onBeginPick}
            disabled={!sailCode || busy}
          >
            Change model
          </button>
        )}
        {data?.matchMode === 'manual' ? (
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onResetLazy} disabled={busy}>
            Reset to lazy
          </button>
        ) : null}
      </div>

      <ReportSnapshot title={null} ariaLabel="Profile metrics" visible={showSnapshot} items={snapshotItems} />

      <main className="talia-report__content talia-report__content--scroll">
        <div className="profile-compare__chart-host">
          <div className="talia-chart">
            <canvas
              ref={chartRef}
              className="talia-chart__canvas"
              aria-label="Profile compare chart"
            />
          </div>
        </div>

        <ReportDataDetails visible={showDetails} as="section" aria-label="Series points">
          <table className="talia-report-table">
            <thead>
              <tr>
                <th>Week</th>
                <th>REAL LF%</th>
                <th>Model LF%</th>
                <th>Target LF%</th>
              </tr>
            </thead>
            <tbody>
              {mergeWeekAxis(realSeries, modelSeries, targetSeries).weeks.map((w) => (
                <tr key={w}>
                  <td>{w === 0 ? 'Sail' : `W-${w}`}</td>
                  <td>{fmt(lfAtWeek(realSeries, w, data?.real?.loadFactorPct))}</td>
                  <td>{fmt(lfAtWeek(modelSeries, w, data?.model?.loadFactorPct))}</td>
                  <td>{fmt(lfAtWeek(targetSeries, w))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default ProfileComparePresenter;
