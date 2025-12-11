/**
 * Data Match Presenter Component
 * Displays data completeness as a cross-tab table using Tabulator
 * Shows matching vs missing record counts for each table per sail
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

const DataMatchPresenter = ({ data, filters, onFiltersChange, theme, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

  // Transform data into cross-tab format for Tabulator
  const transformedData = useMemo(() => {
    if (!data || !data.rows || !data.tables) return [];

    return data.rows.map(row => {
      // Parse date to extract month and year for grouping
      const date = new Date(row.departure_date);
      const month = date.getMonth() + 1; // 1-12
      const year = date.getFullYear();
      const monthYear = `${year}-${String(month).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const rowData = {
        ship_code: row.ship_code,
        departure_date: row.departure_date,
        month_year: monthYear,
        month_name: monthName,
        sail_code: row.sail_code
      };

      // Add columns for each table (combined match/missing format)
      data.tables.forEach(tableName => {
        const match = row.tableMatches.find(tm => tm.tableName === tableName);
        const matchingCount = match?.matchingCount || 0;
        const missingCount = match?.missingCount || 0;
        rowData[tableName] = `${matchingCount}/${missingCount}`;
        // Store raw values for sorting/filtering
        rowData[`${tableName}_match`] = matchingCount;
        rowData[`${tableName}_missing`] = missingCount;
      });

      return rowData;
    });
  }, [data]);

  // Build column definitions dynamically based on tables
  const columns = useMemo(() => {
    if (!data || !data.tables) return [];

    const baseColumns = [
      {
        title: 'Ship Code',
        field: 'ship_code',
        width: 100,
        headerFilter: 'list',
        headerFilterParams: {
          valuesLookup: true,
          autocomplete: true
        },
        frozen: true
      },
      {
        title: 'Month',
        field: 'month_name',
        width: 120,
        headerFilter: 'list',
        headerFilterParams: {
          valuesLookup: true,
          autocomplete: true
        },
        frozen: true
      },
      {
        title: 'Departure Date',
        field: 'departure_date',
        width: 120,
        headerFilter: 'input',
        headerFilterPlaceholder: 'YYYY-MM-DD',
        formatter: (cell) => {
          const value = cell.getValue();
          if (!value) return '';
          const date = new Date(value);
          return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },
        frozen: true
      },
      {
        title: 'Sail Code',
        field: 'sail_code',
        width: 120,
        headerFilter: 'input',
        frozen: true
      }
    ];

    // Add columns for each table (combined match/missing format)
    const tableColumns = data.tables.map(tableName => ({
      title: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      field: tableName,
      hozAlign: 'center',
      width: 120,
      headerFilter: 'input',
      formatter: (cell) => {
        const value = cell.getValue();
        if (!value) return '0/0';
        return value;
      },
      sorter: (a, b) => {
        // Sort by match count (first number)
        const aMatch = parseInt(a.split('/')[0]) || 0;
        const bMatch = parseInt(b.split('/')[0]) || 0;
        return aMatch - bMatch;
      },
      cellStyle: (cell) => {
        try {
          const value = cell.getValue();
          if (!value || typeof value !== 'string') return {};
          const parts = value.split('/');
          if (parts.length !== 2) return {};
          const match = parseInt(parts[0]) || 0;
          const missing = parseInt(parts[1]) || 0;
          
          if (match > 0 && missing === 0) {
            return { backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', fontWeight: '500' };
          } else if (match === 0 && missing > 0) {
            return { backgroundColor: 'rgba(244, 67, 54, 0.2)', color: '#f44336', fontWeight: '500' };
          } else if (match > 0 && missing > 0) {
            return { backgroundColor: 'rgba(255, 152, 0, 0.2)', color: '#ff9800', fontWeight: '500' };
          }
          return {};
        } catch (e) {
          console.warn('[DataMatch] Error in cellStyle:', e);
          return {};
        }
      }
    }));

    return [...baseColumns, ...tableColumns];
  }, [data]);

  // Initialize table once when component mounts
  useEffect(() => {
    if (tableInitialized) return;

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
          data: transformedData,
          columns: columns,
          layout: 'fitColumns',
          height: '100%',
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          selectableRows: 1, // Single row selection
          groupBy: ['ship_code', 'month_name'], // Group by ship_code first, then month_name
          groupHeader: (value, count, data, group) => {
            // Custom group header formatting
            try {
              // Check group structure to determine level
              // First level groups are by ship_code, second level by month_name
              const groupKey = group.getKey();
              if (groupKey && typeof groupKey === 'string') {
                // Check if this is a ship code (typically 2 characters) or month name
                if (groupKey.length <= 3 && /^[A-Z]{2,3}$/.test(groupKey)) {
                  // Likely ship code
                  return `<strong>Ship: ${value}</strong> <span style="color:#999;">(${count} sail${count !== 1 ? 's' : ''})</span>`;
                } else {
                  // Likely month name
                  return `<strong>Month: ${value}</strong> <span style="color:#999;">(${count} sail${count !== 1 ? 's' : ''})</span>`;
                }
              }
              // Fallback: use count to guess level (first level usually has more items)
              if (count > 10) {
                return `<strong>Ship: ${value}</strong> <span style="color:#999;">(${count} sail${count !== 1 ? 's' : ''})</span>`;
              } else {
                return `<strong>Month: ${value}</strong> <span style="color:#999;">(${count} sail${count !== 1 ? 's' : ''})</span>`;
              }
            } catch (e) {
              console.warn('[DataMatch] Error in groupHeader:', e);
              return `${value} (${count})`;
            }
          },
          groupStartOpen: true,
          groupToggleElement: 'header',
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          initialSort: [
            { column: 'ship_code', dir: 'asc' },
            { column: 'departure_date', dir: 'asc' }
          ],
          frozenRows: 0,
          frozenColumns: 4, // Ship Code, Month, Departure Date, Sail Code
          rowClick: (e, row) => {
            try {
              console.log('[DataMatch] Row clicked:', row.getData());
              if (row && typeof row.select === 'function') {
                row.select();
              }
            } catch (err) {
              console.warn('[DataMatch] Error selecting row:', err);
            }
          },
          rowSelectionChanged: (selectedData, selectedRows) => {
            try {
              console.log('[DataMatch] rowSelectionChanged called:', selectedData, selectedRows);
              const rec = selectedData && selectedData.length > 0 ? selectedData[0] : null;
              if (rec) {
                const shipCode = rec.ship_code;
                console.log('[DataMatch] Row selected, emitting ship select event:', shipCode, rec);
                const event = new CustomEvent('talia:ship.select', {
                  detail: {
                    ship_code: shipCode,
                    row_data: rec,
                    timestamp: new Date().toISOString()
                  }
                });
                window.dispatchEvent(event);
                console.log('[DataMatch] Event dispatched:', event.type, event.detail);
              } else {
                console.log('[DataMatch] Row deselected');
                const clearEvent = new CustomEvent('talia:ship.clear', {
                  detail: {
                    timestamp: new Date().toISOString()
                  }
                });
                window.dispatchEvent(clearEvent);
                console.log('[DataMatch] Clear event dispatched');
              }
            } catch (err) {
              console.error('[DataMatch] Error in rowSelectionChanged:', err);
            }
          }
        });

        console.log('[DataMatch] Table initialized with', transformedData.length, 'rows');
        lastDataRef.current = transformedData ? JSON.stringify(transformedData) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[DataMatch] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[DataMatch] Error destroying table:', e);
        }
      }
    };
  }, []); // Initialize once on mount

  // Update table data and columns when data changes
  useEffect(() => {
    if (!tableInitialized || !instanceRef.current) return;

    // Check if data actually changed
    const currentDataStr = transformedData ? JSON.stringify(transformedData) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      console.log('[DataMatch] Updating table data:', transformedData.length, 'rows');
      
      // Update columns if they changed
      if (columns.length > 0) {
        instanceRef.current.setColumns(columns);
      }
      
      // Update data
      instanceRef.current.replaceData(transformedData);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[DataMatch] Error updating data:', e);
    }
  }, [transformedData, columns, tableInitialized]);

  const defaultTheme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b'
    }
  };

  const themeValues = theme || defaultTheme;

  return (
    <div style={{
      height: '100%',
      width: '100%',
      position: 'relative',
      background: themeValues.colors.background,
      color: themeValues.colors.foreground,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Filter Panel */}
      <div style={{
        padding: '12px',
        borderBottom: `1px solid ${themeValues.colors.border || '#333333'}`,
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Ship Code:</span>
          <input
            type="text"
            value={filters.ship_code || ''}
            onChange={(e) => onFiltersChange({ ...filters, ship_code: e.target.value || null })}
            placeholder="Filter by ship code"
            style={{
              padding: '4px 8px',
              border: `1px solid ${themeValues.colors.border || '#333333'}`,
              borderRadius: '4px',
              background: themeValues.colors.cardBackground || themeValues.colors.background,
              color: themeValues.colors.foreground,
              width: '120px'
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Sail Code:</span>
          <input
            type="text"
            value={filters.sail_code || ''}
            onChange={(e) => onFiltersChange({ ...filters, sail_code: e.target.value || null })}
            placeholder="Filter by sail code"
            style={{
              padding: '4px 8px',
              border: `1px solid ${themeValues.colors.border || '#333333'}`,
              borderRadius: '4px',
              background: themeValues.colors.cardBackground || themeValues.colors.background,
              color: themeValues.colors.foreground,
              width: '120px'
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Date From:</span>
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => onFiltersChange({ ...filters, date_from: e.target.value || null })}
            style={{
              padding: '4px 8px',
              border: `1px solid ${themeValues.colors.border || '#333333'}`,
              borderRadius: '4px',
              background: themeValues.colors.cardBackground || themeValues.colors.background,
              color: themeValues.colors.foreground
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Date To:</span>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => onFiltersChange({ ...filters, date_to: e.target.value || null })}
            style={{
              padding: '4px 8px',
              border: `1px solid ${themeValues.colors.border || '#333333'}`,
              borderRadius: '4px',
              background: themeValues.colors.cardBackground || themeValues.colors.background,
              color: themeValues.colors.foreground
            }}
          />
        </label>
        {onRefresh && (
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
              fontWeight: '500',
              marginLeft: 'auto'
            }}
          >
            ↻ Refresh
          </button>
        )}
      </div>

      {/* Table */}
      <div 
        ref={tableRef} 
        style={{ 
          height: '100%', 
          width: '100%',
          flex: 1,
          overflow: 'hidden'
        }} 
      />
    </div>
  );
};

export default DataMatchPresenter;

