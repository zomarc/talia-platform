/**
 * Direct Source Request Presenter Component
 * 
 * Displays results from external GraphQL queries in a Tabulator table.
 * Shows query information, source endpoint, and execution details.
 * 
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useState } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

const DirectSourceRequestPresenter = ({ 
  data, 
  onRefresh, 
  loading,
  queryInfo,
  // Test mode props
  testMode = false,
  onToggleTestMode,
  manualDates = {},
  onDateChange,
  onTestQuery
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const [showQueryDetails, setShowQueryDetails] = useState(false);
  const lastDataRef = useRef(null);

  // Column definitions for availableVoyages data
  const columns = [
    { 
      title: "Package Code", 
      field: "packageCode", 
      width: 120,
      headerFilter: "input",
      headerFilterPlaceholder: "Filter..."
    },
    { 
      title: "Package Name", 
      field: "packageName", 
      widthGrow: 2,
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true
      }
    },
    { 
      title: "Days", 
      field: "sailDays", 
      hozAlign: "center",
      width: 80,
      headerFilter: "number"
    },
    { 
      title: "Cabin Category", 
      field: "cabinCategoryCode", 
      width: 130,
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true
      }
    },
    { 
      title: "Availability", 
      field: "availabilityResult", 
      width: 120,
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true
      },
      formatter: (cell) => {
        const value = cell.getValue();
        if (!value) return '';
        let variant = 'neutral';
        if (value === 'AVAILABLE') variant = 'available';
        else if (value === 'LIMITED') variant = 'limited';
        else if (value === 'SOLD_OUT' || value === 'UNAVAILABLE') variant = 'unavailable';
        return `<span class="direct-source__availability direct-source__availability--${variant}">${value}</span>`;
      }
    },
    { 
      title: "Can Book", 
      field: "canBookCabins", 
      hozAlign: "center",
      width: 100,
      formatter: "tickCross",
      headerFilter: "tickCross",
      headerFilterParams: { tristate: true }
    },
    { 
      title: "Nested", 
      field: "canBookNestedCabins", 
      hozAlign: "center",
      width: 90,
      formatter: "tickCross",
      headerFilterParams: { tristate: true }
    },
    { 
      title: "Total Cabins", 
      field: "totalCabins", 
      hozAlign: "right",
      width: 110,
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? value.toLocaleString() : '0';
      }
    },
    { 
      title: "Available", 
      field: "availableCabins", 
      hozAlign: "right",
      width: 100,
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? value.toLocaleString() : '0';
      }
    },
    { 
      title: "Absolute", 
      field: "totalAvailableAbsolute", 
      hozAlign: "right",
      width: 100,
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? value.toLocaleString() : '0';
      }
    },
    { 
      title: "Weighted", 
      field: "totalAvailableWeighted", 
      hozAlign: "right",
      width: 100,
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value !== null && value !== undefined ? value.toFixed(2) : '0.00';
      }
    }
  ];

  // Initialize table
  useEffect(() => {
    if (!data || data.length === 0 || tableInitialized) return;

    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;

      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, {
          data: data,
          columns: columns,
          layout: "fitColumns",
          height: "100%",
          selectableRows: 1,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          initialSort: [
            { column: "packageName", dir: "asc" }
          ],
          rowClick: (e, row) => {
            try { row?.select?.(); } catch { /* noop */ }
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
              console.log("[DirectSourceRequest] Row selected:", rec);
              // Emit selection event for other components
              window.dispatchEvent(new CustomEvent('talia:directsource.select', { 
                detail: {
                  source: 'DirectSourceRequest',
                  row_data: rec,
                  timestamp: new Date().toISOString()
                }
              }));
            }
          },
        });

        console.log('[DirectSourceRequest] Table initialized with', data.length, 'records');
        lastDataRef.current = data ? JSON.stringify(data) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[DirectSourceRequest] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[DirectSourceRequest] Error destroying table:', e);
        }
      }
    };
  }, [data?.length]);

  // Update table data when data changes
  useEffect(() => {
    if (!tableInitialized || !instanceRef.current || !data) return;

    const currentDataStr = data ? JSON.stringify(data) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      console.log('[DirectSourceRequest] Updating table data:', data.length, 'records');
      instanceRef.current.replaceData(data);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[DirectSourceRequest] Error updating data:', e);
    }
  }, [data, tableInitialized]);

  // Format context info for display
  const getContextDisplay = () => {
    const ctx = queryInfo?.variables?._context || {};
    
    if (testMode) {
      return 'Manual Date Selection';
    }
    
    if (ctx.fallbackReason) {
      return `Fallback: Next 4 Weeks`;
    }
    
    if (ctx.sailDate) {
      const date = new Date(ctx.sailDate);
      return `From Sail: ${date.toLocaleDateString()}`;
    }
    
    if (ctx.source === 'persisted-event') {
      return 'From Selected Event';
    }
    
    return 'Default Range';
  };

  return (
    <div className="direct-source">
      {/* Header */}
      <div className="direct-source__header">
        <div className="direct-source__header-left">
          <h3 className="direct-source__title">Direct Source Request</h3>
          <span className="direct-source__badge">{data?.length || 0} results</span>
          {queryInfo?.executionTime && (
            <span className="direct-source__stats">{queryInfo.executionTime}ms</span>
          )}
        </div>
        <div className="direct-source__header-right">
          <span className="direct-source__source">{queryInfo?.endpoint || 'No endpoint'}</span>
          <button
            onClick={() => setShowQueryDetails(!showQueryDetails)}
            className="direct-source__button"
            title="Show/hide query details"
          >
            {showQueryDetails ? '▼' : '▶'} Query
          </button>
          <button
            onClick={onRefresh}
            className="direct-source__button direct-source__button--primary"
            disabled={loading}
          >
            {loading ? '...' : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* Context Bar */}
      <div className="direct-source__context-bar">
        <div className="direct-source__context-item">
          <span className="direct-source__context-label">Context:</span>
          <span className="direct-source__context-value">{getContextDisplay()}</span>
        </div>
        {queryInfo?.variables && (
          <>
            <div className="direct-source__context-item">
              <span className="direct-source__context-label">From:</span>
              <span className="direct-source__context-value">{queryInfo.variables.startDateFrom}</span>
            </div>
            <div className="direct-source__context-item">
              <span className="direct-source__context-label">To:</span>
              <span className="direct-source__context-value">{queryInfo.variables.startDateTo}</span>
            </div>
          </>
        )}
        {queryInfo?.lastExecuted && (
          <div className="direct-source__context-item">
            <span className="direct-source__context-label">Executed:</span>
            <span className="direct-source__context-value">
              {new Date(queryInfo.lastExecuted).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Fallback Notice */}
      {queryInfo?.variables?._context?.fallbackReason && (
        <div className="direct-source__fallback">
          <span className="direct-source__fallback-icon">ℹ️</span>
          <span className="direct-source__fallback-text">
            {queryInfo.variables._context.fallbackReason} - Showing next 4 weeks instead
          </span>
        </div>
      )}

      {/* Test Mode Controls */}
      <div className="direct-source__test-panel" data-active={testMode ? 'true' : 'false'}>
        <div className="direct-source__test-header">
          <label className="direct-source__test-toggle">
            <input 
              type="checkbox" 
              checked={testMode}
              onChange={onToggleTestMode}
              className="direct-source__test-checkbox"
            />
            <span className="direct-source__test-label">
              Test Mode - Manual Date Selection
            </span>
          </label>
          {testMode && (
            <span className="direct-source__test-note">
              Override event context with manual dates
            </span>
          )}
        </div>
        
        {testMode && (
          <div className="direct-source__test-controls">
            <div className="direct-source__test-input-group">
              <label className="direct-source__test-input-label">Effective Date</label>
              <input 
                type="date"
                value={manualDates.effectiveDate || ''}
                onChange={(e) => onDateChange('effectiveDate', e.target.value)}
                className="direct-source__test-input"
              />
            </div>
            <div className="direct-source__test-input-group">
              <label className="direct-source__test-input-label">Start Date</label>
              <input 
                type="date"
                value={manualDates.startDate || ''}
                onChange={(e) => onDateChange('startDate', e.target.value)}
                className="direct-source__test-input"
              />
            </div>
            <div className="direct-source__test-input-group">
              <label className="direct-source__test-input-label">End Date</label>
              <input 
                type="date"
                value={manualDates.endDate || ''}
                onChange={(e) => onDateChange('endDate', e.target.value)}
                className="direct-source__test-input"
              />
            </div>
            <button 
              onClick={onTestQuery}
              disabled={loading}
              className="direct-source__test-button"
              data-loading={loading ? 'true' : 'false'}
            >
              {loading ? '...' : '▶'} Execute Test Query
            </button>
          </div>
        )}
      </div>

      {/* Query Details Panel (collapsible) */}
      {showQueryDetails && (
        <div className="direct-source__query-panel">
          <div className="direct-source__query-title">
            GraphQL Query:
          </div>
          <pre className="direct-source__query-pre">{queryInfo?.query || 'No query'}</pre>
          {queryInfo?.variables && (
            <>
              <div className="direct-source__query-title direct-source__query-title--spaced">
                Variables:
              </div>
              <pre className="direct-source__query-pre">
                {JSON.stringify({
                  effectiveDate: queryInfo.variables.effectiveDate,
                  startDateFrom: queryInfo.variables.startDateFrom,
                  startDateTo: queryInfo.variables.startDateTo
                }, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="direct-source__table-container">
        {loading && (
          <div className="direct-source__loading-overlay">
            <div className="direct-source__loading-card">
              Querying external source...
            </div>
          </div>
        )}
        <div 
          ref={tableRef} 
          className="direct-source__table-host"
        />
      </div>
    </div>
  );
};

export default DirectSourceRequestPresenter;
