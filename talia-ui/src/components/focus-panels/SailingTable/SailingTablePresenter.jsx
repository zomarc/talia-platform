/**
 * Sailing Table Presentational Component
 * Pure UI component - receives data as props
 * 
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes
 * - No custom sorting → Uses Tabulator initialSort
 * See CODING-STANDARDS.md for principles
 */

import React, { useRef, useEffect } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { apolloClient } from '../../../lib/apolloClient';
import { gql } from '@apollo/client';

const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences($input: UserPreferencesInput!) {
    updateUserPreferences(input: $input) {
      id
      preferences {
        selectedSailCode
      }
    }
  }
`;

/**
 * Presentational component for the sailing table
 */
const SailingTablePresenter = ({ data, theme, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  
  // Safely get user from auth context (may not be available in all contexts)
  let user = null;
  try {
    const authContext = useSupabaseAuth();
    user = authContext?.user || null;
  } catch (error) {
    // AuthContext not available, continue without user
    console.warn('[SailingTable] AuthContext not available:', error);
  }

  // Function to update user preferences with selected sail code
  const updateSelectedSail = async (sailCode) => {
    if (!user?.id) {
      console.log('[SailingTable] No user available, skipping preference save');
      return;
    }
    
    try {
      await apolloClient.mutate({
        mutation: UPDATE_USER_PREFERENCES,
        variables: {
          input: {
            selectedSailCode: sailCode || null
          }
        }
      });
      console.log('[SailingTable] Saved selected sail to user preferences:', sailCode);
    } catch (error) {
      console.error('[SailingTable] Error saving selected sail:', error);
    }
  };

  // Column definitions using Tabulator's native features
  // NOTE: Using valuesLookup:true lets Tabulator automatically generate filter options
  // NOTE: Using Tabulator's layout:"fitData" handles all column sizing automatically!
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
        valuesLookup: true,  // Automatically lookup unique values from this column
        autocomplete: true   // Enable autocomplete behavior
      }
    },
    { 
      field: "ship_name", 
      title: "Ship",
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,  // Automatically lookup unique values
        autocomplete: true   // Enable autocomplete behavior
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
        valuesLookup: true,  // Automatically lookup unique values
        autocomplete: true   // Enable autocomplete behavior
      }
    },
    { 
      field: "geog_area_code", 
      title: "Geographic Area",
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,  // Automatically lookup unique values
        autocomplete: true   // Enable autocomplete behavior
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
        autocomplete: true   // Enable autocomplete behavior
      }
    },
    { 
      field: "port_to", 
      title: "Port To",
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true   // Enable autocomplete behavior
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
          pagination: false
        });

        // Register event listeners using Tabulator's .on() method
        instanceRef.current.on("rowClick", (e, row) => {
          try { row?.select?.(); } catch {}
        });

        instanceRef.current.on("rowSelected", (row) => {
          const data = row.getData();
          console.log("[SailingTable] Row selected:", data);
          
          // Save to database
          updateSelectedSail(data.sail_code);
          
          // Emit selection event for other components with full row data
          window.dispatchEvent(new CustomEvent('talia:sail.select', { 
            detail: {
              sail_code: data.sail_code,
              row_data: data,
              timestamp: new Date().toISOString()
            }
          }));
        });

        instanceRef.current.on("rowDeselected", () => {
          console.log("[SailingTable] Row deselected");
          
          // Clear from database
          updateSelectedSail(null);
          
          // Emit clear event
          window.dispatchEvent(new CustomEvent('talia:sail.clear', {
            detail: {
              timestamp: new Date().toISOString()
            }
          }));
        });

        console.log('[SailingTable] Table initialized with event listeners');
      } catch (err) {
        console.error('[SailingTable] Error initializing table:', err);
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
  }, [data]);

  // Update table data when data prop changes
  useEffect(() => {
    if (instanceRef.current && data) {
      try {
        instanceRef.current.replaceData(data);
      } catch (e) {
        console.warn('[SailingTable] Error updating data:', e);
      }
    }
  }, [data]);

  const defaultTheme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b'
    }
  };

  const themeValues = theme || defaultTheme;

  return <div ref={tableRef} style={{ width: "100%", height: "100%" }} />;
};

export default SailingTablePresenter;

