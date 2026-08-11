/**
 * Distribution Presenter — compact horizontal stacked bars with capacity LF.
 */

import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { useTheme } from '../../../contexts/ThemeContext';
import { getChartColors, getChartOptions, getOverlayLegendOptions, initChartDefaults } from '../../../lib/chartConfig';
import { colorForDimensionKey } from '../../../lib/reservationDimensions';
import DistributionSummary from '../../shared/DistributionSummary';

const AVAILABLE_LABEL = 'Available';

const buildStackedDataset = (slices, stackedLabel, { barThickness = 16 } = {}) => (
  (slices || []).map((slice) => ({
    label: slice.label,
    data: [Number(slice.value) || 0],
    backgroundColor: slice.label === AVAILABLE_LABEL
      ? 'rgba(128,128,128,0.22)'
      : colorForDimensionKey(slice.label),
    borderWidth: 0,
    stack: stackedLabel,
    barThickness,
    maxBarThickness: barThickness + 4,
  }))
);

const buildHorizontalStackedChart = (
  canvas,
  slices,
  {
    title,
    valueMode = 'absolute',
    legendsVisible = true,
    capacityBerths = null,
  } = {}
) => {
  if (!canvas) return null;
  const safeSlices = (slices || []).filter((s) => s && Number(s.value) > 0);
  if (!safeSlices.length) return null;
  initChartDefaults();
  const colors = getChartColors();
  const soldTotal = safeSlices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (soldTotal <= 0) return null;

  const useCapacityScale = valueMode === 'absolute'
    && capacityBerths != null
    && capacityBerths > 0;

  let chartSlices = valueMode === 'percent'
    ? safeSlices.map((s) => ({ ...s, value: (Number(s.value) / soldTotal) * 100 }))
    : safeSlices;

  if (useCapacityScale) {
    const available = Math.max(0, capacityBerths - soldTotal);
    if (available > 0) {
      chartSlices = [...chartSlices, { label: AVAILABLE_LABEL, value: available }];
    }
  }

  const datasets = buildStackedDataset(chartSlices, title);

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
        padding: { top: 2, right: 2, bottom: 2, left: 2 },
      },
      plugins: {
        title: { display: false },
        legend: {
          ...getOverlayLegendOptions({ visible: legendsVisible }),
          labels: {
            ...getOverlayLegendOptions({ visible: legendsVisible }).labels,
            filter: (item) => item?.text !== AVAILABLE_LABEL,
          },
        },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (ctx) => {
              const label = ctx.dataset.label;
              const v = ctx.parsed?.x;
              if (label === AVAILABLE_LABEL) {
                return `Available: ${Number(v || 0).toLocaleString()} berths`;
              }
              if (valueMode === 'percent') {
                const slice = safeSlices.find((s) => s.label === label);
                const cap = slice?.capacityPct;
                return cap != null
                  ? `${label}: ${Number(v || 0).toFixed(1)}% of sold · ${cap}% of capacity`
                  : `${label}: ${Number(v || 0).toFixed(1)}%`;
              }
              const slice = safeSlices.find((s) => s.label === label);
              const cap = slice?.capacityPct;
              return cap != null
                ? `${label}: ${Number(v || 0).toLocaleString()} · ${cap}% of capacity`
                : `${label}: ${Number(v || 0).toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: valueMode === 'percent'
            ? 100
            : (useCapacityScale ? capacityBerths : undefined),
          ticks: {
            maxTicksLimit: 5,
            font: { size: 9 },
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
  marketDimension = 'market_group',
  bookedComposition = 'group_fit_expected',
}) => {
  const { chartLegendsVisible } = useTheme();
  const channelRef = useRef(null);
  const marketRef = useRef(null);
  const groupRef = useRef(null);
  const chartsRef = useRef([]);

  const marketTitle = marketDimension === 'market'
    ? 'By Market'
    : 'By Market Group';
  const groupFitTitle = bundle?.meta?.groupFitLabel || 'Group / FIT';

  const meta = bundle?.meta || {};
  const capacityBerths = meta.capacityBerths ?? null;

  useEffect(() => {
    chartsRef.current.forEach((chart) => {
      try { chart?.destroy?.(); } catch { /* noop */ }
    });
    chartsRef.current = [];
    if (!hasSailSelection || scopeLoading) return undefined;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const channelChart = buildHorizontalStackedChart(
        channelRef.current,
        bundle?.channelSlices,
        {
          title: 'Channel',
          valueMode: 'absolute',
          legendsVisible: chartLegendsVisible,
          capacityBerths,
        }
      );
      const marketChart = buildHorizontalStackedChart(
        marketRef.current,
        bundle?.marketSlices,
        {
          title: marketTitle,
          valueMode: 'percent',
          legendsVisible: chartLegendsVisible,
          capacityBerths,
        }
      );
      const groupChart = buildHorizontalStackedChart(
        groupRef.current,
        bundle?.groupFitSlices,
        {
          title: groupFitTitle,
          valueMode: 'absolute',
          legendsVisible: chartLegendsVisible,
          capacityBerths,
        }
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
  }, [bundle, capacityBerths, chartLegendsVisible, groupFitTitle, hasSailSelection, marketTitle, scopeLoading]);

  const scopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length ? selectedSailCodes.join(', ') : null);
  const marketCount = bundle?.marketSliceCount || 0;
  const marketEmpty = hasSailSelection && !scopeLoading
    && !(bundle?.marketSlices || []).some((s) => Number(s?.value) > 0);

  return (
    <div className="focus-panel talia-report distribution-panel distribution-panel--compact" role="region" aria-label="Distribution">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Distribution</h2>
          <p className="talia-report__subtitle">
            {hasSailSelection
              ? `${scopeLabel} · ${Number(meta.guestTotal || 0).toLocaleString()} guests`
              : 'Select a sailing in Master Sailing Explorer'}
            {hasSailSelection && meta.loadFactorPct != null
              ? ` · ${meta.loadFactorPct}% LF`
              : ''}
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
              {meta.bookingCount || 0} bk
              {capacityBerths != null
                ? ` · ${Number(meta.guestTotal || 0).toLocaleString()}/${Number(capacityBerths).toLocaleString()} berths`
                : ` · ${Number(meta.guestTotal || 0).toLocaleString()} guests`}
              {marketCount > 0
                ? ` · top ${meta.marketTopN || 5}${marketCount > (meta.marketTopN || 5) ? `/${marketCount}` : ''}`
                : ''}
            </p>
            <DistributionSummary
              bundle={bundle}
              marketDimension={marketDimension}
              bookedComposition={bookedComposition}
            />
            <div className="distribution-panel__charts">
              <section className="distribution-panel__chart-card" aria-label="Channel distribution">
                <div className="distribution-panel__chart-head">
                  <h3 className="distribution-panel__chart-title">Channel</h3>
                </div>
                <div className="distribution-panel__chart-canvas">
                  <canvas ref={channelRef} aria-label="Channel distribution chart" />
                </div>
              </section>

              <section className="distribution-panel__chart-card" aria-label="Market distribution">
                <div className="distribution-panel__chart-head">
                  <h3 className="distribution-panel__chart-title">{marketTitle}</h3>
                </div>
                <div className="distribution-panel__chart-canvas">
                  {marketEmpty ? (
                    <p className="distribution-panel__chart-empty">
                      No market split — agency.market / market_roll_up missing.
                    </p>
                  ) : (
                    <canvas ref={marketRef} aria-label="Market distribution chart" />
                  )}
                </div>
              </section>

              <section className="distribution-panel__chart-card" aria-label="Group versus FIT">
                <div className="distribution-panel__chart-head">
                  <h3 className="distribution-panel__chart-title">{groupFitTitle}</h3>
                </div>
                <div className="distribution-panel__chart-canvas">
                  <canvas ref={groupRef} aria-label="Group versus FIT chart" />
                </div>
              </section>
            </div>
            {meta.groupFitCoverageNote ? (
              <p className="distribution-panel__note">{meta.groupFitCoverageNote}</p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
};

export default DistributionPresenter;
