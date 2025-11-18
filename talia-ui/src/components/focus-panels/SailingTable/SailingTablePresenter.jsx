/**
 * Sailing Table Presentational Component
 * Pure UI component - receives data as props
 * 
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes
 * - No custom sorting → Uses Tabulator initialSort
 * See CODING-STANDARDS.md for principles
 */

import React, { useRef, useEffect } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

/**
 * Presentational component for the sailing table
 */
const SailingTablePresenter = ({ data, theme, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);

  // Column definitions using Tabulator's native features
  // NOTE: Using valuesLookup:true lets Tabulator automatically generate filter options
  // NOTE: Using Tabulator's layout:"fitData" handles all column sizing automatically!
  const columns = [
    { 
      field: "sail_id", 
      title: "Sail ID",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? Math.floor(value).toString() : '';
      },
      headerFilter: "input"
    },
    { 
      field: "sail_code", 
      title: "Sail Code",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true  // Automatically lookup unique values from this column
      }
    },
    { 
      field: "ship_name", 
      title: "Ship",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true  // Automatically lookup unique values
      }
    },
    { 
      field: "package_name", 
      title: "Package",
      headerFilter: "input"
    },
    { 
      field: "package_type", 
      title: "Package Type",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true  // Automatically lookup unique values
      }
    },
    { 
      field: "geog_area_code", 
      title: "Geographic Area",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true  // Automatically lookup unique values
      }
    },
    { 
      field: "sail_days", 
      title: "Sail Days",
      hozAlign: "center",
      headerFilter: "number",
      headerFilterParams: {
        min: 0,
        step: 1
      }
    },
    { 
      field: "sail_date_from", 
      title: "Sail Date",
      formatter: (cell) => {
        const date = new Date(cell.getValue());
        return date.toLocaleDateString();
      },
      headerFilter: "input"
    },
    { 
      field: "port_from", 
      title: "Port From",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "port_to", 
      title: "Port To",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "is_active", 
      title: "Active",
      hozAlign: "center",
      headerFilter: "select",
      headerFilterParams: {
        values: {
          "": "All",
          "Y": "Yes",
          "N": "No"
        },
        clearable: true
      }
    }
  ];

  // Initialize Tabulator table
  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current) return;

      try {
        // Load Tabulator resources using shared config
        const Tabulator = await initTabulator();

        if (cancelled) return;

        // Create Tabulator instance
        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, {
          data: data,
          columns: columns,
          layout: "fitData", // Tabulator handles all column sizing automatically!
          initialSort: [
            { column: "sail_date_from", dir: "desc" } // Sort by sail date descending
          ],
          height: "100%",
          selectable: 1, // Enable row selection
          resizableColumns: true, // Allow column resizing
          movableColumns: true, // Allow column reordering
          headerFilterLiveFilter: true, // Live filtering
          headerFilterLiveFilterDelay: 300, // 300ms delay for performance
          pagination: false // Disable pagination - show all data
        });

        // Register event listeners using Tabulator's .on() method
        instanceRef.current.on("rowClick", (e, row) => {
          try { row?.select?.(); } catch {}
        });

        instanceRef.current.on("rowSelected", (row) => {
          const data = row.getData();
          console.log("[SailingTable] Row selected:", data);
          // Emit selection event for other components
          window.dispatchEvent(new CustomEvent('talia:sail.select', { 
            detail: data.sail_code 
          }));
        });

        instanceRef.current.on("rowDeselected", () => {
          console.log("[SailingTable] Row deselected");
          // Emit clear event
          window.dispatchEvent(new CustomEvent('talia:sail.clear'));
        });

        console.log('[SailingTable] Table initialized with event listeners');
      } catch (err) {
        console.error('[SailingTable] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying table:', e);
        }
      }
    };
  }, [data]);

  // Update table data when data prop changes
  useEffect(() => {
    if (instanceRef.current && data) {
      try {
        instanceRef.current.replaceData(data);
      } catch (e) {
        console.warn('[SailingTable] Error updating data:', e);
      }
    }
  }, [data]);

  const defaultTheme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b'
    }
  };

  const themeValues = theme || defaultTheme;

  return (
    <div style={{
      height: "100%",
      width: "100%",
      position: "relative",
      background: themeValues.colors.background,
      color: themeValues.colors.foreground
    }}>
      {onRefresh && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10
        }}>
          <button
            onClick={onRefresh}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              background: 'white',
              fontWeight: '500'
            }}
          >
            ↻ Refresh
          </button>
        </div>
      )}
      <div 
        ref={tableRef} 
        style={{ 
          height: "100%", 
          width: "100%",
          padding: '8px'
        }} 
      />
    </div>
  );
};

export default SailingTablePresenter;

