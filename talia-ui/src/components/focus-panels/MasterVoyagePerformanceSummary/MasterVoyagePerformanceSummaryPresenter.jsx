/**
 * Master Voyage Performance Summary Presentational Component
 * Pure UI component - receives data as props
 * 
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes
 * - No custom sorting → Uses Tabulator initialSort
 * - Conditional formatting via shared formatters from dataTypes library
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';
import {
  createPerformanceFormatter,
  createDeltaFormatter,
  createRowFormatter,
  isEmpty,
  parseNumber
} from '../../../lib/dataTypes';

/**
 * Helper function to format currency (uses shared parseNumber)
 */
const formatCurrency = (value) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

/**
 * Helper function to format percentage
 */
const formatPercentage = (value) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return `${num.toFixed(2)}%`;
};

/**
 * Helper function to format number
 */
const formatNumber = (value) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return new Intl.NumberFormat('en-US').format(num);
};

// Use shared formatters from dataTypes library
const performanceFormatter = (cell, threshold = 100) => {
  return createPerformanceFormatter(threshold)(cell);
};

const deltaFormatter = createDeltaFormatter();

const rowFormatter = createRowFormatter();

/**
 * Presentational component for Master Voyage Performance Summary
 */
const MasterVoyagePerformanceSummaryPresenter = ({ data, theme, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

  // Extract unique values for filters
  const filterValues = useMemo(() => {
    if (!data || data.length === 0) return {};
    
    return {
      ships: [...new Set(data.map(d => d.ship).filter(Boolean))].sort(),
      voyages: [...new Set(data.map(d => d.voyageCode).filter(Boolean))].sort(),
      itineraries: [...new Set(data.map(d => d.itinerary).filter(Boolean))].sort(),
      months: [...new Set(data.map(d => d.accMonth).filter(Boolean))].sort()
    };
  }, [data]);

  // Define all columns with Tabulator's native features
  const columns = useMemo(() => [
    // Core identification columns
    { 
      field: "accMonth", 
      title: "AccMonth",
      width: 100,
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true
      },
      formatter: (cell) => {
        const value = cell.getValue();
        const rowData = cell.getRow().getData();
        if (rowData.rowType === 'month' || rowData.rowType === 'total') {
          cell.getElement().style.fontWeight = 'bold';
        }
        return value || '';
      }
    },
    { 
      field: "voyageCode", 
      title: "Voyage Code",
      width: 150,
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true
      },
      formatter: (cell) => {
        const rowData = cell.getRow().getData();
        if (rowData.rowType === 'month' || rowData.rowType === 'total') {
          cell.getElement().style.fontWeight = 'bold';
        } else if (rowData.rowType === 'category') {
          cell.getElement().style.fontStyle = 'italic';
        }
        return cell.getValue() || '';
      }
    },
    { 
      field: "ship", 
      title: "Ship",
      width: 150,
      headerFilter: "list",
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true
      }
    },
    
    // Occupancy - Passenger Nights (grouped)
    {
      title: "Occupancy - Passenger Nights",
      columns: [
        { 
          field: "paxNightsBookedOccupancy", 
          title: "Pax Nights Booked Occupancy",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? formatPercentage(value) : '';
          }
        },
        { 
          field: "targetOccupancy", 
          title: "Target Occupancy",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? formatPercentage(value) : '';
          }
        },
        { 
          field: "paxNightsReservedOccupancy", 
          title: "Pax Nights Reserved Occupancy",
          width: 150,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? formatPercentage(value) : '';
          }
        },
        { 
          field: "paxNightsBudgetedOccupancy", 
          title: "Pax Nights Budgeted Occupancy",
          width: 150,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? formatPercentage(value) : '';
          }
        }
      ]
    },
    
    // Availability (grouped)
    {
      title: "Availability",
      columns: [
        { 
          field: "availableCabinsInside", 
          title: "Available Cabins Inside",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "availabilityPercentInside", 
          title: "% Availability",
          width: 100,
          hozAlign: "right",
          formatter: (cell) => performanceFormatter(cell, 20)
        },
        { 
          field: "availableCabinsOutside", 
          title: "Available Cabins Outside",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "availabilityPercentOutside", 
          title: "% Availability",
          width: 100,
          hozAlign: "right",
          formatter: (cell) => performanceFormatter(cell, 20)
        },
        { 
          field: "availableCabinsDeluxe", 
          title: "Available Cabins Deluxe",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "availabilityPercentDeluxe", 
          title: "% Availability",
          width: 100,
          hozAlign: "right",
          formatter: (cell) => performanceFormatter(cell, 20)
        },
        { 
          field: "availableCabinsSuites", 
          title: "Available Cabins Suites",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "availabilityPercentSuites", 
          title: "% Availability",
          width: 100,
          hozAlign: "right",
          formatter: (cell) => performanceFormatter(cell, 20)
        }
      ]
    },
    
    // Pricing (grouped)
    {
      title: "Pricing",
      columns: [
        { 
          field: "minFarePPInside", 
          title: "Min Fare PP Inside",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "minFarePPOutside", 
          title: "Min Fare PP Outside",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "minFarePPDeluxe", 
          title: "Min Fare PP Deluxe",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "maxFarePPInside", 
          title: "Max Fare PP Inside",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "maxFarePPOutside", 
          title: "Max Fare PP Outside",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "maxFarePPDeluxe", 
          title: "Max Fare PP Deluxe",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "ytdBookedPax", 
          title: "YTD Booked Pax",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        }
      ]
    },
    
    // Performance vs Budget (grouped)
    {
      title: "Performance vs Budget",
      columns: [
        { 
          field: "ytdBookedRevEUR", 
          title: "YTD Booked Rev EUR",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "vsTargetPercentYTDBookedRevEUR", 
          title: "vs T % YTD Booked Rev EUR",
          width: 160,
          hozAlign: "right",
          formatter: (cell) => deltaFormatter(cell)
        },
        { 
          field: "ytdBookedPaxPerformance", 
          title: "YTD Booked Pax",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "vsTargetPercentYTDBookedPax", 
          title: "vs T % YTD Booked Pax",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => deltaFormatter(cell)
        },
        { 
          field: "ytdBookedPPP", 
          title: "YTD Booked PPP",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "vsTargetPercentYTDBookedPPP", 
          title: "vs T % YTD Booked PPP",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => deltaFormatter(cell)
        },
        { 
          field: "ytdBookedPPPEUR", 
          title: "YTD Booked PPP EUR",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "vsTargetPercentYTDBookedPPPEUR", 
          title: "vs T % YTD Booked PPP EUR",
          width: 160,
          hozAlign: "right",
          formatter: (cell) => deltaFormatter(cell)
        },
        { 
          field: "ytdBudgetYTDBookedPPP", 
          title: "YTD Budget YTD Booked PPP",
          width: 170,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "ytdBudgetYTDBookedPPPEUR", 
          title: "YTD Budget YTD Booked PPP EUR",
          width: 190,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "budgetVsForecastDelta", 
          title: "Budget vs Forecast (Delta)",
          width: 160,
          hozAlign: "right",
          formatter: (cell) => deltaFormatter(cell)
        },
        { 
          field: "budgetVsForecastDeltaEUR", 
          title: "Budget vs Forecast (Delta) EUR",
          width: 180,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        }
      ]
    },
    
    // Recent Performance (grouped)
    {
      title: "Recent Performance",
      columns: [
        { 
          field: "lwBookedRevEUR", 
          title: "LW Booked Rev EUR",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "lwBookedGroupRevEUR", 
          title: "LW Booked Group Rev EUR",
          width: 170,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "lwBookedFITRevEUR", 
          title: "LW Booked FIT Rev EUR",
          width: 160,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "lwBookedGroupPaxTotal", 
          title: "LW Booked Group Pax - Total",
          width: 170,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "lwBookedFITPaxTotal", 
          title: "LW Booked FIT Pax - Total",
          width: 160,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "lwBookedGroupROS", 
          title: "LW Booked Group ROS",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? parseFloat(value).toFixed(1) : '';
          }
        },
        { 
          field: "lwBookedFITROS", 
          title: "LW Booked FIT ROS",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? parseFloat(value).toFixed(1) : '';
          }
        },
        { 
          field: "lwBookedPaxTotal", 
          title: "LW Booked Pax - Total",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "lwBookedRosTotal", 
          title: "LW Booked Ros - Total",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? parseFloat(value).toFixed(1) : '';
          }
        },
        { 
          field: "lwAvgGroupROS", 
          title: "LW Avg Group ROS",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? parseFloat(value).toFixed(1) : '';
          }
        },
        { 
          field: "lwAvgFITROS", 
          title: "LW Avg FIT ROS",
          width: 130,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? parseFloat(value).toFixed(1) : '';
          }
        },
        { 
          field: "lwAvgCombinedROS", 
          title: "LW Avg Combined ROS",
          width: 150,
          hozAlign: "right",
          formatter: (cell) => {
            const value = cell.getValue();
            return value != null ? parseFloat(value).toFixed(1) : '';
          }
        },
        { 
          field: "groupsLessThan10", 
          title: "Groups <10",
          width: 100,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "groupsGreaterThanEqual10", 
          title: "Groups >=10",
          width: 110,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "groupsReleased", 
          title: "Groups Released",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        }
      ]
    },
    
    // Released Space in Last Week (grouped)
    {
      title: "Released Space in Last Week",
      columns: [
        { 
          field: "releasedBookedOFGreaterCX", 
          title: "Released Booked OF > CX",
          width: 170,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "groupsBKGreaterCX", 
          title: "Groups BK > CX",
          width: 120,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "fitOFGreaterCX", 
          title: "FIT OF > CX",
          width: 110,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "fitBKGreaterCX", 
          title: "FIT BK > CX",
          width: 110,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        }
      ]
    },
    
    // T&Cs (grouped)
    {
      title: "T&Cs",
      columns: [
        { 
          field: "outstandingNoGroups", 
          title: "Outstanding No. Groups",
          width: 160,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "outstandingBookedPax", 
          title: "Outstanding Booked Pax",
          width: 160,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "outstandingGroupReservedPax", 
          title: "Outstanding Group Reserved Pax",
          width: 200,
          hozAlign: "right",
          formatter: (cell) => formatNumber(cell.getValue())
        },
        { 
          field: "outstandingGroupAmountEUR", 
          title: "Outstanding Group Amount EUR",
          width: 200,
          hozAlign: "right",
          formatter: (cell) => formatCurrency(cell.getValue())
        },
        { 
          field: "outstandingGroupAmountPercentOfDue", 
          title: "Outstanding Group Amount as % of Due",
          width: 230,
          hozAlign: "right",
          formatter: (cell) => formatPercentage(cell.getValue())
        }
      ]
    }
  ], []);

  // Initialize Tabulator table
  useEffect(() => {
    if (!data || data.length === 0 || tableInitialized) return;

    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;

      try {
        // Load Tabulator resources using shared config
        const Tabulator = await initTabulator();

        if (cancelled || !tableRef.current) return;

        // Create Tabulator instance
        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, {
          data: data,
          columns: columns,
          layout: "fitColumns",
          initialSort: [
            { column: "accMonth", dir: "asc" },
            { column: "voyageCode", dir: "asc" }
          ],
          height: "100%",
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          rowFormatter: rowFormatter,
          rowClick: (e, row) => {
            try { row?.select?.(); } catch {}
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData && selectedData[0];
            if (rec && rec.rowType === 'voyage') {
              console.log("[MasterVoyagePerformance] Row selected:", rec);
              window.dispatchEvent(new CustomEvent('talia:mastervoyage.select', { 
                detail: {
                  voyage_code: rec.voyageCode,
                  row_data: rec,
                  timestamp: new Date().toISOString()
                }
              }));
            }
          },
        });

        console.log('[MasterVoyagePerformance] Table initialized with', data.length, 'records');
        lastDataRef.current = data ? JSON.stringify(data) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[MasterVoyagePerformance] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[MasterVoyagePerformance] Error destroying table:', e);
        }
      }
    };
  }, [data.length]); // Only initialize once when data is available

  // Update table data when data changes
  useEffect(() => {
    if (!tableInitialized || !instanceRef.current || !data) return;
    
    const currentDataStr = data ? JSON.stringify(data) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      console.log('[MasterVoyagePerformance] Updating table data:', data.length, 'records');
      instanceRef.current.replaceData(data);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[MasterVoyagePerformance] Error updating data:', e);
    }
  }, [data, tableInitialized]);

  const defaultTheme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b'
    }
  };

  const themeValues = theme || defaultTheme;

  // Get current date for footer
  const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div style={{
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      background: themeValues.colors.background,
      color: themeValues.colors.foreground
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${themeValues.colors.border || '#e0e0e0'}`,
        background: themeValues.colors.glass || themeValues.colors.background
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 'bold',
              color: themeValues.colors.foreground
            }}>
              Master Voyage Performance Summary
            </h1>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '12px',
              color: themeValues.colors.textSecondary || '#666'
            }}>
              YTD performance on Occupancy YTD, Target and Budget, Cabins Availability, Fares per person, Outstanding group payments, and Last Week Performance by Passenger Type, and FIT ROS for Last 4 Weeks.
            </p>
          </div>
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
                fontWeight: '500'
              }}
            >
              ↻ Refresh
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        padding: '8px'
      }}>
        <div 
          ref={tableRef} 
          style={{ 
            height: "100%", 
            width: "100%"
          }} 
        />
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: `1px solid ${themeValues.colors.border || '#e0e0e0'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: themeValues.colors.textSecondary || '#666',
        background: themeValues.colors.glass || themeValues.colors.background
      }}>
        <div>Data updated Weekly</div>
        <div>Data to: {currentDate}</div>
      </div>
    </div>
  );
};

export default MasterVoyagePerformanceSummaryPresenter;
