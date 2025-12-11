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
 * 
 * TO USE THIS TEMPLATE:
 * 1. Update the columns array with your column definitions
 * 2. Update the event names (talia:yourcomponent.select, etc.)
 * 3. Adjust the initialSort to match your primary sort column
 * 4. Update field names to match your data structure
 */

import React, { useRef, useEffect, useState } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

/**
 * Presentational component template
 */
const TemplatePresenter = ({ data, theme, onRefresh, selectedSailCode }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

  // Column definitions using Tabulator's native features
  // TODO: Replace with your actual column definitions
  const columns = [
    { 
      field: "id", 
      title: "ID",
      width: 100,
      headerFilter: "input"
    },
    { 
      field: "name", 
      title: "Name",
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

        instanceRef.current = new Tabulator(tableRef.current, {
          data: data,
          columns: columns,
          layout: "fitColumns", // or "fitData" depending on your needs
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
            try { row?.select?.(); } catch {}
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
        });

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
              border: `1px solid ${themeValues.colors.border || '#333333'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              background: themeValues.colors.cardBackground || themeValues.colors.background || '#2a2a2a',
              color: themeValues.colors.foreground || '#ffffff',
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
