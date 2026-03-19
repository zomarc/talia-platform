/**
 * Booking Profile Presenter Component
 * Displays booking trends, metrics, and year-over-year comparison
 */

import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import BuildCurveChart from './BuildCurveChart';
import { formatDayMon } from '../../../lib/dateFormat';
import { useTheme } from '../../../contexts/ThemeContext';

// Register Chart.js components
Chart.register(...registerables);

const BookingProfilePresenter = ({ data, sailCode, theme, onRefresh, includeBuildCurves = false }) => {
  const { fontSize, fontFamily } = useTheme();
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Determine if we have YOY comparison data
  const isYOY = data?.previousYear !== undefined;
  const currentYear = isYOY ? data.currentYear : data;
  const previousYear = data?.previousYear;
  const comparison = data?.comparison;

  // Prepare chart data
  useEffect(() => {
    if (!chartRef.current || !currentYear?.bookingDataPoints) return;

    const ctx = chartRef.current.getContext('2d');

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    // Prepare datasets
    const labels = currentYear.bookingDataPoints.map(dp => {
      return formatDayMon(dp.date, '');
    });

    const datasets = [
      {
        label: 'Total Bookings',
        data: currentYear.bookingDataPoints.map(dp => dp.bookings),
        borderColor: theme?.colors?.accent || '#b08d57',
        backgroundColor: theme?.colors?.accentLight || 'rgba(176, 141, 87, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4
      },
      {
        label: 'Total Guests',
        data: currentYear.bookingDataPoints.map(dp => dp.guests),
        borderColor: theme?.colors?.glassAccent || '#64ffda',
        backgroundColor: theme?.colors?.accentLight || 'rgba(100, 255, 218, 0.1)',
        tension: 0.4,
        fill: true,
        yAxisID: 'y1',
        pointRadius: 0,
        pointHoverRadius: 4
      }
    ];

    // Add previous year data if available
    if (previousYear?.bookingDataPoints) {
      datasets.push(      {
        label: 'Previous Year Bookings',
        data: previousYear.bookingDataPoints.map(dp => dp.bookings),
        borderColor: theme?.colors?.textSecondary || '#999',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4
      });
    }

    // Create chart
    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0 // Disable animation to prevent shaking
        },
        transitions: {
          active: {
            animation: {
              duration: 0
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: `Booking Profile: ${sailCode}`,
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Bookings',
            },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Guests',
            },
            grid: {
              drawOnChartArea: false
            },
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
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

  return (
    <div className="booking-profile">
      {/* Header */}
      <div className="booking-profile__header">
        <div>
          <h2 className="booking-profile__title">
            Booking Profile: {sailCode}
          </h2>
          <p className="booking-profile__subtitle">
            {currentYear.shipName} • Sailing: {formatDayMon(currentYear.sailDate, '')}
            {currentYear.daysUntilSailing !== null && (
              <span> • {currentYear.daysUntilSailing} days until sailing</span>
            )}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="booking-profile__refresh"
        >
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
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
        {comparison && (
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
        )}
      </div>

      {/* Booking Trends Chart */}
      <div className="booking-profile__chart">
        <canvas ref={chartRef} />
      </div>

      {/* Build Curves Chart */}
      {includeBuildCurves && data?.buildCurves && data.buildCurves.length > 0 && (
        <div className="booking-profile__build-curves">
          <BuildCurveChart
            buildCurves={data.buildCurves}
            targetCurves={null} // Can be passed from target profile if available
            previousYearCurves={data?.previousYear?.buildCurves}
            sailCode={sailCode}
          />
        </div>
      )}

      {/* Year-over-Year Comparison */}
      {isYOY && previousYear && (
        <div className="booking-profile__comparison">
          <h3 className="booking-profile__comparison-title">
            Year-over-Year Comparison
          </h3>
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
      )}
    </div>
  );
};

// KPI Card Component
const KPICard = ({ title, value, subtitle, isPositive, isWarning }) => {
  const variant = isWarning ? 'warning' : isPositive ? 'positive' : isPositive === false ? 'negative' : 'neutral';

  return (
    <div className="booking-kpi">
      <div className="booking-kpi__title">
        {title}
      </div>
      <div className="booking-kpi__value" data-variant={variant}>
        {value}
      </div>
      {subtitle && (
        <div className="booking-kpi__subtitle">
          {subtitle}
        </div>
      )}
    </div>
  );
};

// Comparison Card Component
const ComparisonCard = ({ title, sailCode, bookings, guests, velocity }) => {
  return (
    <div className="booking-comparison">
      <div className="booking-comparison__title">
        {title}
      </div>
      <div className="booking-comparison__subtitle">
        {sailCode}
      </div>
      <div className="booking-comparison__metrics">
        <MetricRow label="Bookings" value={bookings.toLocaleString()} />
        <MetricRow label="Guests" value={guests.toLocaleString()} />
        <MetricRow label="Velocity" value={velocity.toFixed(1)} />
      </div>
    </div>
  );
};

const MetricRow = ({ label, value }) => (
  <div className="booking-metric">
    <span className="booking-metric__label">{label}:</span>
    <span className="booking-metric__value">{value}</span>
  </div>
);

export default BookingProfilePresenter;


