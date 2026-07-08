/**
 * Booking Profile Presenter Component
 * Displays booking trends, metrics, and year-over-year comparison
 */

import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import BuildCurveChart from './BuildCurveChart';
import { formatDayMon } from '../../../lib/dateFormat';
import { useTheme } from '../../../contexts/ThemeContext';
import BookingGoalCallout from '../../shared/BookingGoalCallout';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import ReportDataDetails from '../../shared/ReportDataDetails';

Chart.register(...registerables);

const BookingProfilePresenter = ({
  data,
  sailCode,
  theme,
  onRefresh,
  includeBuildCurves = false,
  includeComparison = false,
  panelInstanceId,
  panelComponentId,
}) => {
  const { fontSize, fontFamily } = useTheme();
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: panelComponentId || 'booking-profile',
  });

  const isYOY = data?.previousYear !== undefined;
  const currentYear = isYOY ? data.currentYear : data;
  const previousYear = data?.previousYear;
  const comparison = data?.comparison;

  useEffect(() => {
    if (!chartRef.current || !currentYear?.bookingDataPoints) return;

    const ctx = chartRef.current.getContext('2d');

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels = currentYear.bookingDataPoints.map((dp) => formatDayMon(dp.date, ''));

    const datasets = [
      {
        label: 'Total Bookings',
        data: currentYear.bookingDataPoints.map((dp) => dp.bookings),
        borderColor: theme?.colors?.accent || '#b08d57',
        backgroundColor: theme?.colors?.accentLight || 'rgba(176, 141, 87, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: 'Total Guests',
        data: currentYear.bookingDataPoints.map((dp) => dp.guests),
        borderColor: theme?.colors?.glassAccent || '#64ffda',
        backgroundColor: theme?.colors?.accentLight || 'rgba(100, 255, 218, 0.1)',
        tension: 0.4,
        fill: true,
        yAxisID: 'y1',
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ];

    if (previousYear?.bookingDataPoints) {
      datasets.push({
        label: 'Previous Year Bookings',
        data: previousYear.bookingDataPoints.map((dp) => dp.bookings),
        borderColor: theme?.colors?.textSecondary || '#999',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      });
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        transitions: { active: { animation: { duration: 0 } } },
        plugins: {
          legend: { position: 'top' },
          title: { display: false },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Bookings' },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Guests' },
            grid: { drawOnChartArea: false },
          },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [
    currentYear?.bookingDataPoints?.length,
    previousYear?.bookingDataPoints?.length,
    sailCode,
    theme?.colors?.accent,
    theme?.colors?.foreground,
    fontSize,
    fontFamily,
  ]);

  const subtitle = [
    sailCode,
    currentYear?.shipName,
    currentYear?.sailDate ? formatDayMon(currentYear.sailDate, '') : null,
    currentYear?.daysUntilSailing != null ? `${currentYear.daysUntilSailing} days until sailing` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="focus-panel talia-report booking-profile" role="region" aria-label="Booking profile">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Real Booking Profile</h2>
          <p className="talia-report__subtitle">{subtitle || 'Select a sailing'}</p>
        </div>
      </header>

      <BookingGoalCallout variant="REAL" includeComparison={includeComparison} />

      {onRefresh ? (
        <div className="talia-report__actions-bar" aria-label="Booking profile actions">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      ) : null}

      <main className="talia-report__content">
        <ReportDataDetails visible={showDetails} className="booking-profile__data-details">
          <div className="booking-profile__kpi-grid">
            <KPICard
              title="Current Bookings"
              value={currentYear.currentBookings.toLocaleString()}
              subtitle="Reservations"
            />
            <KPICard
              title="Total Guests"
              value={currentYear.currentGuests.toLocaleString()}
              subtitle="Passengers"
            />
            <KPICard
              title="Booking Velocity"
              value={currentYear.bookingVelocity.toFixed(1)}
              subtitle="Bookings per day"
            />
            <KPICard
              title="Cancellation Rate"
              value={`${currentYear.cancellationRate.toFixed(1)}%`}
              subtitle="Of total bookings"
              isWarning={currentYear.cancellationRate > 10}
            />
            {comparison ? (
              <>
                <KPICard
                  title="YoY Bookings"
                  value={`${comparison.bookingsDifference > 0 ? '+' : ''}${comparison.bookingsDifference}`}
                  subtitle={`${comparison.bookingsPercentageChange > 0 ? '+' : ''}${comparison.bookingsPercentageChange.toFixed(1)}%`}
                  isPositive={comparison.bookingsDifference > 0}
                />
                <KPICard
                  title="YoY Guests"
                  value={`${comparison.guestsDifference > 0 ? '+' : ''}${comparison.guestsDifference}`}
                  subtitle={`${comparison.guestsPercentageChange > 0 ? '+' : ''}${comparison.guestsPercentageChange.toFixed(1)}%`}
                  isPositive={comparison.guestsDifference > 0}
                />
              </>
            ) : null}
          </div>

          <div className="booking-profile__chart">
            <canvas ref={chartRef} />
          </div>

          {includeBuildCurves && data?.buildCurves && data.buildCurves.length > 0 ? (
            <div className="booking-profile__build-curves">
              <BuildCurveChart
                buildCurves={data.buildCurves}
                targetCurves={null}
                previousYearCurves={data?.previousYear?.buildCurves}
                sailCode={sailCode}
              />
            </div>
          ) : null}

          {isYOY && previousYear ? (
            <div className="booking-profile__comparison">
              <h3 className="booking-profile__comparison-title">Year-over-Year Comparison</h3>
              <div className="booking-profile__comparison-grid">
                <ComparisonCard
                  title="Current Year"
                  sailCode={currentYear.sailCode}
                  bookings={currentYear.currentBookings}
                  guests={currentYear.currentGuests}
                  velocity={currentYear.bookingVelocity}
                />
                <ComparisonCard
                  title="Previous Year"
                  sailCode={previousYear.sailCode}
                  bookings={previousYear.currentBookings}
                  guests={previousYear.currentGuests}
                  velocity={previousYear.bookingVelocity}
                />
              </div>
            </div>
          ) : null}
        </ReportDataDetails>
      </main>
    </div>
  );
};

const KPICard = ({ title, value, subtitle, isPositive, isWarning }) => {
  const variant = isWarning ? 'warning' : isPositive ? 'positive' : isPositive === false ? 'negative' : 'neutral';

  return (
    <div className="booking-kpi">
      <div className="booking-kpi__title">{title}</div>
      <div className="booking-kpi__value" data-variant={variant}>{value}</div>
      {subtitle ? <div className="booking-kpi__subtitle">{subtitle}</div> : null}
    </div>
  );
};

const ComparisonCard = ({ title, sailCode: cardSailCode, bookings, guests, velocity }) => (
  <div className="booking-comparison">
    <div className="booking-comparison__title">{title}</div>
    <div className="booking-comparison__subtitle">{cardSailCode}</div>
    <div className="booking-comparison__metrics">
      <MetricRow label="Bookings" value={bookings.toLocaleString()} />
      <MetricRow label="Guests" value={guests.toLocaleString()} />
      <MetricRow label="Velocity" value={velocity.toFixed(1)} />
    </div>
  </div>
);

const MetricRow = ({ label, value }) => (
  <div className="booking-metric">
    <span className="booking-metric__label">{label}:</span>
    <span className="booking-metric__value">{value}</span>
  </div>
);

export default BookingProfilePresenter;
