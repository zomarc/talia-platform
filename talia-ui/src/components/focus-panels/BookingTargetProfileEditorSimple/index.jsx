import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useBookingTargetChart } from '../../../hooks/data/useBookingTargetChart';
import { useInventoryProfileSeriesBySail } from '../../../hooks/data/useInventoryProfileSeriesBySail';
import BookingGoalCallout from '../../shared/BookingGoalCallout';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { applyAxisLabelVisibility, axisLabelsPluginOptions } from '../../../lib/chartConfig';
import ReportDataDetails from '../../shared/ReportDataDetails';
import {
  MAX_MODEL_BOOKINGS,
  MAX_MODEL_GUESTS,
  safeBookingInt,
} from '../../../lib/bookingProfileNumbers';
import BookingModelPointsTabulator from './BookingModelPointsTabulator';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { canEditTaliaIntel } from '../../../utils/roleUtils';

Chart.register(...registerables);
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';

const toWeekLabel = (row) => row.weekLabel || `W-${row.weeksUntilSailing ?? 0}`;

const labelSort = (a, b) => {
  if (a === 'Sail') return 1;
  if (b === 'Sail') return -1;
  const na = parseInt(String(a).replace(/\D/g, ''), 10);
  const nb = parseInt(String(b).replace(/\D/g, ''), 10);
  return (nb || 0) - (na || 0);
};

const mapTargetRow = (row) => ({
  weekLabel: toWeekLabel(row),
  weeksUntilSailing: row.weeksUntilSailing ?? 0,
  targetBookings: safeBookingInt(row.targetBookings ?? row.valueBookings ?? row.bookings ?? 0, MAX_MODEL_BOOKINGS),
  targetGuests: safeBookingInt(row.targetGuests ?? row.valueGuests ?? row.guests ?? 0, MAX_MODEL_GUESTS),
});

const DEFAULT_CONTROL_POINTS = [
  { weekLabel: 'W-12', weeksUntilSailing: 12 },
  { weekLabel: 'W-8', weeksUntilSailing: 8 },
  { weekLabel: 'W-4', weeksUntilSailing: 4 },
  { weekLabel: 'Sail', weeksUntilSailing: 0 },
];

const buildEditableRows = ({ labels, actualMap, suppliedMap, profileMap }) =>
  labels.map((label, index) => {
    const actual = actualMap.get(label);
    const supplied = suppliedMap.get(label);
    const existing = profileMap.get(label);
    const chosen = existing || supplied;
    return {
      pointOrder: index,
      weekLabel: label,
      weeksUntilSailing: chosen?.weeksUntilSailing ?? actual?.weeksUntilSailing ?? 0,
      actualBookings: safeBookingInt(actual?.bookings ?? 0, MAX_MODEL_BOOKINGS),
      actualGuests: safeBookingInt(actual?.guests ?? 0, MAX_MODEL_GUESTS),
      targetBookings: safeBookingInt(chosen?.targetBookings ?? 0, MAX_MODEL_BOOKINGS),
      targetGuests: safeBookingInt(chosen?.targetGuests ?? 0, MAX_MODEL_GUESTS),
    };
  });

const rowsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (
      left.weekLabel !== right.weekLabel ||
      left.weeksUntilSailing !== right.weeksUntilSailing ||
      left.actualBookings !== right.actualBookings ||
      left.actualGuests !== right.actualGuests ||
      left.targetBookings !== right.targetBookings ||
      left.targetGuests !== right.targetGuests
    ) {
      return false;
    }
  }
  return true;
};

const BookingTargetProfileEditorSimple = ({ panelInstanceId, panelComponentId }) => {
  const { showAxisLabels } = useReportShellOptions(
    panelComponentId || 'booking-target-profile-editor-simple',
    panelInstanceId
  );
  const [selectedProfileKey, setSelectedProfileKey] = useState('');
  const [profileName, setProfileName] = useState('');
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [chartCanvas, setChartCanvas] = useState(null);
  const [viewScope, setViewScope] = useState(() => (window.__taliaViewScope === 'wide' ? 'wide' : 'local'));
  const chartInstanceRef = useRef(null);
  const chartHostRef = useRef(null);
  const dragStateRef = useRef({ active: false, pointIndex: -1 });
  /** 'bookings' | 'guests' — vertical drag updates this field on the MODEL curve */
  const [dragMetric, setDragMetric] = useState('bookings');
  /** Data table/grid — header ≣ (same pattern as Competitor Pricing); unmounts entire section when hidden */
  const [showDataDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId,
  });

  const dragPendingRef = useRef(null);
  const dragRafRef = useRef(null);
  const isDraggingRef = useRef(false);

  const {
    sailCode,
    setSailCode,
    sailCodes,
    buildCurves,
    refetch,
    loading,
  } = useBookingTargetChart({
    useCentralStore: true,
    listenToSailEvents: true,
  });

  const {
    byKind,
    loading: unifiedLoading,
    error: unifiedError,
    refetch: refetchUnified,
    upsertModelSeries,
  } = useInventoryProfileSeriesBySail(sailCode);

  const { user } = useSupabaseAuth();
  const canEditIntel = canEditTaliaIntel(user?.role);

  useEffect(() => {
    const handleViewScope = (event) => {
      const next = event?.detail?.scope === 'wide' ? 'wide' : 'local';
      setViewScope(next);
    };
    window.addEventListener(DASHBOARD_VIEW_SCOPE_EVENT, handleViewScope);
    return () => window.removeEventListener(DASHBOARD_VIEW_SCOPE_EVENT, handleViewScope);
  }, []);

  /** Grow chart with panel when data table is hidden (same idea as competitor-scatter-grid--table-hidden). */
  useEffect(() => {
    const el = chartHostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const ch = chartInstanceRef.current;
      if (ch?.resize) requestAnimationFrame(() => ch.resize());
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [chartCanvas, showDataDetails]);

  useEffect(() => {
    const ch = chartInstanceRef.current;
    if (ch?.resize) requestAnimationFrame(() => ch.resize());
  }, [showDataDetails]);

  const modelOptions = useMemo(
    () => (byKind.MODEL || []).map((entry) => {
      const base = entry.modelLabel || entry.modelKey || 'MODEL';
      const systemOwned =
        String(entry.profileScope || '').toUpperCase() === 'SYSTEM'
        || String(entry.ownerKey || '').toLowerCase() === 'talia';
      return {
        key: entry.modelKey || 'default',
        label: systemOwned ? `${base} (Talia)` : base,
        points: entry.points || [],
      };
    }),
    [byKind]
  );

  useEffect(() => {
    if (!selectedProfileKey && modelOptions.length) {
      setSelectedProfileKey(modelOptions[0].key);
    }
  }, [selectedProfileKey, modelOptions]);

  const selectedModel = useMemo(
    () => modelOptions.find((m) => m.key === selectedProfileKey) || null,
    [modelOptions, selectedProfileKey]
  );

  const labels = useMemo(() => {
    const set = new Set();
    (buildCurves || []).forEach((row) => set.add(toWeekLabel(row)));
    (byKind.REAL?.points || []).forEach((row) => set.add(toWeekLabel(row)));
    (byKind.TARGET?.points || []).forEach((row) => set.add(toWeekLabel(row)));
    (byKind.BUDGET?.points || []).forEach((row) => set.add(toWeekLabel(row)));
    (selectedModel?.points || []).forEach((row) => set.add(toWeekLabel(row)));
    return Array.from(set).sort(labelSort);
  }, [buildCurves, byKind, selectedModel]);

  const actualMap = useMemo(() => {
    const map = new Map();
    if (viewScope === 'wide') {
      (byKind.REAL?.points || []).forEach((row) => {
        map.set(toWeekLabel(row), {
          weekLabel: toWeekLabel(row),
          weeksUntilSailing: row.weeksUntilSailing ?? 0,
          bookings: safeBookingInt(row.valueBookings ?? 0, MAX_MODEL_BOOKINGS),
          guests: safeBookingInt(row.valueGuests ?? 0, MAX_MODEL_GUESTS),
        });
      });
    } else {
      (byKind.REAL?.points || []).forEach((row) => {
        const label = toWeekLabel(row);
        map.set(label, {
          weekLabel: label,
          weeksUntilSailing: row.weeksUntilSailing ?? 0,
          bookings: safeBookingInt(row.valueBookings ?? 0, MAX_MODEL_BOOKINGS),
          guests: safeBookingInt(row.valueGuests ?? 0, MAX_MODEL_GUESTS),
        });
      });
      (buildCurves || []).forEach((row) => {
        const label = toWeekLabel(row);
        map.set(label, {
          weekLabel: label,
          weeksUntilSailing: row.weeksUntilSailing ?? 0,
          bookings: safeBookingInt(row.bookings ?? 0, MAX_MODEL_BOOKINGS),
          guests: safeBookingInt(row.guests ?? 0, MAX_MODEL_GUESTS),
        });
      });
    }
    return map;
  }, [buildCurves, byKind, viewScope]);

  const suppliedMap = useMemo(() => {
    const map = new Map();
    (byKind.TARGET?.points || []).forEach((row) => {
      map.set(toWeekLabel(row), mapTargetRow(row));
    });
    return map;
  }, [byKind]);

  const budgetMap = useMemo(() => {
    const map = new Map();
    (byKind.BUDGET?.points || []).forEach((row) => {
      map.set(toWeekLabel(row), mapTargetRow(row));
    });
    return map;
  }, [byKind]);

  const profileMap = useMemo(() => {
    const map = new Map();
    (selectedModel?.points || []).forEach((row) => {
      map.set(toWeekLabel(row), mapTargetRow(row));
    });
    return map;
  }, [selectedModel]);

  useEffect(() => {
    const nextRows = buildEditableRows({ labels, actualMap, suppliedMap, profileMap });
    setRows((prevRows) => (rowsEqual(prevRows, nextRows) ? prevRows : nextRows));
  }, [labels, actualMap, suppliedMap, profileMap]);

  const initializeControlPoints = () => {
    const seedCandidates = buildEditableRows({
      labels: DEFAULT_CONTROL_POINTS.map((p) => p.weekLabel),
      actualMap,
      suppliedMap,
      profileMap,
    });
    const seeded = seedCandidates.map((row) => {
      const fallbackActual = safeBookingInt(row.actualBookings || 0, MAX_MODEL_BOOKINGS);
      const fallbackGuests = safeBookingInt(row.actualGuests || 0, MAX_MODEL_GUESTS);
      return {
        ...row,
        weeksUntilSailing: DEFAULT_CONTROL_POINTS.find((p) => p.weekLabel === row.weekLabel)?.weeksUntilSailing ?? row.weeksUntilSailing,
        targetBookings: row.targetBookings > 0 ? row.targetBookings : fallbackActual,
        targetGuests: row.targetGuests > 0 ? row.targetGuests : fallbackGuests,
      };
    });
    setRows(seeded);
    setStatusMessage('Initialized editable control points for MODEL.');
  };

  useEffect(() => {
    setProfileName(selectedModel?.label || '');
  }, [selectedModel]);

  const chartYAxisMax = useMemo(() => {
    let m = 10;
    const bump = (v, cap) => {
      const x = safeBookingInt(v, cap);
      if (x > 0) m = Math.max(m, x);
    };
    labels.forEach((label) => {
      const a = actualMap.get(label);
      if (a) {
        bump(a.bookings, MAX_MODEL_BOOKINGS);
        bump(a.guests, MAX_MODEL_GUESTS);
      }
      const b = budgetMap.get(label);
      if (b) bump(b.targetBookings, MAX_MODEL_BOOKINGS);
      const row = rows.find((r) => r.weekLabel === label);
      if (row) {
        bump(row.targetBookings, MAX_MODEL_BOOKINGS);
        bump(row.targetGuests, MAX_MODEL_GUESTS);
      }
    });
    return Math.max(20, Math.ceil(m * 1.12));
  }, [labels, actualMap, budgetMap, rows]);

  /** Pixel-distance hit test — Chart.js "intersect" hit areas are too small for comfortable dragging */
  const MODEL_HIT_RADIUS_PX = 36;

  const getModelPointIndexFromEvent = (chart, nativeEvent) => {
    const meta = chart.getDatasetMeta(2);
    if (!meta?.data?.length) return -1;
    const rect = chart.canvas.getBoundingClientRect();
    const mx = nativeEvent.clientX - rect.left;
    const my = nativeEvent.clientY - rect.top;
    let best = -1;
    let bestD = Infinity;
    meta.data.forEach((el, i) => {
      if (!el || el.skip) return;
      const { x, y } = el.getProps(['x', 'y'], true);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const d = Math.hypot(mx - x, my - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0 && bestD <= MODEL_HIT_RADIUS_PX) return best;
    return -1;
  };

  useEffect(() => {
    if (!chartCanvas || labels.length === 0) return undefined;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const actualData = labels.map((label) => actualMap.get(label)?.bookings ?? null);
    const budgetData = labels.map((label) => {
      const row = budgetMap.get(label);
      return row ? safeBookingInt(row.targetBookings || 0, MAX_MODEL_BOOKINGS) : null;
    });
    // Seed with zeros; sync effect below applies `rows` without recreating the chart (so drag stays smooth).
    const targetData = labels.map(() => 0);
    const chart = new Chart(chartCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'REAL (Current)',
            data: actualData,
            borderColor: '#b08d57',
            backgroundColor: 'rgba(176,141,87,0.2)',
            fill: true,
            pointRadius: 3,
            tension: 0.3,
            cubicInterpolationMode: 'monotone',
          },
          {
            label: 'BUDGET (External)',
            data: budgetData,
            borderColor: '#e91e63',
            backgroundColor: 'transparent',
            fill: false,
            borderWidth: 2,
            borderDash: [2, 4],
            pointRadius: 2,
            tension: 0.25,
            cubicInterpolationMode: 'monotone',
          },
          {
            label: dragMetric === 'guests' ? 'MODEL — drag points (guests)' : 'MODEL — drag points (bookings)',
            data: targetData,
            borderColor: '#ff9800',
            backgroundColor: 'rgba(255, 152, 0, 0.15)',
            fill: false,
            borderWidth: 3,
            pointRadius: 8,
            pointHoverRadius: 10,
            pointHitRadius: MODEL_HIT_RADIUS_PX,
            pointBackgroundColor: '#ff9800',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0.2,
            cubicInterpolationMode: 'monotone',
          },
        ],
      },
      options: applyAxisLabelVisibility({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false, axis: 'xy' },
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
            max: chartYAxisMax,
            ticks: {
              precision: 0,
              callback: (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString() : ''),
            },
          },
        },
        plugins: {
          ...axisLabelsPluginOptions(showAxisLabels),
          title: {
            display: true,
            text: `Drag orange points — ${sailCode || 'select sail'} (${dragMetric})`,
          },
          tooltip: { enabled: true },
        },
      }, showAxisLabels),
    });
    chartInstanceRef.current = chart;

    const yToValue = (nativeEvent) => {
      const scale = chart.scales?.y;
      if (!scale) return null;
      const rect = chartCanvas.getBoundingClientRect();
      const pixelY = nativeEvent.clientY - rect.top;
      const value = scale.getValueForPixel(pixelY);
      if (!Number.isFinite(value)) return null;
      const cap = dragMetric === 'guests' ? MAX_MODEL_GUESTS : MAX_MODEL_BOOKINGS;
      return safeBookingInt(value, cap);
    };

    const setCursorFromHover = (nativeEvent) => {
      if (!canEditIntel) {
        chartCanvas.style.cursor = 'default';
        return;
      }
      if (dragStateRef.current.active) {
        chartCanvas.style.cursor = 'grabbing';
        return;
      }
      const idx = getModelPointIndexFromEvent(chart, nativeEvent);
      chartCanvas.style.cursor = idx >= 0 ? 'grab' : 'default';
    };

    const flushDragRow = () => {
      dragRafRef.current = null;
      const p = dragPendingRef.current;
      dragPendingRef.current = null;
      if (!p) return;
      setRows((prev) => prev.map((row) => (
        row.weekLabel === p.label ? { ...row, [p.key]: p.value } : row
      )));
    };

    const beginDrag = (nativeEvent) => {
      if (!canEditIntel) return false;
      const idx = getModelPointIndexFromEvent(chart, nativeEvent);
      if (idx < 0) return false;
      dragStateRef.current = { active: true, pointIndex: idx };
      isDraggingRef.current = true;
      chartCanvas.style.cursor = 'grabbing';
      nativeEvent.preventDefault();
      if (chart.options?.plugins?.tooltip) {
        chart.options.plugins.tooltip.enabled = false;
        chart.update('none');
      }
      return true;
    };

    const moveDrag = (nativeEvent) => {
      if (!dragStateRef.current.active) return;
      const value = yToValue(nativeEvent);
      if (value == null) return;
      const label = labels[dragStateRef.current.pointIndex];
      if (!label) return;
      const key = dragMetric === 'guests' ? 'targetGuests' : 'targetBookings';
      dragPendingRef.current = { label, key, value };
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(flushDragRow);
      }
    };

    const stopDrag = () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      flushDragRow();
      if (dragStateRef.current.active) {
        dragStateRef.current = { active: false, pointIndex: -1 };
      }
      isDraggingRef.current = false;
      const ch = chartInstanceRef.current;
      if (ch?.options?.plugins?.tooltip) {
        ch.options.plugins.tooltip.enabled = true;
        ch.update('none');
      }
      chartCanvas.style.cursor = 'default';
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
    };

    const onWindowMove = (e) => moveDrag(e);
    const onWindowUp = () => stopDrag();

    const onWindowTouchMove = (e) => {
      if (dragStateRef.current.active) e.preventDefault();
      if (e.touches?.[0]) moveDrag(e.touches[0]);
    };
    const onWindowTouchEnd = () => stopDrag();

    const onMouseDown = (event) => {
      if (!beginDrag(event)) return;
      window.addEventListener('mousemove', onWindowMove);
      window.addEventListener('mouseup', onWindowUp);
    };

    const onMouseMove = (event) => {
      setCursorFromHover(event);
      moveDrag(event);
    };

    const onMouseUp = () => stopDrag();

    const onTouchStart = (event) => {
      const t = event.touches?.[0];
      if (!t) return;
      if (!beginDrag(t)) return;
      window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
      window.addEventListener('touchend', onWindowTouchEnd);
      window.addEventListener('touchcancel', onWindowTouchEnd);
    };

    const onTouchMove = (event) => {
      const t = event.touches?.[0];
      if (t) setCursorFromHover(t);
    };

    chartCanvas.addEventListener('mousedown', onMouseDown);
    chartCanvas.addEventListener('mousemove', onMouseMove);
    chartCanvas.addEventListener('mouseup', onMouseUp);
    chartCanvas.addEventListener('mouseleave', (e) => {
      if (!dragStateRef.current.active) setCursorFromHover(e);
    });
    chartCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
    chartCanvas.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
      chartCanvas.removeEventListener('mousedown', onMouseDown);
      chartCanvas.removeEventListener('mousemove', onMouseMove);
      chartCanvas.removeEventListener('mouseup', onMouseUp);
      chartCanvas.removeEventListener('touchstart', onTouchStart);
      chartCanvas.removeEventListener('touchmove', onTouchMove);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [chartCanvas, labels, actualMap, budgetMap, sailCode, dragMetric, chartYAxisMax, canEditIntel, showAxisLabels]);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    const actualData = labels.map((label) => actualMap.get(label)?.bookings ?? null);
    const targetData = labels.map((label) => {
      const row = rows.find((r) => r.weekLabel === label);
      if (!row) return 0;
      return dragMetric === 'guests'
        ? safeBookingInt(row.targetGuests, MAX_MODEL_GUESTS)
        : safeBookingInt(row.targetBookings, MAX_MODEL_BOOKINGS);
    });
    const budgetData = labels.map((label) => {
      const row = budgetMap.get(label);
      return row ? safeBookingInt(row.targetBookings || 0, MAX_MODEL_BOOKINGS) : null;
    });
    chart.data.labels = labels;
    if (chart.data.datasets[0]) chart.data.datasets[0].data = actualData;
    if (chart.data.datasets[1]) chart.data.datasets[1].data = budgetData;
    if (chart.data.datasets[2]) {
      chart.data.datasets[2].data = targetData;
      chart.data.datasets[2].label = dragMetric === 'guests'
        ? 'MODEL — drag points (guests)'
        : 'MODEL — drag points (bookings)';
    }
    if (chart.options?.plugins?.title) {
      chart.options.plugins.title.text = `Drag orange points — ${sailCode || 'select sail'} (${dragMetric})`;
    }
    if (chart.options?.scales?.y) {
      chart.options.scales.y.max = chartYAxisMax;
    }
    chart.update('none');
  }, [labels, actualMap, budgetMap, rows, dragMetric, sailCode, chartYAxisMax]);

  const sailOptions = [...new Set([...(sailCode ? [sailCode] : []), ...(sailCodes || [])])];

  const updateRow = (index, key, value) => {
    const cap = key === 'targetGuests' ? MAX_MODEL_GUESTS : MAX_MODEL_BOOKINGS;
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: safeBookingInt(value, cap) };
      return next;
    });
  };

  const seedFromReal = () => {
    setRows((prev) => prev.map((row) => ({
      ...row,
      targetBookings: safeBookingInt(row.actualBookings || 0, MAX_MODEL_BOOKINGS),
      targetGuests: safeBookingInt(row.actualGuests || 0, MAX_MODEL_GUESTS),
    })));
  };

  const saveProfile = async () => {
    if (!profileName.trim()) return;
    setSaving(true);
    setSaveError(null);
    setStatusMessage('');
    try {
      await upsertModelSeries({
        modelKey: selectedProfileKey || `model-${profileName.trim().toLowerCase().replace(/\s+/g, '-')}`,
        modelLabel: profileName.trim(),
        points: rows.map((row) => ({
          pointOrder: row.pointOrder,
          weekLabel: row.weekLabel,
          weeksUntilSailing: row.weeksUntilSailing ?? 0,
          valueBookings: safeBookingInt(row.targetBookings || 0, MAX_MODEL_BOOKINGS),
          valueGuests: safeBookingInt(row.targetGuests || 0, MAX_MODEL_GUESTS),
        })),
      });
      await refetchUnified();
      setStatusMessage(selectedProfileKey ? 'MODEL series updated.' : 'MODEL series created.');
    } catch (error) {
      let msg = error?.message || 'Failed to save target profile';
      if (/inventory_item_profile_curve_point|schema cache|relation.*does not exist/i.test(msg)) {
        msg += ' Apply DB migration `talia-server/supabase/migrations/20260322113000_create_inventory_item_profile_curve_point.sql` to your Supabase project (e.g. `supabase db push`), then retry.';
      }
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="focus-panel talia-report booking-simple booking-profile-editor-simple" role="region" aria-label="Booking target profile editor">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Booking Target Profile Editor</h2>
          <p className="talia-report__subtitle">
            Sail: {sailCode || 'None'} • {rows.length} model points
          </p>
        </div>
      </header>
      <BookingGoalCallout variant="MODEL" />
      {!canEditIntel && (
        <div className="booking-simple__error booking-profile-editor-simple__read-only talia-callout" role="status">
          <strong>View only.</strong> REAL / TARGET / BUDGET / MODEL intelligence is owned by the Talia system (<code>talia</code>).
          Your role can explore curves; only <strong>Manager+</strong> or <strong>Super User</strong> can save changes.
        </div>
      )}
      <div className="booking-simple__toolbar talia-report-filters">
        <input
          className="booking-simple__input"
          list="booking-profile-editor-simple-sails"
          value={sailCode || ''}
          placeholder="Enter/select sail code"
          onChange={(e) => setSailCode(e.target.value?.trim() || null)}
        />
        <datalist id="booking-profile-editor-simple-sails">
          {sailOptions.map((code) => (<option key={code} value={code} />))}
        </datalist>

        <select
          className="booking-simple__select"
          value={selectedProfileKey}
          onChange={(e) => setSelectedProfileKey(e.target.value)}
        >
          <option value="">New MODEL series</option>
          {modelOptions.map((model) => (<option key={model.key} value={model.key}>{model.label}</option>))}
        </select>

        <input
          className="booking-simple__input talia-report-filters__input"
          value={profileName}
          placeholder="Profile name"
          onChange={(e) => setProfileName(e.target.value)}
          disabled={!canEditIntel}
        />
      </div>

      <div className="talia-report__actions-bar" aria-label="Booking target profile editor actions">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={() => { refetch(); refetchUnified(); }} disabled={loading || unifiedLoading}>
          {(loading || unifiedLoading) ? 'Loading…' : 'Refresh Data'}
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={seedFromReal} disabled={!canEditIntel}>
          Seed from REAL
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--primary"
          onClick={saveProfile}
          disabled={saving || !profileName.trim() || rows.length === 0 || !canEditIntel}
        >
          {saving ? 'Saving…' : selectedProfileKey ? 'Update MODEL' : 'Create MODEL'}
        </button>
      </div>

      {(saveError || unifiedError) && (
        <div className="booking-simple__error">
          {saveError || unifiedError?.message}
          {!saveError && unifiedError?.message && /inventory_item_profile_curve_point|schema cache/i.test(unifiedError.message) ? (
            <span> Apply migration `20260322113000_create_inventory_item_profile_curve_point.sql` to Supabase, then refresh.</span>
          ) : null}
        </div>
      )}
      {!saveError && !unifiedError && rows.length === 0 && (
        <div className="booking-simple__error">
          No profile points available for this sail under current Global Criteria. Initialize control points or select a sail with booking data.
        </div>
      )}
      {statusMessage && <div className="booking-profile-editor-simple__status">{statusMessage}</div>}
      <div className="booking-profile-editor-simple__hint booking-profile-editor-simple__hint--drag talia-callout">
        <span>
          {canEditIntel ? (
            <>
              <strong>Drag the orange points</strong> vertically on the chart (large grab area). Release can be outside the chart. Touch: drag on tablet/phone.
            </>
          ) : (
            <>
              <strong>View only:</strong> orange curve shows Talia MODEL; dragging and table edits are disabled for your role.
            </>
          )}
        </span>
        <label className="booking-profile-editor-simple__drag-metric">
          <span>Drag adjusts:</span>
          <select
            value={dragMetric}
            onChange={(e) => setDragMetric(e.target.value === 'guests' ? 'guests' : 'bookings')}
            disabled={!canEditIntel}
            aria-label="Choose whether dragging points edits bookings or guests"
          >
            <option value="bookings">Bookings (MODEL)</option>
            <option value="guests">Guests (MODEL)</option>
          </select>
        </label>
        <span className="booking-profile-editor-simple__scope">
          Scope: {viewScope === 'wide' ? 'Wide (time dependent)' : 'Local (direct sail)'}. REAL = booking build curve + Talia REAL series when present.
        </span>
        <span className="booking-profile-editor-simple__scope">
          <strong>Data table:</strong> header <strong>≣</strong> shows or hides the point grid (entire block, like other reports). Tab <strong>ⓘ</strong> is technical info only.
        </span>
      </div>
      {rows.length === 0 && (
        <div className="booking-profile-editor-simple__hint talia-callout">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={initializeControlPoints} disabled={!canEditIntel}>
            Initialize Control Points
          </button>
        </div>
      )}

      <main className="talia-report__content">
        <div
          ref={chartHostRef}
          className={`booking-profile-editor-simple__chart-host ${showDataDetails ? '' : 'booking-profile-editor-simple__chart-host--grow'}`}
        >
          <div className="booking-profile-editor-simple__chart">
            <canvas ref={setChartCanvas} />
          </div>
        </div>

        <ReportDataDetails
        visible={showDataDetails}
        as="section"
        className="booking-profile-editor-simple__table-section"
        aria-label={`MODEL point values, ${rows.length} week${rows.length === 1 ? '' : 's'}`}
      >
        <div className="booking-profile-editor-simple__table-section-heading">
          <h3 className="booking-profile-editor-simple__table-section-title">Point values</h3>
          <span className="booking-profile-editor-simple__table-section-meta">
            {rows.length} week{rows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="booking-profile-editor-simple__table-wrap">
          <BookingModelPointsTabulator
            rows={rows}
            canEdit={canEditIntel}
            onUpdateCell={(idx, field, value) => updateRow(idx, field, value)}
          />
        </div>
      </ReportDataDetails>
      </main>
    </div>
  );
};

export default BookingTargetProfileEditorSimple;
