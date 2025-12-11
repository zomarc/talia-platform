/**
 * Sailing by Cabin Category Component
 * 
 * Displays cabin occupancy data from sail_by_cabin_occupancy table.
 * Filters server-side based on sail selection events from the business event bus.
 * 
 * Event Bus Contract:
 * - Publishes: None (this component doesn't emit events)
 * - Responds to: talia:sail.select event with { sail_code: string, row_data: object, timestamp: string }
 * 
 * GraphQL Query:
 * - Query: tableData with filters: { sail_code: string } (server-side filtering)
 * 
 * Filtering:
 * - Server-side (Tier 1): Applied via GraphQL query filters based on event bus context (sail_code)
 * - Client-side (Tier 2): Tabulator header filters applied locally, persist across context changes
 */

import React, { useRef, useEffect, useState } from 'react';
import { initTabulator } from '../../lib/tabulatorConfig';
import { useTableDataWithContext } from '../../hooks/data/useTableDataWithContext';
import queryTracker from '../../services/data/queryTracker';

const SailingByCabinCategory = ({ theme }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

  // Use reusable hook for context-based data fetching
  const { data, loading, error, context } = useTableDataWithContext({
    tableName: 'sail_by_cabin_occupancy',
    eventName: 'talia:sail.select',
    contextMapper: (detail) => {
      // Extract sail_code from event detail (supports multiple formats)
      const sailCode = detail?.sail_code || detail?.Sail_Code || (typeof detail === 'string' ? detail : null);
      return sailCode ? { sail_code: sailCode } : null;
    },
    limit: 1000
  });

  // Track queries for InformationPanel
  useEffect(() => {
    if (data && data.length > 0 && !loading) {
      const query = `
        query GetTableData($tableName: String!, $limit: Int, $filters: TableDataFilters) {
          tableData(tableName: $tableName, limit: $limit, filters: $filters)
        }
      `;
      const filters = context ? { sail_code: context.sail_code || context.row_data?.sail_code || (typeof context === 'string' ? context : null) } : {};
      const trackQuery = queryTracker.trackQuery({
        query,
        variables: { tableName: 'sail_by_cabin_occupancy', limit: 1000, filters },
        component: 'SailingByCabinCategory',
        purpose: 'Fetch cabin occupancy data'
      });
      trackQuery({ data });
    }
  }, [data, context, loading]);

  // Initialize table once when component mounts (before data arrives)
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

        console.log('[SailingByCabinCategory] Initializing table...');
        instanceRef.current = new Tabulator(tableRef.current, {
          data: [], // Start with empty data
          columns: [
            { title: "Sail ID", field: "sail_id", width: 100, headerFilter: "input" },
            { title: "Sail Code", field: "sail_code", width: 120, headerFilter: "input" },
            { title: "Ship", field: "ship_name", width: 150, headerFilter: "input" },
            { title: "Package", field: "package_name", widthGrow: 2, headerFilter: "input" },
            { title: "Cabin Category", field: "cabin_category", width: 120, headerFilter: "input" },
            { title: "Total Cabins", field: "total_cabins", hozAlign: "right", width: 100, headerFilter: "input" },
            { title: "Occupied", field: "occupied_cabins", hozAlign: "right", width: 100, headerFilter: "input" },
            { title: "Remaining", field: "remaining_cabins", hozAlign: "right", width: 100, headerFilter: "input" }
          ],
          layout: "fitColumns",
          height: "100%",
          selectableRows: 1,
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200]
        });

        console.log('[SailingByCabinCategory] Table initialized');
        setTableInitialized(true);
      } catch (err) {
        console.error('[SailingByCabinCategory] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
    };
  }, []); // Initialize once on mount

  // Update table data when data changes (from context updates) - but only after initialization
  useEffect(() => {
    console.log('[SailingByCabinCategory] Data update effect triggered', {
      tableInitialized,
      hasInstance: !!instanceRef.current,
      loading,
      dataLength: data?.length || 0,
      context: context ? (context.sail_code || context.row_data?.sail_code || 'has context') : null
    });

    if (!tableInitialized || !instanceRef.current) {
      console.log('[SailingByCabinCategory] ⏳ Waiting for table initialization');
      return;
    }
    
    // Don't update while loading (wait for data to be ready)
    if (loading) {
      console.log('[SailingByCabinCategory] ⏳ Still loading, waiting...');
      return;
    }
    
    // Check if data actually changed (compare JSON strings)
    const currentDataStr = data ? JSON.stringify(data) : null;
    if (lastDataRef.current === currentDataStr) {
      console.log('[SailingByCabinCategory] ⏭️ Data unchanged, skipping update');
      return;
    }

    try {
      console.log('[SailingByCabinCategory] ✅ Updating table with', data?.length || 0, 'records');
      instanceRef.current.replaceData(data || []);
      lastDataRef.current = currentDataStr;
      console.log('[SailingByCabinCategory] ✅ Table updated successfully');
    } catch (e) {
      console.error('[SailingByCabinCategory] ❌ Error updating data:', e);
    }
  }, [data, tableInitialized, loading, context]); // Update when data changes

  // Store component state for debug panel (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window._componentDebugState = window._componentDebugState || {};
      window._componentDebugState.SailingByCabinCategory = {
        loading,
        error: error ? error.message : null,
        dataLength: data?.length || 0,
        tableInitialized,
        hasInstance: !!instanceRef.current,
        context: context ? (context.sail_code || context.row_data?.sail_code || 'has context') : null,
        lastUpdate: new Date().toISOString()
      };
    }
  }, [loading, error, data, tableInitialized, instanceRef.current, context]);

  // Always render the table div - don't return early
  // The table will show empty state if no data, but we need the div to exist for updates
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {loading && (
        <div style={{ 
          position: "absolute", 
          top: "50%", 
          left: "50%", 
          transform: "translate(-50%, -50%)",
          padding: '40px', 
          textAlign: 'center',
          zIndex: 10,
          background: theme?.colors?.cardBackground || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333333'}`
        }}>
          Loading cabin occupancy data...
        </div>
      )}
      {error && (
        <div style={{ 
          position: "absolute", 
          top: "50%", 
          left: "50%", 
          transform: "translate(-50%, -50%)",
          padding: '40px', 
          textAlign: 'center',
          zIndex: 10,
          background: theme?.colors?.cardBackground || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.error || '#f44336'}`
        }}>
          <p>Error loading data: {error.message}</p>
        </div>
      )}
      {!loading && !error && (!data || data.length === 0) && (
        <div style={{ 
          position: "absolute", 
          top: "50%", 
          left: "50%", 
          transform: "translate(-50%, -50%)",
          padding: '40px', 
          textAlign: 'center',
          zIndex: 10,
          background: theme?.colors?.cardBackground || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333333'}`
        }}>
          <p>No data available{context ? ` for selected sail` : '. Select a sail to view cabin occupancy data.'}</p>
        </div>
      )}
      <div ref={tableRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default SailingByCabinCategory;
