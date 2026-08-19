/**
 * Graphical target-profile editor: drag existing LF% waypoints.
 * Shift-click adds a week; double-click removes. Default is move, not add.
 */

import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { getRelativePosition } from 'chart.js/helpers';
import { useTheme } from '../../../contexts/ThemeContext';
import { getOverlayLegendOptions } from '../../../lib/chartConfig';

Chart.register(...registerables);

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const clampLf = (n) => Math.max(0, Math.min(110, round1(n)));

const weekLabel = (w) => (Number(w) === 0 ? 'Sail' : `W-${w}`);

const lfAt = (series, week) => {
  const hit = (series || []).find((p) => Number(p.weeksUntilSailing) === Number(week));
  return hit?.lfPct != null ? Number(hit.lfPct) : null;
};

const TargetProfileCurveEditor = ({
  weekNodes = [],
  realSeries = [],
  modelSeries = [],
  showLegends = true,
  onChangeLf,
  onMovePoint,
  onAddPoint,
  onRemovePoint,
}) => {
  const { fontSize, fontFamily, chartLegendsVisible } = useTheme();
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const dragRef = useRef({ active: false, index: -1, nodeIndex: -1, moved: false });
  const pendingRef = useRef(null);
  const rafRef = useRef(null);
  const lastDragAtRef = useRef(0);
  const nodesRef = useRef(weekNodes);
  const callbacksRef = useRef({ onChangeLf, onMovePoint, onAddPoint, onRemovePoint });

  nodesRef.current = weekNodes;
  callbacksRef.current = { onChangeLf, onMovePoint, onAddPoint, onRemovePoint };

  const axisWeeks = (() => {
    const weeks = new Set();
    weekNodes.forEach((n) => {
      if (n?.weeksUntilSailing != null) weeks.add(Number(n.weeksUntilSailing));
    });
    [...realSeries, ...modelSeries].forEach((p) => {
      if (p?.weeksUntilSailing != null) weeks.add(Number(p.weeksUntilSailing));
    });
    if (!weeks.size) weeks.add(0);
    return [...weeks].sort((a, b) => b - a);
  })();

  const waypointIndexByWeek = new Map();
  weekNodes.forEach((n, i) => {
    if (n?.weeksUntilSailing != null) waypointIndexByWeek.set(Number(n.weeksUntilSailing), i);
  });

  const targetData = axisWeeks.map((w) => {
    const idx = waypointIndexByWeek.get(w);
    if (idx == null) return null;
    const lf = weekNodes[idx]?.lfPct;
    return lf != null ? Number(lf) : null;
  });

  useEffect(() => {
    if (!canvasRef.current || !axisWeeks.length) return undefined;
    const canvas = canvasRef.current;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: axisWeeks.map(weekLabel),
        datasets: [
          {
            label: 'REAL',
            data: axisWeeks.map((w) => lfAt(realSeries, w)),
            borderColor: '#2563eb',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
            spanGaps: true,
          },
          {
            label: 'Model prior',
            data: axisWeeks.map((w) => lfAt(modelSeries, w)),
            borderColor: '#64748b',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            tension: 0.2,
            spanGaps: true,
          },
          {
            label: 'Target — drag to move',
            data: targetData,
            borderColor: '#d97706',
            backgroundColor: 'rgba(217, 119, 6, 0.12)',
            borderWidth: 2.5,
            pointRadius: 7,
            pointHoverRadius: 10,
            pointHitRadius: 24,
            pointBackgroundColor: '#d97706',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0.2,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        plugins: {
          legend: getOverlayLegendOptions({ visible: chartLegendsVisible && showLegends }),
          tooltip: {
            enabled: true,
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed?.y;
                return `${ctx.dataset.label}: ${v == null ? '—' : `${v}%`}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 0, autoSkip: true },
            grid: { display: false },
          },
          y: {
            min: 0,
            max: 110,
            title: { display: true, text: 'LF %' },
          },
        },
      },
    });
    chartRef.current = chart;

    const pointerPos = (nativeEvent) => {
      try {
        return getRelativePosition(nativeEvent, chart);
      } catch {
        const rect = canvas.getBoundingClientRect();
        const sx = (chart.width || rect.width) / (rect.width || 1);
        const sy = (chart.height || rect.height) / (rect.height || 1);
        return {
          x: (nativeEvent.clientX - rect.left) * sx,
          y: (nativeEvent.clientY - rect.top) * sy,
        };
      }
    };

    const nearestWaypointIndex = (nativeEvent) => {
      const meta = chart.getDatasetMeta(2);
      if (!meta?.data?.length) return -1;
      const live = chart.data.datasets[2]?.data || [];
      const { x } = pointerPos(nativeEvent);
      let best = -1;
      let bestDx = Infinity;
      meta.data.forEach((el, i) => {
        if (live[i] == null || !el) return;
        const px = el.getProps(['x'], true).x;
        if (!Number.isFinite(px)) return;
        const dx = Math.abs(x - px);
        if (dx < bestDx) {
          bestDx = dx;
          best = i;
        }
      });
      return best;
    };

    const yToLf = (nativeEvent) => {
      const scale = chart.scales?.y;
      if (!scale) return null;
      const { y } = pointerPos(nativeEvent);
      const value = scale.getValueForPixel(y);
      if (!Number.isFinite(value)) return null;
      return clampLf(value);
    };

    const xToWeek = (nativeEvent) => {
      const scale = chart.scales?.x;
      if (!scale) return null;
      const { x } = pointerPos(nativeEvent);
      const idx = Math.round(scale.getValueForPixel(x));
      if (!Number.isFinite(idx) || idx < 0 || idx >= axisWeeks.length) return null;
      return axisWeeks[idx];
    };

    const flush = () => {
      rafRef.current = null;
      const p = pendingRef.current;
      pendingRef.current = null;
      if (!p) return;
      const node = nodesRef.current[p.nodeIndex];
      if (!node) return;
      if (p.weeksUntilSailing != null && Number(p.weeksUntilSailing) !== Number(node.weeksUntilSailing)) {
        callbacksRef.current.onMovePoint?.(node.tempKey, {
          weeksUntilSailing: p.weeksUntilSailing,
          weekLabel: weekLabel(p.weeksUntilSailing),
          lfPct: p.lfPct,
        });
        return;
      }
      callbacksRef.current.onChangeLf?.(node.tempKey, p.lfPct);
    };

    const beginDrag = (nativeEvent) => {
      const idx = nearestWaypointIndex(nativeEvent);
      if (idx < 0) return false;
      const week = axisWeeks[idx];
      const nodeIndex = nodesRef.current.findIndex(
        (n) => Number(n.weeksUntilSailing) === Number(week)
      );
      if (nodeIndex < 0) return false;
      dragRef.current = { active: true, index: idx, nodeIndex, moved: false };
      canvas.style.cursor = 'grabbing';
      nativeEvent.preventDefault();
      if (chart.options?.plugins?.tooltip) {
        chart.options.plugins.tooltip.enabled = false;
        chart.update('none');
      }
      return true;
    };

    const moveDrag = (nativeEvent) => {
      if (!dragRef.current.active) return;
      const lf = yToLf(nativeEvent);
      if (lf == null) return;
      const week = xToWeek(nativeEvent);
      const ds = chart.data.datasets[2];
      const node = nodesRef.current[dragRef.current.nodeIndex];
      let nextIndex = dragRef.current.index;
      if (
        week != null &&
        node &&
        Number(week) !== Number(node.weeksUntilSailing) &&
        !nodesRef.current.some(
          (n, i) => i !== dragRef.current.nodeIndex && Number(n.weeksUntilSailing) === Number(week)
        )
      ) {
        const dest = axisWeeks.findIndex((w) => Number(w) === Number(week));
        if (dest >= 0) {
          ds.data[dragRef.current.index] = null;
          ds.data[dest] = lf;
          nextIndex = dest;
          dragRef.current.index = dest;
          dragRef.current.moved = true;
        }
      } else {
        ds.data[dragRef.current.index] = lf;
        if (Math.abs(lf - Number(node?.lfPct)) > 0.05) dragRef.current.moved = true;
      }
      chart.update('none');
      pendingRef.current = {
        nodeIndex: dragRef.current.nodeIndex,
        lfPct: lf,
        weeksUntilSailing: axisWeeks[nextIndex],
      };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
    };

    const stopDrag = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      flush();
      if (dragRef.current.active) {
        lastDragAtRef.current = Date.now();
        dragRef.current = { active: false, index: -1, nodeIndex: -1, moved: false };
      }
      if (chart.options?.plugins?.tooltip) {
        chart.options.plugins.tooltip.enabled = true;
        chart.update('none');
      }
      canvas.style.cursor = 'grab';
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
    };

    const onWindowMove = (e) => moveDrag(e);
    const onWindowUp = () => stopDrag();
    const onWindowTouchMove = (e) => {
      if (dragRef.current.active) e.preventDefault();
      if (e.touches?.[0]) moveDrag(e.touches[0]);
    };
    const onWindowTouchEnd = () => stopDrag();

    const onMouseDown = (event) => {
      if (event.shiftKey) return;
      if (!beginDrag(event)) return;
      window.addEventListener('mousemove', onWindowMove);
      window.addEventListener('mouseup', onWindowUp);
    };

    const onDblClick = (event) => {
      const idx = nearestWaypointIndex(event);
      if (idx < 0) return;
      const week = axisWeeks[idx];
      const node = nodesRef.current.find((n) => Number(n.weeksUntilSailing) === Number(week));
      if (node && nodesRef.current.length > 1) {
        callbacksRef.current.onRemovePoint?.(node.tempKey);
      }
    };

    const onClick = (event) => {
      if (!event.shiftKey) return;
      if (dragRef.current.active) return;
      if (Date.now() - lastDragAtRef.current < 250) return;
      const week = xToWeek(event);
      const lf = yToLf(event);
      if (week == null || lf == null) return;
      const exists = nodesRef.current.some((n) => Number(n.weeksUntilSailing) === Number(week));
      if (exists) return;
      callbacksRef.current.onAddPoint?.(week, lf);
    };

    const onMouseMove = () => {
      canvas.style.cursor = dragRef.current.active ? 'grabbing' : 'grab';
    };

    const onTouchStart = (event) => {
      const t = event.touches?.[0];
      if (!t) return;
      if (!beginDrag(t)) return;
      window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
      window.addEventListener('touchend', onWindowTouchEnd);
      window.addEventListener('touchcancel', onWindowTouchEnd);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });

    return () => {
      stopDrag();
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [axisWeeks.join(','), realSeries, modelSeries, chartLegendsVisible, showLegends, fontSize, fontFamily]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || dragRef.current.active) return;
    const next = axisWeeks.map((w) => {
      const node = weekNodes.find((n) => Number(n.weeksUntilSailing) === Number(w));
      return node?.lfPct != null ? Number(node.lfPct) : null;
    });
    chart.data.datasets[2].data = next;
    chart.update('none');
  }, [weekNodes, axisWeeks.join(',')]);

  return (
    <div className="talia-chart">
      <canvas
        ref={canvasRef}
        className="talia-chart__canvas"
        aria-label="Target profile curve editor"
      />
    </div>
  );
};

export default TargetProfileCurveEditor;
