/**
 * Compact reservation booking curve — MSE booked cabins + stacked area chart.
 */

import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { formatDayMon } from '../../../lib/dateFormat';
import { useTheme } from '../../../contexts/ThemeContext';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { useGlobalDemandUnit } from '../../../hooks/useGlobalDemandUnit';
import {
  DEMAND_UNIT_CABINS,
  demandUnitAxisTitle,
  demandUnitNoun,
  demandUnitShortLabel,
  toDemandVolume,
} from '../../../lib/demandUnit';
import {
  getOverlayLegendOptions,
  taliaHorizontalReferenceLinePlugin,
  taliaVerticalReferenceLinePlugin,
  resolveTodayWeekIndex,
} from '../../../lib/chartConfig';
import { colorForDimensionKey } from '../../../lib/reservationDimensions';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
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
  const demandUnit = useGlobalDemandUnit();
  const demandNoun = demandUnitNoun(demandUnit);
  const showCapacityLine = demandUnit === DEMAND_UNIT_CABINS;
  const componentKey = panelComponentId || 'reservation-booking-curve';
  const { showSnapshot, showDetails, showFilters } = useReportShellOptions(
    componentKey,
    panelInstanceId
  );

  // Chart.js needs an explicit resize when Snapshot/Details change host size.
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return undefined;
    const frame = window.requestAnimationFrame(() => {
      try {
        chart.resize();
      } catch {
        // ignore
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showSnapshot, showDetails]);

  useEffect(() => {
    const unitLabel = demandUnitShortLabel(demandUnit);
    return registerPanelDataExport({
      panelInstanceId,
      panelComponentId: componentKey,
      getPayload: () => {
        let chartImage = null;
        try {
          const chart = chartInstanceRef.current;
          if (chart && typeof chart.toBase64Image === 'function') {
            chartImage = chart.toBase64Image('image/png', 1);
          } else if (chartRef.current && typeof chartRef.current.toDataURL === 'function') {
            chartImage = chartRef.current.toDataURL('image/png');
          }
        } catch {
          chartImage = null;
        }

        const rows = Array.isArray(data?.composition) ? data.composition : [];
        if (!rows.length && !chartImage) return null;

        return {
          title: `Reservation Profile ${data?.referenceSailCode || sailCode || ''}`.trim(),
          subtitle: data?.shipName || undefined,
          chartImage,
          columns: [
            { field: 'dimensionKey', title: 'Market group' },
            { field: 'bookings', title: 'Bookings' },
            { field: 'volume', title: unitLabel },
          ],
          rows: rows.map((row) => ({
            dimensionKey: row.dimensionKey,
            bookings: row.bookings,
            volume: toDemandVolume(row.guests, demandUnit),
          })),
        };
      },
    });
  }, [componentKey, data, demandUnit, panelInstanceId, sailCode]);

  useEffect(() => {
    if (!chartRef.current || !data) return;
    const ctx = chartRef.current.getContext('2d');
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const presentGuests = (value) => toDemandVolume(value, demandUnit);
    const contractSeries = Array.isArray(data.contractSeries) ? data.contractSeries : [];
    const targetSeries = Array.isArray(data.targetSeries) ? data.targetSeries : [];
    const useContractDemo = contractSeries.length > 0;
    const axisPoints = useContractDemo
      ? (contractSeries[0]?.points || [])
      : (data.totals || []);
    const labels = useContractDemo
      ? axisPoints.map((p) => (Number(p.weeksUntilSailing) === 0 ? '0' : String(p.weeksUntilSailing ?? p.weekLabel ?? '')))
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
            data: (s.points || []).map((p) => presentGuests(p.guests ?? p.bookings ?? 0)),
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

    if (useContractDemo && targetSeries.length) {
      const byWeek = new Map(
        targetSeries
          .filter((p) => p?.weeksUntilSailing != null)
          .map((p) => [Number(p.weeksUntilSailing), presentGuests(p.guests ?? p.bookings)])
      );
      const targetLabel = data?.activeTargetName
        ? `Target · ${data.activeTargetName}`
        : 'Target';
      datasets.push({
        label: targetLabel,
        data: axisPoints.map((p) => {
          const w = Number(p.weeksUntilSailing);
          const v = byWeek.get(w);
          return v == null ? null : v;
        }),
        borderColor: '#a78bfa',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        fill: false,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 2,
        spanGaps: true,
      });
    }

    const capacity = Number(data?.totalCabins);
    const hasCapacity = showCapacityLine && Number.isFinite(capacity) && capacity > 0;
    const peakBookings = Math.max(
      0,
      ...(data.totals || []).map((p) => Number(p.bookings) || 0),
      ...(series.flatMap((s) => (s.points || []).map((p) => Number(p.bookings) || 0))),
      ...(contractSeries.flatMap((s) => (s.points || []).map((p) => Number(presentGuests(p.guests ?? p.bookings)) || 0))),
      ...(targetSeries.map((p) => Number(presentGuests(p.guests ?? p.bookings)) || 0))
    );
    const daysUntil = data.daysUntilSailing;
    let todayIndex = resolveTodayWeekIndex(axisPoints, daysUntil);
    // Always show Today when we know days-to-sail; clamp onto axis if outside.
    if (todayIndex == null && axisPoints.length && daysUntil != null && Number.isFinite(Number(daysUntil))) {
      todayIndex = Number(daysUntil) <= 0 ? axisPoints.length - 1 : 0;
    }

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
              title: (items) => {
                const idx = items?.[0]?.dataIndex;
                const w = axisPoints[idx]?.weeksUntilSailing;
                if (w == null) return items?.[0]?.label || '';
                if (Number(w) === 0) return 'Sail (Week −0)';
                return `Week −${w}`;
              },
              footer: (items) => {
                const total = items.reduce((sum, it) => sum + (Number(it.raw) || 0), 0);
                return useContractDemo
                  ? `Sum ${total.toLocaleString()} ${demandNoun}`
                  : `Total ${total.toLocaleString()} bookings`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: !useContractDemo,
            title: {
              display: useContractDemo,
              text: 'Week −N (weeks before sail)',
              font: { size: 10, family: fontFamily },
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 16,
              font: { size: 10, family: fontFamily },
              callback(value) {
                const label = this.getLabelForValue(value);
                if (label === '0' || label === 0) return 'Sail';
                return label;
              },
            },
            grid: { display: false },
          },
          y: {
            stacked: !useContractDemo,
            beginAtZero: true,
            suggestedMax: hasCapacity ? Math.max(capacity, peakBookings) * 1.05 : undefined,
            title: {
              display: true,
              text: useContractDemo
                ? demandUnitAxisTitle(demandUnit, { monday: true })
                : 'Cumulative bookings',
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
  }, [chartLegendsVisible, data, demandNoun, demandUnit, fontSize, fontFamily, showCapacityLine]);

  const v = data?.velocity || {};
  const revenue = data?.revenue;
  const competitor = data?.competitor;
  const unitLabel = demandUnitShortLabel(demandUnit);
  const subtitleParts = [
    data?.referenceSailCode || sailCode,
    data?.shipName,
    data?.sailDate ? formatDayMon(data.sailDate, '') : null,
    data?.daysUntilSailing != null ? `${data.daysUntilSailing}d to sail` : null,
    Array.isArray(data?.sailCodes) && data.sailCodes.length > 1
      ? `${data.sailCodes.length} codes`
      : null,
    marketBreakdown === 'market' ? 'by market' : 'by market group',
    unitLabel,
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
      value: fmt(toDemandVolume(data?.bookedGuests, demandUnit)),
      hint: `real ${demandNoun}`,
    },
    {
      key: 'estimated-guests',
      label: 'Estimated',
      value: fmt(toDemandVolume(data?.estimatedGuests, demandUnit), 1),
      hint: 'contr × prob',
    },
    {
      key: 'contracted-guests',
      label: 'Contracted',
      value: fmt(toDemandVolume(data?.contractedGuests, demandUnit)),
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
      label: showCapacityLine ? 'Capacity' : 'Capacity (cabins)',
      value: fmt(data?.totalCabins),
      hint:
        data?.loadFactorPct != null
          ? `${data.loadFactorPct}% LF`
          : 'inventory cabins',
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

      <div
        className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
        aria-label="Curve filters"
      >
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
        title={null}
        ariaLabel="Booking curve metrics"
        visible={showSnapshot}
        items={metrics}
      />

      <main className={`talia-report__content booking-profile__content${showDetails ? ' booking-profile__content--with-details' : ''}`}>
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

        <div
          className="booking-profile__chart-host"
          aria-label={chartLabel}
        >
          <canvas ref={chartRef} />
        </div>
      </main>

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
                    <th>{demandUnitShortLabel(demandUnit)}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.composition.map((row) => (
                    <tr key={row.dimensionKey}>
                      <td>{row.dimensionKey}</td>
                      <td>{row.bookings.toLocaleString()}</td>
                      <td>{(toDemandVolume(row.guests, demandUnit) ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </ReportDataDetails>
    </div>
  );
};

export default ReservationBookingCurvePresenter;
