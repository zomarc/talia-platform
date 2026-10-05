/**
 * Competitor Scatter Chart Component
 * Displays 2x2 grid of scatter plots for different cabin types
 */

import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import SubpanelExpandButton from '../../../shared/SubpanelExpandButton';
import { formatDayMon, formatMonYear } from '../../../../lib/dateFormat';
import { applyAxisLabelVisibility, axisLabelsPluginOptions } from '../../../../lib/chartConfig';
import { useTheme } from '../../../../contexts/ThemeContext';

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
  chartOptions = { pppdScaleMode: 'AUTO', pppdMax: 200 },
  showAxisLabels = true,
}) => {
  const { fontSize, fontFamily } = useTheme();
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
          options: applyAxisLabelVisibility({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              ...axisLabelsPluginOptions(showAxisLabels),
              title: {
                display: true,
                text: `${cabinType} (PPPD/Departure Date)`,
              }
            },
            scales: {
              y: {
                beginAtZero: false,
                min: effectiveYMin,
                max: effectiveYMax,
                ticks: {
                  callback: function(value) {
                    return Math.round(value);
                  }
                }
              },
              x: {
                type: 'linear',
                ticks: {
                  callback: function(value) {
                    return formatMonYear(value, '');
                  }
                }
              }
            }
          }, showAxisLabels),
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
        options: applyAxisLabelVisibility({
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 0
          },
          plugins: {
            ...axisLabelsPluginOptions(showAxisLabels),
            title: {
              display: true,
              text: `${cabinType} (PPPD/Departure Date)`,
            },
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                title: function(context) {
                  const point = context[0];
                  return formatDayMon(point.raw.x, '');
                },
                label: function(context) {
                  const dataset = context.dataset;
                  const point = context.raw;
                  const cabin = cabinType || 'N/A';
                  return [
                    `Cruise Line: ${dataset.label}`,
                    `Cabin Type: ${cabin}`,
                    `PPPD: ${point.y.toFixed(2)}`,
                    `Date: ${formatDayMon(point.x, '')}`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              ticks: {
                callback: function(value) {
                  return formatMonYear(value, '');
                }
              }
            },
            y: {
              beginAtZero: false,
              min: effectiveYMin,
              max: effectiveYMax,
              ticks: {
                callback: function(value) {
                  return Math.round(value);
                },
                stepSize: Math.max(1, Math.ceil((effectiveYMax - effectiveYMin) / 12))
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'nearest'
          }
        }, showAxisLabels)
      });
    });

    return () => {
      cabinTypes.forEach(cabinType => {
        if (chartInstances.current[cabinType]) {
          chartInstances.current[cabinType].destroy();
        }
      });
    };
  }, [data, theme, activeCabinTypes, primaryCruiseLine, secondaryCruiseLine, chartOptions?.pppdScaleMode, chartOptions?.pppdMax, fontSize, fontFamily, showAxisLabels]);

  return (
    <div
      className={`competitor-scatter-grid ${activeCabinTypes.length === 1 ? 'competitor-scatter-grid--single' : ''} ${expandedCabinType ? 'competitor-scatter-grid--expanded' : ''} ${!tableVisible ? 'competitor-scatter-grid--table-hidden' : ''}`}
    >
      {activeCabinTypes.map(cabinType => (
        <div key={cabinType} className="competitor-scatter-grid__chart">
          <SubpanelExpandButton
            className="talia-card__expand-toggle competitor-scatter-grid__expand-btn"
            expanded={Boolean(expandedCabinType)}
            onToggle={() => onToggleExpand?.(expandedCabinType ? null : cabinType)}
            label={`${cabinType} chart`}
          />
          <canvas ref={chartRefs[cabinType]} />
        </div>
      ))}
    </div>
  );
};

export default CompetitorScatterChart;

