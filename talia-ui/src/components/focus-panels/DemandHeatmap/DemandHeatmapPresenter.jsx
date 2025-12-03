/**
 * Demand Heatmap Presenter Component
 * Displays viewing demand across itineraries by departure month as a heatmap
 * Pure UI component - receives data as props
 */

import React, { useRef, useEffect, useMemo } from 'react';
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
 * Presentational component for demand heatmap table
 */
const DemandHeatmapPresenter = ({ data, months, theme, onRefresh }) => {
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

    let failSafeRef = null;

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
                  return '<span style="color: #999;">-</span>';
                }
                
                const colors = getHeatmapColor(value, maxValue);
                const fontWeight = value && value > 0 ? '600' : 'normal';
                
                return `<span style="
                  display: inline-block;
                  width: 100%;
                  padding: 4px 8px;
                  background-color: ${colors.bg};
                  color: ${colors.text};
                  font-weight: ${fontWeight};
                  border-radius: 2px;
                  text-align: center;
                ">${value.toLocaleString()}</span>`;
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
          console.warn('[DemandHeatmap] Failed to destroy Tabulator on unmount:', e);
        }
        instanceRef.current = null;
      }
      initializedRef.current = false;
      if (failSafeRef) {
        clearTimeout(failSafeRef);
      }
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
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--theme-fg, #2b2b2b)'
        }}>
          Viewing Demand Across Itineraries by Departure Month
        </h3>
        
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
        gap: '16px'
      }}>
        <span>Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'rgba(220, 53, 69, 0.3)',
            border: '1px solid #ccc'
          }} />
          <span>Low</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'rgba(220, 53, 69, 0.8)',
            border: '1px solid #ccc'
          }} />
          <span>High</span>
        </div>
        <div style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          Max value: {maxValue.toLocaleString()} {months.length > 0 ? 'views' : ''}
        </div>
      </div>
    </div>
  );
};

export default DemandHeatmapPresenter;
