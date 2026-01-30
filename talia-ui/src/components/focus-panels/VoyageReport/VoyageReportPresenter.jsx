/**
 * Voyage Report Presenter
 * 
 * LIGHTWEIGHT TEMPLATE for Tabulator-based reports.
 * 
 * Standards:
 * - Uses CSS classes from components.css (no inline styles)
 * - Uses shared formatters from dataTypes library
 * - Uses Tabulator's native theming (via tabulator-theme.css)
 * - Accessible: ARIA labels, keyboard navigation
 * 
 * Copy this as a template for new report components.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import {
  createPerformanceFormatter,
  createDeltaFormatter,
  createRowFormatter,
  isEmpty,
  parseNumber
} from '../../../lib/dataTypes';

// ============================================================================
// Value Formatters (from dataTypes patterns)
// ============================================================================

const formatCurrency = (value) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

const formatPercentage = (value) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return `${num.toFixed(2)}%`;
};

// Conditional formatters
const performanceFormatter = createPerformanceFormatter(100);
const deltaFormatter = createDeltaFormatter();
const rowFormatter = createRowFormatter();

// ============================================================================
// Column Definitions
// ============================================================================

const columns = [
  // Core identification columns
  { 
    field: "accMonth", 
    title: "Month",
    width: 100,
    headerFilter: "list",
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    accessibleTitle: "Accounting Month"
  },
  { 
    field: "voyageCode", 
    title: "Voyage",
    width: 150,
    headerFilter: "list",
    headerFilterParams: { valuesLookup: true, autocomplete: true }
  },
  { 
    field: "ship", 
    title: "Ship",
    width: 150,
    headerFilter: "list",
    headerFilterParams: { valuesLookup: true, autocomplete: true }
  },
  
  // Occupancy metrics
  {
    title: "Occupancy",
    columns: [
      { 
        field: "paxNightsBookedOccupancy", 
        title: "Booked %",
        width: 100,
        hozAlign: "right",
        formatter: (cell) => formatPercentage(cell.getValue())
      },
      { 
        field: "targetOccupancy", 
        title: "Target %",
        width: 100,
        hozAlign: "right",
        formatter: (cell) => formatPercentage(cell.getValue())
      }
    ]
  },
  
  // Revenue metrics
  {
    title: "Revenue",
    columns: [
      { 
        field: "ytdBookedRevEUR", 
        title: "YTD Rev EUR",
        width: 130,
        hozAlign: "right",
        formatter: (cell) => formatCurrency(cell.getValue())
      },
      { 
        field: "vsTargetPercentYTDBookedRevEUR", 
        title: "vs Target",
        width: 100,
        hozAlign: "right",
        formatter: deltaFormatter
      }
    ]
  },
  
  // Performance metrics
  {
    title: "Performance",
    columns: [
      { 
        field: "availabilityPercentInside", 
        title: "Avail Inside",
        width: 100,
        hozAlign: "right",
        formatter: (cell) => createPerformanceFormatter(20)(cell)
      },
      { 
        field: "availabilityPercentOutside", 
        title: "Avail Outside",
        width: 100,
        hozAlign: "right",
        formatter: (cell) => createPerformanceFormatter(20)(cell)
      }
    ]
  }
];

// ============================================================================
// Component
// ============================================================================

const VoyageReportPresenter = ({ data, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const lastDataRef = useRef(null);

  // Initialize Tabulator
  useEffect(() => {
    if (!data?.length || initialized) return;

    let cancelled = false;

    const init = async () => {
      if (!tableRef.current || cancelled) return;

      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        // Destroy existing instance
        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        // Create table with theme-aware options
        instanceRef.current = new Tabulator(tableRef.current, {
          ...getTabulatorOptions(),
          data: data,
          columns: columns,
          initialSort: [{ column: "accMonth", dir: "asc" }],
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          rowFormatter: rowFormatter,
          
          // Accessibility
          a11y: true,
          
          // Event handlers
          rowClick: (e, row) => {
            try { row?.select?.(); } catch {}
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData?.[0];
            if (rec) {
              window.dispatchEvent(new CustomEvent('talia:voyagereport.select', { 
                detail: { voyage_code: rec.voyageCode, row_data: rec }
              }));
            }
          },
          dataLoaded: (data) => {
            setRecordCount(data.length);
          }
        });

        lastDataRef.current = JSON.stringify(data);
        setInitialized(true);
        setRecordCount(data.length);
      } catch (err) {
        console.error('[VoyageReport] Init error:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch {}
      }
    };
  }, [data?.length]);

  // Update data when it changes
  useEffect(() => {
    if (!initialized || !instanceRef.current || !data) return;
    
    const currentDataStr = JSON.stringify(data);
    if (lastDataRef.current === currentDataStr) return;

    try {
      instanceRef.current.replaceData(data);
      lastDataRef.current = currentDataStr;
      setRecordCount(data.length);
    } catch (e) {
      console.warn('[VoyageReport] Data update error:', e);
    }
  }, [data, initialized]);

  // Handle keyboard refresh
  const handleKeyDown = useCallback((e) => {
    if ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRefresh?.();
    }
  }, [onRefresh]);

  return (
    <div 
      className="talia-report"
      role="region"
      aria-label="Voyage Report"
      onKeyDown={handleKeyDown}
    >
      {/* Minimal Header */}
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Voyage Report</h2>
          <span className="talia-report__subtitle">Performance by voyage</span>
        </div>
        <div className="talia-report__actions">
          {onRefresh && (
            <button
              className="talia-btn talia-btn--ghost"
              onClick={onRefresh}
              aria-label="Refresh data"
              title="Refresh (Ctrl+R)"
            >
              ↻
            </button>
          )}
        </div>
      </header>

      {/* Table */}
      <main className="talia-report__content">
        <div 
          ref={tableRef} 
          className="talia-table"
          role="grid"
          aria-label="Voyage data"
          aria-rowcount={recordCount}
        />
      </main>

      {/* Footer */}
      <footer className="talia-report__footer">
        <span>{recordCount.toLocaleString()} rows</span>
        <span>Updated weekly</span>
      </footer>
    </div>
  );
};

export default VoyageReportPresenter;
