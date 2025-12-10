/**
 * Reservation Current State Presentational Component
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
 * Presentational component for reservation current state
 */
const ReservationCurrentStatePresenter = ({ data, theme, onRefresh, selectedSailCode }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);

  // Column definitions using Tabulator's native features
  const columns = [
    { 
      field: "res_id", 
      title: "Res ID",
      headerFilter: "input",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? Math.floor(value).toString() : '';
      }
    },
    { 
      field: "sail_code", 
      title: "Sail Code",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "ship", 
      title: "Ship",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "res_status", 
      title: "Status",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "sail_from_date", 
      title: "Sail From Date",
      headerFilter: "input",
      formatter: (cell) => {
        const date = cell.getValue();
        return date ? new Date(date).toLocaleDateString() : '';
      }
    },
    { 
      field: "sail_to_date", 
      title: "Sail To Date",
      headerFilter: "input",
      formatter: (cell) => {
        const date = cell.getValue();
        return date ? new Date(date).toLocaleDateString() : '';
      }
    },
    { 
      field: "cabin_category", 
      title: "Cabin Category",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "guest_count", 
      title: "Guest Count",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? parseFloat(value).toFixed(2) : '';
      }
    },
    { 
      field: "gross_selling_fare", 
      title: "Gross Selling Fare",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
    },
    { 
      field: "net_selling_fare", 
      title: "Net Selling Fare",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
    },
    { 
      field: "net_ticket_revenue_eur", 
      title: "Net Revenue (EUR)",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
    },
    { 
      field: "agency_id", 
      title: "Agency ID",
      headerFilter: "input",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? Math.floor(value).toString() : '';
      }
    },
    { 
      field: "currency", 
      title: "Currency",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "pax_status", 
      title: "PAX Status",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
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
          layout: "fitData",
          initialSort: [
            { column: "sail_from_date", dir: "desc" }
          ],
          height: "100%",
          selectable: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false
        });

        // Register event listeners using Tabulator's .on() method
        instanceRef.current.on("rowClick", (e, row) => {
          try { row?.select?.(); } catch {}
        });

        instanceRef.current.on("rowSelected", (row) => {
          const rowData = row.getData();
          console.log("[ReservationCurrentState] Row selected:", rowData);
          window.dispatchEvent(new CustomEvent('talia:reservation.select', { 
            detail: {
              res_id: rowData.res_id,
              sail_code: rowData.sail_code,
              row_data: rowData,
              timestamp: new Date().toISOString()
            }
          }));
        });

        instanceRef.current.on("rowDeselected", () => {
          console.log("[ReservationCurrentState] Row deselected");
          window.dispatchEvent(new CustomEvent('talia:reservation.clear', {
            detail: {
              timestamp: new Date().toISOString()
            }
          }));
        });

        console.log('[ReservationCurrentState] Table initialized with event listeners');
      } catch (err) {
        console.error('[ReservationCurrentState] Error initializing table:', err);
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
        console.warn('[ReservationCurrentState] Error updating data:', e);
      }
    }
  }, [data]);

  // Default theme fallback
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

export default ReservationCurrentStatePresenter;
