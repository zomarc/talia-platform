/**
 * Sailing by Cabin Category Component
 * Based on TablePanel structure with Tabulator for displaying sailing cabin occupancy data
 * Loads data from local JSON file for demo purposes
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

// Event system for selection
const SELECT_EVENT = 'sailingCabinSelect';
const CLEAR_EVENT = 'sailingCabinClear';

const emitSelect = (rec) => {
  window.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: rec }));
};

// Event system for sail code filtering - separate from existing table/chart events
const SAIL_SELECT_EVENT = 'talia:sail.select';   // payload: sail_code
const SAIL_CLEAR_EVENT = 'talia:sail.clear';     // clear selection

const SailingByCabinCategory = React.memo(() => {
  console.log('[LinkingEvent] [SailingByCabinCategory] Component mounted/rendered');
  
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
  const tableBuiltRef = useRef(false); // Track if table is fully built
  const [selectedSailCode, setSelectedSailCode] = React.useState(null);
  const [allData, setAllData] = React.useState([]);

  // Load sailing cabin occupancy data from local JSON file
  const loadSailingCabinData = async () => {
    try {
      const response = await fetch('/local_data/sail_by_cabin_occupancy.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('[SailingByCabinCategory] Loaded data:', data.length, 'records');
      setAllData(data); // Store all data for filtering
      return data;
    } catch (error) {
      console.error('[SailingByCabinCategory] Error loading data:', error);
      // Return fallback data if JSON file fails to load
      return [
        {
          Sail_ID: 5130.0,
          Sail_Code: "CJ07260502",
          Sail_Days: 7,
          Sail_Date_From: "2026-05-02T00:00:00",
          Master_Voyage: "CJ07260502",
          Ship_Code: "CJ",
          Ship_name: "Celestyal Journey",
          Package_Type: "PIRPIR7",
          Package_Name: "Heavenly Greece,Italy and Croatia - 7Nights",
          Geog_Area_Code: "ADRIATIC",
          Cabin_Category: "IA",
          Cabin_Capacity: 4.0,
          Total_Cabins: 8,
          Occupied_Cabins: 1,
          Remaining_Cabins: 7
        }
      ];
    }
  };

  // Event listeners for sail code filtering - set up immediately
  useEffect(() => {
    console.log('[LinkingEvent] 🔗 [SailingByCabinCategory] Setting up event listeners');
    
    const handleSailSelect = (event) => {
      const sailCode = event.detail;
      console.log('[LinkingEvent] 🔗 [SailingByCabinCategory] RECEIVED sail selection event:', sailCode);
      setSelectedSailCode(sailCode);
    };

    const handleSailClear = () => {
      console.log('[LinkingEvent] 🔗 [SailingByCabinCategory] RECEIVED sail clear event');
      setSelectedSailCode(null);
    };

    // Add event listeners
    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    
    console.log('[LinkingEvent] 🔗 [SailingByCabinCategory] Event listeners added for:', SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT);

    return () => {
      console.log('[LinkingEvent] 🔗 [SailingByCabinCategory] Cleaning up event listeners');
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    };
  }, []);

  // Filter data based on selected sail code
  const getFilteredData = () => {
    if (!selectedSailCode || allData.length === 0) {
      return allData;
    }
    
    const filtered = allData.filter(record => record.Sail_Code === selectedSailCode);
    console.log('[SailingByCabinCategory] Filtered data for sail:', selectedSailCode, 'Records:', filtered.length);
    return filtered;
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
        console.log('[SailingByCabinCategory] skipped (Tabulator exists)'); 
        return; 
      }
      
      const data = [
        { 
          Sail_Code: "CJ07260502", 
          Ship_name: "Celestyal Journey", 
          Package_Name: "Heavenly Greece,Italy and Croatia - 7Nights", 
          Sail_Days: 7, 
          Sail_Date_From: "2026-05-02", 
          Cabin_Category: "IA", 
          Total_Cabins: 8, 
          Occupied_Cabins: 1, 
          Remaining_Cabins: 7 
        }
      ];
      
      const headers = ["Sail Code", "Ship", "Package", "Days", "Sail Date", "Cabin Category", "Total", "Occupied", "Remaining"];
      const rows = data.map((r, i) => `<tr data-id="${i}">
        <td>${r.Sail_Code}</td>
        <td>${r.Ship_name}</td>
        <td>${r.Package_Name}</td>
        <td style="text-align:center">${r.Sail_Days}</td>
        <td>${r.Sail_Date_From}</td>
        <td>${r.Cabin_Category}</td>
        <td style="text-align:right">${r.Total_Cabins}</td>
        <td style="text-align:right">${r.Occupied_Cabins}</td>
        <td style="text-align:right">${r.Remaining_Cabins}</td>
      </tr>`).join("");
      
      tableRef.current.innerHTML = `
        <div style="padding:6px 8px;font-family:ui-sans-serif,system-ui;font-size:13px">
          <div style="margin-bottom:6px;color:#a55">(Sailing by Cabin Category - Fallback table active)</div>
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
          const rec = data[id];
          if (rec) emitSelect(rec);
        });
      } catch {}
      console.log('[SailingByCabinCategory] fallback table rendered');
    };

    (async () => {
      try {
        if (!tableRef.current || initializedRef.current) return;

        // Load sailing cabin occupancy data
        const sailingCabinData = await loadSailingCabinData();
        console.log('[LinkingEvent] [SailingByCabinCategory] Loaded data for Tabulator:', sailingCabinData.length, 'records');

        // Ensure Tabulator is available (via CDN)
        const cssOk = await loadCssFromList(CDN.tabulatorCss);
        await loadScriptFromList(CDN.tabulatorJs, () => window.Tabulator || window.TabulatorFull);
        const TabGlobal = window.Tabulator || window.TabulatorFull;
        console.log('[SailingByCabinCategory] Tabulator global typeof:', typeof TabGlobal);
        if (!cssOk) console.warn("[SailingByCabinCategory] Tabulator CSS failed to load from all sources");
        if (!TabGlobal) { renderFallbackTable(); return; }

        // Wait for real size
        const sz = await waitForNonZeroSize(tableRef.current, 3000);
        console.log("[SailingByCabinCategory] container size before init:", sz);

        // Safety net: If we haven't finished init in 1200ms, draw fallback
        if (failSafeRef.current) clearTimeout(failSafeRef.current);
        failSafeRef.current = setTimeout(() => {
          console.warn('[SailingByCabinCategory] failSafe fired — using fallback table');
          if (!instanceRef.current) renderFallbackTable();
        }, 1200);

        // Define columns for sailing cabin occupancy
        const columns = [
          { 
            title: "Sail ID", 
            field: "Sail_ID", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter sail ID...",
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? Math.floor(value).toString() : '';
            }
          },
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
            title: "Package", 
            field: "Package_Name", 
            widthGrow: 2,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter package..."
          },
          { 
            title: "Package Type", 
            field: "Package_Type", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter type..."
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
            title: "Sail Days", 
            field: "Sail_Days", 
            hozAlign: "center", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Days",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            }
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
            title: "Cabin Category", 
            field: "Cabin_Category", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter cabin..."
          },
          { 
            title: "Cabin Capacity", 
            field: "Cabin_Capacity", 
            hozAlign: "center", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Capacity",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? Math.floor(value).toString() : '';
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
            field: "Occupied_Cabins", 
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
            field: "Remaining_Cabins", 
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
            formatter: (cell, formatterParams, onRendered) => {
              const row = cell.getRow().getData();
              const total = row.Total_Cabins;
              const occupied = row.Occupied_Cabins;
              if (total && total > 0) {
                const percentage = Math.round((occupied / total) * 100);
                return `${percentage}%`;
              }
              return '0%';
            }
          }
        ];

        console.log('[SailingByCabinCategory] initializing Tabulator on', tableRef.current);
        // Give the layout one more frame to settle
        await new Promise((r) => requestAnimationFrame(() => r()));

        const TabCtor = TabGlobal;
        instanceRef.current = new TabCtor(tableRef.current, {
          data: sailingCabinData,
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
          rowClick: (e, row) => {
            try { row?.select?.(); } catch {}
          },
          rowSelectionChanged: (selectedData /* array */) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
              console.log("[SailingByCabinCategory] rowSelectionChanged", rec);
              emitSelect(rec);
            } else {
              console.log("[SailingByCabinCategory] rowSelectionChanged — empty selection");
              emitSelect(null);
            }
          },
          // Font and theme styling
          rowFormatter: (row) => {
            const element = row.getElement();
            if (element) {
              element.style.fontSize = `${fontSize}px`;
              element.style.fontFamily = selectedFont.value;
            }
          }
        });

        // Listen for tableBuilt event
        instanceRef.current.on("tableBuilt", () => {
          console.log('[SailingByCabinCategory] Table built successfully');
          tableBuiltRef.current = true;
        });

        console.log('[SailingByCabinCategory] Tabulator instance created:', instanceRef.current);

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
              console.warn('Failed to destroy SailingByCabinCategory Tabulator instance:', e);
            }
            instanceRef.current = null;
          }
          initializedRef.current = false;
        };

      } catch (err) {
        console.error('[SailingByCabinCategory] fatal init error', err);
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

  // Manual refresh function
  const refreshData = React.useCallback(() => {
    if (instanceRef.current && tableBuiltRef.current) {
      const filteredData = getFilteredData();
      console.log('[SailingByCabinCategory] Manual refresh - updating data with:', filteredData.length, 'records');
      try {
        instanceRef.current.replaceData(filteredData);
      } catch (e) {
        console.warn('[SailingByCabinCategory] Failed to refresh data:', e);
      }
    }
  }, [selectedSailCode, allData]);

  // Update Tabulator data when selected sail code changes
  useEffect(() => {
    console.log('[SailingByCabinCategory] Data update effect triggered - selectedSailCode:', selectedSailCode, 'allData.length:', allData.length, 'tableBuilt:', tableBuiltRef.current);
    
    if (instanceRef.current && allData.length > 0 && tableBuiltRef.current) {
      const filteredData = getFilteredData();
      console.log('[SailingByCabinCategory] Updating Tabulator data with filtered results:', filteredData.length, 'records');
      try {
        instanceRef.current.replaceData(filteredData);
      } catch (e) {
        console.warn('[SailingByCabinCategory] Failed to update Tabulator data:', e);
      }
    } else if (instanceRef.current && allData.length > 0 && !tableBuiltRef.current) {
      console.log('[SailingByCabinCategory] Table not yet built, skipping data update');
    } else if (instanceRef.current && allData.length === 0) {
      console.log('[SailingByCabinCategory] No data available yet');
    }
  }, [selectedSailCode, allData]);

  // Expose refresh function globally for testing
  React.useEffect(() => {
    window.sailingCabinRefresh = refreshData;
    return () => {
      delete window.sailingCabinRefresh;
    };
  }, [refreshData]);

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

SailingByCabinCategory.displayName = 'SailingByCabinCategory';

export default SailingByCabinCategory;
