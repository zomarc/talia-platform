/**
 * Build Curve Chart Component
 * Displays incremental booking build curves at week intervals (W-12, W-10, W-8, W-6, W-4, W-2, Sail)
 */

import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

const BuildCurveChart = ({ buildCurves, targetCurves = null, previousYearCurves = null, theme, sailCode }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !buildCurves || buildCurves.length === 0) return;

    const ctx = chartRef.current.getContext('2d');

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    // Prepare labels (week labels)
    const labels = buildCurves.map(curve => curve.weekLabel);

    // Prepare datasets
    const datasets = [
      {
        label: 'Actual Bookings',
        data: buildCurves.map(curve => curve.bookings),
        borderColor: theme?.colors?.accent || '#b08d57',
        backgroundColor: theme?.colors?.accentLight || 'rgba(176, 141, 87, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ];

    // Add target curve if available
    if (targetCurves && targetCurves.length > 0) {
      datasets.push({
        label: 'Target Bookings',
        data: targetCurves.map(curve => curve.targetBookings || curve.bookings),
        borderColor: theme?.colors?.glassAccent || '#64ffda',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    // Add previous year curve if available
    if (previousYearCurves && previousYearCurves.length > 0) {
      datasets.push({
        label: 'Previous Year',
        data: previousYearCurves.map(curve => curve.bookings),
        borderColor: theme?.colors?.textSecondary || '#999',
        backgroundColor: 'transparent',
        borderDash: [2, 2],
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5
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
            text: `Build Curves: ${sailCode || 'Sailing'}`,
            color: theme?.colors?.foreground || '#2b2b2b',
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return `${label}: ${value.toLocaleString()} bookings`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
            },
            ticks: {
              color: theme?.colors?.textSecondary || '#666'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Bookings',
              color: theme?.colors?.textSecondary || '#666'
            },
            grid: {
              color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
            },
            ticks: {
              color: theme?.colors?.textSecondary || '#666',
              callback: function(value) {
                return value.toLocaleString();
              }
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
    buildCurves?.length,
    targetCurves?.length,
    previousYearCurves?.length,
    sailCode,
    theme?.colors?.accent,
    theme?.colors?.foreground
  ]);

  if (!buildCurves || buildCurves.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: theme?.colors?.textSecondary || '#666'
      }}>
        No build curve data available
      </div>
    );
  }

  return (
    <div style={{
      background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)',
      padding: '20px',
      borderRadius: '8px',
      border: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
      height: '400px'
    }}>
      <canvas ref={chartRef} />
    </div>
  );
};

export default BuildCurveChart;

