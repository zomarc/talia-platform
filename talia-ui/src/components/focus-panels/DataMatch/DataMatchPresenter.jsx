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
      const rowData = {
        ship_code: row.ship_code,
        departure_date: row.departure_date,
        sail_code: row.sail_code
      };

      // Add columns for each table (matching and missing counts)
      data.tables.forEach(tableName => {
        const match = row.tableMatches.find(tm => tm.tableName === tableName);
        rowData[`${tableName}_matching`] = match?.matchingCount || 0;
        rowData[`${tableName}_missing`] = match?.missingCount || 0;
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
        title: 'Departure Date',
        field: 'departure_date',
        width: 120,
        headerFilter: 'input',
        headerFilterPlaceholder: 'YYYY-MM-DD',
        formatter: (cell) => {
          const value = cell.getValue();
          if (!value) return '';
          const date = new Date(value);
          return date.toLocaleDateString();
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

    // Add columns for each table
    const tableColumns = data.tables.flatMap(tableName => [
      {
        title: `${tableName.replace(/_/g, ' ')} (Match)`,
        field: `${tableName}_matching`,
        hozAlign: 'right',
        width: 100,
        headerFilter: 'number',
        headerFilterParams: {
          min: 0,
          step: 1
        },
        formatter: (cell) => {
          const value = cell.getValue();
          return value > 0 ? value.toLocaleString() : '0';
        },
        cellStyle: (cell) => {
          const value = cell.getValue();
          return value > 0 
            ? { backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4caf50' }
            : { backgroundColor: 'rgba(244, 67, 54, 0.2)', color: '#f44336' };
        }
      },
      {
        title: `${tableName.replace(/_/g, ' ')} (Missing)`,
        field: `${tableName}_missing`,
        hozAlign: 'right',
        width: 100,
        headerFilter: 'number',
        headerFilterParams: {
          min: 0,
          step: 1
        },
        formatter: (cell) => {
          const value = cell.getValue();
          return value > 0 ? value.toLocaleString() : '0';
        },
        cellStyle: (cell) => {
          const value = cell.getValue();
          return value > 0 
            ? { backgroundColor: 'rgba(244, 67, 54, 0.2)', color: '#f44336' }
            : { backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4caf50' };
        }
      }
    ]);

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
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          initialSort: [
            { column: 'departure_date', dir: 'desc' },
            { column: 'ship_code', dir: 'asc' }
          ],
          frozenRows: 0,
          frozenColumns: 3 // Ship Code, Departure Date, Sail Code
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

