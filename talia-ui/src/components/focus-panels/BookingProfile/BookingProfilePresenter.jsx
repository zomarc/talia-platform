/**
 * Booking Profile Presenter — compact report shell, primary chart, details tables.
 */

import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import { formatDayMon } from '../../../lib/dateFormat';
import { useTheme } from '../../../contexts/ThemeContext';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { applyAxisLabelVisibility, axisLabelsPluginOptions, getOverlayLegendOptions, getProfileSeriesColors, taliaHorizontalReferenceLinePlugin, taliaVerticalReferenceLinePlugin, resolveTodayWeekIndex } from '../../../lib/chartConfig';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportSnapshot from '../../shared/ReportSnapshot';
import BookingGoalCallout from '../../shared/BookingGoalCallout';


Chart.register(...registerables);
if (!Chart.registry.plugins.get('taliaHorizontalReferenceLine')) {
  Chart.register(taliaHorizontalReferenceLinePlugin);
}
if (!Chart.registry.plugins.get('taliaVerticalReferenceLine')) {
  Chart.register(taliaVerticalReferenceLinePlugin);
}

const pointValue = (point, metric) => {
  if (metric === 'bookings') return point?.bookings ?? 0;
  if (metric === 'load_factor') return point?.loadFactorPct ?? 0;
  return point?.guests ?? 0;
};

const metricLabel = (metric) => {
  if (metric === 'bookings') return 'Bookings';
  if (metric === 'load_factor') return 'Load factor %';
  return 'Guests';
};

const capacityLabel = (capacity, source) => {
  if (capacity == null) return 'Capacity unavailable';
  const n = Number(capacity).toLocaleString();
  if (source === 'ship_day_berth_status') return `Cap ${n} (berths)`;
  if (source === 'ship.ship_pax_capacity') return `Cap ${n} (ship)`;
  return `Cap ${n}`;
};

const BookingProfilePresenter = ({
  data,
  budget = null,
  sailCode,
  theme,
  onRefresh,
  includeComparison = false,
  breakdown = 'none',
  metric = 'guests',
  onBreakdownChange,
  onMetricChange,
  panelInstanceId,
  panelComponentId,
}) => {
  const { fontSize, fontFamily, chartLegendsVisible } = useTheme();
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const componentKey = panelComponentId || 'booking-profile';
  const { showSnapshot, showDetails, showFilters, showLegends, showAxisLabels, reportShellClassName } = useReportShellOptions(
    componentKey,
    panelInstanceId
  );

  const isYoY = Boolean(data?.currentYear);
  const current = isYoY ? data.currentYear : data;
  const previous = isYoY ? data.previousYear : null;
  const comparison = data?.comparison;
  const history = current?.history;

  useEffect(() => {
    if (!chartRef.current || !current) return;

    const ctx = chartRef.current.getContext('2d');
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels =
      current.buildCurves?.map((p) => p.weekLabel) ||
      current.bookingDataPoints?.map((dp) => formatDayMon(dp.date, '')) ||
      [];

    const datasets = [];
    const stacked = breakdown !== 'none' && Array.isArray(current.series) && current.series.length > 0;
    const palette = getProfileSeriesColors();

    if (stacked) {
      current.series.forEach((series, idx) => {
        datasets.push({
          label: series.dimensionKey,
          data: series.points.map((p) => pointValue(p, metric)),
          borderColor: palette[idx % palette.length],
          backgroundColor: `${palette[idx % palette.length]}66`,
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 3,
          stack: 'real',
        });
      });
    } else {
      const curve = current.buildCurves?.length
        ? current.buildCurves
        : (current.bookingDataPoints || []).map((dp) => ({
            weekLabel: formatDayMon(dp.date, ''),
            bookings: dp.bookings,
            guests: dp.guests,
            loadFactorPct: current.capacity
              ? Math.round((dp.guests / current.capacity) * 10000) / 100
              : null,
          }));
      datasets.push({
        label: `REAL ${metricLabel(metric)}`,
        data: curve.map((p) => pointValue(p, metric)),
        borderColor: theme?.colors?.accent || '#b08d57',
        backgroundColor: theme?.colors?.accentLight || 'rgba(176, 141, 87, 0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 3,
      });
    }

    if (previous?.buildCurves?.length) {
      datasets.push({
        label: `Prior ${previous.sailCode || 'year'}`.trim(),
        data: previous.buildCurves.map((p) => pointValue(p, metric)),
        borderColor: theme?.colors?.textSecondary || '#999',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 3,
      });
    }

    if (budget?.totalBudgetPassengers != null && budget.totalBudgetPassengers > 0) {
      const budgetVal =
        metric === 'load_factor' && current.capacity > 0
          ? Math.round((budget.totalBudgetPassengers / current.capacity) * 10000) / 100
          : metric === 'bookings'
            ? null
            : budget.totalBudgetPassengers;
      if (budgetVal != null && labels.length) {
        datasets.push({
          label: 'Finance budget',
          data: labels.map((_, i) => (i === labels.length - 1 ? budgetVal : null)),
          borderColor: '#f7768e',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 5,
          showLine: false,
          fill: false,
        });
      }
    }

    const tickSize = Math.max(10, (fontSize || 14) - 3);
    const capacity = Number(current?.capacity);
    const capacityRef =
      metric === 'load_factor'
        ? { value: 100, label: 'Cap 100%' }
        : metric === 'guests' && Number.isFinite(capacity) && capacity > 0
          ? { value: capacity, label: `Cap ${capacity.toLocaleString()}` }
          : null;
    const todayIndex = resolveTodayWeekIndex(
      current?.buildCurves || [],
      current?.daysUntilSailing
    );

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: applyAxisLabelVisibility({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 4, right: 8, bottom: 0, left: 0 } },
        plugins: {
          ...axisLabelsPluginOptions(showAxisLabels),
          legend: getOverlayLegendOptions({ visible: chartLegendsVisible && showLegends }),
          taliaHorizontalReferenceLine: capacityRef
            ? capacityRef
            : { display: false },
          taliaVerticalReferenceLine: todayIndex != null
            ? {
                index: todayIndex,
                label: 'Today',
              }
            : { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y;
                if (v == null) return null;
                const suffix = metric === 'load_factor' ? '%' : '';
                return `${ctx.dataset.label}: ${Number(v).toLocaleString()}${suffix}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked,
            ticks: {
              color: theme?.colors?.textSecondary || '#999',
              font: { size: tickSize },
              maxRotation: 0,
            },
            grid: { color: 'rgba(128,128,128,0.12)' },
          },
          y: {
            stacked,
            beginAtZero: true,
            suggestedMax: capacityRef
              ? metric === 'load_factor'
                ? Math.max(110, capacityRef.value)
                : capacityRef.value * 1.05
              : undefined,
            ticks: {
              color: theme?.colors?.textSecondary || '#999',
              font: { size: tickSize },
              callback: (v) => (metric === 'load_factor' ? `${v}%` : v),
            },
            grid: { color: 'rgba(128,128,128,0.12)' },
            title: {
              display: true,
              text: metricLabel(metric),
              color: theme?.colors?.textSecondary || '#999',
              font: { size: tickSize },
            },
          },
        },
      }, showAxisLabels),
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [current, previous, budget, breakdown, metric, theme, fontFamily, fontSize, chartLegendsVisible, showAxisLabels, showLegends]);

  const subtitle = [
    current?.referenceSailCode || sailCode,
    current?.shipName,
    current?.sailDate ? formatDayMon(current.sailDate, '') : null,
    current?.daysUntilSailing != null ? `${current.daysUntilSailing}d to sail` : null,
    current?.sailCodes?.length > 1 ? `${current.sailCodes.length} codes` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const compositionRows =
    breakdown === 'market'
      ? current?.composition?.market
      : breakdown === 'currency'
        ? current?.composition?.currency
        : current?.composition?.marketGroup;

  const distributionRows =
    breakdown === 'none' ? current?.composition?.marketGroup : compositionRows;

  const metrics = [
    {
      key: 'bookings',
      label: 'Bookings',
      value: (current.currentBookings || 0).toLocaleString(),
      hint: 'Voyage scope',
    },
    {
      key: 'guests',
      label: 'Guests',
      value: (current.currentGuests || 0).toLocaleString(),
      hint: null,
    },
    {
      key: 'lf',
      label: 'Load factor',
      value:
        current.currentLoadFactorPct != null
          ? `${current.currentLoadFactorPct.toFixed(1)}%`
          : '—',
      hint: capacityLabel(current.capacity, current.capacitySource),
    },
    {
      key: 'velocity',
      label: 'Velocity',
      value: (current.bookingVelocity || 0).toFixed(1),
      hint: '/ day',
    },
  ];

  if (comparison) {
    metrics.push({
      key: 'yoy-guests',
      label: 'YoY guests',
      value: `${comparison.guestsDifference > 0 ? '+' : ''}${comparison.guestsDifference}`,
      hint: `${comparison.guestsPercentageChange > 0 ? '+' : ''}${Number(comparison.guestsPercentageChange).toFixed(1)}%`,
      tone:
        comparison.guestsDifference > 0
          ? 'positive'
          : comparison.guestsDifference < 0
            ? 'negative'
            : 'neutral',
    });
    if (comparison.loadFactorDifference != null) {
      metrics.push({
        key: 'yoy-lf',
        label: 'YoY LF pts',
        value: `${comparison.loadFactorDifference > 0 ? '+' : ''}${comparison.loadFactorDifference.toFixed(1)}`,
        hint: null,
        tone:
          comparison.loadFactorDifference > 0
            ? 'positive'
            : comparison.loadFactorDifference < 0
              ? 'negative'
              : 'neutral',
      });
    }
  }

  if (budget && budget.budgetRowCount > 0) {
    metrics.push({
      key: 'budget-gap',
      label: 'Budget gap',
      value: `${budget.totalGapGuests > 0 ? '+' : ''}${Number(budget.totalGapGuests).toLocaleString()}`,
      hint: `vs ${Number(budget.totalBudgetPassengers).toLocaleString()} pax`,
      tone: budget.totalGapGuests >= 0 ? 'positive' : 'negative',
    });
  }

  return (
    <div className={`focus-panel talia-report booking-profile${reportShellClassName ? ` ${reportShellClassName}` : ''}`} role="region" aria-label="Booking profile">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Real Booking Profile</h2>
          <p className="talia-report__subtitle">{subtitle || 'Select a sailing'}</p>
        </div>
      </header>

      <div
        className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
        aria-label="Profile filters"
      >
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Breakdown</span>
          <select
            className="talia-report-filters__input"
            value={breakdown}
            onChange={(e) => onBreakdownChange?.(e.target.value)}
          >
            <option value="none">Total</option>
            <option value="market_group">Market group</option>
            <option value="market">Market</option>
            <option value="currency">Currency</option>
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Metric</span>
          <select
            className="talia-report-filters__input"
            value={metric}
            onChange={(e) => onMetricChange?.(e.target.value)}
          >
            <option value="guests">Guests</option>
            <option value="bookings">Bookings</option>
            <option value="load_factor">Load factor %</option>
          </select>
        </label>
      </div>

      <BookingGoalCallout variant="REAL" includeComparison={includeComparison} />

      <div className="talia-callout booking-profile__callout" role="alert">
        Snapshot curves often disagree with live KPIs. Use{' '}
        <strong>Reservation booking curve</strong> for MSE-aligned booked cabins and
        original book dates.
      </div>

      {history?.quality && history.quality !== 'good' ? (
        <div className="talia-callout booking-profile__callout" role="status">
          History {history.quality}
          {history.distinctSnapshotDates != null
            ? ` · ${history.distinctSnapshotDates} snapshot dates`
            : ''}
          {history.minSnapshotDate && history.maxSnapshotDate
            ? ` · ${history.minSnapshotDate} → ${history.maxSnapshotDate}`
            : ''}
          {history.message ? ` — ${history.message}` : ''}
        </div>
      ) : null}

      {includeComparison && data?.representativenessNote ? (
        <div className="talia-callout booking-profile__callout" role="note">
          YoY is illustrative
          {data.previousYearSailCode ? ` · peer ${data.previousYearSailCode}` : ' · no peer found'}
          {data.peerSource ? ` (${data.peerSource})` : ''}.
        </div>
      ) : null}

      {onRefresh ? (
        <div className="talia-report__actions-bar" aria-label="Booking profile actions">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      ) : null}

      <ReportSnapshot
        title={null}
        ariaLabel="Profile metrics"
        visible={showSnapshot}
        items={metrics}
      />

      <main className="talia-report__content talia-report__content--scroll booking-profile__content">
        <div className="booking-profile__chart-host" aria-label="Booking build curve">
          <canvas ref={chartRef} />
        </div>

        <ReportDataDetails
          visible={showDetails}
          as="section"
          className="booking-profile__details"
          aria-label="Distribution and budget details"
        >
          {distributionRows?.length ? (
            <div className="booking-profile__section">
              <h3 className="booking-profile__section-title">
                Current distribution
                {breakdown === 'none' ? ' · market group' : ''}
              </h3>
              <div className="booking-profile__table-wrap">
                <table className="booking-profile__table talia-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Bookings</th>
                      <th>Guests</th>
                      <th>LF %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionRows.map((row) => (
                      <tr key={row.dimensionKey}>
                        <td>{row.dimensionKey}</td>
                        <td>{row.bookings.toLocaleString()}</td>
                        <td>{row.guests.toLocaleString()}</td>
                        <td>{row.loadFactorPct != null ? `${row.loadFactorPct}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {budget?.rows?.length ? (
            <div className="booking-profile__section">
              <h3 className="booking-profile__section-title">
                {budget.streamLabel} · end-state vs actual
              </h3>
              {budget.message ? (
                <p className="talia-callout booking-profile__callout">{budget.message}</p>
              ) : null}
              <div className="booking-profile__table-wrap">
                <table className="booking-profile__table talia-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Budget pax</th>
                      <th>Actual guests</th>
                      <th>Gap</th>
                      <th>Budget LF%</th>
                      <th>Actual LF%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.rows.map((row) => (
                      <tr key={row.dimensionKey}>
                        <td>{row.dimensionKey}</td>
                        <td>{Number(row.budgetPassengers).toLocaleString()}</td>
                        <td>{row.actualGuests.toLocaleString()}</td>
                        <td>{Number(row.gapGuests).toLocaleString()}</td>
                        <td>
                          {row.budgetLoadFactorPct != null
                            ? `${row.budgetLoadFactorPct}%`
                            : '—'}
                        </td>
                        <td>
                          {row.actualLoadFactorPct != null
                            ? `${row.actualLoadFactorPct}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : budget?.message ? (
            <p className="talia-callout booking-profile__callout">{budget.message}</p>
          ) : null}
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default BookingProfilePresenter;
