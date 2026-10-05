/**
 * Booking Target Data (Simple)
 * Smoke-test component: only displays business TARGET data (CSV imported targets).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useBookingTargetChart } from '../../../hooks/data/useBookingTargetChart';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { applyAxisLabelVisibility, axisLabelsPluginOptions } from '../../../lib/chartConfig';
import BookingGoalCallout from '../../shared/BookingGoalCallout';

Chart.register(...registerables);

const BookingTargetDataSimple = ({ panelInstanceId, panelComponentId }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const { showAxisLabels } = useReportShellOptions(
    panelComponentId || 'booking-target-data-simple',
    panelInstanceId
  );

  const {
    sailCode,
    setSailCode,
    sailCodes,
    suppliedCurves,
    targetDataDate,
    loading,
    error,
    refetch,
  } = useBookingTargetChart({
    useCentralStore: true,
    listenToSailEvents: true,
  });

  const labels = useMemo(
    () => (suppliedCurves || []).map((p) => p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`),
    [suppliedCurves]
  );
  const data = useMemo(() => (suppliedCurves || []).map((p) => p.targetBookings ?? 0), [suppliedCurves]);

  useEffect(() => {
    if (!chartRef.current || labels.length === 0) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    chartInstanceRef.current = new Chart(chartRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'TARGET (Business Provided)',
            data,
            borderColor: '#64ffda',
            backgroundColor: 'rgba(100,255,218,0.12)',
            borderDash: [6, 4],
            tension: 0.25,
            fill: false,
            pointRadius: 3,
          },
        ],
      },
      options: applyAxisLabelVisibility({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          ...axisLabelsPluginOptions(showAxisLabels),
          title: { display: false },
        },
      }, showAxisLabels),
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [labels, data, sailCode, showAxisLabels]);

  const options = [...new Set([...(sailCode ? [sailCode] : []), ...(sailCodes || [])])];
  const subtitle = [
    sailCode || 'No sail selected',
    targetDataDate ? `Target date: ${targetDataDate}` : null,
    `${labels.length} weeks`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="focus-panel talia-report booking-simple" role="region" aria-label="Target booking data">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">TARGET Only (Business Provided)</h2>
          <p className="talia-report__subtitle">{subtitle}</p>
        </div>
      </header>

      <BookingGoalCallout variant="TARGET" />

      <div className="booking-simple__toolbar talia-report-filters">
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Sail code</span>
          <input
            className="talia-report-filters__input booking-simple__input"
            list="booking-target-simple-sails"
            value={sailCode || ''}
            placeholder="Enter/select sail code"
            onChange={(e) => setSailCode(e.target.value?.trim() || null)}
          />
          <datalist id="booking-target-simple-sails">
            {options.map((code) => (<option key={code} value={code} />))}
          </datalist>
        </label>
      </div>

      <div className="talia-report__actions-bar" aria-label="Target booking data actions">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={refetch} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="booking-simple__error">{error?.message || String(error)}</div> : null}

      <main className="talia-report__content">
        {!loading && labels.length === 0 ? (
          <div className="focus-panel-empty">No business target data available for this sail.</div>
        ) : (
          <div className="booking-simple__chart"><canvas ref={chartRef} /></div>
        )}
      </main>
    </div>
  );
};

export default BookingTargetDataSimple;
