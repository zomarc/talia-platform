/**
 * Distribution Presenter — horizontal stacked bars (channel, market, group/FIT).
 * Charts are the focus; legends stay compact (market = top 5 + Others).
 */

import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { getChartColors, getChartOptions, getSeriesColors, initChartDefaults } from '../../../lib/chartConfig';

const buildStackedDataset = (slices, stackedLabel) => {
  const colors = getSeriesColors();
  return (slices || []).map((slice, index) => ({
    label: slice.label,
    data: [Number(slice.value) || 0],
    backgroundColor: colors[index % colors.length],
    borderWidth: 0,
    stack: stackedLabel,
    barThickness: 28,
    maxBarThickness: 36,
  }));
};

const compactLegend = {
  display: true,
  position: 'right',
  align: 'center',
  labels: {
    boxWidth: 10,
    boxHeight: 10,
    padding: 6,
    font: { size: 10 },
  },
};

const buildHorizontalStackedChart = (canvas, slices, { title, valueMode = 'absolute' } = {}) => {
  if (!canvas) return null;
  const safeSlices = (slices || []).filter((s) => s && Number(s.value) > 0);
  if (!safeSlices.length) return null;
  initChartDefaults();
  const colors = getChartColors();
  const total = safeSlices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return null;
  const datasets = buildStackedDataset(
    valueMode === 'percent'
      ? safeSlices.map((s) => ({ ...s, value: (Number(s.value) / total) * 100 }))
      : safeSlices,
    title
  );

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [' '],
      datasets,
    },
    options: getChartOptions.bar({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 4, right: 4, bottom: 4, left: 4 },
      },
      plugins: {
        title: {
          display: true,
          text: title,
          align: 'start',
          font: { size: 12, weight: '600' },
          padding: { bottom: 6 },
        },
        legend: compactLegend,
        tooltip: {
          callbacks: {
            title: () => '',
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
            maxTicksLimit: 6,
            font: { size: 10 },
            callback: (value) => (
              valueMode === 'percent' ? `${value}%` : value
            ),
          },
          grid: { color: colors.grid },
        },
        y: {
          stacked: true,
          ticks: { display: false },
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

    // Defer one frame so canvas parents have layout size (avoids blank bars).
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const channelChart = buildHorizontalStackedChart(
        channelRef.current,
        bundle?.channelSlices,
        { title: 'Sold by Distribution (guests)', valueMode: 'absolute' }
      );
      const marketChart = buildHorizontalStackedChart(
        marketRef.current,
        bundle?.marketSlices,
        { title: 'Sold by Market Group (share)', valueMode: 'percent' }
      );
      const groupChart = buildHorizontalStackedChart(
        groupRef.current,
        bundle?.groupFitSlices,
        { title: 'Sold by Groups / FIT (guests)', valueMode: 'absolute' }
      );
      chartsRef.current = [channelChart, marketChart, groupChart].filter(Boolean);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      chartsRef.current.forEach((chart) => {
        try { chart?.destroy?.(); } catch { /* noop */ }
      });
      chartsRef.current = [];
    };
  }, [bundle, hasSailSelection, scopeLoading]);

  const scopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length ? selectedSailCodes.join(', ') : null);
  const meta = bundle?.meta || {};
  const marketCount = bundle?.marketSliceCount || 0;
  const marketEmpty = hasSailSelection && !scopeLoading
    && !(bundle?.marketSlices || []).some((s) => Number(s?.value) > 0);

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
            <p className="distribution-panel__summary">
              {meta.bookingCount || 0} bookings · {Number(meta.guestTotal || 0).toLocaleString()} guests
              {meta.withAgency != null ? ` · ${meta.withAgency} agency-matched` : ''}
              {meta.withMarketGroup != null
                ? ` · ${meta.withMarketGroup} market-group mapped`
                : ''}
              {marketCount > 0
                ? ` · market groups top ${meta.marketTopN || 5}${marketCount > (meta.marketTopN || 5) ? ` of ${marketCount}` : ''}`
                : ''}
            </p>
            <div className="distribution-panel__charts">
              <div className="distribution-panel__chart-card">
                <canvas ref={channelRef} aria-label="Channel distribution chart" />
              </div>
              <div className="distribution-panel__chart-card">
                {marketEmpty ? (
                  <p className="distribution-panel__chart-empty">
                    No market group split — agency.market / market_roll_up missing.
                  </p>
                ) : (
                  <canvas ref={marketRef} aria-label="Market distribution chart" />
                )}
              </div>
              <div className="distribution-panel__chart-card">
                <canvas ref={groupRef} aria-label="Group versus FIT chart" />
              </div>
            </div>
            <p className="distribution-panel__note">{meta.groupFitCoverageNote}</p>
          </>
        )}
      </main>
    </div>
  );
};

export default DistributionPresenter;
