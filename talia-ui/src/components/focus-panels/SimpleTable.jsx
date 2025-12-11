/**
 * Simple Table Component
 * Displays master_sail data with server-side filtering based on sail selection events
 * Uses useTableDataWithContext pattern (same as PublishedRates)
 */

import React, { useRef, useEffect, useState } from 'react';
import { initTabulator } from '../../lib/tabulatorConfig';
import { useTableDataWithContext } from '../../hooks/data/useTableDataWithContext';

const SimpleTable = ({ theme }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

  // Use reusable hook for context-based data fetching
  // Note: SimpleTable displays master_sail but doesn't filter by sail_code
  // It just listens to events to emit them when rows are selected
  const { data, loading, error } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null, // Don't filter - show all sail data
    contextMapper: () => null, // No filtering
    limit: 1000
  });

  // Initialize table once when data is ready
  useEffect(() => {
    if (loading || tableInitialized) return;

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
            field: "sail_id", 
            title: "Sail ID",
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? Math.floor(value).toString() : '';
            },
            headerFilter: "input"
          },
          { 
            field: "sail_code", 
            title: "Sail Code",
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            field: "ship_name", 
            title: "Ship",
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            field: "package_name", 
            title: "Package",
            headerFilter: "input"
          },
          { 
            field: "package_type", 
            title: "Package Type",
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            field: "geog_area_code", 
            title: "Geographic Area",
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            field: "sail_days", 
            title: "Sail Days",
            hozAlign: "center",
            headerFilter: "number",
            headerFilterParams: {
              min: 0,
              step: 1
            }
          },
          { 
            field: "sail_date_from", 
            title: "Sail Date",
            formatter: (cell) => {
              const date = new Date(cell.getValue());
              return date.toLocaleDateString();
            },
            headerFilter: "input"
          },
          { 
            field: "port_from", 
            title: "Port From",
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            field: "port_to", 
            title: "Port To",
            headerFilter: "list",
            headerFilterParams: {
              valuesLookup: true,
              autocomplete: true
            }
          },
          { 
            field: "is_active", 
            title: "Active",
            hozAlign: "center",
            headerFilter: "list",
            headerFilterParams: {
              values: {
                "": "All",
                "Y": "Yes",
                "N": "No"
              },
              clearable: true
            }
          }
        ];

        instanceRef.current = new Tabulator(tableRef.current, {
          data: data || [],
          columns: columns,
          layout: "fitData",
          initialSort: [
            { column: "sail_date_from", dir: "desc" }
          ],
          height: "100%",
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false,
          rowClick: (e, row) => {
            try { row?.select?.(); } catch {}
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
              console.log("[SimpleTable] Row selected:", rec);
              // Emit sail selection event
              window.dispatchEvent(new CustomEvent('talia:sail.select', { 
                detail: {
                  sail_code: rec.sail_code,
                  row_data: rec,
                  timestamp: new Date().toISOString()
                }
              }));
            } else {
              console.log("[SimpleTable] Row deselected");
              window.dispatchEvent(new CustomEvent('talia:sail.clear', {
                detail: {
                  timestamp: new Date().toISOString()
                }
              }));
            }
          },
        });

        console.log('[SimpleTable] Table initialized with', data?.length || 0, 'records');
        lastDataRef.current = data ? JSON.stringify(data) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[SimpleTable] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
    };
  }, [loading]); // Only initialize once when loading completes

  // Update table data when data changes - but only after initialization
  useEffect(() => {
    if (!tableInitialized || !instanceRef.current || loading) return;
    
    // Check if data actually changed (compare JSON strings)
    const currentDataStr = data ? JSON.stringify(data) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      console.log('[SimpleTable] Updating table data:', data?.length || 0, 'records');
      instanceRef.current.replaceData(data || []);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[SimpleTable] Error updating data:', e);
    }
  }, [data, tableInitialized, loading]); // Update when data changes

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading master sail data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Error loading data: {error.message}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No data available</p>
      </div>
    );
  }

  return <div ref={tableRef} style={{ width: "100%", height: "100%" }} />;
};

SimpleTable.displayName = 'SimpleTable';

export default SimpleTable;
