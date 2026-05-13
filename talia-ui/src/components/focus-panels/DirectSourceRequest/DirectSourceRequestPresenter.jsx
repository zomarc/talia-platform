/**
 * Direct Source Request Presenter Component
 * 
 * Displays results from external GraphQL queries in a Tabulator table.
 * Shows query information, source endpoint, and execution details.
 * 
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';

const DirectSourceRequestPresenter = ({ 
  data, 
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
      title: "Sail Date", 
      field: "sailDate",
      width: 120,
      sorter: "date",
      formatter: (cell) => {
        const value = cell.getValue();
        if (!value) return 'N/A';
        return formatDayMon(value, 'N/A');
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

  const context = queryInfo?.variables?._context || {};
  const validation = queryInfo?.validation || null;
  const selectedSailCode = context?.sailCode || null;
  const selectedSailDate = context?.sailDate || null;
  const rangeDaysBefore = context?.rangeDaysBefore;
  const rangeDaysAfter = context?.rangeDaysAfter;

  const availabilitySummary = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        beforeAvailable: 0,
        afterAvailable: 0,
        selectedAvailable: 0,
        beforeCount: 0,
        afterCount: 0,
        selectedCount: 0,
        matchedCount: 0
      };
    }

    const anchorDate = selectedSailDate ? new Date(selectedSailDate) : null;
    const anchorDay = anchorDate && !Number.isNaN(anchorDate.getTime())
      ? anchorDate.toISOString().split('T')[0]
      : null;

    let beforeAvailable = 0;
    let afterAvailable = 0;
    let selectedAvailable = 0;
    let beforeCount = 0;
    let afterCount = 0;
    let selectedCount = 0;
    let matchedCount = 0;

    data.forEach((row) => {
      if (row?.isSelectedSail) matchedCount += 1;
      if (!anchorDay || !row?.sailDate) return;
      const rowDate = new Date(row.sailDate);
      if (Number.isNaN(rowDate.getTime())) return;
      const rowDay = rowDate.toISOString().split('T')[0];
      if (rowDay < anchorDay) {
        beforeAvailable += Number(row.availableCabins || 0);
        beforeCount += 1;
      } else if (rowDay > anchorDay) {
        afterAvailable += Number(row.availableCabins || 0);
        afterCount += 1;
      } else {
        selectedAvailable += Number(row.availableCabins || 0);
        selectedCount += 1;
      }
    });

    return {
      beforeAvailable,
      afterAvailable,
      selectedAvailable,
      beforeCount,
      afterCount,
      selectedCount,
      matchedCount
    };
  }, [data, selectedSailDate]);

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

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: data,
          columns: columns,
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
          rowFormatter: (row) => {
            const rowElement = row.getElement();
            const rowData = row.getData();
            if (rowData?.isSelectedSail) {
              rowElement.classList.add('direct-source__row--selected');
            } else {
              rowElement.classList.remove('direct-source__row--selected');
            }
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
        }));

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
    };
  }, [data, tableInitialized]);

  // Destroy table only on component unmount.
  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[DirectSourceRequest] Error destroying table:', e);
        }
        instanceRef.current = null;
      }
    };
  }, []);

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

  const formatDateLabel = (value) => {
    if (!value) return '—';
    return formatDayMon(value, '—');
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '0';
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? '0' : numberValue.toLocaleString();
  };

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
      return `From Sail: ${formatDayMon(ctx.sailDate, '—')}`;
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
          <span className="direct-source__source">
            {queryInfo?.endpointSource ? `[${queryInfo.endpointSource}] ` : ''}
            {queryInfo?.endpoint || 'No endpoint'}
          </span>
          <button
            onClick={() => setShowQueryDetails(!showQueryDetails)}
            className="direct-source__button"
            title="Show/hide query details"
          >
            {showQueryDetails ? '▼' : '▶'} Query
          </button>
        </div>
      </div>

      {/* Summary Panel */}
      <div className="direct-source__summary">
        <div className="direct-source__summary-card">
          <div className="direct-source__summary-label">Sail Code</div>
          <div className="direct-source__summary-value">{selectedSailCode || '—'}</div>
          {validation?.status === 'matched' && (
            <div className="direct-source__summary-meta">
              Validated against sail.select: {validation.matchedRows} rows matched
            </div>
          )}
          {validation?.status === 'no_match' && (
            <div className="direct-source__summary-meta" style={{ color: 'var(--theme-error, #c0392b)' }}>
              Validation failed: no direct rows matched selected sail
            </div>
          )}
          {availabilitySummary.matchedCount > 0 && (
            <div className="direct-source__summary-meta">
              {availabilitySummary.matchedCount.toLocaleString()} matches in data
            </div>
          )}
        </div>
        <div className="direct-source__summary-card">
          <div className="direct-source__summary-label">Sail Date</div>
          <div className="direct-source__summary-value">{formatDateLabel(selectedSailDate)}</div>
          {availabilitySummary.selectedCount > 0 && (
            <div className="direct-source__summary-meta">
              Selected day cabins: {formatNumber(availabilitySummary.selectedAvailable)}
            </div>
          )}
        </div>
        <div className="direct-source__summary-card">
          <div className="direct-source__summary-label">Query Window</div>
          <div className="direct-source__summary-value">
            {queryInfo?.variables ? `${queryInfo.variables.startDateFrom} → ${queryInfo.variables.startDateTo}` : '—'}
          </div>
          {Number.isFinite(rangeDaysBefore) && Number.isFinite(rangeDaysAfter) && (
            <div className="direct-source__summary-meta">
              {rangeDaysBefore} days before / {rangeDaysAfter} days after
            </div>
          )}
        </div>
        <div className="direct-source__summary-card">
          <div className="direct-source__summary-label">Availability</div>
          <div className="direct-source__summary-value">
            Before {formatNumber(availabilitySummary.beforeAvailable)} • After {formatNumber(availabilitySummary.afterAvailable)}
          </div>
          {(availabilitySummary.beforeCount > 0 || availabilitySummary.afterCount > 0) && (
            <div className="direct-source__summary-meta">
              {availabilitySummary.beforeCount + availabilitySummary.afterCount} rows around selection
            </div>
          )}
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
        {Number.isFinite(queryInfo?.retryCount) && (
          <div className="direct-source__context-item">
            <span className="direct-source__context-label">Retries:</span>
            <span className="direct-source__context-value">{queryInfo.retryCount}</span>
          </div>
        )}
        {queryInfo?.parity && (
          <div className="direct-source__context-item">
            <span className="direct-source__context-label">Parity:</span>
            <span className="direct-source__context-value">
              {queryInfo.parity.error
                ? `error (${queryInfo.parity.error})`
                : `rows ${queryInfo.parity.directRows}/${queryInfo.parity.localRows}, Δavail ${queryInfo.parity.availableDelta}`}
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
