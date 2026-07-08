/**
 * Booking Target Chart Presenter
 * Configurable chart interface mapping target data (CSV/profiles) with booking/time data
 * Allows sail/group selection and metric selection for Chart.js visualization
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useTheme } from '../../../contexts/ThemeContext';
import { getChartColors, getSeriesColors } from '../../../lib/chartConfig';
import { formatDayMon, formatDateTime } from '../../../lib/dateFormat';
import BookingGoalCallout from '../../shared/BookingGoalCallout';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import ReportDataDetails from '../../shared/ReportDataDetails';

Chart.register(...registerables);

const METRICS = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'guests', label: 'Guests' },
  { value: 'pctTarget', label: '% of Target' },
];

const CHART_TYPES = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
];

const BookingTargetChartPresenter = ({
  sailCode,
  setSailCode,
  sailCodes,
  bookingData,
  buildCurves,
  suppliedCurves,
  localProfileCurves,
  hasTargetData,
  bookingProfileDate,
  targetDataDate,
  loading,
  error,
  onRefresh,
  profiles,
  selectedProfileId,
  onSelectProfile,
  onSaveProfile,
  panelSaving,
  profileError,
  panelInstanceId,
  panelComponentId,
}) => {
  const { theme, fontSize, fontFamily } = useTheme();
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: panelComponentId || 'booking-target-chart',
  });

  const [metric, setMetric] = useState('bookings');
  const [chartType, setChartType] = useState('line');
  const [profileName, setProfileName] = useState('');
  const [editableCurves, setEditableCurves] = useState([]);

  const colors = theme?.colors || getChartColors();
  const seriesColors = getSeriesColors();

  const profileOptions = useMemo(() => profiles || [], [profiles]);
  const selectedProfile = useMemo(
    () => profileOptions.find((p) => p.id === selectedProfileId) || null,
    [profileOptions, selectedProfileId]
  );

  useEffect(() => {
    setProfileName(selectedProfile?.name || '');
  }, [selectedProfile?.name]);

  useEffect(() => {
    const sourceCurves = ((localProfileCurves?.length ? localProfileCurves : suppliedCurves) || []).map((curve) => ({
      weekLabel: curve.weekLabel || `W-${curve.weeksUntilSailing ?? 0}`,
      weeksUntilSailing: curve.weeksUntilSailing ?? 0,
      targetBookings: Number(curve.targetBookings ?? curve.bookings ?? 0),
      targetGuests: Number(curve.targetGuests ?? 0),
    }));
    setEditableCurves(sourceCurves);
  }, [localProfileCurves, suppliedCurves]);

  const labels = useMemo(() => {
    const set = new Set();
    (buildCurves || []).forEach((c) => set.add(c.weekLabel));
    (suppliedCurves || []).forEach((c) => set.add(c.weekLabel || `W-${c.weeksUntilSailing ?? 0}`));
    (editableCurves || []).forEach((c) => set.add(c.weekLabel || `W-${c.weeksUntilSailing ?? 0}`));
    return Array.from(set).sort((a, b) => {
      if (a === 'Sail') return 1;
      if (b === 'Sail') return -1;
      const na = parseInt(String(a).replace(/\D/g, ''), 10);
      const nb = parseInt(String(b).replace(/\D/g, ''), 10);
      return (nb || 0) - (na || 0);
    });
  }, [buildCurves, suppliedCurves, editableCurves]);

  const actualMap = useMemo(() => {
    const map = new Map();
    (buildCurves || []).forEach((c) => map.set(c.weekLabel, c));
    return map;
  }, [buildCurves]);

  const suppliedMap = useMemo(() => {
    const map = new Map();
    (suppliedCurves || []).forEach((c) => {
      const lbl = c.weekLabel || `W-${c.weeksUntilSailing ?? 0}`;
      map.set(lbl, c);
    });
    return map;
  }, [suppliedCurves]);

  const forecastMap = useMemo(() => {
    const map = new Map();
    (editableCurves || []).forEach((c) => {
      const lbl = c.weekLabel || `W-${c.weeksUntilSailing ?? 0}`;
      map.set(lbl, c);
    });
    return map;
  }, [editableCurves]);

  const seriesData = useMemo(() => {
    const pickActual = (label) => {
      const a = actualMap.get(label);
      if (!a) return null;
      if (metric === 'bookings') return a.bookings ?? 0;
      if (metric === 'guests') return a.guests ?? 0;
      if (metric === 'pctTarget') {
        if (a.percentageOfTarget != null) return a.percentageOfTarget;
        const fc = forecastMap.get(label);
        const denom = Number(fc?.targetBookings || 0);
        return denom > 0 ? Math.round(((a.bookings || 0) / denom) * 100) : null;
      }
      return a.bookings ?? 0;
    };

    const pickSupplied = (label) => {
      const s = suppliedMap.get(label);
      if (!s) return null;
      if (metric === 'bookings') return Number(s.targetBookings || 0);
      if (metric === 'guests') return Number(s.targetGuests || 0);
      return 100;
    };

    const pickForecast = (label) => {
      const f = forecastMap.get(label);
      if (!f) return null;
      if (metric === 'bookings') return Number(f.targetBookings || 0);
      if (metric === 'guests') return Number(f.targetGuests || 0);
      return 100;
    };

    return {
      actual: labels.map((l) => {
        const value = pickActual(l);
        if (value == null) return null;
        return metric === 'pctTarget' ? value : Math.max(0, value);
      }),
      supplied: labels.map((l) => {
        const value = pickSupplied(l);
        if (value == null) return null;
        return metric === 'pctTarget' ? value : Math.max(0, value);
      }),
      forecast: labels.map((l) => {
        const value = pickForecast(l);
        if (value == null) return null;
        return metric === 'pctTarget' ? value : Math.max(0, value);
      }),
    };
  }, [labels, actualMap, suppliedMap, forecastMap, metric]);

  const hasActualData = seriesData.actual.some((v) => v != null && v !== 0);
  const hasSuppliedData = seriesData.supplied.some((v) => v != null && v !== 0);
  const hasForecastData = seriesData.forecast.some((v) => v != null && v !== 0);

  useEffect(() => {
    if (!chartRef.current || !labels.length) return;

    const ctx = chartRef.current.getContext('2d');
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const datasets = [];

    if (hasActualData) {
      datasets.push({
        label: metric === 'pctTarget' ? '% of Target (Actual)' : `Actual ${metric === 'guests' ? 'Guests' : 'Bookings'}`,
        data: seriesData.actual,
        borderColor: seriesColors[0] || colors.accent || '#b08d57',
        backgroundColor: `${(seriesColors[0] || colors.accent || '#b08d57')}33`,
        tension: chartType === 'line' ? 0.4 : 0,
        cubicInterpolationMode: 'monotone',
        fill: chartType === 'line',
        pointRadius: chartType === 'line' ? 4 : 0,
        pointHoverRadius: 6,
      });
    }

    if (hasSuppliedData) {
      datasets.push({
        label: metric === 'pctTarget' ? 'Supplied Target (100%)' : `Supplied Target ${metric === 'guests' ? 'Guests' : 'Bookings'}`,
        data: seriesData.supplied,
        borderColor: seriesColors[1] || colors.glassAccent || '#64ffda',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        tension: chartType === 'line' ? 0.4 : 0,
        cubicInterpolationMode: 'monotone',
        fill: false,
        pointRadius: chartType === 'line' ? 3 : 0,
        pointHoverRadius: 5,
      });
    }

    if (hasForecastData) {
      datasets.push({
        label: metric === 'pctTarget' ? 'Forecast Target (100%)' : `Forecast Target ${metric === 'guests' ? 'Guests' : 'Bookings'}`,
        data: seriesData.forecast,
        borderColor: seriesColors[2] || '#ff9800',
        backgroundColor: 'transparent',
        borderDash: [],
        borderWidth: 3,
        tension: chartType === 'line' ? 0.3 : 0,
        cubicInterpolationMode: 'monotone',
        fill: false,
        pointRadius: chartType === 'line' ? 4 : 0,
        pointHoverRadius: 6,
      });
    }

    if (datasets.length === 0) return;

    const yAxisTitle =
      metric === 'pctTarget'
        ? '% of Target'
        : metric === 'guests'
          ? 'Guests'
          : 'Bookings';

    chartInstanceRef.current = new Chart(ctx, {
      type: chartType,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          legend: { position: 'top' },
          title: {
            display: false,
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => {
                const v = context.parsed.y ?? 0;
                const suffix = metric === 'pctTarget' ? '%' : '';
                return `${context.dataset.label}: ${typeof v === 'number' ? v.toLocaleString() : v}${suffix}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, minRotation: 45 },
          },
          y: {
            beginAtZero: metric !== 'pctTarget',
            title: { display: true, text: yAxisTitle },
            ticks: {
              callback: (v) =>
                metric === 'pctTarget' ? `${v}%` : (typeof v === 'number' ? v.toLocaleString() : v),
            },
          },
        },
        interaction: { mode: 'index', intersect: false },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [
    labels,
    seriesData,
    metric,
    chartType,
    sailCode,
    hasActualData,
    hasSuppliedData,
    hasForecastData,
    seriesColors,
    colors,
    fontSize,
    fontFamily,
  ]);

  const sailOptions = [
    ...new Set([
      ...(sailCode ? [sailCode] : []),
      ...(sailCodes || []),
    ]),
  ].sort();

  const subtitle = [
    sailCode || 'Select a sailing',
    bookingProfileDate ? `Profile: ${formatDayMon(bookingProfileDate, '')}` : null,
    targetDataDate ? `Target loaded: ${formatDateTime(targetDataDate)}` : null,
    bookingData?.daysUntilSailing != null ? `${bookingData.daysUntilSailing} days until sailing` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="focus-panel talia-report booking-target-chart" role="region" aria-label="Booking target chart">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Booking Target Chart</h2>
          <p className="talia-report__subtitle">{subtitle}</p>
        </div>
      </header>

      <BookingGoalCallout variant="LEGACY_CHART" />

      <div className="booking-target-chart__config talia-report-filters">
        <div className="booking-target-chart__config-row">
          <label className="booking-target-chart__label talia-report-filters__group">
            <span className="talia-report-filters__label">Sail / Group</span>
            <span className="booking-target-chart__sail-control">
              <input
                type="text"
                list="booking-target-chart-sail-list"
                className="talia-report-filters__input booking-target-chart__input"
                placeholder="e.g. CJ07250901"
                value={sailCode || ''}
                onChange={(e) => setSailCode(e.target.value?.trim() || null)}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                disabled={loading}
              />
              <datalist id="booking-target-chart-sail-list">
                {sailOptions.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </span>
          </label>

          <label className="booking-target-chart__label talia-report-filters__group">
            <span className="talia-report-filters__label">Metric</span>
            <select
              className="talia-report-filters__input booking-target-chart__select"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="booking-target-chart__label talia-report-filters__group">
            <span className="talia-report-filters__label">Chart type</span>
            <select
              className="talia-report-filters__input booking-target-chart__select"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
            >
              {CHART_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="booking-target-chart__label talia-report-filters__group">
            <span className="talia-report-filters__label">Local profile</span>
            <select
              className="talia-report-filters__input booking-target-chart__select"
              value={selectedProfileId || ''}
              onChange={(e) => onSelectProfile?.(e.target.value || null)}
            >
              <option value="">Use supplied target data</option>
              {profileOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {onRefresh ? (
        <div className="talia-report__actions-bar" aria-label="Booking target chart actions">
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      ) : null}

      <main className="talia-report__content">
        <ReportDataDetails visible={showDetails}>
          <div className="booking-target-chart__chart-wrap">
            {error ? (
              <div className="booking-target-chart__error-banner">
                {error?.message || String(error)}
              </div>
            ) : null}
            {loading ? (
              <div className="booking-target-chart__loading">Loading booking data…</div>
            ) : null}
            {!loading && !labels.length ? (
              <div className="focus-panel-empty">
                <p>
                  {!sailCode
                    ? 'Select a sailing from the table or dropdown to view the chart.'
                    : !hasActualData && !hasTargetData
                      ? `No booking or target data for ${sailCode}. Import targets via Data Management, or ensure booking profile is available.`
                      : 'No chart data available.'}
                </p>
              </div>
            ) : null}
            {!loading && labels.length > 0 ? (
              <div className="booking-target-chart__canvas">
                <canvas ref={chartRef} />
              </div>
            ) : null}
          </div>

          {bookingData && sailCode && !loading ? (
            <div className="booking-target-chart__summary">
              <span>
                {bookingData.shipName} • Sail: {formatDayMon(bookingData.sailDate, '')}
              </span>
            </div>
          ) : null}

          <div className="booking-target-chart__editor">
            <div className="booking-target-chart__editor-header">
              <span className="booking-target-chart__editor-title">Local profile editor</span>
              <span className="booking-target-chart__editor-subtitle">
                Edit target points and save to local Talia profile store
              </span>
            </div>
            <div className="booking-target-chart__editor-actions">
              <input
                className="booking-target-chart__input"
                placeholder="Profile name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <button
                type="button"
                className="talia-btn talia-btn--primary"
                disabled={profileSaving || !profileName || editableCurves.length === 0}
                onClick={() => onSaveProfile?.({ profileName: profileName.trim(), curves: editableCurves })}
              >
                {profileSaving ? 'Saving…' : 'Save local profile'}
              </button>
            </div>
            {profileError ? (
              <div className="booking-target-chart__error-banner">{profileError}</div>
            ) : null}
            {editableCurves.length > 0 ? (
              <div className="booking-target-chart__editor-table-wrap">
                <table className="booking-target-chart__editor-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Target bookings</th>
                      <th>Target guests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableCurves.map((row, idx) => (
                      <tr key={`${row.weekLabel}-${idx}`}>
                        <td>{row.weekLabel}</td>
                        <td>
                          <input
                            className="booking-target-chart__editor-number"
                            type="number"
                            value={row.targetBookings}
                            onChange={(e) => {
                              const next = [...editableCurves];
                              next[idx] = { ...next[idx], targetBookings: Number(e.target.value || 0) };
                              setEditableCurves(next);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="booking-target-chart__editor-number"
                            type="number"
                            value={row.targetGuests}
                            onChange={(e) => {
                              const next = [...editableCurves];
                              next[idx] = { ...next[idx], targetGuests: Number(e.target.value || 0) };
                              setEditableCurves(next);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="booking-target-chart__loading">No target points available to edit.</div>
            )}
          </div>
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default BookingTargetChartPresenter;
