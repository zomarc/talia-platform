/**
 * Compact reservation booking curve — MSE booked cabins + stacked area chart.
 */

import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { formatDayMon } from '../../../lib/dateFormat';
import { useTheme } from '../../../contexts/ThemeContext';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import {
  getOverlayLegendOptions,
  taliaHorizontalReferenceLinePlugin,
  taliaVerticalReferenceLinePlugin,
  resolveTodayWeekIndex,
} from '../../../lib/chartConfig';
import { colorForDimensionKey } from '../../../lib/reservationDimensions';
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

const fmt = (n, digits = 0) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  });
};

const withAlpha = (hex, alphaHex = '99') => {
  const raw = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return `${raw}${alphaHex}`;
  return raw;
};

/** Compare shorter window rate vs next longer window: up = accelerating. */
const velocityTrend = (shorterRate, longerRate) => {
  const a = Number(shorterRate);
  const b = Number(longerRate);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a > b) return 'up';
  if (a < b) return 'down';
  return 'flat';
};

const ReservationBookingCurvePresenter = ({
  data,
  sailCode,
  seriesMode = 'market',
  onSeriesModeChange,
  showRevenue = false,
  onShowRevenueChange,
  showCompetitor = false,
  onShowCompetitorChange,
  marketBreakdown = 'market_group',
  panelInstanceId,
  panelComponentId,
}) => {
  const { fontSize, fontFamily, chartLegendsVisible } = useTheme();
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: panelComponentId || 'reservation-booking-curve',
  });

  useEffect(() => {
    if (!chartRef.current || !data) return;
    const ctx = chartRef.current.getContext('2d');
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const contractSeries = Array.isArray(data.contractSeries) ? data.contractSeries : [];
    const useContractDemo = contractSeries.length > 0;
    const labels = useContractDemo
      ? (contractSeries[0]?.points?.map((p) => p.weekLabel) || [])
      : (
        data.totals?.map((p) => p.weekLabel) ||
        data.series?.[0]?.points?.map((p) => p.weekLabel) ||
        []
      );
    const series = Array.isArray(data.series) ? data.series : [];
    const contractColors = {
      Booked: '#3b82f6',
      Estimated: '#f59e0b',
      Contracted: '#94a3b8',
    };
    const datasets = useContractDemo
      ? contractSeries.map((s) => {
          const color = contractColors[s.dimensionKey] || colorForDimensionKey(s.dimensionKey);
          return {
            label: s.dimensionKey,
            data: (s.points || []).map((p) => p.guests ?? p.bookings ?? 0),
            borderColor: color,
            backgroundColor: withAlpha(color, '22'),
            fill: false,
            tension: 0.2,
            pointRadius: 2,
            pointHoverRadius: 4,
            borderWidth: 2,
          };
        })
      : series.length > 0
        ? series.map((s) => {
            const color = colorForDimensionKey(s.dimensionKey);
            return {
              label: s.dimensionKey,
              data: (s.points || []).map((p) => p.bookings ?? 0),
              borderColor: color,
              backgroundColor: withAlpha(color, '99'),
              fill: true,
              tension: 0.2,
              pointRadius: 0,
              pointHoverRadius: 3,
              borderWidth: 1.5,
              stack: 'curve',
            };
          })
        : [
            {
              label: 'Bookings',
              data: (data.totals || []).map((p) => p.bookings ?? 0),
              borderColor: colorForDimensionKey('Bookings'),
              backgroundColor: withAlpha(colorForDimensionKey('Bookings'), '66'),
              fill: true,
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
            },
          ];

    const capacity = Number(data?.totalCabins);
    const hasCapacity = Number.isFinite(capacity) && capacity > 0;
    const peakBookings = Math.max(
      0,
      ...(data.totals || []).map((p) => Number(p.bookings) || 0),
      ...(series.flatMap((s) => (s.points || []).map((p) => Number(p.bookings) || 0))),
      ...(contractSeries.flatMap((s) => (s.points || []).map((p) => Number(p.guests ?? p.bookings) || 0)))
    );
    const todayIndex = resolveTodayWeekIndex(
      useContractDemo ? (contractSeries[0]?.points || []) : (data.totals || []),
      data.daysUntilSailing
    );

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: getOverlayLegendOptions({ visible: chartLegendsVisible }),
          taliaHorizontalReferenceLine: hasCapacity
            ? {
                value: capacity,
                label: `Cap ${capacity.toLocaleString()}`,
              }
            : { display: false },
          taliaVerticalReferenceLine: todayIndex != null
            ? {
                index: todayIndex,
                label: 'Today',
              }
            : { display: false },
          tooltip: {
            callbacks: {
              footer: (items) => {
                const total = items.reduce((sum, it) => sum + (Number(it.raw) || 0), 0);
                return useContractDemo
                  ? `Sum ${total.toLocaleString()} guests`
                  : `Total ${total.toLocaleString()} bookings`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: !useContractDemo,
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 14,
              font: { size: 10, family: fontFamily },
            },
            grid: { display: false },
          },
          y: {
            stacked: !useContractDemo,
            beginAtZero: true,
            suggestedMax: hasCapacity ? Math.max(capacity, peakBookings) * 1.05 : undefined,
            title: {
              display: true,
              text: useContractDemo ? 'Guests (Monday snapshots)' : 'Cumulative bookings',
              font: { size: 11, family: fontFamily },
            },
            ticks: { font: { size: 10, family: fontFamily } },
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
  }, [chartLegendsVisible, data, fontSize, fontFamily]);

  const v = data?.velocity || {};
  const revenue = data?.revenue;
  const competitor = data?.competitor;
  const subtitleParts = [
    data?.referenceSailCode || sailCode,
    data?.shipName,
    data?.sailDate ? formatDayMon(data.sailDate, '') : null,
    data?.daysUntilSailing != null ? `${data.daysUntilSailing}d to sail` : null,
    Array.isArray(data?.sailCodes) && data.sailCodes.length > 1
      ? `${data.sailCodes.length} codes`
      : null,
    marketBreakdown === 'market' ? 'by market' : 'by market group',
  ].filter(Boolean);

  const velocityMetrics = [
    {
      key: 'v7',
      label: 'Velocity 7d',
      value: `${fmt(v.pastWeek?.bookingsPerDay, 1)}/d`,
      hint: `${fmt(v.pastWeek?.bookings)} bk`,
      trend: velocityTrend(v.pastWeek?.bookingsPerDay, v.pastTwoWeeks?.bookingsPerDay),
    },
    {
      key: 'v14',
      label: 'Velocity 14d',
      value: `${fmt(v.pastTwoWeeks?.bookingsPerDay, 1)}/d`,
      hint: `${fmt(v.pastTwoWeeks?.bookings)} bk`,
      trend: velocityTrend(v.pastTwoWeeks?.bookingsPerDay, v.pastFourWeeks?.bookingsPerDay),
    },
    {
      key: 'v28',
      label: 'Velocity 28d',
      value: `${fmt(v.pastFourWeeks?.bookingsPerDay, 1)}/d`,
      hint: `${fmt(v.pastFourWeeks?.bookings)} bk`,
      trend: velocityTrend(v.pastFourWeeks?.bookingsPerDay, v.pastSixtyDays?.bookingsPerDay),
    },
    {
      key: 'v60',
      label: 'Velocity 60d',
      value: `${fmt(v.pastSixtyDays?.bookingsPerDay, 1)}/d`,
      hint: `${fmt(v.pastSixtyDays?.bookings)} bk`,
      trend: null,
    },
  ];

  const metrics = [
    {
      key: 'booked-guests',
      label: 'Booked',
      value: fmt(data?.bookedGuests),
      hint: 'real guests',
    },
    {
      key: 'estimated-guests',
      label: 'Estimated',
      value: fmt(data?.estimatedGuests, 1),
      hint: 'contr × prob',
    },
    {
      key: 'contracted-guests',
      label: 'Contracted',
      value: fmt(data?.contractedGuests),
      hint: 'group OF face',
    },
    {
      key: 'booked',
      label: 'Bk C',
      value: fmt(data?.bookedCabins),
      hint: 'MSE cabins',
    },
    {
      key: 'capacity',
      label: 'Capacity',
      value: fmt(data?.totalCabins),
      hint:
        data?.loadFactorPct != null
          ? `${data.loadFactorPct}% LF`
          : 'MSE cabins',
    },
    ...velocityMetrics,
  ];

  if (showRevenue) {
    metrics.push({
      key: 'rev-pax',
      label: 'Rev / pax',
      value: revenue?.revPerPaxEur != null ? `€${fmt(revenue.revPerPaxEur, 0)}` : '—',
      hint: revenue?.message
        ? 'no revenue data'
        : `${fmt(revenue?.coveragePct, 0)}% cov`,
    });
  }

  const compositionLabel = seriesMode === 'pax_type'
    ? 'Passenger type'
    : seriesMode === 'channel'
      ? 'Channel'
      : (marketBreakdown === 'market' ? 'Market' : 'Market group');

  const chartLabel = seriesMode === 'pax_type'
    ? 'Booking build by passenger type'
    : seriesMode === 'channel'
      ? 'Booking build by channel'
      : `Booking build by ${marketBreakdown === 'market' ? 'market' : 'market group'}`;

  const marketSeriesLabel = marketBreakdown === 'market' ? 'Market' : 'Market group';

  return (
    <div
      className="focus-panel talia-report booking-profile reservation-booking-curve"
      role="region"
      aria-label="Reservation booking curve"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Reservation Booking Curve</h2>
          <p className="talia-report__subtitle">{subtitleParts.join(' · ') || 'Select a sailing'}</p>
        </div>
      </header>

      <BookingGoalCallout variant="RESERVATION_CURVE" />

      <div className="talia-report-filters" aria-label="Curve filters">
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Series</span>
          <select
            className="talia-report-filters__input"
            value={seriesMode}
            onChange={(e) => onSeriesModeChange?.(e.target.value)}
          >
            <option value="market">{marketSeriesLabel}</option>
            <option value="channel">Channel (distribution)</option>
            <option value="pax_type">Passenger type (Group/FIT)</option>
          </select>
        </label>
        <label className="talia-report-filters__group talia-report-filters__group--toggle">
          <input
            type="checkbox"
            checked={showRevenue}
            onChange={(e) => onShowRevenueChange?.(e.target.checked)}
          />
          <span className="talia-report-filters__label">Rev / pax</span>
        </label>
        <label className="talia-report-filters__group talia-report-filters__group--toggle">
          <input
            type="checkbox"
            checked={showCompetitor}
            onChange={(e) => onShowCompetitorChange?.(e.target.checked)}
          />
          <span className="talia-report-filters__label">Competitor</span>
        </label>
      </div>

      {data?.contractMessage ? (
        <div className="talia-callout booking-profile__callout" role="status">
          {data.contractMessage}
        </div>
      ) : null}

      {data?.missingBookDates > 0 ? (
        <div className="talia-callout booking-profile__callout" role="status">
          {data.missingBookDates.toLocaleString()} reservations missing original book date
          {data.reservationBookings
            ? ` · ${data.reservationBookings.toLocaleString()} active reservations`
            : ''}
          . Curve uses original_init_date (fallback res_init_date).
        </div>
      ) : null}

      <ReportSnapshot
        title="Snapshot"
        ariaLabel="Booking curve metrics"
        items={metrics}
      />

      <main className="talia-report__content talia-report__content--scroll booking-profile__content">
        {showCompetitor ? (
          <div className="talia-callout booking-profile__callout reservation-booking-curve__competitor" role="status">
            {competitor?.ourMinFarePp != null || competitor?.competitorMedianPp != null ? (
              <>
                Own min fare €{fmt(competitor?.ourMinFarePp)} · Peer median €{fmt(competitor?.competitorMedianPp)}
                {competitor?.gapPct != null
                  ? ` · ${competitor.gapPct > 0 ? '+' : ''}${fmt(competitor.gapPct, 1)}% vs peers`
                  : ''}
                {competitor?.competitorCount
                  ? ` · ${competitor.competitorCount} peer offers`
                  : ''}
                {competitor?.departureMonth ? ` · ${competitor.departureMonth}` : ''}
              </>
            ) : (
              competitor?.message || 'Competitor comparison unavailable for this sailing.'
            )}
          </div>
        ) : null}

        {showRevenue && revenue?.message ? (
          <div className="talia-callout booking-profile__callout" role="note">
            {revenue.message}
          </div>
        ) : null}

        <div className="booking-profile__chart-host" aria-label={chartLabel}>
          <canvas ref={chartRef} />
        </div>

        <ReportDataDetails
          visible={showDetails}
          as="section"
          className="booking-profile__details"
          aria-label="Distribution details"
        >
          {data?.composition?.length ? (
            <div className="booking-profile__section">
              <h3 className="booking-profile__section-title">
                Current distribution · {compositionLabel}
              </h3>
              <div className="booking-profile__table-wrap">
                <table className="booking-profile__table talia-table">
                  <thead>
                    <tr>
                      <th>{compositionLabel}</th>
                      <th>Bookings</th>
                      <th>Guests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.composition.map((row) => (
                      <tr key={row.dimensionKey}>
                        <td>{row.dimensionKey}</td>
                        <td>{row.bookings.toLocaleString()}</td>
                        <td>{row.guests.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default ReservationBookingCurvePresenter;
