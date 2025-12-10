/**
 * Demand Heatmap with Search Trends Presenter Component
 * Displays viewing demand across itineraries by departure month as a heatmap
 * Enhanced with search trends overlay/correlation
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';

/**
 * Helper function to generate heatmap color based on value
 * Returns a shade of red - darker for higher values
 */
const getHeatmapColor = (value, maxValue) => {
  if (!value || value === 0 || !maxValue || maxValue === 0) {
    return { bg: '#ffffff', text: '#666666' };
  }

  const intensity = Math.min(value / maxValue, 1); // Normalize to 0-1
  const alpha = 0.3 + (intensity * 0.7); // Range from 0.3 to 1.0
  
  // Red gradient: light red for low values, dark red for high values
  const red = 220 - (intensity * 100); // 220 to 120
  const green = 53 - (intensity * 53); // 53 to 0
  const blue = 69 - (intensity * 69); // 69 to 0

  return {
    bg: `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${alpha.toFixed(2)})`,
    text: intensity > 0.5 ? '#ffffff' : '#000000'
  };
};

/**
 * Helper function to generate search trend indicator color
 */
const getTrendColor = (changePercent) => {
  if (!changePercent && changePercent !== 0) return { bg: '#e0e0e0', text: '#666' };
  if (changePercent > 0) return { bg: 'rgba(76, 175, 80, 0.2)', text: '#4caf50' };
  if (changePercent < 0) return { bg: 'rgba(244, 67, 54, 0.2)', text: '#f44336' };
  return { bg: 'rgba(158, 158, 158, 0.2)', text: '#9e9e9e' };
};

/**
 * Presentational component for combined demand heatmap and search trends
 */
const DemandHeatmapWithSearchTrendsPresenter = ({ 
  heatmapData, 
  months, 
  searchTrends, 
  combinedData,
  trackedQueries,
  containsMockData,
  theme, 
  onRefresh 
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

    let failSafeRef = null;

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
            
            return {
              title: showTrends ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span>{displayMonth}</span>
                  {combinedData && combinedData.some(row => row[`${month}_searchTrends`]) && (
                    <span style={{ fontSize: '9px', color: '#4caf50', fontWeight: '500' }}>
                      📈 Trends
                    </span>
                  )}
                </div>
              ) : displayMonth,
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
                  return '<span style="color: #999;">-</span>';
                }
                
                const colors = getHeatmapColor(value, maxValue);
                const fontWeight = value && value > 0 ? '600' : 'normal';
                
                // Build cell content
                let cellContent = `<span style="
                  display: inline-block;
                  width: 100%;
                  padding: 4px 8px;
                  background-color: ${colors.bg};
                  color: ${colors.text};
                  font-weight: ${fontWeight};
                  border-radius: 2px;
                  text-align: center;
                ">${value.toLocaleString()}</span>`;
                
                // Add search trends indicator if available
                if (showTrends && trendData) {
                  const trendColors = getTrendColor(trendData.data[0]?.changePercent);
                  cellContent += `<div style="
                    margin-top: 2px;
                    font-size: 9px;
                    padding: 2px 4px;
                    background-color: ${trendColors.bg};
                    color: ${trendColors.text};
                    border-radius: 2px;
                    text-align: center;
                  ">📊 ${Math.round(trendData.average).toLocaleString()}</div>`;
                }
                
                return cellContent;
              }
            };
          })
        ];

        // Give layout one frame to settle
        await new Promise((r) => requestAnimationFrame(() => r()));

        // Create Tabulator instance
        instanceRef.current = new TabGlobal(tableRef.current, {
          data: combinedData || heatmapData,
          columns: columns,
          layout: 'fitDataStretch',
          reactiveData: false,
          height: '100%',
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
        });

        initializedRef.current = true;

        // Clear failSafe
        if (failSafeRef) {
          clearTimeout(failSafeRef);
          failSafeRef = null;
        }

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
        if (failSafeRef) {
          clearTimeout(failSafeRef);
        }
        // Retry after delay
        failSafeRef = setTimeout(() => {
          initializedRef.current = false;
          initializeTable();
        }, 2000);
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
      if (failSafeRef) {
        clearTimeout(failSafeRef);
      }
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
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--theme-border, #e0e0e0)'
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--theme-fg, #2b2b2b)'
          }}>
            Demand Heatmap with Search Trends Correlation
          </h3>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '12px',
            color: 'var(--theme-text-secondary, #666)'
          }}>
            Viewing demand across itineraries by departure month, enhanced with search trend indicators
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setShowTrends(!showTrends)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: showTrends ? 'var(--theme-accent, #b08d57)' : 'transparent',
              color: showTrends ? 'white' : 'var(--theme-fg, #2b2b2b)',
              border: `1px solid var(--theme-accent, #b08d57)`,
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showTrends ? '📊 Hide Trends' : '📊 Show Trends'}
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: 'var(--theme-accent, #b08d57)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Search Trends Summary */}
      {showTrends && searchTrends && searchTrends.series && searchTrends.series.length > 0 && (
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          background: 'rgba(76, 175, 80, 0.1)',
          borderRadius: '6px',
          border: '1px solid rgba(76, 175, 80, 0.3)',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--theme-fg, #2b2b2b)' }}>
            📈 Active Search Trends ({searchTrends.series.length} queries)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
            {searchTrends.series.map((series, idx) => (
              <span key={idx} style={{
                padding: '4px 8px',
                background: 'white',
                borderRadius: '4px',
                border: '1px solid rgba(76, 175, 80, 0.3)'
              }}>
                "{series.query}": {series.latestCount.toLocaleString()} results
                {series.changePercent !== 0 && (
                  <span style={{ 
                    color: series.changePercent > 0 ? '#4caf50' : '#f44336',
                    marginLeft: '4px'
                  }}>
                    ({series.changePercent > 0 ? '+' : ''}{series.changePercent.toFixed(1)}%)
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div ref={tableRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid var(--theme-border, #e0e0e0)',
        fontSize: '12px',
        color: 'var(--theme-text-secondary, #666)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <span>Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'rgba(220, 53, 69, 0.3)',
            border: '1px solid #ccc'
          }} />
          <span>Low Demand</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'rgba(220, 53, 69, 0.8)',
            border: '1px solid #ccc'
          }} />
          <span>High Demand</span>
        </div>
        {showTrends && (
          <>
            <div style={{ width: '1px', height: '16px', background: '#ccc' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📊</span>
              <span>Search Trends (avg results/month)</span>
            </div>
          </>
        )}
        <div style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          Max demand: {maxValue.toLocaleString()} {containsMockData && '(includes mock data)'}
        </div>
      </div>
    </div>
  );
};

export default DemandHeatmapWithSearchTrendsPresenter;

