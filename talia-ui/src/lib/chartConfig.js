/**
 * Chart.js Global Configuration
 * 
 * Sets up Chart.js with application theme defaults.
 * Import this file once in the app to apply global chart styling.
 * 
 * Usage:
 *   import { initChartDefaults, getChartColors } from './lib/chartConfig';
 *   initChartDefaults(); // Call once at app startup
 */

import { Chart, defaults } from 'chart.js';

/**
 * Get computed CSS variable value
 */
const getCSSVar = (name, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

/**
 * Chart color palette - uses CSS variables with fallbacks
 */
export const getChartColors = () => ({
  // Primary data colors
  primary: getCSSVar('--theme-accent', '#5b9bd5'),
  secondary: getCSSVar('--theme-perf-good', '#4caf50'),
  tertiary: getCSSVar('--theme-warning', '#ff9800'),
  quaternary: getCSSVar('--theme-error', '#f44336'),
  
  // Text colors
  text: getCSSVar('--theme-fg', '#e8e8f0'),
  textMuted: getCSSVar('--theme-text-muted', 'rgba(232, 232, 240, 0.55)'),
  textSecondary: getCSSVar('--theme-text-secondary', 'rgba(232, 232, 240, 0.75)'),
  
  // Grid and borders
  grid: getCSSVar('--theme-border-light', 'rgba(255, 255, 255, 0.08)'),
  border: getCSSVar('--theme-border', 'rgba(255, 255, 255, 0.15)'),
  
  // Background
  background: getCSSVar('--theme-bg-solid', '#151528'),
  backgroundLight: getCSSVar('--theme-glass', 'rgba(255, 255, 255, 0.08)'),
  
  // Status colors
  positive: getCSSVar('--theme-delta-positive', '#4caf50'),
  negative: getCSSVar('--theme-delta-negative', '#f44336'),
  neutral: getCSSVar('--theme-text-muted', 'rgba(232, 232, 240, 0.55)'),
});

/**
 * Data series color palette for multi-series charts
 */
export const getSeriesColors = () => [
  getCSSVar('--theme-accent', '#5b9bd5'),
  getCSSVar('--theme-perf-good', '#4caf50'),
  getCSSVar('--theme-warning', '#ff9800'),
  getCSSVar('--theme-error', '#f44336'),
  '#9c27b0', // Purple
  '#00bcd4', // Cyan
  '#795548', // Brown
  '#607d8b', // Blue Grey
];

/**
 * Initialize Chart.js with theme defaults
 * Call this once at application startup
 */
export const initChartDefaults = () => {
  const colors = getChartColors();
  
  // Global defaults
  defaults.color = colors.text;
  defaults.borderColor = colors.border;
  defaults.backgroundColor = colors.backgroundLight;
  
  // Font defaults
  defaults.font.family = getCSSVar('--theme-font-family', 'Inter, sans-serif');
  defaults.font.size = 12;
  
  // Plugin defaults
  defaults.plugins.legend.labels.color = colors.text;
  defaults.plugins.legend.labels.usePointStyle = true;
  defaults.plugins.legend.labels.padding = 16;
  
  defaults.plugins.title.color = colors.text;
  defaults.plugins.title.font = { size: 14, weight: '600' };
  
  defaults.plugins.tooltip.backgroundColor = colors.background;
  defaults.plugins.tooltip.titleColor = colors.text;
  defaults.plugins.tooltip.bodyColor = colors.textSecondary;
  defaults.plugins.tooltip.borderColor = colors.border;
  defaults.plugins.tooltip.borderWidth = 1;
  defaults.plugins.tooltip.padding = 12;
  defaults.plugins.tooltip.cornerRadius = 4;
  
  // Scale defaults
  defaults.scale.grid.color = colors.grid;
  defaults.scale.grid.lineWidth = 1;
  defaults.scale.ticks.color = colors.textMuted;
  defaults.scale.title.color = colors.textSecondary;
  
  // Disable animations for better performance
  defaults.animation = false;
  defaults.transitions = { active: { animation: { duration: 0 } } };
  
  // Element defaults
  defaults.elements.line.borderWidth = 2;
  defaults.elements.line.tension = 0.4;
  defaults.elements.point.radius = 0;
  defaults.elements.point.hoverRadius = 4;
  defaults.elements.bar.borderRadius = 4;
  defaults.elements.arc.borderWidth = 0;
  
  console.log('[ChartConfig] Chart.js defaults initialized');
};

/**
 * Get standard chart options for specific chart types
 */
export const getChartOptions = {
  /**
   * Line chart options
   */
  line: (options = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    ...options,
  }),
  
  /**
   * Bar chart options
   */
  bar: (options = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    ...options,
  }),
  
  /**
   * Pie/Doughnut chart options
   */
  pie: (options = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      ...options.plugins,
    },
    ...options,
  }),
  
  /**
   * Scatter chart options
   */
  scatter: (options = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    ...options,
  }),
};

/**
 * Create a dataset with theme-aware styling
 */
export const createDataset = (data, label, colorIndex = 0, options = {}) => {
  const seriesColors = getSeriesColors();
  const color = seriesColors[colorIndex % seriesColors.length];
  
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: `${color}20`, // 12.5% opacity
    ...options,
  };
};

export default {
  initChartDefaults,
  getChartColors,
  getSeriesColors,
  getChartOptions,
  createDataset,
};
