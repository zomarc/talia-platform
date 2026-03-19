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

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';
import {
  createPerformanceFormatter,
  createDeltaFormatter,
  isEmpty,
  parseNumber
} from '../../../lib/dataTypes';
const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';

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

const GROUP_BY = [
  (rowData) => rowData?.accMonth || 'Unknown Month',
  (rowData) => rowData?.voyageCategory || 'Uncategorized',
];
const GROUP_MAX_DEPTH = GROUP_BY.length;

const GROUP_HEADERS = [
  (value, count) => `<span class="master-voyage-performance-summary-group master-voyage-performance-summary-group--month">${value} (${count})</span>`,
  (value, count) => `<span class="master-voyage-performance-summary-group master-voyage-performance-summary-group--category">${value} (${count})</span>`,
];

/**
 * Presentational component for Master Voyage Performance Summary
 */
const MasterVoyagePerformanceSummaryPresenter = ({ data, panelInstanceId, panelComponentId }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const pendingGroupActionRef = useRef(null);
  const didApplyInitialGroupOpenRef = useRef(false);
  const groupCycleDepthRef = useRef(1);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);

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
      formatter: (cell) => cell.getValue() || ''
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
      formatter: (cell) => cell.getValue() || ''
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

  const openFirstMonthOnly = useCallback(() => {
    const table = instanceRef.current;
    if (!table) return;
    const topGroups = table.getGroups?.() || [];
    if (!topGroups.length) return;
    topGroups.forEach((group, index) => {
      if (!group) return;
      if (index === 0) {
        group.show?.();
        const categoryGroups = group.getSubGroups?.() || [];
        categoryGroups.forEach((subGroup, subIndex) => {
          if (subGroup) {
            if (subIndex === 0) subGroup.show?.();
            else subGroup.hide?.();
          }
        });
      } else {
        group.hide?.();
      }
    });
  }, []);

  const applyGroupDepth = useCallback((depth) => {
    const table = instanceRef.current;
    const targetDepth = Math.max(0, Math.min(depth, GROUP_MAX_DEPTH));
    groupCycleDepthRef.current = targetDepth;
    if (!table) return targetDepth;
    if (!tableBuiltRef.current) {
      pendingGroupActionRef.current = `depth:${targetDepth}`;
      return targetDepth;
    }
    const groupStartOpen = Array.from({ length: GROUP_MAX_DEPTH }, (_unused, index) => index < targetDepth);
    table.setGroupStartOpen?.(groupStartOpen);
    table.setGroupBy?.(GROUP_BY);
    const currentRows = table.getData?.() || [];
    table.setData?.(currentRows);
    return targetDepth;
  }, []);

  const collapseAllGroups = useCallback(() => {
    applyGroupDepth(0);
  }, [applyGroupDepth]);

  const openAllGroups = useCallback(() => {
    applyGroupDepth(GROUP_MAX_DEPTH);
  }, [applyGroupDepth]);

  const cycleGroupState = useCallback(() => {
    const nextDepth = (groupCycleDepthRef.current + 1) % (GROUP_MAX_DEPTH + 1);
    return applyGroupDepth(nextDepth);
  }, [applyGroupDepth]);

  const getGroupCycleState = useCallback(() => ({
    depth: groupCycleDepthRef.current,
    maxDepth: GROUP_MAX_DEPTH,
  }), []);

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
          layout: "fitDataFill",
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
          pagination: false,
          groupBy: GROUP_BY,
          groupStartOpen: [true, false],
          groupHeader: GROUP_HEADERS,
          rowClick: (e, row) => {
            try { row?.select?.(); } catch { /* noop */ }
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
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

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          if (!didApplyInitialGroupOpenRef.current) {
            openFirstMonthOnly();
            didApplyInitialGroupOpenRef.current = true;
          }
          const pendingAction = pendingGroupActionRef.current;
          if (pendingAction === 'openAll') {
            pendingGroupActionRef.current = null;
            openAllGroups();
          } else if (pendingAction === 'collapseAll') {
            pendingGroupActionRef.current = null;
            collapseAllGroups();
          } else if (typeof pendingAction === 'string' && pendingAction.startsWith('depth:')) {
            pendingGroupActionRef.current = null;
            const depth = Number.parseInt(pendingAction.split(':')[1], 10);
            applyGroupDepth(Number.isNaN(depth) ? 0 : depth);
          }
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
      tableBuiltRef.current = false;
      pendingGroupActionRef.current = null;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[MasterVoyagePerformance] Error destroying table:', e);
        }
      }
    };
  }, [applyGroupDepth, collapseAllGroups, columns, data.length, openAllGroups, openFirstMonthOnly]); // Only initialize once when data is available

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
      if (!didApplyInitialGroupOpenRef.current) {
        openFirstMonthOnly();
        didApplyInitialGroupOpenRef.current = true;
      }
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[MasterVoyagePerformance] Error updating data:', e);
    }
  }, [data, openFirstMonthOnly, tableInitialized]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
    const componentKey = panelComponentId || 'master-voyage-performance-summary';
    const actions = {
      openAll: openAllGroups,
      collapseAll: collapseAllGroups,
      cycle: cycleGroupState,
      getCycleState: getGroupCycleState,
    };
    window.__taliaPanelGroupActions[componentKey] = actions;
    if (panelInstanceId) {
      window.__taliaPanelGroupActions[panelInstanceId] = actions;
    }

    return () => {
      if (!window.__taliaPanelGroupActions) return;
      delete window.__taliaPanelGroupActions[componentKey];
      if (panelInstanceId) {
        delete window.__taliaPanelGroupActions[panelInstanceId];
      }
    };
  }, [collapseAllGroups, cycleGroupState, getGroupCycleState, openAllGroups, panelComponentId, panelInstanceId]);

  useEffect(() => {
    const handleGroupAction = (event) => {
      const detail = event?.detail || {};
      const action = detail.action;
      const targetPanelInstance = detail.panelId;
      const targetPanelComponent = detail.panelComponent;
      const thisComponent = panelComponentId || 'master-voyage-performance-summary';
      const isTargeted =
        !targetPanelInstance && !targetPanelComponent
          ? true
          : targetPanelInstance === panelInstanceId || targetPanelComponent === thisComponent;
      if (!isTargeted) return;
      if (action === 'openAll') {
        openAllGroups();
      } else if (action === 'collapseAll') {
        collapseAllGroups();
      } else if (action === 'cycle') {
        cycleGroupState();
      }
    };
    window.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    document.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    return () => {
      window.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
      document.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    };
  }, [collapseAllGroups, cycleGroupState, openAllGroups, panelComponentId, panelInstanceId]);

  return (
    <div className="focus-panel master-voyage-performance-summary-panel">
      <div className="master-voyage-performance-summary-table-wrap">
        <div
          ref={tableRef}
          className="focus-panel__table master-voyage-performance-summary-table"
        />
      </div>
    </div>
  );
};

export default MasterVoyagePerformanceSummaryPresenter;
