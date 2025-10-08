/**
 * Sailing Summary Component
 * Aggregates sailing cabin occupancy data at the sail level
 * Loads data from local JSON file and dynamically summarizes by sail
 */

import React, { useRef, useEffect } from 'react';

// CDN URLs for Tabulator
const CDN = {
  tabulatorCss: [
    "https://unpkg.com/tabulator-tables@5.5.2/dist/css/tabulator.min.css"
  ],
  tabulatorJs: [
    "https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js"
  ]
};

// Utility functions for loading CDN resources
const loadCssFromList = async (urls) => {
  for (const url of urls) {
    try {
      if (document.querySelector(`link[href="${url}"]`)) return true;
      await new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`));
        document.head.appendChild(link);
      });
      return true;
    } catch (e) {
      console.warn(`Failed to load CSS from ${url}:`, e);
    }
  }
  return false;
};

const loadScriptFromList = async (urls, checkFn) => {
  for (const url of urls) {
    try {
      if (checkFn && checkFn()) return true;
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
        document.head.appendChild(script);
      });
      if (checkFn && checkFn()) return true;
    } catch (e) {
      console.warn(`Failed to load script from ${url}:`, e);
    }
  }
  return false;
};

// Event system for selection - separate from existing table/chart events
const SAIL_SELECT_EVENT = 'talia:sail.select';   // payload: sail_code
const SAIL_CLEAR_EVENT = 'talia:sail.clear';     // clear selection

const emitSailSelect = (sailCode) => {
  try { 
    window.dispatchEvent(new CustomEvent(SAIL_SELECT_EVENT, { detail: sailCode })); 
    console.log('[LinkingEvent] 🚀 [SailingSummary] FIRED sail selection event:', sailCode);
  } catch (e) { 
    console.warn('[LinkingEvent] emitSailSelect failed', e); 
  }
};

const emitSailClear = () => {
  try { 
    window.dispatchEvent(new CustomEvent(SAIL_CLEAR_EVENT)); 
    console.log('[LinkingEvent] 🚀 [SailingSummary] FIRED sail clear event');
  } catch (e) { 
    console.warn('[LinkingEvent] emitSailClear failed', e); 
  }
};

// Function to aggregate sailing data
const aggregateSailingData = (rawData) => {
  const sailMap = new Map();

  rawData.forEach(record => {
    const key = `${record.Sail_Code}_${record.Ship_Code}_${record.Package_Type}_${record.Port_Code}`;
    
    if (!sailMap.has(key)) {
      sailMap.set(key, {
        Sail_Code: record.Sail_Code,
        Ship_name: record.Ship_name,
        Package_Type: record.Package_Type,
        Package_Name: record.Package_Name,
        Sail_Date_From: record.Sail_Date_From,
        Port_Code: record.Port_Code,
        Sail_Days: record.Sail_Days,
        Geog_Area_Code: record.Geog_Area_Code,
        Total_Cabin_Capacity: 0,
        Total_Cabins: 0,
        Total_Occupied_Cabins: 0,
        Total_Remaining_Cabins: 0,
        Occupancy_Percentage: 0
      });
    }

    const sail = sailMap.get(key);
    sail.Total_Cabin_Capacity += (record.Cabin_Capacity || 0) * (record.Total_Cabins || 0);
    sail.Total_Cabins += record.Total_Cabins || 0;
    sail.Total_Occupied_Cabins += record.Occupied_Cabins || 0;
    sail.Total_Remaining_Cabins += record.Remaining_Cabins || 0;
  });

  // Calculate occupancy percentage for each sail
  const aggregatedData = Array.from(sailMap.values()).map(sail => ({
    ...sail,
    Occupancy_Percentage: sail.Total_Cabins > 0 ? 
      Math.round((sail.Total_Occupied_Cabins / sail.Total_Cabins) * 100) : 0
  }));

  console.log('[SailingSummary] Aggregated data:', aggregatedData.length, 'sails');
  return aggregatedData;
};

const SailingSummary = React.memo(() => {
  console.log('🚨 [LinkingEvent] [SailingSummary] COMPONENT LOADED - This should appear when component mounts!');
  
  // Default theme values (same as Dashboard default theme)
  const theme = {
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
  };
  const fontSize = 12;
  const selectedFont = { value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' };
  const spacingMode = 'default';
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const initializedRef = useRef(false);
  const failSafeRef = useRef(null);
  const tableBuiltRef = useRef(false);

  // Load sailing cabin occupancy data from local JSON file and aggregate it
  const loadAndAggregateSailingData = async () => {
    try {
      const response = await fetch('/local_data/sail_by_cabin_occupancy.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rawData = await response.json();
      console.log('[SailingSummary] Loaded raw data:', rawData.length, 'records');
      
      // Aggregate the data at sail level
      const aggregatedData = aggregateSailingData(rawData);
      return aggregatedData;
    } catch (error) {
      console.error('[SailingSummary] Error loading data:', error);
      // Return fallback aggregated data if JSON file fails to load
      return [
        {
          Sail_Code: "CJ07260502",
          Ship_name: "Celestyal Journey",
          Package_Type: "PIRPIR7",
          Package_Name: "Heavenly Greece,Italy and Croatia - 7Nights",
          Sail_Date_From: "2026-05-02T00:00:00",
          Port_Code: "PIR",
          Sail_Days: 7,
          Geog_Area_Code: "ADRIATIC",
          Total_Cabin_Capacity: 32,
          Total_Cabins: 8,
          Total_Occupied_Cabins: 1,
          Total_Remaining_Cabins: 7,
          Occupancy_Percentage: 13
        }
      ];
    }
  };

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
      if (instanceRef.current) { 
        console.log('[SailingSummary] skipped (Tabulator exists)'); 
        return; 
      }
      
      const data = [
        { 
          Sail_Code: "CJ07260502", 
          Ship_name: "Celestyal Journey", 
          Package_Name: "Heavenly Greece,Italy and Croatia - 7Nights", 
          Sail_Days: 7, 
          Sail_Date_From: "2026-05-02", 
          Total_Cabins: 8, 
          Total_Occupied_Cabins: 1, 
          Total_Remaining_Cabins: 7,
          Occupancy_Percentage: 13
        }
      ];
      
      const headers = ["Sail Code", "Ship", "Package", "Days", "Sail Date", "Total Cabins", "Occupied", "Remaining", "Occupancy %"];
      const rows = data.map((r, i) => `<tr data-id="${i}">
        <td>${r.Sail_Code}</td>
        <td>${r.Ship_name}</td>
        <td>${r.Package_Name}</td>
        <td style="text-align:center">${r.Sail_Days}</td>
        <td>${r.Sail_Date_From}</td>
        <td style="text-align:right">${r.Total_Cabins}</td>
        <td style="text-align:right">${r.Total_Occupied_Cabins}</td>
        <td style="text-align:right">${r.Total_Remaining_Cabins}</td>
        <td style="text-align:right">${r.Occupancy_Percentage}%</td>
      </tr>`).join("");
      
      tableRef.current.innerHTML = `
        <div style="padding:6px 8px;font-family:ui-sans-serif,system-ui;font-size:13px">
          <div style="margin-bottom:6px;color:#a55">(Sailing Summary - Fallback table active)</div>
          <table style="width:100%; border-collapse:collapse">
            <thead><tr>${headers.map(h=>`<th style="text-align:left;border-bottom:1px solid #e8dfd0;padding:4px 6px">${h}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      
      try {
        const tbody = tableRef.current.querySelector('tbody');
        tbody?.addEventListener('click', (ev) => {
          console.log('[LinkingEvent] [SailingSummary] Fallback table row clicked');
          const tr = ev.target.closest('tr');
          if (!tr) return;
          // clear others
          tbody.querySelectorAll('tr.selected').forEach(n => n.classList.remove('selected'));
          tr.classList.add('selected');
          const id = Number(tr.getAttribute('data-id'));
          const rec = data[id];
          console.log('[LinkingEvent] [SailingSummary] Fallback table - selected record:', rec);
          if (rec) {
            emitSailSelect(rec.Sail_Code);
          }
        });
      } catch {}
      console.log('[SailingSummary] fallback table rendered');
    };

    (async () => {
      try {
        if (!tableRef.current || initializedRef.current) return;

        // Load and aggregate sailing data
        const sailingSummaryData = await loadAndAggregateSailingData();

        // Ensure Tabulator is available (via CDN)
        const cssOk = await loadCssFromList(CDN.tabulatorCss);
        await loadScriptFromList(CDN.tabulatorJs, () => window.Tabulator || window.TabulatorFull);
        const TabGlobal = window.Tabulator || window.TabulatorFull;
        console.log('[SailingSummary] Tabulator global typeof:', typeof TabGlobal);
        if (!cssOk) console.warn("[SailingSummary] Tabulator CSS failed to load from all sources");
        if (!TabGlobal) { renderFallbackTable(); return; }

        // Wait for real size
        const sz = await waitForNonZeroSize(tableRef.current, 3000);
        console.log("[SailingSummary] container size before init:", sz);

        // Safety net: If we haven't finished init in 1200ms, draw fallback
        if (failSafeRef.current) clearTimeout(failSafeRef.current);
        failSafeRef.current = setTimeout(() => {
          console.warn('[SailingSummary] failSafe fired — using fallback table');
          if (!instanceRef.current) renderFallbackTable();
        }, 1200);

        // Define columns for sailing summary
        const columns = [
          { 
            title: "Sail Code", 
            field: "Sail_Code", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter sail code..."
          },
          { 
            title: "Ship", 
            field: "Ship_name", 
            width: 150,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Ships", "Celestyal Journey": "Celestyal Journey", "Celestyal Discovery": "Celestyal Discovery" },
              clearable: true
            }
          },
          { 
            title: "Package Type", 
            field: "Package_Type", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter type..."
          },
          { 
            title: "Package", 
            field: "Package_Name", 
            widthGrow: 2,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter package..."
          },
          { 
            title: "Sail Date", 
            field: "Sail_Date_From", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "YYYY-MM-DD",
            formatter: (cell) => {
              const date = new Date(cell.getValue());
              return date.toLocaleDateString();
            }
          },
          { 
            title: "Port", 
            field: "Port_Code", 
            width: 80,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter port..."
          },
          { 
            title: "Days", 
            field: "Sail_Days", 
            hozAlign: "center", 
            width: 80,
            headerFilter: "input",
            headerFilterPlaceholder: "Days",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
          },
          { 
            title: "Geographic Area", 
            field: "Geog_Area_Code", 
            width: 120,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Areas", "ADRIATIC": "ADRIATIC", "AEGEAN": "AEGEAN", "MEDITERRANEAN": "MEDITERRANEAN" },
              clearable: true
            }
          },
          { 
            title: "Total Capacity", 
            field: "Total_Cabin_Capacity", 
            hozAlign: "right", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Min capacity",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? value.toLocaleString() : '0';
            }
          },
          { 
            title: "Total Cabins", 
            field: "Total_Cabins", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min total",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
          },
          { 
            title: "Occupied", 
            field: "Total_Occupied_Cabins", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min occupied",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
          },
          { 
            title: "Remaining", 
            field: "Total_Remaining_Cabins", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min remaining",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
          },
          { 
            title: "Occupancy %", 
            field: "Occupancy_Percentage", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min %",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return `${value}%`;
            }
          }
        ];

        console.log('[LinkingEvent] [SailingSummary] initializing Tabulator on', tableRef.current);
        // Give the layout one more frame to settle
        await new Promise((r) => requestAnimationFrame(() => r()));

        const TabCtor = TabGlobal;
        console.log('[LinkingEvent] [SailingSummary] Creating Tabulator instance with data:', sailingSummaryData.length, 'records');
        instanceRef.current = new TabCtor(tableRef.current, {
          data: sailingSummaryData,
          columns,
          layout: "fitColumns",
          reactiveData: false,
          height: "100%",
          selectable: 1,                // single-select only (native Tabulator method)
          headerFilterLiveFilter: true, // live filtering as you type
          headerFilterLiveFilterDelay: 300, // delay for live filtering
          // Theme and font configuration
          theme: "default", // Use default theme, we'll override with CSS
          fontSize: fontSize,
          headerHeight: spacingMode === 'compact' ? Math.max(28, fontSize + 6) : Math.max(35, fontSize + 12),
          rowHeight: spacingMode === 'compact' ? Math.max(24, fontSize + 4) : Math.max(32, fontSize + 8),
          // Font and theme styling
          rowFormatter: (row) => {
            const element = row.getElement();
            if (element) {
              element.style.fontSize = `${fontSize}px`;
              element.style.fontFamily = selectedFont.value;
            }
          }
        });

        console.log('[LinkingEvent] [SailingSummary] Tabulator instance created:', instanceRef.current);

        // Add event listeners after table is created (like existing TablePanel)
        instanceRef.current.on("rowClick", (e, row) => {
          console.log('[LinkingEvent] [SailingSummary] Row clicked via event listener:', row?.getData());
          try { row?.select?.(); } catch {}
        });

        instanceRef.current.on("rowSelectionChanged", (selectedData) => {
          console.log('[LinkingEvent] [SailingSummary] rowSelectionChanged via event listener:', selectedData);
          const rec = selectedData && selectedData[0];
          if (rec) {
            console.log('[LinkingEvent] [SailingSummary] About to emit sail selection for:', rec.Sail_Code);
            emitSailSelect(rec.Sail_Code);
          } else {
            console.log('[LinkingEvent] [SailingSummary] Empty selection via event listener');
            emitSailClear();
          }
        });

        // Clear failSafe since we succeeded
        if (failSafeRef.current) {
          clearTimeout(failSafeRef.current);
          failSafeRef.current = null;
        }

        // Mark as initialized
        initializedRef.current = true;

        return () => {
          if (instanceRef.current) {
            try {
              instanceRef.current.destroy();
            } catch (e) {
              console.warn('Failed to destroy SailingSummary Tabulator instance:', e);
            }
            instanceRef.current = null;
          }
          initializedRef.current = false;
        };

      } catch (err) {
        console.error('[SailingSummary] fatal init error', err);
        renderFallbackTable();
      }
    })();

    return () => { 
      cancelled = true; 
      if (failSafeRef.current) {
        clearTimeout(failSafeRef.current);
        failSafeRef.current = null;
      }
    };
  }, []);

  // Note: Font changes are handled via CSS and don't require Tabulator updates
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
      <div 
        ref={tableRef} 
        style={{ 
          height: "100%", 
          width: "100%",
          fontSize: `${fontSize}px`,
          fontFamily: selectedFont.value
        }} 
      />
    </div>
  );
});

SailingSummary.displayName = 'SailingSummary';

export default SailingSummary;
