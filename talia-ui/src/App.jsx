import React, { useCallback, useRef, useEffect, useState } from "react";
import { ApolloProvider } from '@apollo/client';
import { DockviewReact } from "dockview";
import "dockview/dist/styles/dockview.css"; // required Dockview CSS
import { getFocusLayout, getAvailableFocuses } from "./data/focusLayouts";
import KPICards from "./components/focus-panels/KPICards";
import OccupancyChart from "./components/focus-panels/OccupancyChart";
import RevenueBreakdown from "./components/focus-panels/RevenueBreakdown";
import ExceptionList from "./components/focus-panels/ExceptionList";
import ItineraryList from "./components/focus-panels/ItineraryList";
import { apolloClient, GraphQLUtils } from "./lib/apolloClient";
// Focus Management Integration
import { FocusSelector, FocusManager } from "./components/focus-management";
import { useFocusManagement } from "./hooks/useFocusManagement";
import { useAuth } from "./contexts/AuthContext";
import "./components/focus-management/focus-management.css";

// Debug logging
const debugLog = (message, data = null) => {
  console.log(`[App Debug] ${message}`, data || '');
};

// Basic startup logging
console.log('🚀 App.jsx file loaded');
console.log('📦 React version:', React?.version);
console.log('🔧 Dockview imported:', !!DockviewReact);

// Theme system
const THEMES = {
  default: {
    name: 'Default',
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      sidebar: '#f7f3ee',
      sidebarBorder: '#e8dfd0',
      sidebarHeader: '#f5efe6',
      accent: '#b08d57',
      accentHover: 'rgba(176, 141, 87, 0.6)',
      accentLight: 'rgba(176, 141, 87, 0.3)',
      textSecondary: '#6b6b6b',
      textMuted: '#999',
      border: '#e8dfd0',
      hover: '#fff7ea',
      selected: '#fdeacc'
    }
  },
  dark: {
    name: 'Dark Mode',
    colors: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      sidebar: '#252526',
      sidebarBorder: '#3e3e42',
      sidebarHeader: '#2d2d30',
      accent: '#007acc',
      accentHover: 'rgba(0, 122, 204, 0.6)',
      accentLight: 'rgba(0, 122, 204, 0.3)',
      textSecondary: '#cccccc',
      textMuted: '#808080',
      border: '#3e3e42',
      hover: '#2a2d2e',
      selected: '#094771'
    }
  },
  light: {
    name: 'Light Mode',
    colors: {
      background: '#ffffff',
      foreground: '#333333',
      sidebar: '#f3f3f3',
      sidebarBorder: '#e1e1e1',
      sidebarHeader: '#e8e8e8',
      accent: '#0078d4',
      accentHover: 'rgba(0, 120, 212, 0.6)',
      accentLight: 'rgba(0, 120, 212, 0.3)',
      textSecondary: '#666666',
      textMuted: '#999999',
      border: '#e1e1e1',
      hover: '#f5f5f5',
      selected: '#deecf9'
    }
  }
};

// Theme Context
const ThemeContext = React.createContext();

// Font families for data visualization
const FONT_FAMILIES = {
  'Inter': {
    name: 'Inter',
    value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    description: 'Modern, clean, highly readable'
  },
  'Roboto': {
    name: 'Roboto',
    value: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    description: 'Google\'s data-friendly font'
  },
  'Source Sans Pro': {
    name: 'Source Sans Pro',
    value: '"Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    description: 'Adobe\'s professional font'
  },
  'Arial': {
    name: 'Arial',
    value: 'Arial, Helvetica, sans-serif',
    description: 'Classic, widely supported'
  },
  'Verdana': {
    name: 'Verdana',
    value: 'Verdana, Geneva, sans-serif',
    description: 'High readability, screen-optimized'
  },
  'Brush Script': {
    name: 'Brush Script',
    value: '"Brush Script MT", cursive',
    description: 'Handwritten, casual style'
  },
  'Georgia': {
    name: 'Georgia',
    value: 'Georgia, "Times New Roman", serif',
    description: 'Elegant serif, print-friendly'
  },
  'Comic Sans': {
    name: 'Comic Sans',
    value: '"Comic Sans MS", cursive, sans-serif',
    description: 'Informal, friendly appearance'
  }
};

// Theme Provider Component
function ThemeProvider({ children }) {
  // Initialize appearance settings from localStorage if available
  const [currentTheme, setCurrentTheme] = React.useState(() => {
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.fontSettings?.theme || 'default';
      }
    } catch (e) {
      console.warn('Failed to load theme from localStorage:', e);
    }
    return 'default';
  });
  
  const [fontSize, setFontSize] = React.useState(() => {
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.fontSettings?.fontSize || 12;
      }
    } catch (e) {
      console.warn('Failed to load fontSize from localStorage:', e);
    }
    return 12;
  });
  
  const [fontFamily, setFontFamily] = React.useState(() => {
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.fontSettings?.fontFamily || 'Inter';
      }
    } catch (e) {
      console.warn('Failed to load fontFamily from localStorage:', e);
    }
    return 'Inter';
  });
  
  const [spacingMode, setSpacingMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.fontSettings?.spacingMode || 'default';
      }
    } catch (e) {
      console.warn('Failed to load spacingMode from localStorage:', e);
    }
    return 'default';
  });

  const theme = THEMES[currentTheme];
  const scaledFontSize = fontSize;
  const selectedFont = FONT_FAMILIES[fontFamily];

  const value = {
    theme,
    currentTheme,
    setCurrentTheme,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    selectedFont,
    spacingMode,
    setSpacingMode,
    scaledFontSize
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

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
const SELECT_EVENT = "talia:sailing.select";   // payload: one record
const CLEAR_EVENT  = "talia:sailing.clear";    // clear selection

function emitSelect(record) {
  try { window.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: record })); } catch (e) { console.warn("emitSelect failed", e); }
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

// ----------------- Lightweight CDN loader (idempotent) -----------------
const CDN = {
  tabulatorCss: [
    "https://cdnjs.cloudflare.com/ajax/libs/tabulator/5.6.1/css/tabulator.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/tabulator-tables/5.6.1/css/tabulator.min.css",
    "https://unpkg.com/tabulator-tables@5.6.1/dist/css/tabulator.min.css",
  ],
  tabulatorJs: [
    "https://cdnjs.cloudflare.com/ajax/libs/tabulator/5.6.1/js/tabulator.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/tabulator-tables/5.6.1/js/tabulator.min.js",
    "https://unpkg.com/tabulator-tables@5.6.1/dist/js/tabulator.min.js",
  ],
  chartJs: [
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.0/chart.umd.min.js",
    "https://unpkg.com/chart.js@4.4.3/dist/chart.umd.min.js",
  ],
};

const _loaded = new Set();
function loadCssOnce(href) {
  return new Promise((resolve, reject) => {
    if (_loaded.has(href) || document.querySelector(`link[href="${href}"]`)) return resolve(href);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => { _loaded.add(href); resolve(href); };
    link.onerror = (e) => { console.warn("[CDN] CSS failed:", href, e); reject(e); };
    document.head.appendChild(link);
  });
}
function loadScriptOnce(src, checkGlobal) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof checkGlobal === "function") {
        const g = checkGlobal();
        if (g) return resolve(g);
      }
    } catch {}
    if (_loaded.has(src) || document.querySelector(`script[src="${src}"]`)) return resolve(src);
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => { _loaded.add(src); resolve(src); };
    s.onerror = (e) => { console.warn("[CDN] JS failed:", src, e); reject(e); };
    document.head.appendChild(s);
  });
}
async function loadCssFromList(urls) {
  for (const href of urls) { try { await loadCssOnce(href); console.log("[CDN] CSS loaded:", href); return true; } catch {} }
  return false;
}
async function loadScriptFromList(urls, checkGlobal) {
  for (const src of urls) {
    try {
      await loadScriptOnce(src, checkGlobal);
      if (typeof checkGlobal === "function") {
        const g = checkGlobal();
        if (g) { console.log("[CDN] JS loaded:", src); return g; }
      } else { console.log("[CDN] JS loaded:", src); return true; }
    } catch {}
  }
  return null;
}

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
  const { theme, fontSize, selectedFont, spacingMode, fontFamily } = useTheme();
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const failSafeRef = useRef(null);    // ensure timeout is always cleared
  const builtRef = useRef(false);       // only redraw after tableBuilt
  const initializedRef = useRef(false);
  const [filters, setFilters] = React.useState({
    ship: '',
    sailing: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    bookedMin: '',
    bookedMax: ''
  });

  // Define panel close handler outside useEffect to avoid scoping issues
  const onPanelClosed = useCallback(() => { 
    try { 
      if (builtRef.current && instanceRef.current && typeof instanceRef.current.redraw === 'function') {
        instanceRef.current.redraw(true); 
      }
    } catch (e) {
      console.warn('[TablePanel] panel close redraw failed:', e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ro = null;

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
            <thead><tr>${headers.map(h=>`<th style=\"text-align:left;border-bottom:1px solid #e8dfd0;padding:4px 6px\">${h}</th>`).join("")}</tr></thead>
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
      } catch {}
      console.log('[FallbackTable] rendered');
    };

    (async () => {
      try {
        if (!tableRef.current || initializedRef.current) return;

        // Ensure Tabulator is available (via CDN)
        const cssOk = await loadCssFromList(CDN.tabulatorCss);
        await loadScriptFromList(CDN.tabulatorJs, () => window.Tabulator || window.TabulatorFull);
        const TabGlobal = window.Tabulator || window.TabulatorFull;
        console.log('[CDN] Tabulator global typeof:', typeof TabGlobal);
        if (!cssOk) console.warn("[CDN] Tabulator CSS failed to load from all sources");
        if (!TabGlobal) { renderFallbackTable(); return; }

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

        const TabCtor = TabGlobal;
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
          theme: "default", // Use default theme, we'll override with CSS
          fontSize: fontSize,
          headerHeight: spacingMode === 'compact' ? Math.max(28, fontSize + 6) : Math.max(35, fontSize + 12),
          rowHeight: spacingMode === 'compact' ? Math.max(24, fontSize + 4) : Math.max(32, fontSize + 8),
          rowClick: (e, row) => {
            try { row?.select?.(); } catch {}
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
            try { cell.getRow()?.select?.(); } catch {}
          },
        });
        console.log('[Tabulator] instance created');

        // Listen for a clear selection from the toolbar
        const onClear = () => { try { instanceRef.current?.deselectRow?.(); } catch {}; };
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

        // Set up resize listeners immediately, not just after tableBuilt
        try {
          // Set up panel close listener immediately
          window.addEventListener('panelClosed', onPanelClosed);
        } catch (e) { console.warn('[Tabulator] panel close listener failed', e); }

        // Hook events after init
        try {
          instanceRef.current.on('tableBuilt', () => { 
            builtRef.current = true; 
            console.log('[Tabulator] tableBuilt');
            
            // Set up ResizeObserver AFTER table is built with a small delay
            setTimeout(() => {
              try {
                ro = new ResizeObserver(() => { 
                  try { 
                    if (builtRef.current && instanceRef.current && typeof instanceRef.current.redraw === 'function') {
                      instanceRef.current.redraw(true); 
                    }
                  } catch {} 
                });
                ro.observe(tableRef.current);
                window.addEventListener('resize', () => { 
                  try { 
                    if (builtRef.current && instanceRef.current && typeof instanceRef.current.redraw === 'function') {
                      instanceRef.current.redraw(true);
                    }
                  } catch {} 
                });
              } catch (e) { console.warn('[Tabulator] resize observer failed', e); }
            }, 100); // Small delay to ensure table is fully ready
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
      try { ro?.disconnect?.(); } catch {}
      try { instanceRef.current?.destroy?.(); } catch {}
      // Remove panel close listener
      window.removeEventListener('panelClosed', onPanelClosed);
      instanceRef.current = null;
      builtRef.current = false;
      initializedRef.current = false;
    };
  }, []);

  // Note: Font changes are handled via CSS and don't require Tabulator updates
  // This prevents interference with Dockview's drag and drop system

  return (
    <div style={{ 
      height: "100%", 
      width: "100%", 
      display: "flex", 
      flexDirection: "column",
      background: theme.colors.background,
      color: theme.colors.foreground,
      fontSize: `${fontSize}px`,
      fontFamily: selectedFont.value
    }}>
      <div style={{ 
        padding: "8px 12px", 
        background: theme.colors.sidebarHeader, 
        borderBottom: `1px solid ${theme.colors.sidebarBorder}`,
        fontSize: `${fontSize - 1}px`,
        color: theme.colors.textSecondary
      }}>
        <strong>Table Filters:</strong> Use the filter controls in column headers to filter data. 
        <span style={{ marginLeft: "8px", color: theme.colors.accent }}>
          💡 Tip: Click filter icons in column headers to filter by Ship, Sailing, Status, or numeric values
        </span>
      </div>
      <div 
        ref={tableRef} 
        style={{ height: "100%", width: "100%", flex: 1 }} 
      />
      <style>{`
        /* Tabulator theme overrides */
        .tabulator {
          font-size: ${fontSize}px !important;
          font-family: ${selectedFont.value} !important;
          background-color: ${theme.colors.background} !important;
          color: ${theme.colors.foreground} !important;
        }
        
        .tabulator .tabulator-header {
          background-color: ${theme.colors.sidebarHeader} !important;
          color: ${theme.colors.foreground} !important;
          font-size: ${fontSize}px !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${theme.colors.sidebarBorder} !important;
        }
        
        .tabulator .tabulator-header .tabulator-col {
          background-color: ${theme.colors.sidebarHeader} !important;
          color: ${theme.colors.foreground} !important;
          font-size: ${fontSize}px !important;
          font-family: ${selectedFont.value} !important;
          font-weight: 600 !important;
          border-right: 1px solid ${theme.colors.sidebarBorder} !important;
          padding: ${spacingMode === 'compact' ? Math.max(4, fontSize / 4) : Math.max(8, fontSize / 2)}px ${spacingMode === 'compact' ? Math.max(4, fontSize / 4) : Math.max(8, fontSize / 2)}px !important;
          line-height: ${spacingMode === 'compact' ? 1.2 : 1.4} !important;
        }
        
        .tabulator .tabulator-row {
          background-color: ${theme.colors.background} !important;
          color: ${theme.colors.foreground} !important;
          font-size: ${fontSize}px !important;
          border-bottom: 1px solid ${theme.colors.border} !important;
        }
        
        .tabulator .tabulator-row:hover { 
          background-color: ${theme.colors.hover} !important; 
        }
        
        .tabulator .tabulator-row.tabulator-selected { 
          background-color: ${theme.colors.selected} !important; 
        }
        
        .tabulator .tabulator-cell {
          background-color: inherit !important;
          color: inherit !important;
          font-size: ${fontSize}px !important;
          font-family: ${selectedFont.value} !important;
          padding: ${spacingMode === 'compact' ? Math.max(4, fontSize / 4) : Math.max(8, fontSize / 2)}px ${spacingMode === 'compact' ? Math.max(4, fontSize / 4) : Math.max(8, fontSize / 2)}px !important;
          line-height: ${spacingMode === 'compact' ? 1.2 : 1.4} !important;
          vertical-align: middle !important;
        }
        
        .tabulator .tabulator-header-filter { 
          background-color: ${theme.colors.sidebarHeader} !important; 
        }
        
        .tabulator .tabulator-header-filter input, 
        .tabulator .tabulator-header-filter select { 
          border: 1px solid ${theme.colors.border} !important; 
          border-radius: 4px !important;
          padding: 4px 6px !important;
          font-size: ${fontSize - 1}px !important;
          font-family: ${selectedFont.value} !important;
          background-color: ${theme.colors.background} !important;
          color: ${theme.colors.foreground} !important;
        }
        
        .tabulator .tabulator-header-filter input:focus, 
        .tabulator .tabulator-header-filter select:focus { 
          border-color: ${theme.colors.accent} !important; 
          outline: none !important;
          box-shadow: 0 0 0 2px ${theme.colors.accentLight} !important;
        }
        
        .tabulator .tabulator-header-filter input::placeholder {
          color: ${theme.colors.textMuted} !important;
        }
      `}</style>
    </div>
  );
});

// ---- Panel 2: Chart.js line chart (single series + target; listens to SELECT_EVENT) ----
const ChartPanel = React.memo(function ChartPanel() {
  const { theme, fontSize, selectedFont, fontFamily } = useTheme();
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

        // Ensure Chart.js is available (via CDN)
        await loadScriptFromList(CDN.chartJs, () => window.Chart);
        const ChartGlobal = window.Chart;
        if (!ChartGlobal) { console.error("Chart.js not available after CDN load"); return; }

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
          const allCharts = ChartGlobal.instances || {};
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
        
        chartRef.current = new ChartGlobal(ctx, {
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
        
        // Listen for panel close events to trigger chart resize
        const onPanelClosed = () => {
          if (chartRef.current) {
            chartRef.current.resize();
          }
        };
        window.addEventListener('panelClosed', onPanelClosed);

        // Mark as initialized
        initializedRef.current = true;

        // Kick off with a default selection so the chart shows a curve quickly
        setTimeout(() => { if (!cancelled) emitSelect({ id:1, ship:"Celestyal Discovery", sailing:"7N Islands" }); }, 350);

        return () => {
          window.removeEventListener(SELECT_EVENT, onSelect);
          window.removeEventListener(CLEAR_EVENT, onClear);
          window.removeEventListener('panelClosed', onPanelClosed);
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
    <div style={{ 
      height: "100%", 
      width: "100%", 
      position: "relative",
      background: theme.colors.background,
      color: theme.colors.foreground,
      fontSize: `${fontSize}px`,
      fontFamily: selectedFont.value
    }}>
      <canvas 
        ref={canvasRef} 
        style={{ height: "100%", width: "100%" }} 
      />
    </div>
  );
});

// ---- Simple text panel (fallback/info) ----
function InfoPanel(props) {
  const { theme, fontSize, selectedFont, fontFamily } = useTheme();
  const title = props?.params?.panel?.title || props?.params?.title || "Panel";
  return (
    <div style={{ 
      height: "100%", 
      width: "100%", 
      padding: 16, 
      fontSize: `${fontSize}px`, 
      fontFamily: selectedFont.value,
      lineHeight: 1.5, 
      color: theme.colors.foreground, 
      background: theme.colors.background 
    }}>
      <p style={{ margin: 0, marginBottom: 8, fontWeight: 600 }}>{title}</p>
      <p style={{ margin: 0 }}>This is a generic panel. Drag the tab to dock/split.</p>
    </div>
  );
}

// ---- VS Code-style Sidebar Component ----
function Sidebar({ isCollapsed, onToggle, onAddPanel, globalFilters, onGlobalFiltersChange, width, saveLayout, loadLayout, addPanel, clearSelection, clearFilters, resetLayout, createLayoutPreset, currentFocus, onFocusChange, userRole, focuses, focusLoading, focusError, fallbackMode, initializeStandardFocuses }) {
  const { theme, currentTheme, setCurrentTheme, fontSize, setFontSize, fontFamily, setFontFamily, selectedFont, spacingMode, setSpacingMode } = useTheme();
  debugLog('Sidebar component render', { isCollapsed, width, globalFilters, currentTheme, fontSize, fontFamily, spacingMode });
  
  // TEST: This should be visible at the very top of the sidebar
  console.log('🔍 Sidebar rendering with props:', { userRole, focuses: focuses?.length, focusLoading, focusError, fallbackMode });

  const [expandedSections, setExpandedSections] = React.useState({
    focus: true,
    criteria: true,
    reports: true,
    appearance: false,
    controls: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const sidebarStyle = {
    width: isCollapsed ? '48px' : `${width}px`,
    height: '100%',
    background: theme.colors.sidebar,
    borderRight: `1px solid ${theme.colors.sidebarBorder}`,
    display: 'flex',
    flexDirection: 'column',
    transition: isCollapsed ? 'width 0.2s ease' : 'none',
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
    fontSize: `${fontSize}px`,
    fontFamily: selectedFont.value
  };

  const sectionStyle = {
    borderBottom: `1px solid ${theme.colors.sidebarBorder}`
  };

  const sectionHeaderStyle = {
    padding: '8px 12px',
    background: theme.colors.sidebarHeader,
    borderBottom: `1px solid ${theme.colors.sidebarBorder}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: `${fontSize}px`,
    fontWeight: '600',
    color: theme.colors.foreground,
    userSelect: 'none'
  };

  const sectionContentStyle = {
    padding: '8px 12px',
    fontSize: `${fontSize}px`,
    color: theme.colors.foreground,
    maxHeight: '300px',
    overflow: 'auto'
  };

  const inputStyle = {
    width: '100%',
    padding: '6px 8px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '4px',
    fontSize: `${fontSize - 1}px`,
    marginBottom: '6px',
    background: theme.colors.background,
    color: theme.colors.foreground,
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    width: '100%',
    padding: '8px 6px',
    background: theme.colors.accent,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: `${fontSize - 1}px`,
    cursor: 'pointer',
    marginBottom: '6px',
    textAlign: 'left',
    boxSizing: 'border-box'
  };

  const iconStyle = {
    fontSize: '14px',
    transition: 'transform 0.2s ease'
  };

  if (isCollapsed) {
    return (
      <div style={sidebarStyle}>
        <div style={{ padding: '8px', textAlign: 'center' }}>
          <button
            onClick={onToggle}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
          >
            ☰
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px' }}>
          <button style={{ ...buttonStyle, width: '32px', height: '32px', marginBottom: '8px' }} title="Default Criteria">📊</button>
          <button style={{ ...buttonStyle, width: '32px', height: '32px', marginBottom: '8px' }} title="Reports">📋</button>
          <button style={{ ...buttonStyle, width: '32px', height: '32px', marginBottom: '8px' }} title="Appearance">🎨</button>
        </div>
      </div>
    );
  }

  return (
    <div style={sidebarStyle}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8dfd0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#2b2b2b' }}>Explorer</span>
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
        >
          ◀
        </button>
      </div>

      {/* TEST: This should be visible at the very top */}
      <div style={{ 
        background: '#FFD700', 
        color: '#000', 
        padding: '2px', 
        fontSize: '8px',
        textAlign: 'center',
        fontWeight: 'bold',
        border: '2px solid #FF0000'
      }}>
        🚨 SIDEBAR RENDERING TEST 🚨
      </div>

      {/* Enhanced Focus Section with New Focus Management */}
      <div style={sectionStyle}>
        {/* TEST: This should always be visible */}
        <div style={{ 
          background: '#ff6b6b', 
          color: 'white', 
          padding: '4px', 
          marginBottom: '8px',
          fontSize: '10px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          🧪 FOCUS MANAGEMENT TEST - SHOULD BE VISIBLE
        </div>
        <div 
          style={sectionHeaderStyle}
          onClick={() => {
            console.log('🔍 Focus Management section clicked!');
            toggleSection('focus');
          }}
        >
          <span>Focus Management</span>
          <span style={{ ...iconStyle, transform: expandedSections.focus ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
        </div>
        <div style={{ ...sectionContentStyle, display: expandedSections.focus ? 'block' : 'none' }}>
          {/* Debug Information */}
          <div style={{ 
            background: '#e7f3ff', 
            color: '#0066cc', 
            padding: '6px', 
            borderRadius: '4px', 
            marginBottom: '8px',
            fontSize: `${fontSize - 3}px`,
            border: '1px solid #b3d9ff'
          }}>
            <strong>Debug:</strong> Role: {userRole} | Focuses: {focuses?.length || 0} | Loading: {focusLoading ? 'Yes' : 'No'} | Fallback: {fallbackMode ? 'Yes' : 'No'}
          </div>
          
          {/* Show focus management error if any */}
          {focusError && (
            <div style={{ 
              background: '#f8d7da', 
              color: '#721c24', 
              padding: '8px', 
              borderRadius: '4px', 
              marginBottom: '10px',
              fontSize: `${fontSize - 2}px`
            }}>
              Focus Error: {focusError}
            </div>
          )}
          
          {/* Show loading state */}
          {focusLoading && (
            <div style={{ 
              background: '#d1ecf1', 
              color: '#0c5460', 
              padding: '8px', 
              borderRadius: '4px', 
              marginBottom: '10px',
              fontSize: `${fontSize - 2}px`
            }}>
              Loading focuses...
            </div>
          )}
          
          {/* New Focus Management System */}
          {focusError ? (
            <div style={{ 
              background: '#fff3cd', 
              color: '#856404', 
              padding: '8px', 
              borderRadius: '4px', 
              marginBottom: '10px',
              fontSize: `${fontSize - 2}px`
            }}>
              Focus Management Error: {focusError}
              <div style={{ marginTop: '4px', fontSize: `${fontSize - 3}px` }}>
                {fallbackMode ? 'Using fallback focus system.' : 'Using legacy focus system as fallback.'}
              </div>
            </div>
          ) : fallbackMode ? (
            <div style={{ 
              background: '#d1ecf1', 
              color: '#0c5460', 
              padding: '8px', 
              borderRadius: '4px', 
              marginBottom: '10px',
              fontSize: `${fontSize - 2}px`
            }}>
              📡 Database Offline - Using Fallback Focuses
            </div>
          ) : (
            <div>
              <div style={{ 
                background: '#90EE90', 
                color: '#006400', 
                padding: '8px', 
                marginBottom: '8px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                🟢 FocusSelector should render here
              </div>
              {(() => {
                try {
                  return (
                    <FocusSelector 
                      onFocusChange={onFocusChange}
                      currentFocusId={currentFocus}
                    />
                  );
                } catch (error) {
                  console.error('FocusSelector render error:', error);
                  return (
                    <div style={{ 
                      background: '#ff6b6b', 
                      color: 'white', 
                      padding: '8px',
                      fontSize: '12px'
                    }}>
                      FocusSelector Error: {error.message}
                    </div>
                  );
                }
              })()}
            </div>
          )}
          
          {/* Fallback: Show legacy focus list if FocusSelector fails or in fallback mode */}
          {(focusError || fallbackMode) && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ 
                fontSize: `${fontSize - 2}px`, 
                fontWeight: 'bold', 
                marginBottom: '8px',
                color: theme.colors.textSecondary
              }}>
                {fallbackMode ? 'Available Focus Options:' : 'Legacy Focus Options:'}
              </div>
              {[
                { id: 'performance', name: 'Performance Dashboard', icon: '📊' },
                { id: 'exception', name: 'Exception Management', icon: '⚠️' },
                { id: 'inventory', name: 'Inventory Management', icon: '📦' },
                { id: 'setup', name: 'Talia Set-up', icon: '⚙️' }
              ].map(focus => (
                <div
                  key={focus.id}
                  onClick={() => onFocusChange && onFocusChange(focus.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    background: currentFocus === focus.id ? theme.colors.accent : 'transparent',
                    color: currentFocus === focus.id ? 'white' : theme.colors.foreground,
                    borderRadius: '4px',
                    marginBottom: '2px',
                    fontSize: `${fontSize - 1}px`,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{focus.icon}</span>
                  <span>{focus.name}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Admin-only Focus Manager Button */}
          {userRole === 'admin' && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e0e0e0' }}>
              <button
                onClick={() => {
                  // Initialize standard focuses if not already done
                  if (focuses.length === 0) {
                    initializeStandardFocuses();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#2E86AB',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: `${fontSize - 2}px`,
                  cursor: 'pointer',
                  marginBottom: '4px'
                }}
              >
                🚀 Initialize Standard Focuses
              </button>
              <div style={{ 
                fontSize: `${fontSize - 3}px`, 
                color: theme.colors.textMuted,
                textAlign: 'center'
              }}>
                Admin: Set up standard focuses
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Default Criteria Section */}
      <div style={sectionStyle}>
        <div 
          style={sectionHeaderStyle}
          onClick={() => toggleSection('criteria')}
        >
          <span>Default Criteria</span>
          <span style={{ ...iconStyle, transform: expandedSections.criteria ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
        </div>
        <div style={{ ...sectionContentStyle, display: expandedSections.criteria ? 'block' : 'none' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '500' }}>Ship Filter:</label>
            <select 
              style={inputStyle}
              value={globalFilters.ship || ''}
              onChange={(e) => onGlobalFiltersChange({ ...globalFilters, ship: e.target.value })}
            >
              <option value="">All Ships</option>
              <option value="Celestyal Discovery">Celestyal Discovery</option>
              <option value="Celestyal Journey">Celestyal Journey</option>
            </select>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '500' }}>Date From:</label>
            <input
              type="date"
              style={inputStyle}
              value={globalFilters.dateFrom || ''}
              onChange={(e) => onGlobalFiltersChange({ ...globalFilters, dateFrom: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: '500' }}>Date To:</label>
            <input
              type="date"
              style={inputStyle}
              value={globalFilters.dateTo || ''}
              onChange={(e) => onGlobalFiltersChange({ ...globalFilters, dateTo: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Reports Section */}
      <div style={sectionStyle}>
        <div 
          style={sectionHeaderStyle}
          onClick={() => toggleSection('reports')}
        >
          <span>Reports</span>
          <span style={{ ...iconStyle, transform: expandedSections.reports ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
        </div>
        <div style={{ ...sectionContentStyle, display: expandedSections.reports ? 'block' : 'none' }}>
          <button style={buttonStyle} onClick={() => onAddPanel('table', 'New Table')}>
            📊 New Table
          </button>
          <button style={buttonStyle} onClick={() => onAddPanel('chart', 'New Chart')}>
            📈 New Chart
          </button>
          <button style={buttonStyle} onClick={() => onAddPanel('graphql-sailings', 'Sailings Data')}>
            🚢 Sailings Data
          </button>
          <button style={buttonStyle} onClick={() => onAddPanel('graphql-kpis', 'KPI Dashboard')}>
            📊 KPI Dashboard
          </button>
          <button style={buttonStyle} onClick={() => onAddPanel('graphql-exceptions', 'Exceptions')}>
            ⚠️ Exceptions
          </button>
          <button style={buttonStyle} onClick={() => onAddPanel('graphql-ships', 'Ships Report')}>
            🚢 Ships Report
          </button>
          <button style={buttonStyle} onClick={() => onAddPanel('graphql-cabins', 'Cabins Report')}>
            🏠 Cabins Report
          </button>
          <button style={buttonStyle} onClick={() => onAddPanel('graphql-books', 'Books Report')}>
            📚 Books Report
          </button>
        </div>
      </div>

      {/* Appearance Section */}
      <div style={sectionStyle}>
        <div 
          style={sectionHeaderStyle}
          onClick={() => toggleSection('appearance')}
        >
          <span>Appearance</span>
          <span style={{ ...iconStyle, transform: expandedSections.appearance ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
        </div>
        <div style={{ ...sectionContentStyle, display: expandedSections.appearance ? 'block' : 'none' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: `${fontSize - 1}px`, fontWeight: '500', color: theme.colors.foreground }}>Theme:</label>
            <select 
              style={inputStyle}
              value={currentTheme}
              onChange={(e) => setCurrentTheme(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="dark">Dark Mode</option>
              <option value="light">Light Mode</option>
            </select>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: `${fontSize - 1}px`, fontWeight: '500', color: theme.colors.foreground }}>Font Family:</label>
            <select 
              style={inputStyle}
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
            >
              {Object.entries(FONT_FAMILIES).map(([key, font]) => (
                <option key={key} value={key}>{font.name}</option>
              ))}
            </select>
            <div style={{ fontSize: `${fontSize - 2}px`, color: theme.colors.textMuted, marginTop: '2px' }}>
              {selectedFont.description}
            </div>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: `${fontSize - 1}px`, fontWeight: '500', color: theme.colors.foreground }}>Spacing Mode:</label>
            <select 
              style={inputStyle}
              value={spacingMode}
              onChange={(e) => setSpacingMode(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="compact">Compact</option>
            </select>
            <div style={{ fontSize: `${fontSize - 2}px`, color: theme.colors.textMuted, marginTop: '2px' }}>
              {spacingMode === 'compact' ? 'Minimal spacing for data cells' : 'Standard spacing for readability'}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: `${fontSize - 1}px`, fontWeight: '500', color: theme.colors.foreground }}>
              Font Size: {fontSize}px
            </label>
            <input 
              type="range" 
              min="10" 
              max="18" 
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ 
                width: '100%',
                accentColor: theme.colors.accent
              }}
            />
          </div>
        </div>
      </div>

      {/* Control Centre Section */}
      <div style={sectionStyle}>
        <div
          style={sectionHeaderStyle}
          onClick={() => toggleSection('controls')}
        >
          <span>Control Centre</span>
          <span style={{ ...iconStyle, transform: expandedSections.controls ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▶
          </span>
        </div>
        <div style={{ ...sectionContentStyle, display: expandedSections.controls ? 'block' : 'none' }}>
          <button
            style={buttonStyle}
            onClick={saveLayout}
          >
            💾 Save Layout
          </button>
          <button
            style={buttonStyle}
            onClick={loadLayout}
          >
            📂 Load Layout
          </button>
          <button
            style={buttonStyle}
            onClick={addPanel}
          >
            ➕ Add Panel
          </button>
          
          {/* Layout Preset Buttons */}
          <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
            <button
              style={{...buttonStyle, fontSize: `${fontSize - 2}px`, padding: "2px 6px"}}
              onClick={() => createLayoutPreset('grid')}
            >
              🔲 Grid
            </button>
            <button
              style={{...buttonStyle, fontSize: `${fontSize - 2}px`, padding: "2px 6px"}}
              onClick={() => createLayoutPreset('horizontal')}
            >
              ↔️ Horizontal
            </button>
            <button
              style={{...buttonStyle, fontSize: `${fontSize - 2}px`, padding: "2px 6px"}}
              onClick={() => createLayoutPreset('vertical')}
            >
              ↕️ Vertical
            </button>
          </div>
          
          <button
            style={buttonStyle}
            onClick={clearSelection}
          >
            ❌ Clear Selection
          </button>
          <button
            style={buttonStyle}
            onClick={clearFilters}
          >
            🔄 Clear Filters
          </button>
          <button
            style={buttonStyle}
            onClick={resetLayout}
          >
            🔄 Reset Layout
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', padding: '8px 12px', borderTop: '1px solid #e8dfd0', fontSize: '10px', color: '#6b6b6b' }}>
        Dockview v4.6.2
      </div>
      
    </div>
  );
}

// ---- Enhanced GraphQL Data Panel ----
const GraphQLPanel = React.memo(function GraphQLPanel(props) {
  const { theme, fontSize, selectedFont, fontFamily } = useTheme();
  debugLog('GraphQLPanel render', { props });

  const title = props?.params?.panel?.title || props?.params?.title || "GraphQL Data";
  const dataType = props?.params?.dataType || "ships";
  
  // Use Apollo Client for enhanced GraphQL queries
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const fetchData = async () => {
    debugLog('GraphQLPanel fetchData called', { dataType });
    setLoading(true);
    setError(null);

    try {
      let query, variables = {};
      
      switch (dataType) {
        case "books":
          query = `query GetBooks { books { title author } }`;
          break;
        case "ships":
          query = `query GetShips { ships { Ship_Id Ship_Code Ship_Name Ship_Pax_Capacity Ship_Length Ship_Tonnage } }`;
          break;
        case "sailings":
          query = `query GetSailings($userRole: UserRole) { 
            sailings(userRole: $userRole) { 
              id ship sailing depart booked available projected status 
            } 
          }`;
          variables = { userRole: GraphQLUtils.getUserRole() };
          break;
        case "kpis":
          query = `query GetKPIs($userRole: UserRole) { 
            kpis(userRole: $userRole) { 
              id title value target unit trend change period 
            } 
          }`;
          variables = { userRole: GraphQLUtils.getUserRole() };
          break;
        case "exceptions":
          query = `query GetExceptions($userRole: UserRole) { 
            exceptions(userRole: $userRole) { 
              id type severity message sailing ship createdAt resolved 
            } 
          }`;
          variables = { userRole: GraphQLUtils.getUserRole() };
          break;
        case "cabinAvailability":
          query = `query GetCabinAvailability { 
            cabinAvailability { 
              Snapshot_Date Package_Name Sail_Days Cabin_Category 
              Available_Cabins Total_Cabins Available_Weighted Availability_Result 
            } 
          }`;
          break;
        default:
          query = `query GetBooks { books { title author } }`;
      }

      debugLog('Making GraphQL request', { query, dataType, variables });

      const response = await apolloClient.query({
        query: require('graphql-tag')(query),
        variables,
        errorPolicy: 'all'
      });

      debugLog('GraphQL response received', response);

      if (response.errors) {
        setError(response.errors[0].message);
      } else {
        // Extract data based on query type
        const result = response.data;
        if (dataType === 'sailings') {
          setData({ sailings: result.sailings });
        } else if (dataType === 'kpis') {
          setData({ kpis: result.kpis });
        } else if (dataType === 'exceptions') {
          setData({ exceptions: result.exceptions });
        } else {
          setData(result);
        }
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
      <div style={{ 
        height: "100%", 
        width: "100%", 
        padding: 16, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        flexDirection: "column",
        background: theme.colors.background,
        color: theme.colors.foreground,
        fontSize: `${fontSize}px`,
        fontFamily: selectedFont.value
      }}>
        <div style={{ fontSize: `${fontSize + 4}px`, color: theme.colors.accent, marginBottom: 8 }}>🔄 Loading {dataType}...</div>
        <div style={{ fontSize: `${fontSize - 1}px`, color: theme.colors.textSecondary }}>Fetching data from GraphQL server</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        height: "100%", 
        width: "100%", 
        padding: 16, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        flexDirection: "column",
        background: theme.colors.background,
        color: theme.colors.foreground,
        fontSize: `${fontSize}px`,
        fontFamily: selectedFont.value
      }}>
        <div style={{ fontSize: `${fontSize + 4}px`, color: "#d32f2f", marginBottom: 8 }}>❌ GraphQL Error</div>
        <div style={{ fontSize: `${fontSize - 1}px`, color: theme.colors.textSecondary, textAlign: "center", marginBottom: 16 }}>
          {error}
        </div>
        <button 
          onClick={handleRefresh}
          style={{ 
            padding: "8px 16px", 
            background: theme.colors.accent, 
            color: "white", 
            border: "none", 
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: `${fontSize - 1}px`
          }}
        >
          Retry
        </button>
        <div style={{ fontSize: `${fontSize - 2}px`, color: theme.colors.textMuted, marginTop: 8 }}>
          Server: http://localhost:4000/graphql
        </div>
      </div>
    );
  }

  const items = data?.[dataType] || [];
  
  return (
    <div style={{ 
      height: "100%", 
      width: "100%", 
      display: "flex", 
      flexDirection: "column",
      background: theme.colors.background,
      color: theme.colors.foreground,
      fontSize: `${fontSize}px`
    }}>
      <div style={{ 
        padding: "8px 12px", 
        background: theme.colors.sidebarHeader, 
        borderBottom: `1px solid ${theme.colors.sidebarBorder}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ fontSize: `${fontSize + 2}px`, fontWeight: 600, color: theme.colors.foreground }}>
          {title} ({items.length} items)
        </div>
        <button 
          onClick={handleRefresh}
          style={{ 
            padding: "4px 8px", 
            background: theme.colors.accent, 
            color: "white", 
            border: "none", 
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: `${fontSize - 1}px`
          }}
        >
          🔄 Refresh
        </button>
      </div>
      
      <div 
        style={{ 
          flex: 1, 
          padding: 16, 
          overflow: "auto",
          background: theme.colors.background,
          color: theme.colors.foreground
        }}
      >
        {items.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            color: theme.colors.textSecondary, 
            fontSize: `${fontSize + 2}px` 
          }}>
            No {dataType} data available
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item, index) => (
              <div 
                key={item.id || index}
                style={{ 
                  padding: 12, 
                  background: theme.colors.sidebarHeader, 
                  border: `1px solid ${theme.colors.border}`, 
                  borderRadius: "6px",
                  fontSize: `${fontSize + 1}px`
                }}
              >
                <div style={{ 
                  fontWeight: 600, 
                  marginBottom: 6, 
                  color: theme.colors.foreground 
                }}>
                  {item.title || item.Ship_Name || item.Package_Name || `Item ${item.id || item.Ship_Id}`}
                </div>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", 
                  gap: 8, 
                  fontSize: `${fontSize}px`, 
                  color: theme.colors.textSecondary 
                }}>
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

function App() {
  const { theme, currentTheme, setCurrentTheme, fontSize, selectedFont, fontFamily, spacingMode, setFontSize, setFontFamily, setSpacingMode } = useTheme();
  
  // Focus Management Integration
  const { user } = useAuth();
  
  // Development mode: Override user role to admin for testing
  const devUser = user ? { ...user, role: 'admin' } : null;
  
  const {
    focuses,
    currentFocus: dbCurrentFocus,
    loading: focusLoading,
    error: focusError,
    fallbackMode,
    loadFocus,
    createFocus,
    updateFocus,
    deleteFocus,
    toggleFavorite,
    initializeStandardFocuses,
    favoriteFocuses,
    recentlyUsedFocuses
  } = useFocusManagement();
  
  debugLog('App component initializing');
  
  // Debug: Log focus management state
  console.log('🔍 Focus Management Debug:', {
    hasFocusSelector: !!FocusSelector,
    hasFocusManager: !!FocusManager,
    hasUseFocusManagement: !!useFocusManagement,
    focuses: focuses?.length || 0,
    focusLoading,
    focusError,
    fallbackMode,
    userRole
  });

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
  const initializedRef = useRef(false); // guard for React 18 StrictMode

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(280);
  const [isResizing, setIsResizing] = React.useState(false);
  const [globalFilters, setGlobalFilters] = React.useState({
    ship: '',
    dateFrom: '',
    dateTo: ''
  });

  // Focus navigation state - integrate with new focus management
  const [currentFocus, setCurrentFocus] = useState(() => {
    const saved = localStorage.getItem('talia-current-focus');
    return saved || 'performance';
  });
  const [userRole, setUserRole] = useState(devUser?.role || 'admin'); // Use dev user role or admin for full access during development

  // Update userRole when devUser changes
  useEffect(() => {
    if (devUser?.role) {
      setUserRole(devUser.role);
      console.log('User role updated to:', devUser.role);
    }
  }, [devUser?.role]);

  debugLog('App state initialized', { 
    sidebarCollapsed, 
    sidebarWidth, 
    globalFilters, 
    theme: theme.name, 
    fontSize,
    userRole,
    hasUser: !!user,
    hasDevUser: !!devUser,
    devUserRole: devUser?.role,
    focusLoading,
    focusError,
    fallbackMode,
    focusesCount: focuses?.length || 0
  });

  // Enhanced focus change handler - integrates with new focus management system
  const handleFocusChange = useCallback((focusId) => {
    console.log('Focus changed to:', focusId);
    setCurrentFocus(focusId);
    localStorage.setItem('talia-current-focus', focusId);
    
    // Use new focus management system if available
    if (dbCurrentFocus && dbCurrentFocus.id === focusId) {
      // Focus is already loaded from database
      loadFocusLayout(focusId);
    } else if (loadFocus) {
      // Load focus from database
      loadFocus(focusId).then(() => {
        loadFocusLayout(focusId);
      });
    } else {
      // Fallback to legacy system
      loadFocusLayout(focusId);
    }
  }, [dbCurrentFocus, loadFocus]);

  // Load focus-specific layout
  const loadFocusLayout = useCallback((focusId) => {
    if (!apiRef.current) return;
    
    const focusLayout = getFocusLayout(focusId);
    console.log('Loading focus layout:', focusLayout.name);
    
    // Generate unique timestamp for this focus load to ensure unique panel IDs
    const timestamp = Date.now();
    
    // Simple approach: just add new panels with unique IDs
    setTimeout(() => {
      focusLayout.panels.forEach((panel, index) => {
        setTimeout(() => {
          try {
            // Generate unique panel ID with timestamp and random component
            const uniqueId = `${focusId}-${panel.id}-${timestamp}-${Math.random().toString(36).substr(2, 5)}`;
            apiRef.current.addPanel({
              id: uniqueId,
              component: panel.component,
              title: panel.title
            });
          } catch (e) {
            console.warn('Failed to add panel:', panel.id, e);
          }
        }, index * 200); // Stagger panel creation
      });
    }, 100);
  }, []);

  useEffect(() => () => { 
    initializedRef.current = false; 
  }, []);

  const saveLayout = () => {
    if (!apiRef.current) return;
    const json = apiRef.current.toJSON();
    const payload = {
      version: LAYOUT_VERSION,
      data: json,
      sidebar: {
        collapsed: sidebarCollapsed,
        width: sidebarWidth
      },
      globalFilters: globalFilters,
      fontSettings: {
        theme: currentTheme,
        fontSize: fontSize,
        fontFamily: fontFamily,
        spacingMode: spacingMode
      }
    };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(payload));
    console.log('Layout saved:', payload);
    alert("Layout saved.");
  };

  const loadLayout = () => {
    if (!apiRef.current) {
      console.warn('Dockview API not ready, cannot load layout');
      return;
    }
    
    const saved = localStorage.getItem(LAYOUT_KEY);
    console.log('Loading layout from localStorage:', saved);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('Parsed layout:', parsed);
        if (parsed?.version === LAYOUT_VERSION && parsed?.data) {
          // Validate layout data before attempting to restore
          if (!validateLayoutData(parsed.data)) {
            console.warn('Invalid layout data structure, cannot load');
            alert('Layout data is corrupted and cannot be loaded. Please save a new layout.');
            return;
          }
          
          // Clear existing panels before loading new layout
          try {
            apiRef.current.clear();
          } catch (e) {
            console.warn('Failed to clear existing panels:', e);
          }
          
          // Load the layout
          apiRef.current.fromJSON(parsed.data);
          console.log('Layout loaded successfully');
          
          // Restore sidebar state
          if (parsed.sidebar) {
            setSidebarCollapsed(parsed.sidebar.collapsed || false);
            setSidebarWidth(parsed.sidebar.width || 280);
            console.log('Sidebar state restored:', parsed.sidebar);
          }
          
          // Restore global filters
          if (parsed.globalFilters) {
            setGlobalFilters(parsed.globalFilters);
            console.log('Global filters restored:', parsed.globalFilters);
          }
          
          // Restore font settings
          if (parsed.fontSettings) {
            setCurrentTheme(parsed.fontSettings.theme || 'default');
            setFontSize(parsed.fontSettings.fontSize || 12);
            setFontFamily(parsed.fontSettings.fontFamily || 'Inter');
            setSpacingMode(parsed.fontSettings.spacingMode || 'default');
            console.log('Font settings restored:', parsed.fontSettings);
          }
        } else {
          console.warn('Layout version mismatch or no data:', parsed);
        }
      } catch (e) { 
        console.warn("Layout restore failed", e);
        alert('Failed to load layout: ' + e.message);
      }
    } else {
      console.log('No saved layout found');
    }
  };

  const addPanel = () => {
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
      component: "panel", 
      title: "New Window",
      position
    });
  };

  const resetLayout = () => {
    localStorage.removeItem(LAYOUT_KEY);
    window.location.reload();
  };

  const clearSelection = () => { window.dispatchEvent(new Event(CLEAR_EVENT)); };
  const clearFilters = () => { 
    if (window.clearTableFilters) {
      window.clearTableFilters();
    }
  };

  const toggleSidebar = () => {
    console.log('Toggling sidebar. Current width:', sidebarWidth, 'Collapsed:', sidebarCollapsed);
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const addNewPanel = (componentType, title) => {
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
      position
    });
  };

  const handleGlobalFiltersChange = (newFilters) => {
    setGlobalFilters(newFilters);
    // You can add logic here to apply filters to existing panels
    console.log('Global filters updated:', newFilters);
  };

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 500) {
      setSidebarWidth(newWidth);
      console.log('Resizing sidebar to:', newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Force Dockview to recalculate layout when sidebar changes
  React.useEffect(() => {
    if (apiRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        try {
          apiRef.current.layout();
        } catch (e) {
          console.warn('Failed to trigger Dockview layout:', e);
        }
      }, 100);
    }
  }, [sidebarCollapsed, sidebarWidth]);

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
            createDefaultLayout(api);
            return;
          }
          
          // Restore font settings FIRST to prevent component recreation
          if (parsed.fontSettings) {
            setCurrentTheme(parsed.fontSettings.theme || 'default');
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
              createDefaultLayout(api);
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
      createDefaultLayout(api);
    }
    
    // Gentle resize function that works with Dockview's layout system
    const forcePanelResize = () => {
      console.log('Triggering gentle panel resize');
      // Wait longer for Dockview to complete its internal layout
      setTimeout(() => {
        requestAnimationFrame(() => {
          // Use Dockview's own resize method first
          if (api && typeof api.layout === 'function') {
            const container = document.querySelector('.dv-dockview') || 
                             document.querySelector('.dockview') || 
                             document.querySelector('[data-dockview]') ||
                             document.querySelector('.dockview-component') ||
                             document.querySelector('.dv-container');
            
            if (container) {
              // Get current dimensions
              const width = container.clientWidth;
              const height = container.clientHeight;
              
              // Use Dockview's layout method
              api.layout(width, height);
            }
          }
          
          // Let Dockview handle layout naturally - no forced events
        });
      }, 200); // Wait 200ms for Dockview to complete its layout
    };
    
    // Let Dockview handle its own layout naturally
    // Only log events for debugging, don't interfere with Dockview's internal processes
    api.onDidAddPanel(() => {
      console.log('Panel added - letting Dockview handle layout');
    });
    
    api.onDidRemovePanel(() => {
      console.log('Panel removed - letting Dockview handle layout');
    });
    
    api.onDidLayoutChange(() => {
      console.log('Layout changed - letting Dockview handle layout');
    });
    
    api.onDidActivePanelChange(() => {
      console.log('Active panel changed - letting Dockview handle layout');
    });
    
    api.onDidMovePanel(() => {
      console.log('Panel moved - letting Dockview handle layout');
    });
    
    // Let Dockview handle all layout and rendering naturally
    // No MutationObserver or DOM manipulation needed
  }, []);

  const createDefaultLayout = useCallback((api) => {
    // Create a 2x2 grid layout with enhanced GraphQL panels
    // Top row: Table and Chart
    api.addPanel({ id: "win-1", component: "table", title: "Sailings (Tabulator)" });
    api.addPanel({ id: "win-2", component: "chart", title: "Booking Curve (Chart.js)", position: { referencePanel: "win-1", direction: "right" } });
    
    // Bottom row: Enhanced GraphQL panels
    api.addPanel({ id: "win-3", component: "graphql-kpis", title: "KPI Dashboard", position: { referencePanel: "win-1", direction: "below" } });
    api.addPanel({ id: "win-4", component: "graphql-exceptions", title: "Exceptions", position: { referencePanel: "win-3", direction: "right" } });
    
    // Additional panels for comprehensive view
    api.addPanel({ id: "win-5", component: "graphql-sailings", title: "Sailings Data", position: { referencePanel: "win-2", direction: "below" } });
    api.addPanel({ id: "win-6", component: "graphql-ships", title: "Ships Report", position: { referencePanel: "win-5", direction: "right" } });

    // Safety: in case Tabulator doesn't emit, show first sailing
    setTimeout(() => { emitSelect({ id:1, ship:"Celestyal Discovery", sailing:"7N Islands" }); }, 700);
  }, []);

  // Enhanced layout creation with different presets
  const createLayoutPreset = useCallback((preset) => {
    // Store the preset preference and reload the page
    localStorage.setItem('dockview-layout-preset', preset);
    window.location.reload();
  }, []);

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
    <div 
      className={`dockview-theme-${theme.name.toLowerCase().replace(' ', '-')}`} 
      style={{ 
        height: "100vh", 
        width: "100vw", 
        overflow: "hidden", 
        background: theme.colors.background, 
        color: theme.colors.foreground,
        fontSize: `${fontSize}px`,
        fontFamily: selectedFont.value
      }}
    >
      {/* Top Toolbar */}
      <div style={{ 
        display: "flex", 
        gap: 8, 
        padding: "8px 10px", 
        borderBottom: `1px solid ${theme.colors.sidebarBorder}`, 
        background: theme.colors.sidebar, 
        alignItems: "center" 
      }}>
        <button 
          onClick={toggleSidebar} 
          style={{ 
            background: theme.colors.accent, 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            padding: "4px 8px", 
            cursor: "pointer",
            fontSize: `${fontSize - 1}px`
          }}
        >
          {sidebarCollapsed ? "☰ Show Sidebar" : "◀ Hide Sidebar"}
        </button>
        <div style={{ 
          marginLeft: "auto", 
          fontSize: `${fontSize - 1}px`, 
          color: theme.colors.textSecondary 
        }}>
          Dockview Dashboard - {theme.name}
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 48px)", position: "relative" }}>
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          onAddPanel={addNewPanel}
          globalFilters={globalFilters}
          onGlobalFiltersChange={handleGlobalFiltersChange}
          width={sidebarWidth}
          saveLayout={saveLayout}
          loadLayout={loadLayout}
          addPanel={addPanel}
          clearSelection={clearSelection}
          clearFilters={clearFilters}
          resetLayout={resetLayout}
          createLayoutPreset={createLayoutPreset}
          currentFocus={currentFocus}
          onFocusChange={handleFocusChange}
          userRole={userRole}
          focuses={focuses}
          focusLoading={focusLoading}
          focusError={focusError}
          fallbackMode={fallbackMode}
          initializeStandardFocuses={initializeStandardFocuses}
        />
        
        {/* Resize Handle - positioned between sidebar and main content */}
        {!sidebarCollapsed && (
          <div
            style={{
              width: '4px',
              height: '100%',
              background: theme.colors.accentLight,
              cursor: 'col-resize',
              flexShrink: 0,
              transition: 'background 0.2s ease'
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={(e) => {
              e.target.style.background = theme.colors.accentHover;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = theme.colors.accentLight;
            }}
          />
        )}
        
        {isResizing && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: `${sidebarWidth + 4}px`,
            width: '2px',
            height: '100%',
            background: theme.colors.accent,
            zIndex: 1000,
            pointerEvents: 'none'
          }} />
        )}
        
        {/* Dockview container with flex: 1 to fill remaining space */}
        <div style={{ flex: 1, height: "100%", minWidth: 0 }}>
          <DockviewReact 
            components={{ 
              panel: InfoPanel, 
              table: TablePanel, 
              chart: ChartPanel,
              // Enhanced GraphQL panels with new data types
              "graphql-sailings": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "sailings"}} />,
              "graphql-kpis": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "kpis"}} />,
              "graphql-exceptions": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "exceptions"}} />,
              "graphql-books": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "books"}} />,
              "graphql-ships": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "ships"}} />,
              "graphql-cabins": (props) => <GraphQLPanel {...props} params={{...props.params, dataType: "cabinAvailability"}} />,
              // Focus-specific components
              "kpi-cards": KPICards,
              "occupancy-chart": OccupancyChart,
              "revenue-breakdown": RevenueBreakdown,
              "exception-list": ExceptionList,
              "itinerary-list": ItineraryList
            }} 
            onReady={onReady}
            style={{ height: "100%", width: "100%" }} 
          />
        </div>
      </div>

      {/* Dynamic theme styles */}
      <style>{`
        .dockview-theme-default {
          --dv-foreground: #2b2b2b;
          --dv-background: #ffffff;
          --dv-titlebar-background: #f7f3ee; /* very light tan */
          --dv-titlebar-inactiveForeground: #6b6b6b;
          --dv-titlebar-activeForeground: #2b2b2b;
          --dv-activegroup-background: #ffffff;
          --dv-inactivegroup-background: #fdfbf7;
          --dv-activegroup-visible: #b08d57; /* accent border */
          --dv-inactivegroup-visible: #e2d3bb; /* subtle border */
          --dv-activegroup-border: #b08d57;
          --dv-inactivegroup-border: #e2d3bb;
          --dv-drag-over-background: rgba(176, 141, 87, 0.2);
          --dv-separator-border: #e8dfd0;
          --dv-panelview-background: #ffffff;
          --dv-tab-divider-color: transparent;
          --dv-tab-close-button-hover-background: rgba(176, 141, 87, 0.15);
          --dv-tab-outline-color: #b08d57;
          --dv-scrollbar-slider-background: rgba(176, 141, 87, 0.45);
          --dv-scrollbar-slider-hover-background: rgba(176, 141, 87, 0.65);
        }
        .dockview-theme-talia .dv-tabs { gap: 2px; }
        .dockview-theme-talia .dv-tab {
          border-radius: 10px 10px 0 0;
          padding: 6px 10px;
          font-weight: 600;
          background: #f5efe6;
        }
        .dockview-theme-talia .dv-tab.active {
          background: #fff;
          box-shadow: inset 0 -2px 0 #b08d57;
        }
        
        .dockview-theme-dark {
          --dv-foreground: #d4d4d4;
          --dv-background: #1e1e1e;
          --dv-titlebar-background: #252526;
          --dv-titlebar-inactiveForeground: #808080;
          --dv-titlebar-activeForeground: #d4d4d4;
          --dv-activegroup-background: #1e1e1e;
          --dv-inactivegroup-background: #2d2d30;
          --dv-group-view-background: #1e1e1e;
          --dv-tabs-container-background: #252526;
          --dv-tab-divider: #3e3e42;
          --dv-tab-background: #2d2d30;
          --dv-tab-active-background: #1e1e1e;
          --dv-tab-inactive-background: #2d2d30;
          --dv-tab-activeforeground: #d4d4d4;
          --dv-tab-inactiveforeground: #808080;
          --dv-tab-hover-background: #2a2d2e;
          --dv-drop-target-background: rgba(0, 122, 204, 0.2);
          --dv-drop-target-border: #007acc;
        }
        
        .dockview-theme-light {
          --dv-foreground: #333333;
          --dv-background: #ffffff;
          --dv-titlebar-background: #f3f3f3;
          --dv-titlebar-inactiveForeground: #999999;
          --dv-titlebar-activeForeground: #333333;
          --dv-activegroup-background: #ffffff;
          --dv-inactivegroup-background: #e8e8e8;
          --dv-group-view-background: #ffffff;
          --dv-tabs-container-background: #f3f3f3;
          --dv-tab-divider: #e1e1e1;
          --dv-tab-background: #e8e8e8;
          --dv-tab-active-background: #ffffff;
          --dv-tab-inactive-background: #e8e8e8;
          --dv-tab-activeforeground: #333333;
          --dv-tab-inactiveforeground: #999999;
          --dv-tab-hover-background: #f5f5f5;
          --dv-drop-target-background: rgba(0, 120, 212, 0.2);
          --dv-drop-target-border: #0078d4;
        }
      `}</style>
    </div>
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
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
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

// Initialize user context on app start
const initializeUserContext = () => {
  // Set default user context for development
  GraphQLUtils.setUserContext({
    id: '1',
    role: 'ADMIN',
    email: 'admin@celestyal.com'
  });
};

// Export App wrapped in Apollo Provider, error boundary and theme provider
export default function AppWithErrorBoundary() {
  // Initialize user context when app starts
  React.useEffect(() => {
    initializeUserContext();
  }, []);

  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeProvider>
    </ApolloProvider>
  );
}

