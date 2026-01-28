/**
 * Direct Source Request Presenter Component
 * 
 * Displays results from external GraphQL queries in a Tabulator table.
 * Shows query information, source endpoint, and execution details.
 * 
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

const DirectSourceRequestPresenter = ({ 
  data, 
  theme, 
  onRefresh, 
  loading,
  queryInfo,
  persistedEvent,
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
        let color = '#888';
        if (value === 'AVAILABLE') color = '#4caf50';
        else if (value === 'LIMITED') color = '#ff9800';
        else if (value === 'SOLD_OUT' || value === 'UNAVAILABLE') color = '#f44336';
        return `<span style="color: ${color}; font-weight: 500;">${value}</span>`;
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
            try { row?.select?.(); } catch {}
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

  const defaultTheme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      border: '#e0e0e0',
      cardBackground: '#f5f5f5',
      accent: '#b08d57',
      textSecondary: '#666666'
    }
  };

  const themeValues = theme || defaultTheme;

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

  // Inline styles (self-contained, no external CSS)
  const styles = {
    container: {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      background: themeValues.colors.background,
      color: themeValues.colors.foreground
    },
    header: {
      padding: '8px 12px',
      background: themeValues.colors.cardBackground || themeValues.colors.background,
      borderBottom: `1px solid ${themeValues.colors.border || '#333'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '8px'
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    title: {
      fontSize: '14px',
      fontWeight: '600',
      margin: 0
    },
    badge: {
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '10px',
      background: themeValues.colors.accent || '#b08d57',
      color: 'white'
    },
    sourceInfo: {
      fontSize: '11px',
      color: themeValues.colors.textSecondary || '#888',
      fontFamily: 'monospace'
    },
    button: {
      padding: '4px 10px',
      fontSize: '12px',
      border: `1px solid ${themeValues.colors.border || '#333'}`,
      borderRadius: '4px',
      cursor: 'pointer',
      background: themeValues.colors.cardBackground || '#2a2a2a',
      color: themeValues.colors.foreground || '#fff',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    buttonPrimary: {
      background: themeValues.colors.accent || '#b08d57',
      color: 'white',
      border: 'none'
    },
    contextBar: {
      padding: '6px 12px',
      background: `${themeValues.colors.accent}15` || 'rgba(176, 141, 87, 0.1)',
      borderBottom: `1px solid ${themeValues.colors.border || '#333'}`,
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap'
    },
    contextItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    contextLabel: {
      color: themeValues.colors.textSecondary || '#888',
      fontWeight: '500'
    },
    contextValue: {
      color: themeValues.colors.foreground
    },
    testPanel: {
      padding: '12px',
      background: testMode 
        ? `${themeValues.colors.accent}20` 
        : themeValues.colors.cardBackground || '#1e1e1e',
      borderBottom: `1px solid ${themeValues.colors.border || '#333'}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    testHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px'
    },
    testToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer'
    },
    testCheckbox: {
      width: '16px',
      height: '16px',
      cursor: 'pointer'
    },
    testLabel: {
      fontSize: '13px',
      fontWeight: '600',
      color: themeValues.colors.foreground
    },
    testControls: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'flex-end'
    },
    testInputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },
    testInputLabel: {
      fontSize: '11px',
      color: themeValues.colors.textSecondary || '#888',
      fontWeight: '500'
    },
    testInput: {
      padding: '6px 10px',
      fontSize: '13px',
      border: `1px solid ${themeValues.colors.border || '#333'}`,
      borderRadius: '4px',
      background: themeValues.colors.background,
      color: themeValues.colors.foreground,
      minWidth: '140px'
    },
    testButton: {
      padding: '6px 16px',
      fontSize: '13px',
      fontWeight: '600',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      background: themeValues.colors.accent || '#b08d57',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    queryPanel: {
      padding: '12px',
      background: themeValues.colors.cardBackground || '#1e1e1e',
      borderBottom: `1px solid ${themeValues.colors.border || '#333'}`,
      maxHeight: '200px',
      overflow: 'auto'
    },
    queryPre: {
      margin: 0,
      fontSize: '11px',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      color: themeValues.colors.foreground,
      background: themeValues.colors.background,
      padding: '8px',
      borderRadius: '4px',
      border: `1px solid ${themeValues.colors.border || '#333'}`
    },
    tableContainer: {
      flex: 1,
      minHeight: 0,
      padding: '8px'
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    },
    stats: {
      fontSize: '11px',
      color: themeValues.colors.textSecondary || '#888'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>Direct Source Request</h3>
          <span style={styles.badge}>{data?.length || 0} results</span>
          {queryInfo?.executionTime && (
            <span style={styles.stats}>{queryInfo.executionTime}ms</span>
          )}
        </div>
        <div style={styles.headerRight}>
          <span style={styles.sourceInfo}>{queryInfo?.endpoint || 'No endpoint'}</span>
          <button
            onClick={() => setShowQueryDetails(!showQueryDetails)}
            style={styles.button}
            title="Show/hide query details"
          >
            {showQueryDetails ? '▼' : '▶'} Query
          </button>
          <button
            onClick={onRefresh}
            style={{ ...styles.button, ...styles.buttonPrimary }}
            disabled={loading}
          >
            {loading ? '...' : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* Context Bar */}
      <div style={styles.contextBar}>
        <div style={styles.contextItem}>
          <span style={styles.contextLabel}>Context:</span>
          <span style={styles.contextValue}>{getContextDisplay()}</span>
        </div>
        {queryInfo?.variables && (
          <>
            <div style={styles.contextItem}>
              <span style={styles.contextLabel}>From:</span>
              <span style={styles.contextValue}>{queryInfo.variables.startDateFrom}</span>
            </div>
            <div style={styles.contextItem}>
              <span style={styles.contextLabel}>To:</span>
              <span style={styles.contextValue}>{queryInfo.variables.startDateTo}</span>
            </div>
          </>
        )}
        {queryInfo?.lastExecuted && (
          <div style={styles.contextItem}>
            <span style={styles.contextLabel}>Executed:</span>
            <span style={styles.contextValue}>
              {new Date(queryInfo.lastExecuted).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Fallback Notice */}
      {queryInfo?.variables?._context?.fallbackReason && (
        <div style={{
          padding: '8px 12px',
          background: `${themeValues.colors.warning || '#f5a623'}20`,
          borderBottom: `1px solid ${themeValues.colors.border || '#333'}`,
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px' }}>ℹ️</span>
          <span style={{ color: themeValues.colors.warning || '#f5a623' }}>
            {queryInfo.variables._context.fallbackReason} - Showing next 4 weeks instead
          </span>
        </div>
      )}

      {/* Test Mode Controls */}
      <div style={styles.testPanel}>
        <div style={styles.testHeader}>
          <label style={styles.testToggle}>
            <input 
              type="checkbox" 
              checked={testMode}
              onChange={onToggleTestMode}
              style={styles.testCheckbox}
            />
            <span style={styles.testLabel}>
              Test Mode - Manual Date Selection
            </span>
          </label>
          {testMode && (
            <span style={{ fontSize: '11px', color: themeValues.colors.textSecondary }}>
              Override event context with manual dates
            </span>
          )}
        </div>
        
        {testMode && (
          <div style={styles.testControls}>
            <div style={styles.testInputGroup}>
              <label style={styles.testInputLabel}>Effective Date</label>
              <input 
                type="date"
                value={manualDates.effectiveDate || ''}
                onChange={(e) => onDateChange('effectiveDate', e.target.value)}
                style={styles.testInput}
              />
            </div>
            <div style={styles.testInputGroup}>
              <label style={styles.testInputLabel}>Start Date</label>
              <input 
                type="date"
                value={manualDates.startDate || ''}
                onChange={(e) => onDateChange('startDate', e.target.value)}
                style={styles.testInput}
              />
            </div>
            <div style={styles.testInputGroup}>
              <label style={styles.testInputLabel}>End Date</label>
              <input 
                type="date"
                value={manualDates.endDate || ''}
                onChange={(e) => onDateChange('endDate', e.target.value)}
                style={styles.testInput}
              />
            </div>
            <button 
              onClick={onTestQuery}
              disabled={loading}
              style={{
                ...styles.testButton,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'wait' : 'pointer'
              }}
            >
              {loading ? '...' : '▶'} Execute Test Query
            </button>
          </div>
        )}
      </div>

      {/* Query Details Panel (collapsible) */}
      {showQueryDetails && (
        <div style={styles.queryPanel}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '12px' }}>
            GraphQL Query:
          </div>
          <pre style={styles.queryPre}>{queryInfo?.query || 'No query'}</pre>
          {queryInfo?.variables && (
            <>
              <div style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '500', fontSize: '12px' }}>
                Variables:
              </div>
              <pre style={styles.queryPre}>
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
      <div style={styles.tableContainer}>
        {loading && (
          <div style={styles.loadingOverlay}>
            <div style={{ 
              background: themeValues.colors.cardBackground, 
              padding: '16px 24px', 
              borderRadius: '8px',
              color: themeValues.colors.foreground
            }}>
              Querying external source...
            </div>
          </div>
        )}
        <div 
          ref={tableRef} 
          style={{ height: "100%", width: "100%" }} 
        />
      </div>
    </div>
  );
};

export default DirectSourceRequestPresenter;
