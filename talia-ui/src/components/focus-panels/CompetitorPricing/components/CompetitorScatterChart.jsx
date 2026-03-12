/**
 * Competitor Scatter Chart Component
 * Displays 2x2 grid of scatter plots for different cabin types
 */

import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

// Color palette for cruise lines (case-insensitive lookup)
const CRUISE_LINE_COLORS = {
  'celebrity cruises': '#1f77b4', // Blue
  'msc cruises': '#2ca02c', // Dark Blue/Green
  'royal caribbean': '#ff7f0e', // Orange
  'virgin voyages cruises': '#9467bd', // Purple
  'azamara': '#8c564b', // Brown
  'holland america': '#e377c2', // Pink
  'princess cruises': '#7f7f7f', // Gray
  'norwegian cruise line': '#bcbd22', // Yellow-Green
  'cunard': '#17becf', // Cyan
  'costa': '#d62728' // Red
};

const getColorForCruiseLine = (cruiseLine, index) => {
  if (!cruiseLine) {
    return '#999999';
  }
  
  // Case-insensitive lookup
  const key = cruiseLine.toLowerCase();
  if (CRUISE_LINE_COLORS[key]) {
    return CRUISE_LINE_COLORS[key];
  }
  
  // Fallback to a color palette
  const fallbackColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
  ];
  return fallbackColors[index % fallbackColors.length];
};

const ALL_CABIN_TYPES = ['BALCONY', 'INSIDE', 'OUTSIDE', 'SUITE'];
const PRIMARY_COLOR = '#ef4444';
const normalizeLine = (value) => String(value || '').trim().toLowerCase();

const getPointStyleForCabinType = (cabinType) => {
  switch (String(cabinType || '').toUpperCase()) {
    case 'INSIDE':
      return 'circle';
    case 'OUTSIDE':
      return 'triangle';
    case 'BALCONY':
      return 'rect';
    case 'SUITE':
      return 'star';
    default:
      return 'circle';
  }
};

const withAlpha = (hexColor, alpha) => {
  if (!hexColor || typeof hexColor !== 'string') return `rgba(153, 153, 153, ${alpha})`;
  const normalized = hexColor.replace('#', '');
  if (normalized.length !== 6) return `rgba(153, 153, 153, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CompetitorScatterChart = ({
  data,
  theme,
  filters,
  expandedCabinType,
  onToggleExpand,
  tableVisible = true,
  chartOptions = { pppdScaleMode: 'AUTO', pppdMax: 200 }
}) => {
  const containerRef = useRef(null);
  const filteredCabinTypes = (filters?.cabinType && filters.cabinType !== 'ALL')
    ? [filters.cabinType]
    : ALL_CABIN_TYPES;
  const activeCabinTypes = expandedCabinType ? [expandedCabinType] : filteredCabinTypes;
  const primaryCruiseLine = filters?.primaryCruiseLine || null;
  const secondaryCruiseLine = filters?.secondaryCruiseLine || 'ALL';

  const chartRefs = {
    BALCONY: useRef(null),
    INSIDE: useRef(null),
    OUTSIDE: useRef(null),
    SUITE: useRef(null)
  };
  const chartInstances = useRef({});

  useEffect(() => {
    if (!data || data.length === 0) return;
    const cabinTypes = activeCabinTypes;

    // Group data by cabin type
    const dataByCabinType = {};
    ALL_CABIN_TYPES.forEach(type => {
      dataByCabinType[type] = data.filter(d => d.cabinType === type);
    });

    // Calculate global min/max PPPD across all cabin types for consistent scaling
    const allPppdValues = data
      .map(d => d.pppd)
      .filter(val => val != null && !isNaN(val) && val > 0);
    
    const minPppd = allPppdValues.length > 0 ? Math.min(...allPppdValues) : 0;
    const maxPppd = allPppdValues.length > 0 ? Math.max(...allPppdValues) : 600;
    
    // Add 10% padding above and below
    const padding = (maxPppd - minPppd) * 0.1;
    const yAxisMin = Math.max(0, minPppd - padding);
    const yAxisMax = maxPppd + padding;
    
    // Round to nice numbers
    const roundedMin = Math.floor(yAxisMin / 10) * 10;
    const roundedMax = Math.ceil(yAxisMax / 10) * 10;
    const useFixedPppd = chartOptions?.pppdScaleMode === 'FIXED';
    const fixedMax = Number(chartOptions?.pppdMax) || 200;
    const effectiveYMin = useFixedPppd ? 0 : roundedMin;
    const effectiveYMax = useFixedPppd ? fixedMax : roundedMax;

    // Get unique cruise lines
    const allCruiseLines = [...new Set(data.map(d => d.cruiseLine).filter(Boolean))].sort();
    const cruiseLines = allCruiseLines.filter((line) => {
      if (primaryCruiseLine && normalizeLine(line) === normalizeLine(primaryCruiseLine)) return true;
      if (secondaryCruiseLine === 'NONE') return false;
      if (secondaryCruiseLine && secondaryCruiseLine !== 'ALL') {
        return normalizeLine(line) === normalizeLine(secondaryCruiseLine);
      }
      if (primaryCruiseLine) return normalizeLine(line) !== normalizeLine(primaryCruiseLine);
      return true;
    });

    cabinTypes.forEach(cabinType => {
      const canvasRef = chartRefs[cabinType].current;
      if (!canvasRef) return;

      // Destroy existing chart
      if (chartInstances.current[cabinType]) {
        chartInstances.current[cabinType].destroy();
        chartInstances.current[cabinType] = null;
      }

      const ctx = canvasRef.getContext('2d');
      const cabinData = dataByCabinType[cabinType];

      if (!cabinData || cabinData.length === 0) {
        // Create empty chart with same scale for consistency
        chartInstances.current[cabinType] = new Chart(ctx, {
          type: 'scatter',
          data: { datasets: [] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: `${cabinType} (PPPD/Departure Date)`,
                color: theme?.colors?.foreground || '#2b2b2b',
                font: { size: 12, weight: '600' }
              }
            },
            scales: {
              y: {
                beginAtZero: false,
                min: effectiveYMin,
                max: effectiveYMax,
                grid: {
                  color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
                },
                ticks: {
                  color: theme?.colors?.textSecondary || '#666',
                  font: { size: 9 },
                  callback: function(value) {
                    return Math.round(value);
                  }
                }
              },
              x: {
                type: 'linear',
                grid: {
                  color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
                },
                ticks: {
                  color: theme?.colors?.textSecondary || '#666',
                  font: { size: 9 },
                  callback: function(value) {
                    const date = new Date(value);
                    const monthYear = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                    return monthYear.replace(' ', '/');
                  }
                }
              }
            }
          }
        });
        return;
      }

      // Create datasets for each cruise line
      const datasets = cruiseLines.map((cruiseLine, index) => {
        const cruiseLineData = cabinData.filter(d => d.cruiseLine === cruiseLine);
        const isPrimary = primaryCruiseLine && normalizeLine(cruiseLine) === normalizeLine(primaryCruiseLine);
        const baseColor = isPrimary ? PRIMARY_COLOR : getColorForCruiseLine(cruiseLine, index);
        const color = isPrimary ? baseColor : withAlpha(baseColor, 0.35);
        const pointStyle = getPointStyleForCabinType(cabinType);
        const baseRadius = cabinType === 'SUITE' ? 2.4 : 2.8;
        return {
          label: cruiseLine,
          data: cruiseLineData.map(d => ({
            x: new Date(d.departureDate).getTime(),
            y: d.pppd
          })),
          backgroundColor: color,
          borderColor: color,
          pointStyle,
          pointRadius: isPrimary ? baseRadius + 0.6 : baseRadius,
          pointHoverRadius: isPrimary ? baseRadius + 1.2 : baseRadius + 0.6,
          pointBorderWidth: 0,
          pointBorderColor: color
        };
      });

      // Create chart
      chartInstances.current[cabinType] = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 0
          },
          plugins: {
            title: {
              display: true,
              text: `${cabinType} (PPPD/Departure Date)`,
              color: theme?.colors?.foreground || '#2b2b2b',
              font: { size: 10, weight: '600' }
            },
            legend: {
              display: false, // Hide legend in individual charts (will show in main legend)
              position: 'top',
              labels: {
                color: theme?.colors?.foreground || '#2b2b2b',
                usePointStyle: true
              }
            },
            tooltip: {
              callbacks: {
                title: function(context) {
                  const point = context[0];
                  const date = new Date(point.raw.x);
                  return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                },
                label: function(context) {
                  const dataset = context.dataset;
                  const point = context.raw;
                  const cabin = cabinType || 'N/A';
                  return [
                    `Cruise Line: ${dataset.label}`,
                    `Cabin Type: ${cabin}`,
                    `PPPD: ${point.y.toFixed(2)}`,
                    `Date: ${new Date(point.x).toLocaleDateString()}`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              grid: {
                color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
              },
              ticks: {
                color: theme?.colors?.textSecondary || '#666',
                font: { size: 9 },
                callback: function(value) {
                  const date = new Date(value);
                  const monthYear = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                  return monthYear.replace(' ', '/');
                }
              }
            },
            y: {
              beginAtZero: false,
              min: effectiveYMin,
              max: effectiveYMax,
              grid: {
                color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
              },
              ticks: {
                color: theme?.colors?.textSecondary || '#666',
                font: { size: 9 },
                callback: function(value) {
                  return Math.round(value);
                },
                // Calculate step size to get approximately 8-12 ticks
                stepSize: Math.max(1, Math.ceil((effectiveYMax - effectiveYMin) / 12))
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'nearest'
          }
        }
      });
    });

    return () => {
      cabinTypes.forEach(cabinType => {
        if (chartInstances.current[cabinType]) {
          chartInstances.current[cabinType].destroy();
        }
      });
    };
  }, [data, theme, activeCabinTypes, primaryCruiseLine, secondaryCruiseLine, chartOptions?.pppdScaleMode, chartOptions?.pppdMax]);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      Object.values(chartInstances.current).forEach((chart) => {
        try {
          chart?.resize?.();
        } catch {
          // noop
        }
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`competitor-scatter-grid ${activeCabinTypes.length === 1 ? 'competitor-scatter-grid--single' : ''} ${expandedCabinType ? 'competitor-scatter-grid--expanded' : ''} ${!tableVisible ? 'competitor-scatter-grid--table-hidden' : ''}`}
    >
      {activeCabinTypes.map(cabinType => (
        <div key={cabinType} className="competitor-scatter-grid__chart">
          <button
            type="button"
            className="competitor-scatter-grid__expand-btn"
            aria-label={expandedCabinType ? `Collapse ${cabinType} chart` : `Expand ${cabinType} chart`}
            title={expandedCabinType ? 'Return to panel layout' : 'Expand chart'}
            onClick={() => onToggleExpand?.(expandedCabinType ? null : cabinType)}
          >
            {expandedCabinType ? '↙' : '↗'}
          </button>
          <canvas ref={chartRefs[cabinType]} />
        </div>
      ))}
    </div>
  );
};

export default CompetitorScatterChart;

