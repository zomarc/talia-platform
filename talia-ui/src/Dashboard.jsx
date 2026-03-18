import React, { useCallback, useRef, useEffect, useState } from "react";
import { DockviewReact } from "dockview";
import "dockview/dist/styles/dockview.css"; // required Dockview CSS
import reportRegistry from "./components/focus-panels/registry";
import { normalizeRole } from "./utils/roleUtils";
import { GraphQLUtils } from "./lib/apolloClient";
// Focus Management Integration
import { useFocusManagement } from "./hooks/useFocusManagement";
import useDashboardSidebar from "./hooks/useDashboardSidebar";
import graphQLFocusService from "./services/GraphQLFocusService";
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT, emitSailClear, emitSailSelect } from "./lib/eventBus";
// Admin Components
import { AdminDashboard, UserMappingTable, TaliaUserTable } from "./components/admin";
// Context Row Monitor (Admin only)
import ContextRowMonitor from "./components/focus-panels/ContextRowMonitor/index.jsx";
import TaliaDockviewTab from "./components/dockview/TaliaDockviewTab.jsx";
import ReportShell from "./components/dockview/ReportShell.jsx";
import DashboardSidebar from "./components/sidebar/DashboardSidebar.jsx";
import {
  DOCKVIEW_MAXIMIZE_STATE_EVENT,
  DASHBOARD_CYCLE_FOCUS_EVENT,
} from "./components/dockview/eventConstants";
// Dev Role Selector is now integrated into ModeSelector dropdown
// Theme System - using centralized theme context
import { useTheme } from "./contexts/ThemeContext";
import { DEFAULT_THEME } from "./config/themes.js";
// Tabulator - using npm package
import Tabulator from "./lib/tabulatorConfig.js";
// Chart.js - using npm package
import { Chart } from "chart.js/auto";
// Removed Apollo Client - using direct fetch instead

// Debug logging
const debugLog = (message, data = null) => {
  console.log(`[App Debug] ${message}`, data || '');
};

const toggleDockviewPanelLayout = (panelApi, dockviewApi) => {
  if (!panelApi) return;
  const currentlyMaximized = panelApi?.isMaximized?.() ?? false;
  if (currentlyMaximized) {
    panelApi?.exitMaximized?.();
    dockviewApi?.exitMaximizedGroup?.();
    return;
  }
  if (dockviewApi?.hasMaximizedGroup?.()) {
    dockviewApi?.exitMaximizedGroup?.();
  }
  panelApi?.maximize?.();
};

// IMPORTANT: DO NOT MESS WITH DOCKVIEW'S LAYOUT SYSTEM
// - Do not add resize event listeners
// - Do not call api.layout() manually
// - Do not manipulate panel positioning after creation
// - Let Dockview handle all layout and resizing naturally
// - Only use addPanel() with proper position references

// Basic startup logging
console.log('🚀 App.jsx file loaded');
console.log('📦 React version:', React?.version);
console.log('🔧 Dockview imported:', !!DockviewReact);

// Theme system is now centralized in src/contexts/ThemeContext.jsx
// Dashboard uses the centralized theme via useTheme hook imported above

/**
 * Talia Demo — Dockview + Tabulator + Chart.js (React + Vite)
 * - StrictMode-safe (guards + cleanup)
 * - 2×2 layout using api.addPanel with relative positions (right/below)
 * - Talia tan & white theme via CSS variables
 * - Layout versioning + reset
 * - Cross-filtering: single-select table → chart
 * - **CDN fallbacks** for Tabulator & Chart.js so the canvas preview runs without npm installs
 * - Canvas-safe: graceful HTML table fallback if Tabulator can't initialize
 */

// ----------------- Cross-panel event channel -----------------
const SELECT_EVENT = SAIL_SELECT_EVENT;   // payload: one record
const CLEAR_EVENT = SAIL_CLEAR_EVENT;     // clear selection

function emitSelect(record) {
  if (record) {
    emitSailSelect(record);
  } else {
    emitSailClear({ timestamp: new Date().toISOString() });
  }
}

// Global error taps so canvas won't just stop silently
if (!window.__taliaGlobalErrorInstalled) {
  window.__taliaGlobalErrorInstalled = true;
  window.addEventListener("error", (e) => {
    const { message, filename, lineno, colno } = e;
    console.error("[GlobalError]", message || e.error, filename, lineno, colno);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[UnhandledRejection]", e.reason || e);
  });
}

// ----------------- GraphQL Client Setup -----------------
// Using direct fetch instead of Apollo Client for simplicity

// CDN loading removed - using npm packages instead
// Tabulator: tabulator-tables@6.3.1 (imported above)
// Chart.js: chart.js (imported above)

// ----------------- Demo booking curves by sailing id -----------------
const curveLabels = ["W-12", "W-10", "W-8", "W-6", "W-4", "W-2", "Sail"];
const curvesById = {
  1: { labels: curveLabels, actual: [18, 30, 44, 59, 75, 88, 96], target: [18, 30, 44, 60, 76, 88, 95] },
  2: { labels: curveLabels, actual: [12, 22, 36, 49, 63, 79, 90], target: [14, 24, 38, 52, 68, 82, 94] },
  3: { labels: curveLabels, actual: [10, 18, 28, 40, 55, 70, 83], target: [15, 25, 37, 50, 66, 80, 93] },
  4: { labels: curveLabels, actual: [22, 35, 48, 62, 77, 90, 98], target: [20, 32, 46, 61, 76, 89, 97] },
  5: { labels: curveLabels, actual: [9, 16, 26, 39, 54, 71, 86], target: [13, 22, 34, 48, 65, 80, 94] },
  6: { labels: curveLabels, actual: [6, 12, 20, 31, 45, 60, 75], target: [10, 18, 28, 42, 58, 74, 90] },
};

// Quick test cases (won't throw; logs only)
console.assert(Object.keys(curvesById).length === 6, "Test: 6 curve sets available");
for (const [id, c] of Object.entries(curvesById)) {
  const ok = c.labels.length === curveLabels.length && c.actual.length === curveLabels.length && c.target.length === curveLabels.length;
  console.assert(ok, `Test: curve ${id} lengths match`);
}

// ----------------- GraphQL Queries -----------------
// Using direct fetch instead of gql template literals

// ---- Panel 1: Tabulator table (single-select with canvas-safe fallback) ----
const TablePanel = React.memo(function TablePanel() {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const failSafeRef = useRef(null);    // ensure timeout is always cleared
  const builtRef = useRef(false);       // only redraw after tableBuilt
  const initializedRef = useRef(false);

  useEffect(() => {

    const waitForNonZeroSize = (el, timeout = 3000) => new Promise((resolve) => {
      const start = performance.now();
      const check = () => {
        if (!el) return resolve(false);
        const w = el.clientWidth, h = el.clientHeight;
        if (w > 0 && h > 0) return resolve({ w, h });
        if (performance.now() - start > timeout) return resolve(false);
        requestAnimationFrame(check);
      };
      check();
    });

    const renderFallbackTable = () => {
      if (!tableRef.current) return;
      if (instanceRef.current) { console.log('[FallbackTable] skipped (Tabulator exists)'); return; }
      const data = [
        { id: 1, ship: "Celestyal Discovery", sailing: "7N Islands", depart: "2025-09-05", booked: 820, available: 950, projected: 910, status: "As expected" },
        { id: 2, ship: "Celestyal Journey",   sailing: "3N Iconic Aegean", depart: "2025-09-06", booked: 620, available: 700, projected: 680, status: "Needs attention" },
        { id: 3, ship: "Celestyal Discovery", sailing: "4N Adriatic", depart: "2025-09-12", booked: 450, available: 760, projected: 720, status: "Below expected" },
        { id: 4, ship: "Celestyal Journey",   sailing: "7N Idyllic Aegean", depart: "2025-09-13", booked: 910, available: 980, projected: 960, status: "As expected" },
        { id: 5, ship: "Celestyal Journey",   sailing: "7N Three Continents", depart: "2025-09-20", booked: 700, available: 980, projected: 850, status: "Needs attention" },
        { id: 6, ship: "Celestyal Discovery", sailing: "3N Iconic Aegean", depart: "2025-09-27", booked: 300, available: 700, projected: 540, status: "Below expected" },
      ];
      const headers = ["Ship","Sailing","Depart","Booked","Available","Projected","Status"];
      const rows = data.map(r => `<tr data-id="${r.id}"><td>${r.ship}</td><td>${r.sailing}</td><td>${r.depart}</td><td style="text-align:right">${r.booked}</td><td style="text-align:right">${r.available}</td><td style="text-align:right">${r.projected}</td><td>${r.status}</td></tr>`).join("");
      tableRef.current.innerHTML = `
        <div style="padding:6px 8px;font-family:ui-sans-serif,system-ui;font-size:13px">
          <div style="margin-bottom:6px;color:#a55">(Fallback table active)</div>
          <table style="width:100%; border-collapse:collapse">
            <thead><tr>${headers.map(h=>`<th style="text-align:left;border-bottom:1px solid #e8dfd0;padding:4px 6px">${h}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      try {
        const tbody = tableRef.current.querySelector('tbody');
        tbody?.addEventListener('click', (ev) => {
          const tr = ev.target.closest('tr');
          if (!tr) return;
          // clear others
          tbody.querySelectorAll('tr.selected').forEach(n => n.classList.remove('selected'));
          tr.classList.add('selected');
          const id = Number(tr.getAttribute('data-id'));
          const rec = {
            1: { id:1, ship:"Celestyal Discovery", sailing:"7N Islands" },
            2: { id:2, ship:"Celestyal Journey", sailing:"3N Iconic Aegean" },
            3: { id:3, ship:"Celestyal Discovery", sailing:"4N Adriatic" },
            4: { id:4, ship:"Celestyal Journey", sailing:"7N Idyllic Aegean" },
            5: { id:5, ship:"Celestyal Journey", sailing:"7N Three Continents" },
            6: { id:6, ship:"Celestyal Discovery", sailing:"3N Iconic Aegean" },
          }[id];
          if (rec) emitSelect(rec);
        });
      } catch {
        // noop
      }
      console.log('[FallbackTable] rendered');
    };

    (async () => {
      try {
        if (!tableRef.current || initializedRef.current) return;

        // Tabulator is available via npm import
        if (!Tabulator) { 
          console.warn('[TablePanel] Tabulator not available');
          renderFallbackTable(); 
          return; 
        }

        // Wait for real size
        const sz = await waitForNonZeroSize(tableRef.current, 3000);
        console.log("[TablePanel] container size before init:", sz);

        // Safety net: If we haven't finished init in 1200ms, draw fallback
        if (failSafeRef.current) clearTimeout(failSafeRef.current);
        failSafeRef.current = setTimeout(() => {
          console.warn('[TablePanel] failSafe fired — using fallback table');
          if (!instanceRef.current) renderFallbackTable();
        }, 1200);

        const data = [
          { id: 1, ship: "Celestyal Discovery", sailing: "7N Islands", depart: "2025-09-05", booked: 820, available: 950, projected: 910, status: "As expected" },
          { id: 2, ship: "Celestyal Journey",   sailing: "3N Iconic Aegean", depart: "2025-09-06", booked: 620, available: 700, projected: 680, status: "Needs attention" },
          { id: 3, ship: "Celestyal Discovery", sailing: "4N Adriatic", depart: "2025-09-12", booked: 450, available: 760, projected: 720, status: "Below expected" },
          { id: 4, ship: "Celestyal Journey",   sailing: "7N Idyllic Aegean", depart: "2025-09-13", booked: 910, available: 980, projected: 960, status: "As expected" },
          { id: 5, ship: "Celestyal Journey",   sailing: "7N Three Continents", depart: "2025-09-20", booked: 700, available: 980, projected: 850, status: "Needs attention" },
          { id: 6, ship: "Celestyal Discovery", sailing: "3N Iconic Aegean", depart: "2025-09-27", booked: 300, available: 700, projected: 540, status: "Below expected" },
        ];

        const columns = [
          { 
            title: "Ship", 
            field: "ship", 
            widthGrow: 2,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Ships", "Celestyal Discovery": "Celestyal Discovery", "Celestyal Journey": "Celestyal Journey" },
              clearable: true
            }
          },
          { 
            title: "Sailing", 
            field: "sailing", 
            widthGrow: 2,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter sailing..."
          },
          { 
            title: "Depart", 
            field: "depart", 
            hozAlign: "center", 
            width: 130,
            headerFilter: "input",
            headerFilterPlaceholder: "YYYY-MM-DD"
          },
          { 
            title: "Booked", 
            field: "booked", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min value",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
          },
          { 
            title: "Available", 
            field: "available", 
            hozAlign: "right", 
            width: 110,
            headerFilter: "input",
            headerFilterPlaceholder: "Min value",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
          },
          { 
            title: "Projected", 
            field: "projected", 
            hozAlign: "right", 
            width: 110,
            headerFilter: "input",
            headerFilterPlaceholder: "Min value",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
          },
          { 
            title: "Status", 
            field: "status", 
            widthGrow: 1,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Status", "As expected": "As expected", "Needs attention": "Needs attention", "Below expected": "Below expected" },
              clearable: true
            }
          },
        ];

        console.log('[TablePanel] initializing Tabulator on', tableRef.current);
        // Give the layout one more frame to settle
        await new Promise((r) => requestAnimationFrame(() => r()));

        const TabCtor = Tabulator;
        instanceRef.current = new TabCtor(tableRef.current, {
          data,
          columns,
          layout: "fitColumns",
          reactiveData: false,
          height: "100%",
          selectableRows: 1,            // single-select only
          headerFilterLiveFilter: true, // live filtering as you type
          headerFilterLiveFilterDelay: 300, // delay for live filtering
          // Theme and font configuration
          rowClick: (e, row) => {
            try { row?.select?.(); } catch { /* noop */ }
          },
          rowSelectionChanged: (selectedData /* array */) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
              console.log("[Tabulator] rowSelectionChanged", rec);
              emitSelect(rec);
            } else {
              console.log("[Tabulator] rowSelectionChanged — empty selection");
              emitSelect(null);
            }
          },
          cellClick: (e, cell) => {
            try { cell.getRow()?.select?.(); } catch { /* noop */ }
          },
        });
        console.log('[Tabulator] instance created');

        // Listen for a clear selection from the toolbar
        const onClear = () => { try { instanceRef.current?.deselectRow?.(); } catch { /* noop */ } };
        window.addEventListener(CLEAR_EVENT, onClear);

        // Add clear filters function to global scope for toolbar access
        window.clearTableFilters = () => {
          try {
            instanceRef.current?.clearHeaderFilter?.();
            console.log('[TablePanel] All filters cleared');
          } catch (e) {
            console.warn('[TablePanel] Clear filters failed', e);
          }
        };

        // Hook events after init
        try {
          instanceRef.current.on('tableBuilt', () => { 
            builtRef.current = true; 
            console.log('[Tabulator] tableBuilt');
          });
          instanceRef.current.on('rowSelected', (row) => {
          const rec = row?.getData?.();
          console.log('[Tabulator] rowSelected (emit)', rec);
          if (rec) emitSelect(rec);
        });
          instanceRef.current.on('rowDeselected', (row) => console.log('[Tabulator] rowDeselected', row?.getData?.()));
          setTimeout(() => {
            try { instanceRef.current.selectRow(1); console.log('[Tabulator] selectRow(1) called'); } catch (err) { console.warn('[Tabulator] default selection failed', err); }
          }, 60);
        } catch (e) { console.warn('[Tabulator] event hooks failed', e); }

        // Clear the fail-safe once everything is set up
        if (failSafeRef.current) { clearTimeout(failSafeRef.current); failSafeRef.current = null; }
        
        // Mark as initialized
        initializedRef.current = true;

      } catch (err) {
        console.error('[TablePanel] fatal init error', err);
        // Last resort fallback
        renderFallbackTable();
      }
    })();

    return () => {
      if (failSafeRef.current) { clearTimeout(failSafeRef.current); failSafeRef.current = null; }
      try { instanceRef.current?.destroy?.(); } catch { /* noop */ }
      instanceRef.current = null;
      builtRef.current = false;
      initializedRef.current = false;
    };
  }, []);

  // Note: Font changes are handled via CSS and don't require Tabulator updates
  // This prevents interference with Dockview's drag and drop system

  return (
    <div className="dashboard-table-panel">
      <div className="dashboard-table-panel__note">
        <strong>Table Filters:</strong> Use the filter controls in column headers to filter data. 
        <span className="dashboard-table-panel__tip">
          💡 Tip: Click filter icons in column headers to filter by Ship, Sailing, Status, or numeric values
        </span>
      </div>
      <div 
        ref={tableRef} 
        className="dashboard-table-panel__body"
      />
      {/* Tabulator styling configured via initTabulator() - CSS injected after Tabulator loads */}
    </div>
  );
});

// ---- Panel 2: Chart.js line chart (single series + target; listens to SELECT_EVENT) ----
const ChartPanel = React.memo(function ChartPanel() {
  const { theme, fontSize, selectedFont } = useTheme();
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!canvasRef.current || initializedRef.current) return;

        // Comprehensive cleanup: destroy any existing chart on this canvas
        if (chartRef.current) {
          try {
            chartRef.current.destroy();
            chartRef.current = null;
          } catch (e) {
            console.warn('Failed to destroy existing chart:', e);
          }
        }

        // Also check Chart.js global registry for any chart using this canvas
        try {
          if (window.Chart && window.Chart.instances) {
            Object.keys(window.Chart.instances).forEach(id => {
              const chart = window.Chart.instances[id];
              if (chart && chart.canvas === canvasRef.current) {
                console.log('Destroying existing chart on canvas from registry:', id);
                chart.destroy();
              }
            });
          }
        } catch (e) {
          console.warn('Failed to clean up chart registry:', e);
        }

        // Clear canvas to ensure clean state
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Chart.js is available via npm import
        if (!Chart) { console.error("Chart.js not available"); return; }

        // ctx already declared above

        const buildDatasets = (rec) => {
          const baseTarget = { label: "Target % Sold", data: curvesById[1].target, borderColor: "#8c8c8c", backgroundColor: "rgba(140,140,140,0.15)", borderDash: [6,4], tension: 0.3, pointRadius: 2 };
          if (!rec || !curvesById[rec.id]) return [baseTarget];
          const c = curvesById[rec.id];
          const actual = { label: `Actual % — ${rec.ship} • ${rec.sailing}` , data: c.actual, borderColor: "#b08d57", backgroundColor: "#b08d5733", tension: 0.3, pointRadius: 2 };
          return [actual, baseTarget];
        };

        // Generate unique chart ID using cryptographic hash for absolute uniqueness
        const timestamp = Date.now();
        const random1 = Math.random().toString(36).substr(2, 9);
        const random2 = Math.random().toString(36).substr(2, 9);
        const random3 = Math.random().toString(36).substr(2, 9);
        
        // Create a hash-like string for absolute uniqueness
        const hashInput = `${timestamp}-${random1}-${random2}-${random3}`;
        const chartId = `chart-${btoa(hashInput).replace(/[^a-zA-Z0-9]/g, '').substr(0, 20)}`;
        console.log('Generated chart ID:', chartId);
        
        // Destroy any existing chart on this canvas first
        try {
          if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
          }
        } catch (e) {
          console.warn('Failed to destroy existing chart reference:', e);
        }
        
        // Also check Chart.js registry for any chart using this canvas
        try {
          const allCharts = Chart.instances || {};
          Object.keys(allCharts).forEach(id => {
            const chart = allCharts[id];
            if (chart && chart.canvas === canvasRef.current) {
              console.log('Destroying existing chart on canvas:', id);
              chart.destroy();
            }
          });
        } catch (e) {
          console.warn('Failed to clean up existing charts:', e);
        }
        
        chartRef.current = new Chart(ctx, {
          id: chartId,
          type: "line",
          data: { labels: curveLabels, datasets: buildDatasets(null) },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
              y: { 
                beginAtZero: true, 
                max: 100, 
                ticks: { 
                  callback: (v) => v + "%",
                  color: theme.colors.foreground,
                  font: { size: fontSize, family: selectedFont.value }
                },
                grid: { color: theme.colors.border },
                title: { color: theme.colors.foreground, font: { size: fontSize } }
              },
              x: {
                ticks: { 
                  color: theme.colors.foreground,
                  font: { size: fontSize, family: selectedFont.value }
                },
                grid: { color: theme.colors.border },
                title: { color: theme.colors.foreground, font: { size: fontSize } }
              }
            },
            plugins: { 
              legend: { 
                position: "top",
                labels: {
                  color: theme.colors.foreground,
                  font: { size: fontSize, family: selectedFont.value }
                }
              }, 
              tooltip: { 
                intersect: false, 
                mode: "index",
                titleColor: theme.colors.foreground,
                bodyColor: theme.colors.foreground,
                backgroundColor: theme.colors.sidebarHeader,
                borderColor: theme.colors.border,
                titleFont: { size: fontSize, family: selectedFont.value },
                bodyFont: { size: fontSize - 1, family: selectedFont.value },
                callbacks: {
                  title: function(context) {
                    try {
                      if (!context || !context[0]) return 'N/A';
                      return context[0].label || 'N/A';
                    } catch (e) {
                      console.warn('Tooltip title error:', e);
                      return 'N/A';
                    }
                  },
                  label: function(context) {
                    try {
                      if (!context || !context.dataset) return 'N/A';
                      return context.dataset.label + ': ' + (context.parsed.y || 'N/A') + '%';
                    } catch (e) {
                      console.warn('Tooltip label error:', e);
                      return 'N/A';
                    }
                  }
                }
              } 
            },
            interaction: { intersect: false, mode: "index" },
          },
        });

        console.log('Chart created with ID:', chartRef.current.id, 'Expected ID:', chartId);

        // Tests: chart datasets
        console.assert(chartRef.current.data.datasets.length === 1, "Test: initial datasets = 1 (target only)");

        const onSelect = (evt) => {
          const rec = evt?.detail || null;
          const ch = chartRef.current;
          if (!ch) return; // Chart not initialized yet
          ch.data.labels = curveLabels;
          ch.data.datasets = buildDatasets(rec);
          ch.update();
          console.log("[Chart] updated for id", rec?.id, "chartId:", ch.id);
          // Exactly 2 datasets (Actual + Target) when selected
          if (rec) console.assert(ch.data.datasets.length === 2, "Test: 2 datasets when selection present");
        };

        const onClear = () => { onSelect({ detail: null }); };

        window.addEventListener(SELECT_EVENT, onSelect);
        window.addEventListener(CLEAR_EVENT, onClear);
        
        // REMOVED: Panel close resize listener - let Dockview handle chart resizing

        // Mark as initialized
        initializedRef.current = true;

        // Kick off with a default selection so the chart shows a curve quickly
        setTimeout(() => { if (!cancelled) emitSelect({ id:1, ship:"Celestyal Discovery", sailing:"7N Islands" }); }, 350);

        return () => {
          window.removeEventListener(SELECT_EVENT, onSelect);
          window.removeEventListener(CLEAR_EVENT, onClear);
          if (chartRef.current) {
            try {
              chartRef.current.destroy();
            } catch (e) {
              console.warn('Failed to destroy chart on cleanup:', e);
            }
            chartRef.current = null;
          }
          initializedRef.current = false;
        };
      } catch (err) {
        console.error('[ChartPanel] fatal init error', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Note: Chart font changes are handled via CSS and don't require Chart.js updates
  // This prevents interference with Dockview's drag and drop system

  return (
    <div className="dashboard-chart-panel">
      <canvas 
        ref={canvasRef} 
        className="dashboard-chart-panel__canvas"
      />
    </div>
  );
});

// ---- Simple text panel (fallback/info) ----
function InfoPanel(props) {
  const title = props?.params?.panel?.title || props?.params?.title || "Panel";
  return (
    <div className="dashboard-info-panel">
      <p className="dashboard-info-panel__title">{title}</p>
      <p className="dashboard-info-panel__text">This is a generic panel. Drag the tab to dock/split.</p>
    </div>
  );
}

// ---- GraphQL Data Panel ----
const GraphQLPanel = React.memo(function GraphQLPanel(props) {
  debugLog('GraphQLPanel render', { props });

  const title = props?.params?.panel?.title || props?.params?.title || "GraphQL Data";
  const dataType = props?.params?.dataType || "ships";
  
  // Data fetching logic moved to fetchData function below

  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const fetchData = async () => {
    debugLog('GraphQLPanel fetchData called', { dataType });
    setLoading(true);
    setError(null);

    try {
      let query = '';
      switch (dataType) {
        case "books":
          query = '{ books { title author } }';
          break;
        case "ships":
          query = '{ ships { Ship_Code Ship_Id Ship_Length Ship_Name Ship_Pax_Capacity Ship_Tonnage } }';
          break;
        case "cabinAvailability":
          query = '{ cabinAvailability { Package_Name Total_Cabins Snapshot_Date Sail_Days Cabin_Category Available_Weighted } }';
          break;
        default:
          query = '{ books { title author } }';
      }

      debugLog('Making GraphQL request', { query, dataType });

      // Use relative path - Vite proxy handles routing to localhost:4000
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();
      debugLog('GraphQL response received', result);

      if (result.errors) {
        setError(result.errors[0].message);
      } else {
        setData(result.data);
      }
    } catch (err) {
      debugLog('GraphQL fetch error', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dataType]);

  const handleRefresh = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__icon">🔄 Loading {dataType}...</div>
        <div className="dashboard-loading__text">Fetching data from GraphQL server</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="dashboard-error__icon">❌</div>
        <div className="dashboard-error__title">GraphQL Error</div>
        <div className="dashboard-error__message">{error}</div>
        <button 
          className="dashboard-btn dashboard-btn--primary"
          onClick={handleRefresh}
        >
          🔄 Retry
        </button>
        <div className="dashboard-error__details">
          Server: /api/graphql (proxied to localhost:4000)
        </div>
      </div>
    );
  }

  const items = data?.[dataType] || [];
  
  return (
    <div className="dashboard-graphql-panel">
      <div className="dashboard-graphql-panel__header">
        <div className="dashboard-graphql-panel__title">
          {title} ({items.length} items)
        </div>
        <button 
          onClick={handleRefresh}
          className="talia-btn talia-btn--primary talia-btn--small"
        >
          🔄 Refresh
        </button>
      </div>
      
      <div 
        className="dashboard-graphql-panel__content"
      >
        {items.length === 0 ? (
          <div className="dashboard-graphql-panel__empty">
            No {dataType} data available
          </div>
        ) : (
          <div className="dashboard-graphql-grid">
            {items.map((item, index) => (
              <div 
                key={item.id || index}
                className="dashboard-graphql-card"
              >
                <div className="dashboard-graphql-card__title">
                  {item.title || item.Ship_Name || item.Package_Name || `Item ${item.id || item.Ship_Id}`}
                </div>
                <div className="dashboard-graphql-card__meta">
                  {Object.entries(item).map(([key, value]) => (
                    key !== 'title' && key !== 'Ship_Name' && key !== 'Package_Name' && (
                      <div key={key}>
                        <strong>{key}:</strong> {String(value)}
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function Dashboard({ user }) {
  const { theme, setCurrentTheme, fontSize, setFontSize, setFontFamily, setSpacingMode } = useTheme();

  const reportComponentMap = React.useMemo(() => {
    const map = {};
    Object.values(reportRegistry).forEach((report) => {
      if (!report.panelId) {
        return;
      }
      const Component = report.component;
      map[report.panelId] = (props) => (
        <ReportShell
          report={report}
          panelInstanceId={props?.api?.id || props?.params?.panel?.id || report.panelId}
        >
          <Component
            theme={theme}
            panelInstanceId={props?.api?.id || props?.params?.panel?.id || report.panelId}
            panelComponentId={report.panelId}
            {...props}
          />
        </ReportShell>
      );
    });
    return map;
  }, [theme]);
  
  // Status messages use global API (window.__taliaStatus)
  const setStatusMessage = (message) => {
    if (window.__taliaStatus) {
      window.__taliaStatus.setStatusMessage(message);
    }
  };
  
  // Focus Management Integration
  const {
    focuses: taliaFocuses,
    loading: focusLoading,
    error: focusError,
    updateFocus: updateTaliaFocus
  } = useFocusManagement();
  
  // Get role from user or localStorage (normalized)
  const normalizedUserRole = normalizeRole(user?.role || GraphQLUtils.getUserRole() || 'USER');
  
  // Events are tracked globally in main.jsx - no need to track here
  
  debugLog('App component initializing');

  const LAYOUT_KEY = "taliaLayout";
  const LAYOUT_VERSION = 6; // bump to avoid restoring older layout causing replays

  // Validate layout data to prevent deserialization errors
  const validateLayoutData = (data) => {
    if (!data || typeof data !== 'object') return false;
    
    // Check if data has the expected Dockview structure
    if (data.grid && data.grid.root) {
      const root = data.grid.root;
      if (root.type === 'branch' && Array.isArray(root.data)) {
        // Recursively validate nodes
        const validateNode = (node) => {
          if (!node || typeof node !== 'object') return false;
          if (!node.type || (node.type !== 'leaf' && node.type !== 'branch')) return false;
          
          if (node.type === 'leaf') {
            if (!node.data || typeof node.data !== 'object') return false;
            if (!node.data.id || !node.data.views || !Array.isArray(node.data.views)) return false;
            // size can be null, that's okay
          } else if (node.type === 'branch') {
            if (!node.data || !Array.isArray(node.data)) return false;
            // Recursively validate child nodes
            for (const child of node.data) {
              if (!validateNode(child)) return false;
            }
          }
          
          return true;
        };
        
        for (const node of root.data) {
          if (!validateNode(node)) return false;
        }
      }
    }
    
    // Also check if panels exist
    if (!data.panels || typeof data.panels !== 'object') {
      return false;
    }
    
    return true;
  };

  // Clear corrupted layout data on startup
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.version === LAYOUT_VERSION && parsed?.data) {
          // Validate layout data structure
          if (!validateLayoutData(parsed.data)) {
            console.warn('Corrupted layout data detected, clearing...');
            localStorage.removeItem(LAYOUT_KEY);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to validate saved layout, clearing...', e);
      localStorage.removeItem(LAYOUT_KEY);
    }
  }, []);

  const apiRef = useRef(null);
  const dockviewHostRef = useRef(null);
  const initializedRef = useRef(false); // guard for React 18 StrictMode
  const [isGroupMaximized, setIsGroupMaximized] = useState(false);
  const reportPanelIds = React.useMemo(
    () => new Set(Object.values(reportRegistry).map((report) => report.panelId).filter(Boolean)),
    []
  );
  const refreshableReportPanelIds = React.useMemo(
    () =>
      new Set(
        Object.values(reportRegistry)
          .filter((report) => report.panelId && report.supportsRefresh)
          .map((report) => report.panelId)
      ),
    []
  );
  const groupActionPanelIds = React.useMemo(
    () =>
      new Set(
        Object.values(reportRegistry)
          .filter((report) => report.panelId && report.supportsGroupActions)
          .map((report) => report.panelId)
      ),
    []
  );

  const {
    shellRef,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    toggleSidebar,
    handleMouseDown,
  } = useDashboardSidebar();

  const [globalFilters, setGlobalFilters] = React.useState({
    ship: '',
    dateFrom: '',
    dateTo: ''
  });

  // Focus navigation state - now using database focus system
  const [currentFocus, setCurrentFocus] = useState(null);

  // Role-based focus filtering function is now defined outside the component
  const [userRole, setUserRole] = useState(normalizedUserRole);

  // Update userRole when user changes
  useEffect(() => {
    const currentRole = normalizeRole(user?.role || GraphQLUtils.getUserRole() || 'USER');
    setUserRole(currentRole);
    console.log('User role updated to:', currentRole);
  }, [user?.role, user?.email]);

  debugLog('App state initialized', { sidebarCollapsed, sidebarWidth, globalFilters, theme: theme.name, fontSize });

  // Load focus-specific layout from database
  const loadFocusLayout = useCallback(async (focusId) => {
    if (!apiRef.current) {
      throw new Error('Dockview API not ready. Cannot load focus layout.');
    }

    console.log('🔄 Loading focus layout from database:', focusId);
    
    // Reload focuses from database to ensure we have the latest data
    try {
      const refreshedFocuses = await graphQLFocusService.getFocusesForRole(normalizedUserRole || 'ADMIN');
      // Try to find by ID first, then by name (for backward compatibility)
      let focus = refreshedFocuses.find(f => f.id === focusId);
      if (!focus) {
        // Try finding by name (case-insensitive)
        focus = refreshedFocuses.find(f => f.name.toLowerCase() === focusId.toLowerCase());
      }
      
      if (!focus) {
        // Don't show error alert - just log and return gracefully
        const errorMsg = `Focus with ID/name "${focusId}" not found in database. Available focuses: ${refreshedFocuses.map(f => f.name).join(', ')}`;
        console.warn('⚠️', errorMsg);
        // Don't throw error - allow app to continue
        return;
      }
      
      console.log('✅ Found focus:', focus.name, '(ID:', focusId + ')', 'Layout data:', focus.layoutData);
      
      // Check if focus has saved layout data
      if (!focus.layoutData || !focus.layoutData.dockviewLayout) {
        const errorMsg = `Focus "${focus.name}" (ID: ${focusId}) has no saved Dockview layout. The layout_data only contains: ${JSON.stringify(Object.keys(focus.layoutData || {}))}. Please save a layout first using the "Save Current Layout" button.`;
        console.warn('⚠️', errorMsg);
        console.warn('⚠️ Full layoutData:', JSON.stringify(focus.layoutData, null, 2));
        // Don't show alert or throw error - just log and return
        // This allows the app to continue without blocking the UI
        return;
      }
      
      console.log('📦 Loading saved Dockview layout from database');
      try {
        // Clear existing panels first
        apiRef.current.clear();
        
        // Validate layout data structure
        const layoutData = focus.layoutData.dockviewLayout;
        if (!layoutData || typeof layoutData !== 'object') {
          throw new Error('Invalid layout data structure');
        }
        
        // Load the saved Dockview layout directly
        apiRef.current.fromJSON(layoutData);
        console.log('✅ Successfully loaded saved layout from database');
        
      } catch (e) {
        const errorMsg = `Failed to load saved layout for focus "${focus.name}": ${e.message}. The layout data may be corrupted. Please save a new layout.`;
        console.error('❌', errorMsg, e);
        alert(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      // Re-throw if it's already our formatted error
      if (error.message && (error.message.includes('not found') || error.message.includes('no saved layout') || error.message.includes('Failed to load'))) {
        throw error;
      }
      // Otherwise wrap in a meaningful error
      const errorMsg = `Error loading focus layout: ${error.message}. Please try refreshing the page.`;
      console.error('❌', errorMsg, error);
      alert(errorMsg);
      throw new Error(errorMsg);
    }
  }, [normalizedUserRole]);

  // Focus change handler
  const handleFocusChange = useCallback(async (focusId) => {
    console.log('🔄 Focus changed to:', focusId);
    setCurrentFocus(focusId);
    
    try {
      // Load the focus-specific layout from database (will error if not found or invalid)
      await loadFocusLayout(focusId);
    } catch (error) {
      console.error('❌ Failed to load focus layout:', error);
      // Error is already shown to user in loadFocusLayout
      // Don't fall back - let the error stand
    }
  }, [loadFocusLayout]);

  const cycleFocus = useCallback(async () => {
    if (!Array.isArray(taliaFocuses) || taliaFocuses.length === 0) {
      return;
    }
    const currentFocusValue = typeof currentFocus === 'string' ? currentFocus.toLowerCase() : null;
    const currentIndex = taliaFocuses.findIndex((focus) =>
      focus?.id === currentFocus || (currentFocusValue && typeof focus?.name === 'string' && focus.name.toLowerCase() === currentFocusValue)
    );
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % taliaFocuses.length : 0;
    const nextFocus = taliaFocuses[nextIndex];
    if (!nextFocus?.id) return;
    await handleFocusChange(nextFocus.id);
    setStatusMessage(`Focus switched to "${nextFocus.name || nextFocus.id}"`);
  }, [currentFocus, handleFocusChange, taliaFocuses]);

  // Save current layout to focus
  const handleSaveCurrentLayoutToFocus = useCallback(async (focusId) => {
    if (!apiRef.current) {
      setStatusMessage('No layout to save');
      return;
    }

    try {
      // Get current layout from Dockview
      const currentLayout = apiRef.current.toJSON();
      console.log('Saving current layout to focus:', focusId, currentLayout);

      // Get focus name for status message
      const focus = taliaFocuses.find(f => f.id === focusId);
      const focusName = focus?.name || 'focus';

      // Update the focus with the current layout
      const success = await updateTaliaFocus(focusId, {
        layoutData: {
          dockviewLayout: currentLayout,
          components: extractComponentsFromLayout(currentLayout)
        }
      });

      if (success) {
        setStatusMessage(`Layout saved to "${focusName}" successfully`);
      } else {
        setStatusMessage('Failed to save layout to focus');
      }
    } catch (error) {
      console.error('Error saving layout to focus:', error);
      setStatusMessage('Error saving layout: ' + error.message);
    }
  }, [updateTaliaFocus, taliaFocuses]);

  // Extract components from Dockview layout for focus storage
  const extractComponentsFromLayout = useCallback((layout) => {
    const components = [];
    
    if (layout.panels) {
      Object.entries(layout.panels).forEach(([panelId, panel]) => {
        if (panel.params && panel.params.component) {
          components.push({
            id: panelId,
            type: panel.params.component,
            title: panel.params.title || panel.title || 'Panel',
            position: { x: 0, y: 0, width: 6, height: 4 } // Default position
          });
        }
      });
    }
    
    return components;
  }, []);

  useEffect(() => () => { 
    initializedRef.current = false; 
  }, []);

  useEffect(() => {
    const handleCycleFocus = () => {
      cycleFocus();
    };
    window.addEventListener(DASHBOARD_CYCLE_FOCUS_EVENT, handleCycleFocus);
    return () => window.removeEventListener(DASHBOARD_CYCLE_FOCUS_EVENT, handleCycleFocus);
  }, [cycleFocus]);

  const addNewPanel = (componentType, title, panelParams = {}) => {
    if (!apiRef.current) return;
    const id = "win-" + Date.now();
    
    // Get existing panels using toJSON method
    let position = null;
    try {
      const layout = apiRef.current.toJSON();
      if (layout.panels && Object.keys(layout.panels).length > 0) {
        // Get the currently active panel or the last panel
        const activeGroup = layout.activeGroup;
        let referencePanelId = null;
        let direction = "right"; // Default direction
        
        if (activeGroup && layout.panels[activeGroup]) {
          // Use the active panel as reference
          referencePanelId = activeGroup;
        } else {
          // Fallback to the last panel
          const panelIds = Object.keys(layout.panels);
          referencePanelId = panelIds[panelIds.length - 1];
        }
        
        if (referencePanelId) {
          // Smart positioning: alternate between right and below for better layout
          const panelCount = Object.keys(layout.panels).length;
          if (panelCount % 2 === 0) {
            direction = "below"; // Even panels go below
          } else {
            direction = "right"; // Odd panels go to the right
          }
          
          position = { referencePanel: referencePanelId, direction };
        }
      }
    } catch (e) {
      console.warn('Could not get existing panels:', e);
    }
    
    apiRef.current.addPanel({ 
      id, 
      component: componentType, 
      title: title || "New Panel",
      position,
      params: panelParams
    });
  };

  const handleGlobalFiltersChange = (newFilters) => {
    setGlobalFilters(newFilters);
    // You can add logic here to apply filters to existing panels
    console.log('Global filters updated:', newFilters);
  };

  // REMOVED: Manual layout triggering - let Dockview handle sidebar changes naturally

  const toggleActivePanelMaximize = useCallback(() => {
    const api = apiRef.current;
    const activePanel = api?.activePanel;
    const panelApi = activePanel?.api;
    if (!panelApi) return;
    // Use the exact same maximize/restore path as the tab layout button.
    toggleDockviewPanelLayout(panelApi, api);
    setIsGroupMaximized(typeof api?.hasMaximizedGroup === 'function' ? api.hasMaximizedGroup() : false);
    window.dispatchEvent(new CustomEvent(DOCKVIEW_MAXIMIZE_STATE_EVENT));
  }, []);

  React.useEffect(() => {
    const host = dockviewHostRef.current;
    if (!host) return;

    const onDoubleClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.talia-dv-tab__actions')) return;
      const tabHeader = target.closest('.dv-tab');
      if (!tabHeader) return;
      toggleActivePanelMaximize();
    };

    host.addEventListener('dblclick', onDoubleClick);
    return () => host.removeEventListener('dblclick', onDoubleClick);
  }, [toggleActivePanelMaximize]);

  const defaultTabComponent = useCallback(
    (props) => (
      <TaliaDockviewTab
        {...props}
        reportPanelIds={reportPanelIds}
        refreshableReportPanelIds={refreshableReportPanelIds}
        groupActionPanelIds={groupActionPanelIds}
        maximizeStateToken={isGroupMaximized}
      />
    ),
    [reportPanelIds, refreshableReportPanelIds, groupActionPanelIds, isGroupMaximized]
  );

  const onReady = useCallback((event) => {
    debugLog('Dockview onReady called');
    if (initializedRef.current) {
      debugLog('Dockview already initialized, skipping');
      return;
    }
    initializedRef.current = true;

    const api = event.api;
    apiRef.current = api;
    window.dockviewApi = api; // Make API available globally for layout presets

    debugLog("Dockview onReady - API initialized", api);

    // Load and restore settings BEFORE creating panels
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.version === LAYOUT_VERSION && parsed?.data) { 
          // Validate layout data structure before attempting to restore
          const isValidLayout = validateLayoutData(parsed.data);
          if (!isValidLayout) {
            console.warn('Invalid layout data structure, clearing corrupted data');
            localStorage.removeItem(LAYOUT_KEY);
            createDefaultLayout();
            return;
          }
          
          // Restore font settings FIRST to prevent component recreation
          if (parsed.fontSettings) {
            setCurrentTheme(parsed.fontSettings.theme || DEFAULT_THEME);
            setFontSize(parsed.fontSettings.fontSize || 12);
            setFontFamily(parsed.fontSettings.fontFamily || 'Inter');
            setSpacingMode(parsed.fontSettings.spacingMode || 'default');
          }
          
          // Restore sidebar state
          if (parsed.sidebar) {
            setSidebarCollapsed(parsed.sidebar.collapsed || false);
            setSidebarWidth(parsed.sidebar.width || 280);
          }
          
          // Restore global filters
          if (parsed.globalFilters) {
            setGlobalFilters(parsed.globalFilters);
          }
          
          // Load layout after a longer delay to ensure all components are stable
          setTimeout(() => {
            try {
              api.fromJSON(parsed.data);
              debugLog('Layout restored from localStorage');
            } catch (e) {
              console.warn('Failed to restore layout, clearing corrupted data:', e);
              // Clear corrupted layout data
              localStorage.removeItem(LAYOUT_KEY);
              createDefaultLayout();
            }
          }, 500);
          
          return; 
        }
      } catch (e) { 
        console.warn("Layout restore failed, clearing corrupted data:", e);
        localStorage.removeItem(LAYOUT_KEY);
      }
    }

    // Check for layout preset first, otherwise create default layout
    const preset = localStorage.getItem('dockview-layout-preset');
    if (preset) {
      loadLayoutPreset(api);
    } else {
      createDefaultLayout();
    }
    
    // REMOVED: forcePanelResize function - let Dockview handle layout naturally
    
    if (typeof api.onDidMaximizedGroupChange === 'function') {
      api.onDidMaximizedGroupChange(() => {
        const maximized = typeof api.hasMaximizedGroup === 'function' ? api.hasMaximizedGroup() : false;
        setIsGroupMaximized(maximized);
        window.dispatchEvent(new CustomEvent(DOCKVIEW_MAXIMIZE_STATE_EVENT));
      });
    }

    setIsGroupMaximized(typeof api.hasMaximizedGroup === 'function' ? api.hasMaximizedGroup() : false);
    window.dispatchEvent(new CustomEvent(DOCKVIEW_MAXIMIZE_STATE_EVENT));
    
    // Let Dockview handle all layout and rendering naturally
    // No MutationObserver or DOM manipulation needed
  }, []);

  const createDefaultLayout = useCallback(async () => {
    // Load the first available focus layout as the default
    // Try to find a focus by name "Performance" or use the first available focus
    console.log('Creating default layout using first available focus');
    try {
      const focuses = await graphQLFocusService.getFocusesForRole(normalizedUserRole || 'ADMIN');
      if (focuses && focuses.length > 0) {
        // Try to find "Performance" focus by name, otherwise use first focus
        const performanceFocus = focuses.find(f => f.name.toLowerCase().includes('performance')) || focuses[0];
        console.log(`Loading default focus: ${performanceFocus.name} (ID: ${performanceFocus.id})`);
        await loadFocusLayout(performanceFocus.id);
      } else {
        console.warn('No focuses available, skipping default layout load');
      }
    } catch (error) {
      console.error('Error loading default focus:', error);
      // Don't throw - allow the app to continue without a default layout
    }
    
    // Safety: in case Tabulator doesn't emit, show first sailing
    setTimeout(() => { emitSelect({ id:1, ship:"Celestyal Discovery", sailing:"7N Islands" }); }, 700);
  }, [loadFocusLayout, normalizedUserRole]);

  // Load layout preset on startup
  const loadLayoutPreset = useCallback((api) => {
    const preset = localStorage.getItem('dockview-layout-preset');
    if (preset) {
      localStorage.removeItem('dockview-layout-preset'); // Clear after use
      
      const timestamp = Date.now();
      
      switch (preset) {
        case 'grid':
          // 2x2 grid layout - add first panel without reference
          api.addPanel({ id: `grid-${timestamp}-1`, component: "table", title: "Sailings (Tabulator)" });
          setTimeout(() => {
            // Add second panel to the right
            api.addPanel({ id: `grid-${timestamp}-2`, component: "chart", title: "Booking Curve (Chart.js)" });
            setTimeout(() => {
              // Add third panel below first
              api.addPanel({ id: `grid-${timestamp}-3`, component: "graphql-books", title: "Books (GraphQL)" });
              setTimeout(() => {
                // Add fourth panel to the right of third
                api.addPanel({ id: `grid-${timestamp}-4`, component: "graphql-ships", title: "Ships (GraphQL)" });
              }, 300);
            }, 300);
          }, 300);
          break;
          
        case 'horizontal':
          // Horizontal layout - all panels in a row
          api.addPanel({ id: `h-${timestamp}-1`, component: "table", title: "Sailings (Tabulator)" });
          setTimeout(() => {
            // Add second panel to the right of first
            try {
              api.addPanel({ id: `h-${timestamp}-2`, component: "chart", title: "Booking Curve (Chart.js)", position: { referencePanel: `h-${timestamp}-1`, direction: "right" } });
            } catch (e) {
              console.warn('Failed to add panel with reference, adding without position:', e);
              api.addPanel({ id: `h-${timestamp}-2`, component: "chart", title: "Booking Curve (Chart.js)" });
            }
            setTimeout(() => {
              // Add third panel to the right of second
              try {
                api.addPanel({ id: `h-${timestamp}-3`, component: "graphql-books", title: "Books (GraphQL)", position: { referencePanel: `h-${timestamp}-2`, direction: "right" } });
              } catch (e) {
                console.warn('Failed to add panel with reference, adding without position:', e);
                api.addPanel({ id: `h-${timestamp}-3`, component: "graphql-books", title: "Books (GraphQL)" });
              }
              setTimeout(() => {
                // Add fourth panel to the right of third
                try {
                  api.addPanel({ id: `h-${timestamp}-4`, component: "graphql-ships", title: "Ships (GraphQL)", position: { referencePanel: `h-${timestamp}-3`, direction: "right" } });
                } catch (e) {
                  console.warn('Failed to add panel with reference, adding without position:', e);
                  api.addPanel({ id: `h-${timestamp}-4`, component: "graphql-ships", title: "Ships (GraphQL)" });
                }
              }, 500);
            }, 500);
          }, 500);
          break;
          
        case 'vertical':
          // Vertical layout - all panels stacked
          api.addPanel({ id: `v-${timestamp}-1`, component: "table", title: "Sailings (Tabulator)" });
          setTimeout(() => {
            // Add second panel below first
            try {
              api.addPanel({ id: `v-${timestamp}-2`, component: "chart", title: "Booking Curve (Chart.js)", position: { referencePanel: `v-${timestamp}-1`, direction: "below" } });
            } catch (e) {
              console.warn('Failed to add panel with reference, adding without position:', e);
              api.addPanel({ id: `v-${timestamp}-2`, component: "chart", title: "Booking Curve (Chart.js)" });
            }
            setTimeout(() => {
              // Add third panel below second
              try {
                api.addPanel({ id: `v-${timestamp}-3`, component: "graphql-books", title: "Books (GraphQL)", position: { referencePanel: `v-${timestamp}-2`, direction: "below" } });
              } catch (e) {
                console.warn('Failed to add panel with reference, adding without position:', e);
                api.addPanel({ id: `v-${timestamp}-3`, component: "graphql-books", title: "Books (GraphQL)" });
              }
              setTimeout(() => {
                // Add fourth panel below third
                try {
                  api.addPanel({ id: `v-${timestamp}-4`, component: "graphql-ships", title: "Ships (GraphQL)", position: { referencePanel: `v-${timestamp}-3`, direction: "below" } });
                } catch (e) {
                  console.warn('Failed to add panel with reference, adding without position:', e);
                  api.addPanel({ id: `v-${timestamp}-4`, component: "graphql-ships", title: "Ships (GraphQL)" });
                }
              }, 500);
            }, 500);
          }, 500);
          break;
      }
    }
  }, []);

  debugLog('App render called');

  return (
    <>
      {/* Status Bar is now at top level (main.jsx) - not rendered here */}
      {/* DevRoleSelector is now in ModeSelector dropdown */}
      <div 
      className={`dashboard-shell dockview-theme-${theme.name.toLowerCase().replace(' ', '-')} ${isGroupMaximized ? 'dashboard-shell--maximized' : ''}`} 
      ref={shellRef}
    >
      <div className="dashboard-layout">
        <DashboardSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          onAddPanel={addNewPanel}
          globalFilters={globalFilters}
          onGlobalFiltersChange={handleGlobalFiltersChange}
          currentFocus={currentFocus}
          onFocusChange={handleFocusChange}
          userRole={userRole}
          focusLoading={focusLoading}
          focusError={focusError}
          onSaveCurrentLayout={handleSaveCurrentLayoutToFocus}
        />
        
        {/* Resize Handle - positioned between sidebar and main content */}
        {!sidebarCollapsed && (
          <div
            className="dashboard-resize-handle"
            onMouseDown={handleMouseDown}
          />
        )}
        
        {isResizing && (
          <div className="dashboard-resize-guide" />
        )}
        
        {/* Dockview container with flex: 1 to fill remaining space */}
        <div className="dashboard-content" ref={dockviewHostRef}>
          <DockviewReact 
            components={{ 
              panel: InfoPanel, 
              table: TablePanel, 
              chart: ChartPanel,
              "graphql-books": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "books"}} />,
              "graphql-ships": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "ships"}} />,
              "graphql-cabins": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "cabinAvailability"}} />,
              ...reportComponentMap,
              // Admin components
              "admin-dashboard": AdminDashboard,
              "user-mapping-table": UserMappingTable,
              "talia-user-table": TaliaUserTable,
              "context-row-monitor": ContextRowMonitor
            }} 
            defaultTabComponent={defaultTabComponent}
            onReady={onReady}
            className="dashboard-dockview"
          />
        </div>
      </div>

      </div>
    </>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    debugLog('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dashboard-error-boundary">
          <h2>Application Error</h2>
          <p>Error: {this.state.error?.message}</p>
          <p>Check console for details</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export Dashboard component only
// ThemeProvider is now centralized in src/contexts/ThemeContext.jsx
export default Dashboard;

