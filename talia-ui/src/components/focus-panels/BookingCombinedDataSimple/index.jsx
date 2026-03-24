/**
 * Booking Combined Data (Simple)
 * Smoke-test component: combines REAL + TARGET + MODEL(forecast) safely.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useBookingTargetChart } from '../../../hooks/data/useBookingTargetChart';
import { useInventoryProfileSeriesBySail } from '../../../hooks/data/useInventoryProfileSeriesBySail';
import BookingGoalCallout from '../../shared/BookingGoalCallout';

Chart.register(...registerables);
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';

const sortLabels = (labels) => labels.sort((a, b) => {
  if (a === 'Sail') return 1;
  if (b === 'Sail') return -1;
  const na = parseInt(String(a).replace(/\D/g, ''), 10);
  const nb = parseInt(String(b).replace(/\D/g, ''), 10);
  return (nb || 0) - (na || 0);
});

const BookingCombinedDataSimple = () => {
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [viewScope, setViewScope] = useState(() => (window.__taliaViewScope === 'wide' ? 'wide' : 'local'));
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const {
    sailCode,
    setSailCode,
    sailCodes,
    buildCurves,
    bookingProfileDate,
    targetDataDate,
    loading,
    error,
    refetch,
  } = useBookingTargetChart({
    useCentralStore: true,
    listenToSailEvents: true,
  });

  const {
    byKind,
    loading: unifiedLoading,
    error: unifiedError,
    refetch: refetchUnified,
  } = useInventoryProfileSeriesBySail(sailCode);

  useEffect(() => {
    const handleViewScope = (event) => {
      const next = event?.detail?.scope === 'wide' ? 'wide' : 'local';
      setViewScope(next);
    };
    window.addEventListener(DASHBOARD_VIEW_SCOPE_EVENT, handleViewScope);
    return () => window.removeEventListener(DASHBOARD_VIEW_SCOPE_EVENT, handleViewScope);
  }, []);

  const modelOptions = useMemo(
    () => (byKind.MODEL || []).map((entry) => ({
      id: entry.modelKey || entry.modelLabel || 'default',
      label: entry.modelLabel || entry.modelKey || 'MODEL',
      points: entry.points || [],
    })),
    [byKind]
  );

  useEffect(() => {
    if (!selectedProfileId && modelOptions.length) {
      setSelectedProfileId(modelOptions[0].id);
    }
  }, [modelOptions, selectedProfileId]);

  const selectedModel = useMemo(
    () => modelOptions.find((option) => option.id === selectedProfileId) || null,
    [modelOptions, selectedProfileId]
  );

  const labels = useMemo(() => {
    const set = new Set();
    (buildCurves || []).forEach((p) => set.add(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`));
    (byKind.REAL?.points || []).forEach((p) => set.add(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`));
    (byKind.TARGET?.points || []).forEach((p) => set.add(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`));
    (byKind.BUDGET?.points || []).forEach((p) => set.add(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`));
    (selectedModel?.points || []).forEach((p) => set.add(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`));
    return sortLabels(Array.from(set));
  }, [buildCurves, byKind, selectedModel]);

  const actualMap = useMemo(() => {
    const m = new Map();
    if (viewScope === 'wide') {
      (byKind.REAL?.points || []).forEach((p) => {
        m.set(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`, Math.max(0, Number(p.valueBookings ?? 0)));
      });
    } else {
      (buildCurves || []).forEach((p) => {
        m.set(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`, Math.max(0, Number(p.bookings ?? 0)));
      });
    }
    return m;
  }, [byKind, buildCurves, viewScope]);

  const targetMap = useMemo(() => {
    const m = new Map();
    (byKind.TARGET?.points || []).forEach((p) => {
      m.set(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`, Math.max(0, Number(p.valueBookings ?? 0)));
    });
    return m;
  }, [byKind]);

  const budgetMap = useMemo(() => {
    const m = new Map();
    (byKind.BUDGET?.points || []).forEach((p) => {
      m.set(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`, Math.max(0, Number(p.valueBookings ?? 0)));
    });
    return m;
  }, [byKind]);

  const modelMap = useMemo(() => {
    const m = new Map();
    (selectedModel?.points || []).forEach((p) => {
      m.set(p.weekLabel || `W-${p.weeksUntilSailing ?? 0}`, Math.max(0, Number(p.valueBookings ?? 0)));
    });
    return m;
  }, [selectedModel]);

  const actualData = useMemo(() => labels.map((l) => actualMap.get(l) ?? null), [labels, actualMap]);
  const targetData = useMemo(() => labels.map((l) => targetMap.get(l) ?? null), [labels, targetMap]);
  const budgetData = useMemo(() => labels.map((l) => budgetMap.get(l) ?? null), [labels, budgetMap]);
  const modelData = useMemo(() => labels.map((l) => modelMap.get(l) ?? null), [labels, modelMap]);

  useEffect(() => {
    if (!chartRef.current || labels.length === 0) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const datasets = [];
    if (actualData.some((v) => v != null)) {
      datasets.push({
        label: 'REAL',
        data: actualData,
        borderColor: '#b08d57',
        backgroundColor: 'rgba(176,141,87,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
      });
    }
    if (targetData.some((v) => v != null)) {
      datasets.push({
        label: 'TARGET',
        data: targetData,
        borderColor: '#64ffda',
        borderDash: [6, 4],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        cubicInterpolationMode: 'monotone',
        pointRadius: 3,
      });
    }
    if (budgetData.some((v) => v != null)) {
      datasets.push({
        label: 'BUDGET',
        data: budgetData,
        borderColor: '#e91e63',
        backgroundColor: 'transparent',
        borderDash: [2, 4],
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        cubicInterpolationMode: 'monotone',
        pointRadius: 2,
      });
    }
    if (modelData.some((v) => v != null)) {
      datasets.push({
        label: 'MODEL',
        data: modelData,
        borderColor: '#ff9800',
        backgroundColor: 'transparent',
        borderWidth: 3,
        fill: false,
        tension: 0.25,
        cubicInterpolationMode: 'monotone',
        pointRadius: 4,
      });
    }

    if (datasets.length === 0) return;

    chartInstanceRef.current = new Chart(chartRef.current.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { title: { display: true, text: `Combined REAL/TARGET/BUDGET/MODEL ${sailCode ? `- ${sailCode}` : ''}` } },
      },
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [labels, actualData, targetData, budgetData, modelData, sailCode]);

  const sailOptions = [...new Set([...(sailCode ? [sailCode] : []), ...(sailCodes || [])])];

  return (
    <div className="booking-simple">
      <BookingGoalCallout variant="COMBINED" />
      <div className="booking-simple__toolbar">
        <input
          className="booking-simple__input"
          list="booking-combined-simple-sails"
          value={sailCode || ''}
          placeholder="Enter/select sail code"
          onChange={(e) => setSailCode(e.target.value?.trim() || null)}
        />
        <datalist id="booking-combined-simple-sails">
          {sailOptions.map((code) => (<option key={code} value={code} />))}
        </datalist>

        <select
          className="booking-simple__select"
          value={selectedProfileId || ''}
          onChange={(e) => setSelectedProfileId(e.target.value || null)}
        >
          <option value="">No MODEL profile</option>
          {modelOptions.map((model) => (<option key={model.id} value={model.id}>{model.label}</option>))}
        </select>

        <button type="button" className="talia-btn talia-btn--secondary" onClick={() => { refetch(); refetchUnified(); }} disabled={loading || unifiedLoading}>
          {(loading || unifiedLoading) ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="booking-simple__meta-row">
        {bookingProfileDate && <span>REAL date: {bookingProfileDate}</span>}
        {targetDataDate && <span>TARGET date: {targetDataDate}</span>}
        {selectedProfileId && <span>MODEL: selected</span>}
        {byKind.BUDGET?.points?.length ? <span>BUDGET: loaded</span> : null}
        <span>Scope: {viewScope === 'wide' ? 'Wide (time dependent)' : 'Local (direct sail)'}</span>
      </div>

      {(error || unifiedError) && <div className="booking-simple__error">{error?.message || unifiedError?.message || String(error || unifiedError)}</div>}
      {!error && !unifiedError && labels.length === 0 && (
        <div className="booking-simple__error">
          No overlay points available for this sail under current Global Criteria. Select another sail or broaden criteria.
        </div>
      )}
      {!(loading || unifiedLoading) && labels.length === 0 ? (
        <div className="focus-panel-empty">No combined data available for this sail.</div>
      ) : (
        <div className="booking-simple__chart"><canvas ref={chartRef} /></div>
      )}
    </div>
  );
};

export default BookingCombinedDataSimple;
