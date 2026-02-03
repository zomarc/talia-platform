import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { getChartColors, getChartOptions } from '../../../lib/chartConfig';

/**
 * OccupancyChartPresenter - Weekly occupancy and revenue chart
 *
 * @param {Object} props
 * @param {Array} props.data - Weekly occupancy data
 */
const OccupancyChartPresenter = ({ data }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const colors = getChartColors();
    const labels = data.map((entry) => entry.day);
    const occupancyValues = data.map((entry) => entry.occupancy);
    const revenueValues = data.map((entry) => entry.revenue);

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Occupancy %',
            data: occupancyValues,
            backgroundColor: colors.primary,
            borderRadius: 4,
            yAxisID: 'occupancy'
          },
          {
            type: 'line',
            label: 'Revenue',
            data: revenueValues,
            borderColor: colors.secondary,
            backgroundColor: `${colors.secondary}33`,
            tension: 0.3,
            yAxisID: 'revenue'
          }
        ]
      },
      options: getChartOptions.bar({
        plugins: {
          legend: {
            position: 'top'
          }
        },
        scales: {
          occupancy: {
            position: 'left',
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`
            }
          },
          revenue: {
            position: 'right',
            beginAtZero: true,
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              callback: (value) => `€${Math.round(value / 1000)}k`
            }
          }
        }
      })
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data]);

  return (
    <div className="talia-report" role="region" aria-label="Weekly occupancy and revenue">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Weekly Occupancy & Revenue</h2>
          <p className="talia-report__subtitle">7-day performance overview</p>
        </div>
      </header>
      <main className="talia-report__content">
        <div className="talia-chart">
          <canvas ref={canvasRef} className="talia-chart__canvas" />
        </div>
      </main>
      <footer className="talia-report__footer">
        <span>{data.length} days</span>
        <span>Last 7 days</span>
      </footer>
    </div>
  );
};

export default OccupancyChartPresenter;
