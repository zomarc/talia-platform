import React, { useEffect, useMemo, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { getChartOptions, getSeriesColors } from '../../../lib/chartConfig';

/**
 * RevenueBreakdownPresenter - Revenue mix visualization
 *
 * @param {Object} props
 * @param {Array} props.data - Revenue category data
 */
const RevenueBreakdownPresenter = ({ data }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const totalRevenue = useMemo(
    () => data.reduce((sum, item) => sum + item.amount, 0),
    [data]
  );

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const labels = data.map((item) => item.category);
    const values = data.map((item) => item.amount);
    const colors = getSeriesColors();

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: values.map((_, index) => colors[index % colors.length]),
            borderWidth: 0
          }
        ]
      },
      options: getChartOptions.pie({
        plugins: {
          legend: {
            position: 'right'
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
    <div className="talia-report" role="region" aria-label="Revenue breakdown">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Revenue Breakdown</h2>
          <p className="talia-report__subtitle">Today&apos;s revenue by category</p>
        </div>
      </header>
      <main className="talia-report__content">
        <div className="talia-chart">
          <canvas ref={canvasRef} className="talia-chart__canvas" />
        </div>
      </main>
      <footer className="talia-report__footer">
        <span>Total revenue</span>
        <span>€{totalRevenue.toLocaleString()}</span>
      </footer>
    </div>
  );
};

export default RevenueBreakdownPresenter;
