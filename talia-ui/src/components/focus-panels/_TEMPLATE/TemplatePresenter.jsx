/**
 * Template Presentational Component
 * Pure UI component - receives data as props
 * 
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes
 * - No custom sorting → Uses Tabulator initialSort
 * See CODING-STANDARDS.md for principles
 * 
 * TO USE THIS TEMPLATE:
 * 1. Update the columns array with your column definitions
 * 2. Update the event names (talia:yourcomponent.select, etc.)
 * 3. Adjust the initialSort to match your primary sort column
 */

import React, { useRef, useEffect } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

/**
 * Presentational component template
 */
const TemplatePresenter = ({ data, theme, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);

  // Column definitions using Tabulator's native features
  // TODO: Replace with your actual column definitions
  const columns = [
    { 
      field: "id", 
      title: "ID",
      headerFilter: "input"
    },
    { 
      field: "name", 
      title: "Name",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true  // Automatically lookup unique values from this column
      }
    },
    // Add more columns here following the same pattern
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
            { column: "id", dir: "desc" } // TODO: Update to your primary sort column
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
          const rowData = row.getData();
          console.log("[Template] Row selected:", rowData);
          // TODO: Update event name to match your component
          window.dispatchEvent(new CustomEvent('talia:template.select', { 
            detail: {
              id: rowData.id,
              row_data: rowData,
              timestamp: new Date().toISOString()
            }
          }));
        });

        instanceRef.current.on("rowDeselected", () => {
          console.log("[Template] Row deselected");
          // TODO: Update event name to match your component
          window.dispatchEvent(new CustomEvent('talia:template.clear', {
            detail: {
              timestamp: new Date().toISOString()
            }
          }));
        });

        console.log('[Template] Table initialized with event listeners');
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
        console.warn('[Template] Error updating data:', e);
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

export default TemplatePresenter;

