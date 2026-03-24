/**
 * Booking Target Data (Simple)
 * Smoke-test component: only displays business TARGET data (CSV imported targets).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useBookingTargetChart } from '../../../hooks/data/useBookingTargetChart';
import BookingGoalCallout from '../../shared/BookingGoalCallout';

Chart.register(...registerables);

const BookingTargetDataSimple = () => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

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
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          title: { display: true, text: `Business Target Curve ${sailCode ? `- ${sailCode}` : ''}` },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [labels, data, sailCode]);

  const options = [...new Set([...(sailCode ? [sailCode] : []), ...(sailCodes || [])])];

  return (
    <div className="booking-simple">
      <BookingGoalCallout variant="TARGET" />
      <div className="booking-simple__toolbar">
        <input
          className="booking-simple__input"
          list="booking-target-simple-sails"
          value={sailCode || ''}
          placeholder="Enter/select sail code"
          onChange={(e) => setSailCode(e.target.value?.trim() || null)}
        />
        <datalist id="booking-target-simple-sails">
          {options.map((code) => (<option key={code} value={code} />))}
        </datalist>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={refetch} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {targetDataDate && (
          <span className="booking-simple__meta">Target Data Date: {targetDataDate}</span>
        )}
      </div>
      {error && <div className="booking-simple__error">{error?.message || String(error)}</div>}
      {!loading && labels.length === 0 ? (
        <div className="focus-panel-empty">No business target data available for this sail.</div>
      ) : (
        <div className="booking-simple__chart"><canvas ref={chartRef} /></div>
      )}
    </div>
  );
};

export default BookingTargetDataSimple;
