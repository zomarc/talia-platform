/**
 * Booking Profile Presenter Component
 * Displays booking trends, metrics, and year-over-year comparison
 */

import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import BuildCurveChart from './BuildCurveChart';

// Register Chart.js components
Chart.register(...registerables);

const BookingProfilePresenter = ({ data, sailCode, theme, onRefresh, includeBuildCurves = false }) => {
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
      const date = new Date(dp.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
            labels: {
              color: theme?.colors?.foreground || '#2b2b2b',
              usePointStyle: true
            }
          },
          title: {
            display: true,
            text: `Booking Profile: ${sailCode}`,
            color: theme?.colors?.foreground || '#2b2b2b',
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            grid: {
              color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
            },
            ticks: {
              color: theme?.colors?.textSecondary || '#666',
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
              color: theme?.colors?.textSecondary || '#666'
            },
            grid: {
              color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
            },
            ticks: {
              color: theme?.colors?.textSecondary || '#666'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Guests',
              color: theme?.colors?.textSecondary || '#666'
            },
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              color: theme?.colors?.textSecondary || '#666'
            }
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
    theme?.colors?.foreground
  ]);

  // Calculate additional metrics
  const totalNewBookings = currentYear.bookingDataPoints?.reduce((sum, dp) => sum + dp.newBookings, 0) || 0;
  const totalCancellations = currentYear.bookingDataPoints?.reduce((sum, dp) => sum + dp.cancellations, 0) || 0;
  const netBookings = totalNewBookings - totalCancellations;

  return (
    <div style={{
      padding: '20px',
      background: theme?.colors?.background || '#ffffff',
      borderRadius: '8px',
      color: theme?.colors?.foreground || '#2b2b2b'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 'bold',
            color: theme?.colors?.foreground || '#2b2b2b'
          }}>
            Booking Profile: {sailCode}
          </h2>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '14px',
            color: theme?.colors?.textSecondary || '#666'
          }}>
            {currentYear.shipName} • Sailing: {new Date(currentYear.sailDate).toLocaleDateString()}
            {currentYear.daysUntilSailing !== null && (
              <span> • {currentYear.daysUntilSailing} days until sailing</span>
            )}
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            padding: '8px 16px',
            background: theme?.colors?.accent || '#b08d57',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <KPICard
          title="Current Bookings"
          value={currentYear.currentBookings.toLocaleString()}
          subtitle="Reservations"
          theme={theme}
        />
        <KPICard
          title="Total Guests"
          value={currentYear.currentGuests.toLocaleString()}
          subtitle="Passengers"
          theme={theme}
        />
        <KPICard
          title="Booking Velocity"
          value={currentYear.bookingVelocity.toFixed(1)}
          subtitle="Bookings per day"
          theme={theme}
        />
        <KPICard
          title="Cancellation Rate"
          value={`${currentYear.cancellationRate.toFixed(1)}%`}
          subtitle="Of total bookings"
          theme={theme}
          isWarning={currentYear.cancellationRate > 10}
        />
        {comparison && (
          <>
            <KPICard
              title="YoY Bookings"
              value={`${comparison.bookingsDifference > 0 ? '+' : ''}${comparison.bookingsDifference}`}
              subtitle={`${comparison.bookingsPercentageChange > 0 ? '+' : ''}${comparison.bookingsPercentageChange.toFixed(1)}%`}
              theme={theme}
              isPositive={comparison.bookingsDifference > 0}
            />
            <KPICard
              title="YoY Guests"
              value={`${comparison.guestsDifference > 0 ? '+' : ''}${comparison.guestsDifference}`}
              subtitle={`${comparison.guestsPercentageChange > 0 ? '+' : ''}${comparison.guestsPercentageChange.toFixed(1)}%`}
              theme={theme}
              isPositive={comparison.guestsDifference > 0}
            />
          </>
        )}
      </div>

      {/* Booking Trends Chart */}
      <div style={{
        background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)',
        padding: '20px',
        borderRadius: '8px',
        border: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
        marginBottom: '24px',
        height: '400px'
      }}>
        <canvas ref={chartRef} />
      </div>

      {/* Build Curves Chart */}
      {includeBuildCurves && data?.buildCurves && data.buildCurves.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <BuildCurveChart
            buildCurves={data.buildCurves}
            targetCurves={null} // Can be passed from target profile if available
            previousYearCurves={data?.previousYear?.buildCurves}
            theme={theme}
            sailCode={sailCode}
          />
        </div>
      )}

      {/* Year-over-Year Comparison */}
      {isYOY && previousYear && (
        <div style={{
          background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)',
          padding: '20px',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#e0e0e0'}`
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: theme?.colors?.foreground || '#2b2b2b'
          }}>
            Year-over-Year Comparison
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            <ComparisonCard
              title="Current Year"
              sailCode={currentYear.sailCode}
              bookings={currentYear.currentBookings}
              guests={currentYear.currentGuests}
              velocity={currentYear.bookingVelocity}
              theme={theme}
            />
            <ComparisonCard
              title="Previous Year"
              sailCode={previousYear.sailCode}
              bookings={previousYear.currentBookings}
              guests={previousYear.currentGuests}
              velocity={previousYear.bookingVelocity}
              theme={theme}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// KPI Card Component
const KPICard = ({ title, value, subtitle, theme, isPositive, isWarning }) => {
  const cardStyle = {
    background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)',
    padding: '16px',
    borderRadius: '8px',
    border: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  };

  const valueColor = isWarning 
    ? '#f44336' 
    : isPositive 
      ? '#4caf50' 
      : isPositive === false 
        ? '#f44336' 
        : theme?.colors?.foreground || '#2b2b2b';

  return (
    <div style={cardStyle}>
      <div style={{
        fontSize: '12px',
        color: theme?.colors?.textSecondary || '#666',
        marginBottom: '8px',
        fontWeight: '500'
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: valueColor,
        marginBottom: '4px'
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{
          fontSize: '12px',
          color: theme?.colors?.textMuted || '#999'
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

// Comparison Card Component
const ComparisonCard = ({ title, sailCode, bookings, guests, velocity, theme }) => {
  return (
    <div style={{
      background: theme?.colors?.selected || 'rgba(253, 234, 204, 0.3)',
      padding: '16px',
      borderRadius: '8px',
      border: `1px solid ${theme?.colors?.border || '#e0e0e0'}`
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: theme?.colors?.foreground || '#2b2b2b',
        marginBottom: '12px'
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '12px',
        color: theme?.colors?.textSecondary || '#666',
        marginBottom: '8px'
      }}>
        {sailCode}
      </div>
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <MetricRow label="Bookings" value={bookings.toLocaleString()} theme={theme} />
        <MetricRow label="Guests" value={guests.toLocaleString()} theme={theme} />
        <MetricRow label="Velocity" value={velocity.toFixed(1)} theme={theme} />
      </div>
    </div>
  );
};

const MetricRow = ({ label, value, theme }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px'
  }}>
    <span style={{ color: theme?.colors?.textSecondary || '#666' }}>{label}:</span>
    <span style={{ fontWeight: '600', color: theme?.colors?.foreground || '#2b2b2b' }}>{value}</span>
  </div>
);

export default BookingProfilePresenter;


