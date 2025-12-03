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

const CompetitorScatterChart = ({ data, theme }) => {
  const chartRefs = {
    BALCONY: useRef(null),
    INSIDE: useRef(null),
    OUTSIDE: useRef(null),
    SUITE: useRef(null)
  };
  const chartInstances = useRef({});

  useEffect(() => {
    if (!data || data.length === 0) return;

    const cabinTypes = ['BALCONY', 'INSIDE', 'OUTSIDE', 'SUITE'];

    // Group data by cabin type
    const dataByCabinType = {};
    cabinTypes.forEach(type => {
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

    // Get unique cruise lines
    const cruiseLines = [...new Set(data.map(d => d.cruiseLine).filter(Boolean))].sort();

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
                text: cabinType,
                color: theme?.colors?.foreground || '#2b2b2b'
              }
            },
            scales: {
              y: {
                beginAtZero: false,
                min: roundedMin,
                max: roundedMax,
                title: {
                  display: true,
                  text: 'PPPD',
                  color: theme?.colors?.textSecondary || '#666'
                },
                grid: {
                  color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
                },
                ticks: {
                  color: theme?.colors?.textSecondary || '#666',
                  callback: function(value) {
                    return Math.round(value);
                  }
                }
              },
              x: {
                type: 'linear',
                title: {
                  display: true,
                  text: 'Departure Date',
                  color: theme?.colors?.textSecondary || '#666'
                },
                grid: {
                  color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
                },
                ticks: {
                  color: theme?.colors?.textSecondary || '#666'
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
        return {
          label: cruiseLine,
          data: cruiseLineData.map(d => ({
            x: new Date(d.departureDate).getTime(),
            y: d.pppd
          })),
          backgroundColor: getColorForCruiseLine(cruiseLine, index),
          borderColor: getColorForCruiseLine(cruiseLine, index),
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBorderWidth: 1,
          pointBorderColor: '#fff'
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
              text: cabinType,
              color: theme?.colors?.foreground || '#2b2b2b',
              font: { size: 16, weight: 'bold' }
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
                  return [
                    `Cruise Line: ${dataset.label}`,
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
              title: {
                display: true,
                text: 'Departure Date',
                color: theme?.colors?.textSecondary || '#666'
              },
              grid: {
                color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
              },
              ticks: {
                color: theme?.colors?.textSecondary || '#666',
                callback: function(value) {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }
              }
            },
            y: {
              beginAtZero: false,
              min: roundedMin,
              max: roundedMax,
              title: {
                display: true,
                text: 'PPPD',
                color: theme?.colors?.textSecondary || '#666'
              },
              grid: {
                color: theme?.colors?.border || 'rgba(0,0,0,0.1)'
              },
              ticks: {
                color: theme?.colors?.textSecondary || '#666',
                callback: function(value) {
                  return Math.round(value);
                },
                // Calculate step size to get approximately 8-12 ticks
                stepSize: Math.max(1, Math.ceil((roundedMax - roundedMin) / 12))
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
  }, [data, theme]);

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '16px',
    padding: '16px',
    background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)'
  };

  const chartContainerStyle = {
    position: 'relative',
    height: '300px',
    background: theme?.colors?.background || '#fff',
    borderRadius: '8px',
    border: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
    padding: '12px'
  };

  const cabinTypes = ['BALCONY', 'INSIDE', 'OUTSIDE', 'SUITE'];

  return (
    <div style={containerStyle}>
      {cabinTypes.map(cabinType => (
        <div key={cabinType} style={chartContainerStyle}>
          <canvas ref={chartRefs[cabinType]} />
        </div>
      ))}
    </div>
  );
};

export default CompetitorScatterChart;

