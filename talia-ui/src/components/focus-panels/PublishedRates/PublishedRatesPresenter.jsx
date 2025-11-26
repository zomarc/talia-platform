/**
 * Published Rates Presentational Component
 * Pure UI component - receives data as props
 * 
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes + CSS variables
 * - No custom sorting → Uses Tabulator initialSort
 * See CODING-STANDARDS.md for principles
 */

import React, { useRef, useEffect } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';
import { useTheme } from '../../../contexts/ThemeContext';
import '../../../styles/publishedRates.css';

// Event names for row selection
const SELECT_EVENT = 'talia:publishedRates.select';
const CLEAR_EVENT = 'talia:publishedRates.clear';

/**
 * Presentational component for published rates table
 */
const PublishedRatesPresenter = ({ data, theme, onRefresh, selectedSailCode }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const { fontSize, selectedFont, spacingMode } = useTheme();

  // Column definitions using Tabulator's native features
  const columns = [
    { 
      title: "Snapshot Date", 
      field: "SNAPSHOT_DATE", 
      width: 120,
      headerFilter: "input",
      headerFilterPlaceholder: "YYYY-MM-DD",
      formatter: (cell) => {
        const value = cell.getValue();
        if (!value) return '';
        const date = new Date(value);
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
        const value = cell.getValue();
        if (!value) return '';
        const date = new Date(value);
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
          layout: "fitColumns",
          initialSort: [
            { column: "SNAPSHOT_DATE", dir: "desc" },
            { column: "DEPARTURE_DATE", dir: "asc" }
          ],
          height: "100%",
          selectableRows: 1, // Enable row selection (correct property name)
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false,
          headerHeight: 28, // Fixed to match Data Mode
          rowHeight: 24, // Fixed to match Data Mode
          fontSize: 10, // Use Tabulator's fontSize option
          theme: "default" // Use default theme
        });

        // Register event listeners using Tabulator's .on() method
        instanceRef.current.on("rowClick", (e, row) => {
          try { row?.select?.(); } catch {}
        });

        instanceRef.current.on("rowSelected", (row) => {
          const rowData = row.getData();
          console.log("[PublishedRates] Row selected:", rowData);
          window.dispatchEvent(new CustomEvent(SELECT_EVENT, { 
            detail: {
              sail_code: rowData.SAIL_CODE,
              row_data: rowData,
              timestamp: new Date().toISOString()
            }
          }));
        });

        instanceRef.current.on("rowDeselected", () => {
          console.log("[PublishedRates] Row deselected");
          window.dispatchEvent(new CustomEvent(CLEAR_EVENT, {
            detail: {
              timestamp: new Date().toISOString()
            }
          }));
        });

        console.log('[PublishedRates] Table initialized with event listeners');
      } catch (err) {
        console.error('[PublishedRates] Error initializing table:', err);
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
  }, []); // Only run once on mount

  // Update table data when data prop changes
  useEffect(() => {
    if (instanceRef.current && data) {
      try {
        instanceRef.current.replaceData(data);
      } catch (e) {
        console.warn('[PublishedRates] Error updating data:', e);
      }
    }
  }, [data]);

  return (
    <div style={{
      height: "100%",
      width: "100%",
      position: "relative",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Container wrapper matching Data Mode styling */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--theme-glass, rgba(255, 255, 255, 0.08))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        border: "1px solid var(--theme-glass-border, rgba(255, 255, 255, 0.15))",
        overflow: "hidden"
      }}>
        {/* Table container */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontSize: "10px",
          color: "var(--theme-fg, #e8e8f0)",
          fontFamily: selectedFont.value
        }}>
          {selectedSailCode && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              zIndex: 10,
              padding: '4px 8px',
              backgroundColor: 'var(--theme-accent-light)',
              color: 'var(--theme-fg)',
              borderRadius: '4px',
              fontSize: '8px',
              fontWeight: '500'
            }}>
              Filtered by: {selectedSailCode}
            </div>
          )}
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
                  fontSize: '10px',
                  border: '1px solid var(--theme-glass-border, rgba(255, 255, 255, 0.15))',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: 'var(--theme-bg-solid, #151528)',
                  color: 'var(--theme-fg, #e8e8f0)',
                  fontWeight: '500'
                }}
              >
                ↻ Refresh
              </button>
            </div>
          )}
          <div 
            ref={tableRef} 
            className="published-rates-table"
            style={{ 
              height: "100%", 
              width: "100%",
              flex: 1,
              overflow: "hidden"
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default PublishedRatesPresenter;

