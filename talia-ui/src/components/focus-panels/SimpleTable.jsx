/**
 * Sailing by Cabin Category Component
 * Based on TablePanel structure with Tabulator for displaying sailing cabin occupancy data
 * Loads data from local JSON file for demo purposes
 */

import React, { useRef, useEffect } from 'react';

import { initTabulator } from '../../lib/tabulatorConfig';

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
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const initializedRef = useRef(false);
  const failSafeRef = useRef(null);
  const tableBuiltRef = useRef(false); // Track if table is fully built
  const [selectedSailCode, setSelectedSailCode] = React.useState(null);
  const [allData, setAllData] = React.useState([]);

  // Load sailing cabin occupancy data from Supabase
  const loadSailingCabinData = async () => {
    try {
      // Direct Supabase query for master_sail table
      const response = await fetch('http://127.0.0.1:54321/rest/v1/master_sail?select=*&limit=100', {
        headers: {
          'apikey': 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
          'Authorization': 'Bearer sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[SailingByCabinCategory] Loaded data from Supabase:', data.length, 'records');
      setAllData(data); // Store all data for filtering
      return data;
    } catch (error) {
      console.error('[SailingByCabinCategory] Error loading data:', error);
      // Return empty array and let the UI handle the no-data state
      return [];
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

    const renderNoData = () => {
      if (!tableRef.current) return;
      if (instanceRef.current) { 
        console.log('[SailingByCabinCategory] skipped (Tabulator exists)'); 
        return; 
      }
      
      tableRef.current.innerHTML = `
        <div style="padding:20px;font-family:ui-sans-serif,system-ui;font-size:14px;text-align:center;color:#666">
          <div style="margin-bottom:10px;color:#999">⚠️ No data available</div>
          <div style="color:#888;font-size:12px">Unable to load data from Supabase. Please check the connection.</div>
        </div>`;
      
      console.log('[SailingByCabinCategory] No data message displayed');
    };

    (async () => {
      try {
        if (!tableRef.current || initializedRef.current) return;

        // Load sailing cabin occupancy data
        const sailingCabinData = await loadSailingCabinData();
        console.log('[LinkingEvent] [SailingByCabinCategory] Loaded data for Tabulator:', sailingCabinData.length, 'records');

        // Load Tabulator using shared config
        const Tabulator = await initTabulator();
        const TabGlobal = Tabulator;
        console.log('[SailingByCabinCategory] Tabulator global typeof:', typeof TabGlobal);
        if (!TabGlobal) { renderNoData(); return; }

        // Wait for real size
        const sz = await waitForNonZeroSize(tableRef.current, 3000);
        console.log("[SailingByCabinCategory] container size before init:", sz);

        // Safety net: If we haven't finished init in 1200ms, draw fallback
        if (failSafeRef.current) clearTimeout(failSafeRef.current);
          failSafeRef.current = setTimeout(() => {
          console.warn('[SailingByCabinCategory] failSafe fired — showing no data message');
          if (!instanceRef.current) renderNoData();
        }, 1200);

        // Define columns for master sail data
        const columns = [
          { 
            title: "Sail ID", 
            field: "sail_id", 
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
            field: "sail_code", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter sail code..."
          },
          { 
            title: "Ship", 
            field: "ship_name", 
            width: 150,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Ships", "Celestyal Journey": "Celestyal Journey", "Celestyal Discovery": "Celestyal Discovery" },
              clearable: true
            }
          },
          { 
            title: "Package", 
            field: "package_name", 
            widthGrow: 2,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter package..."
          },
          { 
            title: "Package Type", 
            field: "package_type", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter type..."
          },
          { 
            title: "Geographic Area", 
            field: "geog_area_code", 
            width: 120,
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All Areas", "ADRIATIC": "ADRIATIC", "AEGEAN": "AEGEAN", "MEDITERRANEAN": "MEDITERRANEAN" },
              clearable: true
            }
          },
          { 
            title: "Sail Days", 
            field: "sail_days", 
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
            field: "sail_date_from", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "YYYY-MM-DD",
            formatter: (cell) => {
              const date = new Date(cell.getValue());
              return date.toLocaleDateString();
            }
          },
          { 
            title: "Port From", 
            field: "port_from", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "From port..."
          },
          { 
            title: "Port To", 
            field: "port_to", 
            width: 100,
            headerFilter: "input",
            headerFilterPlaceholder: "To port..."
          },
          { 
            title: "Active", 
            field: "is_active", 
            width: 80,
            hozAlign: "center",
            headerFilter: "list",
            headerFilterParams: {
              values: { "": "All", "Y": "Yes", "N": "No" },
              clearable: true
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
        renderNoData();
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
  }, [selectedSailCode, allData.length]);

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
  }, [selectedSailCode, allData.length]);

  // Expose refresh function globally for testing
  React.useEffect(() => {
    window.sailingCabinRefresh = refreshData;
    return () => {
      delete window.sailingCabinRefresh;
    };
  }, [refreshData]);

  // Note: Font changes are handled via CSS and don't require Tabulator updates
  // This prevents interference with Dockview's drag and drop system

  return <div ref={tableRef} style={{ width: "100%", height: "100%" }} />;
});

SailingByCabinCategory.displayName = 'SailingByCabinCategory';

export default SailingByCabinCategory;
