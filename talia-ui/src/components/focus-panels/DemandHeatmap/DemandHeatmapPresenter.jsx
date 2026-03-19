/**
 * Demand Heatmap Presenter Component
 * Displays viewing demand across itineraries by departure month as a heatmap
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

/**
 * Helper function to generate heatmap level based on value.
 * Returns a number from 0-5 for CSS class mapping.
 */
const getHeatmapLevel = (value, maxValue) => {
  if (!value || value === 0 || !maxValue || maxValue === 0) {
    return 0;
  }

  const intensity = Math.min(value / maxValue, 1);
  const scaled = Math.ceil(intensity * 5);
  return Math.min(5, Math.max(1, scaled));
};

/**
 * Presentational component for demand heatmap table
 */
const DemandHeatmapPresenter = ({ data, months, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const initializedRef = useRef(false);

  // Calculate max value for color scaling
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 1;
    
    let max = 0;
    data.forEach(row => {
      months.forEach(month => {
        const value = row[month];
        if (value && typeof value === 'number') {
          max = Math.max(max, value);
        }
      });
    });
    
    return max || 1;
  }, [data, months]);

  // Initialize Tabulator table
  useEffect(() => {
    if (!tableRef.current || !data || data.length === 0) return;
    if (initializedRef.current) return;

    const initializeTable = async () => {
      try {
        // Load Tabulator
        const TabGlobal = await initTabulator();
        if (!TabGlobal) {
          console.error('[DemandHeatmap] Failed to load Tabulator');
          return;
        }

        // Build column definitions
        const columns = [
          {
            title: 'Region',
            field: 'region',
            width: 120,
            frozen: true,
            headerFilter: 'input',
            headerFilterPlaceholder: 'Filter region...',
            cssClass: 'heatmap-region-column'
          },
          {
            title: 'Itinerary',
            field: 'itinerary',
            widthGrow: 2,
            frozen: true,
            headerFilter: 'input',
            headerFilterPlaceholder: 'Filter itinerary...',
            cssClass: 'heatmap-itinerary-column'
          },
          // Dynamic month columns
          ...months.map(month => {
            // Format month for display (e.g., "2025-12" -> "2025-12")
            const displayMonth = month;
            
            return {
              title: displayMonth,
              field: month,
              width: 100,
              hozAlign: 'center',
              headerFilter: 'input',
              headerFilterPlaceholder: 'Min value',
              headerFilterFunc: '>=',
              headerFilterParams: {
                type: 'number'
              },
              formatter: (cell) => {
                const value = cell.getValue();
                if (value === null || value === undefined) {
                  return '<span class="demand-heatmap__cell demand-heatmap__cell--empty">-</span>';
                }

                const level = getHeatmapLevel(value, maxValue);
                const strongClass = value && value > 0 ? ' demand-heatmap__cell--strong' : '';
                return `<span class="demand-heatmap__cell demand-heatmap__cell--level-${level}${strongClass}">${value.toLocaleString()}</span>`;
              }
            };
          })
        ];

        // Give layout one frame to settle
        await new Promise((r) => requestAnimationFrame(() => r()));

        // Create Tabulator instance
        instanceRef.current = new TabGlobal(tableRef.current, {
          data: data,
          columns: columns,
          layout: 'fitDataFill',
          reactiveData: false,
          height: '100%',
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
        });

        initializedRef.current = true;
        console.log('[DemandHeatmap] Tabulator initialized successfully');

        return () => {
          if (instanceRef.current) {
            try {
              instanceRef.current.destroy();
            } catch (e) {
              console.warn('[DemandHeatmap] Failed to destroy Tabulator instance:', e);
            }
            instanceRef.current = null;
          }
          initializedRef.current = false;
        };
      } catch (error) {
        console.error('[DemandHeatmap] Error initializing table:', error);
        // Error handling - don't retry automatically, let user retry or component remount
      }
    };

    initializeTable();

    // Cleanup
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[DemandHeatmap] Failed to destroy Tabulator on unmount:', e);
        }
        instanceRef.current = null;
      }
      initializedRef.current = false;
    };
  }, [data, months, maxValue]);

  // Update data when it changes
  useEffect(() => {
    if (instanceRef.current && data && initializedRef.current) {
      try {
        instanceRef.current.replaceData(data);
      } catch (error) {
        console.error('[DemandHeatmap] Error updating data:', error);
      }
    }
  }, [data]);

  return (
    <div className="demand-heatmap">
      {/* Header */}
      <div className="demand-heatmap__header">
        <h3 className="demand-heatmap__title">
          Viewing Demand Across Itineraries by Departure Month
        </h3>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="demand-heatmap__refresh"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="demand-heatmap__table">
        <div ref={tableRef} className="demand-heatmap__table-host" />
      </div>

      {/* Legend */}
      <div className="demand-heatmap__legend">
        <span>Legend:</span>
        <div className="demand-heatmap__legend-item">
          <div className="demand-heatmap__legend-swatch demand-heatmap__legend-swatch--low" />
          <span>Low</span>
        </div>
        <div className="demand-heatmap__legend-item">
          <div className="demand-heatmap__legend-swatch demand-heatmap__legend-swatch--high" />
          <span>High</span>
        </div>
        <div className="demand-heatmap__legend-note">
          Max value: {maxValue.toLocaleString()} {months.length > 0 ? 'views' : ''}
        </div>
      </div>
    </div>
  );
};

export default DemandHeatmapPresenter;
