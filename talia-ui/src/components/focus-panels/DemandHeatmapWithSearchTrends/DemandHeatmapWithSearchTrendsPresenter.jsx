/**
 * Demand Heatmap with Search Trends Presenter Component
 * Displays viewing demand across itineraries by departure month as a heatmap
 * Enhanced with search trends overlay/correlation
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';

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
 * Helper function to generate search trend indicator variant
 */
const getTrendVariant = (changePercent) => {
  if (!changePercent && changePercent !== 0) return 'neutral';
  if (changePercent > 0) return 'positive';
  if (changePercent < 0) return 'negative';
  return 'neutral';
};

/**
 * Presentational component for combined demand heatmap and search trends
 */
const DemandHeatmapWithSearchTrendsPresenter = ({ 
  heatmapData, 
  months, 
  searchTrends, 
  combinedData,
  containsMockData,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const initializedRef = useRef(false);
  const [showTrends, setShowTrends] = useState(true);

  // Calculate max value for color scaling
  const maxValue = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) return 1;
    
    let max = 0;
    heatmapData.forEach(row => {
      months.forEach(month => {
        const value = row[month];
        if (value && typeof value === 'number') {
          max = Math.max(max, value);
        }
      });
    });
    
    return max || 1;
  }, [heatmapData, months]);

  // Initialize Tabulator table
  useEffect(() => {
    if (!tableRef.current || !heatmapData || heatmapData.length === 0) return;
    if (initializedRef.current) return;

    const initializeTable = async () => {
      try {
        // Load Tabulator
        const TabGlobal = await initTabulator();
        if (!TabGlobal) {
          console.error('[DemandHeatmapWithSearchTrends] Failed to load Tabulator');
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
          // Dynamic month columns with optional search trends overlay
          ...months.map(month => {
            const displayMonth = month;
            const hasTrend = combinedData && combinedData.some(row => row[`${month}_searchTrends`]);
            const titleContent = showTrends
              ? `<div class="demand-heatmap__month-header">
                  <span>${displayMonth}</span>
                  ${hasTrend ? '<span class="demand-heatmap__month-trend">📈 Trends</span>' : ''}
                </div>`
              : displayMonth;

            return {
              title: titleContent,
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
                const row = cell.getRow().getData();
                const trendData = row[`${month}_searchTrends`];
                
                if (value === null || value === undefined) {
                  return '<span class="demand-heatmap__cell demand-heatmap__cell--empty">-</span>';
                }

                const level = getHeatmapLevel(value, maxValue);
                const strongClass = value && value > 0 ? ' demand-heatmap__cell--strong' : '';
                
                // Build cell content
                let cellContent = `<span class="demand-heatmap__cell demand-heatmap__cell--level-${level}${strongClass}">${value.toLocaleString()}</span>`;
                
                // Add search trends indicator if available
                if (showTrends && trendData) {
                  const trendVariant = getTrendVariant(trendData.data[0]?.changePercent);
                  cellContent += `<div class="demand-heatmap__trend demand-heatmap__trend--${trendVariant}">📊 ${Math.round(trendData.average).toLocaleString()}</div>`;
                }
                
                return cellContent;
              }
            };
          })
        ];

        // Give layout one frame to settle
        await new Promise((r) => requestAnimationFrame(() => r()));

        // Create Tabulator instance
        instanceRef.current = new TabGlobal(tableRef.current, getTabulatorOptions({
          data: combinedData || heatmapData,
          columns: columns,
          reactiveData: false,
          height: '100%',
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
        }));

        initializedRef.current = true;
        console.log('[DemandHeatmapWithSearchTrends] Tabulator initialized successfully');

        return () => {
          if (instanceRef.current) {
            try {
              instanceRef.current.destroy();
            } catch (e) {
              console.warn('[DemandHeatmapWithSearchTrends] Failed to destroy Tabulator instance:', e);
            }
            instanceRef.current = null;
          }
          initializedRef.current = false;
        };
      } catch (error) {
        console.error('[DemandHeatmapWithSearchTrends] Error initializing table:', error);
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
          console.warn('[DemandHeatmapWithSearchTrends] Failed to destroy Tabulator on unmount:', e);
        }
        instanceRef.current = null;
      }
      initializedRef.current = false;
    };
  }, [combinedData, heatmapData, months, maxValue, showTrends]);

  // Update data when it changes
  useEffect(() => {
    if (instanceRef.current && (combinedData || heatmapData) && initializedRef.current) {
      try {
        instanceRef.current.replaceData(combinedData || heatmapData);
      } catch (error) {
        console.error('[DemandHeatmapWithSearchTrends] Error updating data:', error);
      }
    }
  }, [combinedData, heatmapData]);

  return (
    <div className="demand-heatmap talia-report">
      {/* Header */}
      <div className="demand-heatmap__header talia-report__header">
        <div>
          <h3 className="demand-heatmap__title talia-report__title">
            Demand Heatmap with Search Trends Correlation
          </h3>
          <p className="demand-heatmap__subtitle talia-report__subtitle">
            Viewing demand across itineraries by departure month, enhanced with search trend indicators
          </p>
        </div>
        
        <div className="demand-heatmap__controls talia-report__actions talia-report-filters">
          <button
            onClick={() => setShowTrends(!showTrends)}
            className="demand-heatmap__toggle"
            data-active={showTrends ? 'true' : 'false'}
          >
            {showTrends ? '📊 Hide Trends' : '📊 Show Trends'}
          </button>
        </div>
      </div>

      {/* Search Trends Summary */}
      {showTrends && searchTrends && searchTrends.series && searchTrends.series.length > 0 && (
        <div className="demand-heatmap__trends-summary">
          <div className="demand-heatmap__trends-title">
            📈 Active Search Trends ({searchTrends.series.length} queries)
          </div>
          <div className="demand-heatmap__trends-list">
            {searchTrends.series.map((series, idx) => (
              <span key={idx} className="demand-heatmap__trend-chip">
                "{series.query}": {series.latestCount.toLocaleString()} results
                {series.changePercent !== 0 && (
                  <span
                    className={`demand-heatmap__trend-change demand-heatmap__trend-change--${series.changePercent > 0 ? 'positive' : 'negative'}`}
                  >
                    ({series.changePercent > 0 ? '+' : ''}{series.changePercent.toFixed(1)}%)
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="demand-heatmap__table">
        <div ref={tableRef} className="demand-heatmap__table-host" />
      </div>

      {/* Legend */}
      <div className="demand-heatmap__legend">
        <span>Legend:</span>
        <div className="demand-heatmap__legend-item">
          <div className="demand-heatmap__legend-swatch demand-heatmap__legend-swatch--low" />
          <span>Low Demand</span>
        </div>
        <div className="demand-heatmap__legend-item">
          <div className="demand-heatmap__legend-swatch demand-heatmap__legend-swatch--high" />
          <span>High Demand</span>
        </div>
        {showTrends && (
          <>
            <div className="demand-heatmap__legend-divider" />
            <div className="demand-heatmap__legend-item">
              <span>📊</span>
              <span>Search Trends (avg results/month)</span>
            </div>
          </>
        )}
        <div className="demand-heatmap__legend-note">
          Max demand: {maxValue.toLocaleString()} {containsMockData && '(includes mock data)'}
        </div>
      </div>
    </div>
  );
};

export default DemandHeatmapWithSearchTrendsPresenter;

