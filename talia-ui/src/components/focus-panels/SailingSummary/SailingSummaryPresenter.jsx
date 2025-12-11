/**
 * Sailing Summary Presenter Component
 * Aggregates cabin occupancy data at the sail level and displays in Tabulator table
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

// Event system for selection
const SAIL_SELECT_EVENT = 'talia:sail.select';
const SAIL_CLEAR_EVENT = 'talia:sail.clear';

// Function to aggregate sailing data at sail level
const aggregateSailingData = (rawData) => {
  const sailMap = new Map();

  rawData.forEach(record => {
    const key = `${record.sail_code}_${record.ship_code}_${record.package_type}_${record.port_code || ''}`;
    
    if (!sailMap.has(key)) {
      sailMap.set(key, {
        sail_code: record.sail_code,
        ship_name: record.ship_name,
        package_type: record.package_type,
        package_name: record.package_name,
        sail_date_from: record.sail_date_from,
        port_code: record.port_code || '',
        sail_days: record.sail_days,
        geog_area_code: record.geog_area_code,
        total_cabin_capacity: 0,
        total_cabins: 0,
        total_occupied_cabins: 0,
        total_remaining_cabins: 0,
        occupancy_percentage: 0
      });
    }

    const sail = sailMap.get(key);
    // Aggregate cabin capacity (capacity * total_cabins for each cabin category)
    sail.total_cabin_capacity += (record.cabin_capacity || 0) * (record.total_cabins || 0);
    sail.total_cabins += record.total_cabins || 0;
    sail.total_occupied_cabins += record.occupied_cabins || 0;
    sail.total_remaining_cabins += record.remaining_cabins || 0;
  });

  // Calculate occupancy percentage for each sail
  const aggregatedData = Array.from(sailMap.values()).map(sail => ({
    ...sail,
    occupancy_percentage: sail.total_cabins > 0 ? 
      Math.round((sail.total_occupied_cabins / sail.total_cabins) * 100) : 0
  }));

  return aggregatedData;
};

const SailingSummaryPresenter = ({ data, theme, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

  // Aggregate data at sail level
  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return aggregateSailingData(data);
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

        const columns = [
          { 
            title: "Sail Code", 
            field: "sail_code", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter sail code..."
          },
          { 
            title: "Ship", 
            field: "ship_name", 
            width: 150,
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            title: "Package Type", 
            field: "package_type", 
            width: 120,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter type..."
          },
          { 
            title: "Package", 
            field: "package_name", 
            widthGrow: 2,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter package..."
          },
          { 
            title: "Sail Date", 
            field: "sail_date_from", 
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
            title: "Port", 
            field: "port_code", 
            width: 80,
            headerFilter: "input",
            headerFilterPlaceholder: "Filter port..."
          },
          { 
            title: "Days", 
            field: "sail_days", 
            hozAlign: "center", 
            width: 80,
            headerFilter: "number",
            headerFilterParams: {
              min: 0,
              step: 1
            }
          },
          { 
            title: "Geographic Area", 
            field: "geog_area_code", 
            width: 120,
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            title: "Total Capacity", 
            field: "total_cabin_capacity", 
            hozAlign: "right", 
            width: 120,
            headerFilter: "number",
            headerFilterParams: {
              min: 0,
              step: 1
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? value.toLocaleString() : '0';
            }
          },
          { 
            title: "Total Cabins", 
            field: "total_cabins", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "number",
            headerFilterParams: {
              min: 0,
              step: 1
            }
          },
          { 
            title: "Occupied", 
            field: "total_occupied_cabins", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "number",
            headerFilterParams: {
              min: 0,
              step: 1
            }
          },
          { 
            title: "Remaining", 
            field: "total_remaining_cabins", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "number",
            headerFilterParams: {
              min: 0,
              step: 1
            }
          },
          { 
            title: "Occupancy %", 
            field: "occupancy_percentage", 
            hozAlign: "right", 
            width: 100,
            headerFilter: "number",
            headerFilterParams: {
              min: 0,
              max: 100,
              step: 1
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return `${value}%`;
            }
          }
        ];

        instanceRef.current = new Tabulator(tableRef.current, {
          data: aggregatedData,
          columns,
          layout: "fitColumns",
          height: "100%",
          selectableRows: 1,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          initialSort: [
            { column: "sail_date_from", dir: "desc" }
          ],
          rowClick: (e, row) => {
            try { row?.select?.(); } catch {}
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
              console.log("[SailingSummary] Row selected:", rec);
              window.dispatchEvent(new CustomEvent(SAIL_SELECT_EVENT, { 
                detail: {
                  sail_code: rec.sail_code,
                  row_data: rec,
                  timestamp: new Date().toISOString()
                }
              }));
            } else {
              console.log("[SailingSummary] Row deselected");
              window.dispatchEvent(new CustomEvent(SAIL_CLEAR_EVENT, {
                detail: {
                  timestamp: new Date().toISOString()
                }
              }));
            }
          },
        });

        console.log('[SailingSummary] Table initialized with', aggregatedData.length, 'aggregated records');
        lastDataRef.current = aggregatedData ? JSON.stringify(aggregatedData) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[SailingSummary] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[SailingSummary] Error destroying table:', e);
        }
      }
    };
  }, []); // Initialize once on mount

  // Update table data when aggregated data changes
  useEffect(() => {
    if (!tableInitialized || !instanceRef.current) return;
    
    // Check if data actually changed
    const currentDataStr = aggregatedData ? JSON.stringify(aggregatedData) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      console.log('[SailingSummary] Updating table data:', aggregatedData.length, 'records');
      instanceRef.current.replaceData(aggregatedData);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[SailingSummary] Error updating data:', e);
    }
  }, [aggregatedData, tableInitialized]);

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

export default SailingSummaryPresenter;

