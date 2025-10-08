/**
 * Published Rates Component
 * Based on TablePanel structure with Tabulator for displaying published rates data
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
const SELECT_EVENT = 'publishedRatesSelect';
const CLEAR_EVENT = 'publishedRatesClear';

const emitSelect = (rec) => {
  window.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: rec }));
};

// Event system for sail code filtering - separate from existing table/chart events
const SAIL_SELECT_EVENT = 'talia:sail.select';   // payload: sail_code
const SAIL_CLEAR_EVENT = 'talia:sail.clear';     // clear selection

const PublishedRates = React.memo(() => {
  console.log('[LinkingEvent] [PublishedRates] Component mounted/rendered');
  
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

  // Load published rates data from local JSON file
  const loadPublishedRatesData = async () => {
    try {
      const response = await fetch('/local_data/published_rate.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('[PublishedRates] Loaded data:', data.length, 'records');
      setAllData(data); // Store all data for filtering
      return data;
    } catch (error) {
      console.error('[PublishedRates] Error loading data:', error);
      // Return fallback data if JSON file fails to load
      return [
        {
          SNAPSHOT_DATE: "2025-08-05T00:00:00",
          SAIL_CODE: "CJ07260509",
          SHIP_CODE: "CJ",
          PACKAGE_NAME: "Idyllic Greece -7Nights",
          REGION: "IDYLLIC26",
          RATE_TYPE: "CUG",
          SAIL_DAYS: 7.0,
          DEPARTURE_DATE: "2026-05-09T00:00:00",
          CABIN_CATEGORY: "XBO",
          PROMO_NAME: "CELESTYAL ONE, PUBLISHED Summer Campaign",
          PROMO_TYPE: "TARIFF, PROMO",
          CURRENCY_CODE: "EUR",
          FARE_PER_PERSON: 1459.0,
          PORT_TAXES_SERVICES: 289.0,
          EXTRA_ADULT: 0.0,
          EXTRA_CHILD: 0.0,
          DISCOUNT: 661.0
        }
      ];
    }
  };

  // Event listeners for sail code filtering - set up immediately
  useEffect(() => {
    console.log('[LinkingEvent] 🔗 [PublishedRates] Setting up event listeners');
    
    const handleSailSelect = (event) => {
      const sailCode = event.detail;
      console.log('[LinkingEvent] 🔗 [PublishedRates] RECEIVED sail selection event:', sailCode);
      setSelectedSailCode(sailCode);
    };

    const handleSailClear = () => {
      console.log('[LinkingEvent] 🔗 [PublishedRates] RECEIVED sail clear event');
      setSelectedSailCode(null);
    };

    // Add event listeners
    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    
    console.log('[LinkingEvent] 🔗 [PublishedRates] Event listeners added for:', SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT);

    return () => {
      console.log('[LinkingEvent] 🔗 [PublishedRates] Cleaning up event listeners');
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    };
  }, []);

  // Filter data based on selected sail code
  const getFilteredData = () => {
    if (!selectedSailCode || allData.length === 0) {
      return allData;
    }
    
    const filtered = allData.filter(record => record.SAIL_CODE === selectedSailCode);
    console.log('[PublishedRates] Filtered data for sail:', selectedSailCode, 'Records:', filtered.length);
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
        console.log('[PublishedRates] skipped (Tabulator exists)'); 
        return; 
      }
      
      const data = [
        { 
          SNAPSHOT_DATE: "2025-08-05", 
          SAIL_CODE: "CJ07260509", 
          SHIP_CODE: "CJ", 
          PACKAGE_NAME: "Idyllic Greece -7Nights", 
          RATE_TYPE: "CUG", 
          DEPARTURE_DATE: "2026-05-09", 
          CABIN_CATEGORY: "XBO", 
          FARE_PER_PERSON: 1459.0, 
          CURRENCY_CODE: "EUR" 
        }
      ];
      
      const headers = ["Snapshot Date", "Sail Code", "Ship", "Package", "Rate Type", "Departure", "Cabin", "Fare", "Currency"];
      const rows = data.map((r, i) => `<tr data-id="${i}">
        <td>${r.SNAPSHOT_DATE}</td>
        <td>${r.SAIL_CODE}</td>
        <td>${r.SHIP_CODE}</td>
        <td>${r.PACKAGE_NAME}</td>
        <td>${r.RATE_TYPE}</td>
        <td>${r.DEPARTURE_DATE}</td>
        <td>${r.CABIN_CATEGORY}</td>
        <td style="text-align:right">${r.FARE_PER_PERSON}</td>
        <td>${r.CURRENCY_CODE}</td>
      </tr>`).join("");
      
      tableRef.current.innerHTML = `
        <div style="padding:6px 8px;font-family:ui-sans-serif,system-ui;font-size:13px">
          <div style="margin-bottom:6px;color:#a55">(Published Rates - Fallback table active)</div>
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
      console.log('[PublishedRates] fallback table rendered');
    };

    (async () => {
      try {
        if (!tableRef.current || initializedRef.current) return;

        // Load published rates data
        const publishedRatesData = await loadPublishedRatesData();

        // Ensure Tabulator is available (via CDN)
        const cssOk = await loadCssFromList(CDN.tabulatorCss);
        await loadScriptFromList(CDN.tabulatorJs, () => window.Tabulator || window.TabulatorFull);
        const TabGlobal = window.Tabulator || window.TabulatorFull;
        console.log('[PublishedRates] Tabulator global typeof:', typeof TabGlobal);
        if (!cssOk) console.warn("[PublishedRates] Tabulator CSS failed to load from all sources");
        if (!TabGlobal) { renderFallbackTable(); return; }

        // Wait for real size
        const sz = await waitForNonZeroSize(tableRef.current, 3000);
        console.log("[PublishedRates] container size before init:", sz);

        // Safety net: If we haven't finished init in 1200ms, draw fallback
        if (failSafeRef.current) clearTimeout(failSafeRef.current);
        failSafeRef.current = setTimeout(() => {
          console.warn('[PublishedRates] failSafe fired — using fallback table');
          if (!instanceRef.current) renderFallbackTable();
        }, 1200);

        // Define columns for published rates
        const columns = [
          { 
            title: "Snapshot Date", 
            field: "SNAPSHOT_DATE", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "YYYY-MM-DD",
            formatter: (cell) => {
              const date = new Date(cell.getValue());
              return date.toLocaleDateString();
            }
          },
          { 
            title: "Sail Code", 
            field: "SAIL_CODE", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter sail code..."
          },
          { 
            title: "Ship", 
            field: "SHIP_CODE", 
            width: 80,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Ships", "CJ": "Celestyal Journey", "CD": "Celestyal Discovery" },
              clearable: true
            }
          },
          { 
            title: "Package", 
            field: "PACKAGE_NAME", 
            widthGrow: 2,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter package..."
          },
          { 
            title: "Region", 
            field: "REGION", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter region..."
          },
          { 
            title: "Rate Type", 
            field: "RATE_TYPE", 
            width: 100,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Types", "CUG": "CUG", "BAR": "BAR", "PROMO": "PROMO" },
              clearable: true
            }
          },
          { 
            title: "Sail Days", 
            field: "SAIL_DAYS", 
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
            title: "Departure", 
            field: "DEPARTURE_DATE", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "YYYY-MM-DD",
            formatter: (cell) => {
              const date = new Date(cell.getValue());
              return date.toLocaleDateString();
            }
          },
          { 
            title: "Cabin", 
            field: "CABIN_CATEGORY", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter cabin..."
          },
          { 
            title: "Promo", 
            field: "PROMO_NAME", 
            widthGrow: 2,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter promo..."
          },
          { 
            title: "Currency", 
            field: "CURRENCY_CODE", 
            width: 80,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All", "EUR": "EUR", "USD": "USD", "GBP": "GBP" },
              clearable: true
            }
          },
          { 
            title: "Fare", 
            field: "FARE_PER_PERSON", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min fare",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? value.toLocaleString() : '';
            }
          },
          { 
            title: "Port Taxes", 
            field: "PORT_TAXES_SERVICES", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min taxes",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? value.toLocaleString() : '';
            }
          },
          { 
            title: "Discount", 
            field: "DISCOUNT", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "Min discount",
            headerFilterFunc: ">=",
            headerFilterParams: {
              type: "number"
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? value.toLocaleString() : '';
            }
          }
        ];

        console.log('[PublishedRates] initializing Tabulator on', tableRef.current);
        // Give the layout one more frame to settle
        await new Promise((r) => requestAnimationFrame(() => r()));

        const TabCtor = TabGlobal;
        instanceRef.current = new TabCtor(tableRef.current, {
          data: publishedRatesData,
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
              console.log("[PublishedRates] rowSelectionChanged", rec);
              emitSelect(rec);
            } else {
              console.log("[PublishedRates] rowSelectionChanged — empty selection");
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
          console.log('[PublishedRates] Table built successfully');
          tableBuiltRef.current = true;
        });

        console.log('[PublishedRates] Tabulator instance created:', instanceRef.current);

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
              console.warn('Failed to destroy PublishedRates Tabulator instance:', e);
            }
            instanceRef.current = null;
          }
          initializedRef.current = false;
        };

      } catch (err) {
        console.error('[PublishedRates] fatal init error', err);
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
      console.log('[PublishedRates] Manual refresh - updating data with:', filteredData.length, 'records');
      try {
        instanceRef.current.replaceData(filteredData);
      } catch (e) {
        console.warn('[PublishedRates] Failed to refresh data:', e);
      }
    }
  }, [selectedSailCode, allData]);

  // Update Tabulator data when selected sail code changes
  useEffect(() => {
    console.log('[PublishedRates] Data update effect triggered - selectedSailCode:', selectedSailCode, 'allData.length:', allData.length, 'tableBuilt:', tableBuiltRef.current);
    
    if (instanceRef.current && allData.length > 0 && tableBuiltRef.current) {
      const filteredData = getFilteredData();
      console.log('[PublishedRates] Updating Tabulator data with filtered results:', filteredData.length, 'records');
      try {
        instanceRef.current.replaceData(filteredData);
      } catch (e) {
        console.warn('[PublishedRates] Failed to update Tabulator data:', e);
      }
    } else if (instanceRef.current && allData.length > 0 && !tableBuiltRef.current) {
      console.log('[PublishedRates] Table not yet built, skipping data update');
    } else if (instanceRef.current && allData.length === 0) {
      console.log('[PublishedRates] No data available yet');
    }
  }, [selectedSailCode, allData]);

  // Expose refresh function globally for testing
  React.useEffect(() => {
    window.publishedRatesRefresh = refreshData;
    return () => {
      delete window.publishedRatesRefresh;
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

PublishedRates.displayName = 'PublishedRates';

export default PublishedRates;
