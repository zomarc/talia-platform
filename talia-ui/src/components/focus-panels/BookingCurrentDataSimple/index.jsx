/**
 * Booking Current Data (Simple)
 * Smoke-test component: only displays REAL/current booking build curve data.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useBookingTargetChart } from '../../../hooks/data/useBookingTargetChart';
import BookingGoalCallout from '../../shared/BookingGoalCallout';

Chart.register(...registerables);

const BookingCurrentDataSimple = () => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const {
    sailCode,
    setSailCode,
    buildCurves,
    bookingProfileDate,
    loading,
    error,
    refetch,
  } = useBookingTargetChart({
    useCentralStore: false,
    listenToSailEvents: true,
  });

  const labels = useMemo(() => (buildCurves || []).map((p) => p.weekLabel), [buildCurves]);
  const data = useMemo(() => (buildCurves || []).map((p) => p.bookings ?? 0), [buildCurves]);

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
            label: 'REAL (Current Bookings)',
            data,
            borderColor: '#b08d57',
            backgroundColor: 'rgba(176, 141, 87, 0.2)',
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          title: { display: true, text: `Current Booking Profile ${sailCode ? `- ${sailCode}` : ''}` },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [labels, data, sailCode]);

  return (
    <div className="booking-simple">
      <BookingGoalCallout variant="REAL_SIMPLE" />
      <div className="booking-simple__toolbar">
        <input
          className="booking-simple__input"
          value={sailCode || ''}
          placeholder="Enter sail code"
          onChange={(e) => setSailCode(e.target.value?.trim() || null)}
        />
        <button type="button" className="talia-btn talia-btn--secondary" onClick={refetch} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {bookingProfileDate && (
          <span className="booking-simple__meta">Profile Date: {bookingProfileDate}</span>
        )}
      </div>
      {error && <div className="booking-simple__error">{error?.message || String(error)}</div>}
      {!loading && labels.length === 0 ? (
        <div className="focus-panel-empty">No current booking curve data.</div>
      ) : (
        <div className="booking-simple__chart"><canvas ref={chartRef} /></div>
      )}
    </div>
  );
};

export default BookingCurrentDataSimple;
