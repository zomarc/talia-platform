/**
 * Template Presentational Component
 * Pure UI component - receives data as props
 * 
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes
 * - No custom sorting → Uses Tabulator initialSort
 * 
 * STANDARD PATTERN:
 * - Initialize table once when data is ready
 * - Update table data when data changes (using replaceData)
 * - Emit events when rows are selected (talia:yourcomponent.select)
 * - Use selectableRows: 1 for single row selection
 * - Use headerFilter: "list" with autocomplete: true for dropdown filters
 * - Optional grouped tab actions: register cycle/getCycleState handlers on window.__taliaPanelGroupActions
 * 
 * TO USE THIS TEMPLATE:
 * 1. Update the columns array with your column definitions
 * 2. Update the event names (talia:yourcomponent.select, etc.)
 * 3. Adjust the initialSort to match your primary sort column
 * 4. Update field names to match your data structure
 */

import React, { useRef, useEffect, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';

/**
 * Presentational component template
 */
const TemplatePresenter = ({ data, panelInstanceId, panelComponentId }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

  // Column definitions using Tabulator's native features
  // TODO: Replace with your actual column definitions
  const columns = [
    { 
      field: "id", 
      titleShort: "ID",
      titleLong: "Record identifier",
      width: 100,
      headerFilter: "input"
    },
    { 
      field: "name", 
      titleShort: "Name",
      titleLong: "Display name",
      widthGrow: 2,
      headerFilter: "list", // Use "list" instead of deprecated "autocomplete"
      headerFilterParams: {
        valuesLookup: true,  // Automatically lookup unique values from this column
        autocomplete: true   // Enable autocomplete behavior
      }
    },
    // TODO: Add more columns here following the same pattern
  ];

  // Initialize table once when data is ready
  useEffect(() => {
    if (!data || data.length === 0 || tableInitialized) return;

    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;

      try {
        // Load Tabulator resources using shared config
        const Tabulator = await initTabulator();

        if (cancelled || !tableRef.current) return;

        // Create Tabulator instance
        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: data,
          columns: columns,
          initialSort: [
            { column: "id", dir: "desc" } // TODO: Update to your primary sort column
          ],
          height: "100%",
          selectableRows: 1, // Enable single row selection (replaces deprecated "selectable")
          resizableColumns: true, // Allow column resizing
          movableColumns: true, // Allow column reordering
          headerFilterLiveFilter: true, // Live filtering
          headerFilterLiveFilterDelay: 300, // 300ms delay for performance
          pagination: true, // Enable pagination for large datasets
          paginationSize: 50, // Default page size
          paginationSizeSelector: [25, 50, 100, 200], // Page size options
          rowClick: (e, row) => {
            try { row?.select?.(); } catch { /* noop */ }
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
              console.log("[Template] Row selected:", rec);
              // TODO: Update event name to match your component
              window.dispatchEvent(new CustomEvent('talia:template.select', { 
                detail: {
                  id: rec.id, // TODO: Update to match your primary key field
                  row_data: rec,
                  timestamp: new Date().toISOString()
                }
              }));
            } else {
              console.log("[Template] Row deselected");
              // TODO: Update event name to match your component
              window.dispatchEvent(new CustomEvent('talia:template.clear', {
                detail: {
                  timestamp: new Date().toISOString()
                }
              }));
            }
          },
        }));

        console.log('[Template] Table initialized with', data.length, 'records');
        lastDataRef.current = data ? JSON.stringify(data) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[Template] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[Template] Error destroying table:', e);
        }
      }
    };
  }, [data.length]); // Only initialize once when data is available

  // Update table data when data changes (from context updates) - but only after initialization
  useEffect(() => {
    if (!tableInitialized || !instanceRef.current || !data) return;
    
    // Check if data actually changed (compare JSON strings)
    const currentDataStr = data ? JSON.stringify(data) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      console.log('[Template] Updating table data:', data.length, 'records');
      instanceRef.current.replaceData(data);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[Template] Error updating data:', e);
    }
  }, [data, tableInitialized]); // Update when data changes

  // OPTIONAL: register grouped table actions for Dockview tab icons.
  // Use this only when your panel config sets supportsGroupActions: true in registry.js.
  useEffect(() => {
    // TODO: Uncomment and implement when this panel uses Tabulator grouping.
    // window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
    // const key = panelComponentId || 'your-panel-id';
    // const actions = {
    //   cycle: () => { /* closed -> level1 -> level2 ... -> closed */ },
    //   getCycleState: () => ({ depth: 0, maxDepth: 2 }),
    //   // optional compatibility:
    //   openAll: () => { /* expand all groups */ },
    //   collapseAll: () => { /* collapse all groups */ },
    // };
    // window.__taliaPanelGroupActions[key] = actions;
    // if (panelInstanceId) window.__taliaPanelGroupActions[panelInstanceId] = actions;
    // return () => {
    //   delete window.__taliaPanelGroupActions[key];
    //   if (panelInstanceId) delete window.__taliaPanelGroupActions[panelInstanceId];
    // };
  }, [panelComponentId, panelInstanceId]);

  return (
    <div className="focus-panel">
      <div 
        ref={tableRef} 
        className="focus-panel__table"
      />
    </div>
  );
};

export default TemplatePresenter;
