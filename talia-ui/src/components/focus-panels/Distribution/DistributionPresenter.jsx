/**
 * Distribution Presenter — horizontal stacked bars (channel, market, group/FIT).
 */

import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { getChartColors, getChartOptions, getSeriesColors, initChartDefaults } from '../../../lib/chartConfig';

const buildStackedDataset = (slices, stackedLabel) => {
  const colors = getSeriesColors();
  return (slices || []).map((slice, index) => ({
    label: slice.label,
    data: [slice.value],
    backgroundColor: colors[index % colors.length],
    borderWidth: 0,
    stack: stackedLabel,
  }));
};

const buildHorizontalStackedChart = (canvas, slices, { title, valueMode = 'absolute' } = {}) => {
  if (!canvas) return null;
  const safeSlices = (slices || []).filter((s) => s && Number(s.value) > 0);
  if (!safeSlices.length) return null;
  initChartDefaults();
  const colors = getChartColors();
  const total = safeSlices.reduce((sum, s) => sum + (s.value || 0), 0);
  const datasets = buildStackedDataset(
    valueMode === 'percent' && total > 0
      ? safeSlices.map((s) => ({ ...s, value: (s.value / total) * 100 }))
      : safeSlices,
    title
  );

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [valueMode === 'percent' ? 'Share' : 'Guests'],
      datasets,
    },
    options: getChartOptions.bar({
      indexAxis: 'y',
      plugins: {
        title: {
          display: true,
          text: title,
          align: 'start',
        },
        legend: {
          display: true,
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed?.x;
              if (valueMode === 'percent') {
                return `${ctx.dataset.label}: ${Number(v || 0).toFixed(1)}%`;
              }
              return `${ctx.dataset.label}: ${Number(v || 0).toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: valueMode === 'percent' ? 100 : undefined,
          ticks: {
            callback: (value) => (
              valueMode === 'percent' ? `${value}%` : value
            ),
          },
          grid: { color: colors.grid },
        },
        y: {
          stacked: true,
          grid: { display: false },
        },
      },
    }),
  });
};

const DistributionPresenter = ({
  bundle,
  hasSailSelection,
  scopeLoading = false,
  selectedSailCodes = [],
  selectedReferenceSailCode = null,
}) => {
  const channelRef = useRef(null);
  const marketRef = useRef(null);
  const groupRef = useRef(null);
  const chartsRef = useRef([]);

  useEffect(() => {
    chartsRef.current.forEach((chart) => {
      try { chart?.destroy?.(); } catch { /* noop */ }
    });
    chartsRef.current = [];
    if (!hasSailSelection || scopeLoading) return undefined;

    const channelChart = buildHorizontalStackedChart(
      channelRef.current,
      bundle?.channelSlices,
      { title: 'Sold by Distribution (guests)', valueMode: 'absolute' }
    );
    const marketChart = buildHorizontalStackedChart(
      marketRef.current,
      bundle?.marketSlices,
      { title: 'Sold by Market (share)', valueMode: 'percent' }
    );
    const groupChart = buildHorizontalStackedChart(
      groupRef.current,
      bundle?.groupFitSlices,
      { title: 'Sold by Groups / FIT (guests)', valueMode: 'absolute' }
    );
    chartsRef.current = [channelChart, marketChart, groupChart].filter(Boolean);

    return () => {
      chartsRef.current.forEach((chart) => {
        try { chart?.destroy?.(); } catch { /* noop */ }
      });
      chartsRef.current = [];
    };
  }, [bundle, hasSailSelection, scopeLoading]);

  const scopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length ? selectedSailCodes.join(', ') : null);
  const meta = bundle?.meta || {};

  return (
    <div className="focus-panel talia-report distribution-panel" role="region" aria-label="Distribution">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Distribution</h2>
          <p className="talia-report__subtitle">
            {hasSailSelection
              ? `Guests by channel and market for ${scopeLabel}`
              : 'Select a sailing in Master Sailing Explorer'}
          </p>
        </div>
      </header>

      <main className="talia-report__content distribution-panel__content">
        {!hasSailSelection && (
          <p className="focus-panel-empty__detail">No sailing selected.</p>
        )}
        {hasSailSelection && scopeLoading && (
          <p className="focus-panel-empty__detail">Loading bookings for selected sailing…</p>
        )}
        {hasSailSelection && !scopeLoading && (
          <>
            <p className="talia-callout distribution-panel__summary">
              {meta.bookingCount || 0} bookings · {Number(meta.guestTotal || 0).toLocaleString()} guests
              {meta.withAgency != null
                ? ` · ${meta.withAgency} matched to agency`
                : ''}
            </p>
            <div className="distribution-panel__charts">
              <div className="distribution-panel__chart-card">
                <canvas ref={channelRef} aria-label="Channel distribution chart" />
              </div>
              <div className="distribution-panel__chart-card">
                <canvas ref={marketRef} aria-label="Market distribution chart" />
              </div>
              <div className="distribution-panel__chart-card">
                <canvas ref={groupRef} aria-label="Group versus FIT chart" />
              </div>
            </div>
            <p className="talia-callout distribution-panel__note">
              {meta.groupFitCoverageNote}
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default DistributionPresenter;
