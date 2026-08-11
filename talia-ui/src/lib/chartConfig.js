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
 * Shared profile / distribution stack palette (Reservation curve + Distribution).
 * Theme series first, then fixed accents so both panels stay aligned.
 */
export const PROFILE_SERIES_PALETTE = [
  '#7aa2f7',
  '#9ece6a',
  '#e0af68',
  '#bb9af7',
  '#f7768e',
  '#73daca',
  '#ff9e64',
  '#c0caf5',
  '#b08d57',
  '#64ffda',
];

export const getProfileSeriesColors = () => {
  const theme = getSeriesColors();
  const seen = new Set(theme.map((c) => String(c).toLowerCase()));
  const extras = PROFILE_SERIES_PALETTE.filter((c) => !seen.has(String(c).toLowerCase()));
  return [...theme, ...extras];
};

/**
 * Read numeric font size from CSS variable (e.g. "10px" -> 10)
 */
const getCSSFontSize = (varName, fallback) => {
  const raw = getCSSVar(varName, '');
  const num = parseFloat(raw);
  return Number.isFinite(num) ? num : fallback;
};

/**
 * Compact overlay legend shared by profile / distribution charts.
 * Drawn inside the chart area so it stays discrete and does not steal layout.
 */
export const getOverlayLegendOptions = ({
  visible = true,
  align = 'start',
} = {}) => {
  const colors = getChartColors();
  const fontFamily = getCSSVar('--theme-font-family', 'Inter, sans-serif');
  return {
    display: visible !== false,
    position: 'chartArea',
    align,
    fullSize: false,
    labels: {
      boxWidth: 8,
      boxHeight: 8,
      padding: 4,
      usePointStyle: true,
      pointStyle: 'rectRounded',
      color: colors.textMuted || colors.text,
      font: { size: 9, family: fontFamily },
    },
  };
};

/**
 * Draws a dotted horizontal reference line (e.g. capacity) inside the chart area.
 * Configure via options.plugins.taliaHorizontalReferenceLine = { value, label?, color?, ... }.
 */
export const taliaHorizontalReferenceLinePlugin = {
  id: 'taliaHorizontalReferenceLine',
  afterDatasetsDraw(chart) {
    const cfg = chart.options?.plugins?.taliaHorizontalReferenceLine;
    if (!cfg || cfg.display === false) return;
    const value = Number(cfg.value);
    if (!Number.isFinite(value)) return;

    const yScale = chart.scales?.[cfg.scaleID || 'y'];
    const xScale = chart.scales?.x;
    if (!yScale || !xScale) return;

    const y = yScale.getPixelForValue(value);
    if (!Number.isFinite(y) || y < yScale.top || y > yScale.bottom) return;

    const colors = getChartColors();
    const color = cfg.color || colors.textMuted || 'rgba(232, 232, 240, 0.55)';
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash(Array.isArray(cfg.borderDash) ? cfg.borderDash : [5, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth = cfg.lineWidth || 1.25;
    ctx.moveTo(xScale.left, y);
    ctx.lineTo(xScale.right, y);
    ctx.stroke();

    const label = cfg.label;
    if (label) {
      const fontFamily = getCSSVar('--theme-font-family', 'Inter, sans-serif');
      ctx.setLineDash([]);
      ctx.font = cfg.font || `9px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(label), xScale.right - 2, y - 2);
    }
    ctx.restore();
  },
};

/**
 * Draws a light vertical reference line (e.g. today) on a category X axis.
 * Configure via options.plugins.taliaVerticalReferenceLine =
 *   { index, label?, color?, borderDash?, ... }  // index may be fractional
 */
export const taliaVerticalReferenceLinePlugin = {
  id: 'taliaVerticalReferenceLine',
  afterDatasetsDraw(chart) {
    const cfg = chart.options?.plugins?.taliaVerticalReferenceLine;
    if (!cfg || cfg.display === false) return;
    const index = Number(cfg.index);
    if (!Number.isFinite(index)) return;

    const xScale = chart.scales?.[cfg.scaleID || 'x'];
    const yScale = chart.scales?.y;
    if (!xScale || !yScale) return;

    const maxIndex = Math.max(0, (chart.data?.labels?.length || 1) - 1);
    const clamped = Math.min(maxIndex, Math.max(0, index));
    const left = Math.floor(clamped);
    const right = Math.min(maxIndex, Math.ceil(clamped));
    const t = clamped - left;
    const xLeft = xScale.getPixelForValue(left);
    const xRight = xScale.getPixelForValue(right);
    const x = left === right ? xLeft : xLeft + (xRight - xLeft) * t;
    if (!Number.isFinite(x) || x < xScale.left || x > xScale.right) return;

    const colors = getChartColors();
    const color = cfg.color || colors.textSecondary || 'rgba(232, 232, 240, 0.45)';
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash(Array.isArray(cfg.borderDash) ? cfg.borderDash : [3, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = cfg.lineWidth || 1;
    ctx.globalAlpha = cfg.opacity != null ? cfg.opacity : 0.7;
    ctx.moveTo(x, yScale.top);
    ctx.lineTo(x, yScale.bottom);
    ctx.stroke();

    const label = cfg.label;
    if (label) {
      const fontFamily = getCSSVar('--theme-font-family', 'Inter, sans-serif');
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.font = cfg.font || `9px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(label), x, yScale.top + 2);
    }
    ctx.restore();
  },
};

/**
 * Map days-until-sailing onto a weeks-until axis index (labels ordered early → Sail).
 * @param {Array<{ weeksUntilSailing?: number }>} points
 * @param {number|null|undefined} daysUntilSailing
 * @returns {number|null}
 */
export const resolveTodayWeekIndex = (points = [], daysUntilSailing) => {
  if (!points?.length || daysUntilSailing == null || !Number.isFinite(Number(daysUntilSailing))) {
    return null;
  }
  const weeksExact = Math.max(0, Number(daysUntilSailing) / 7);
  let bestIdx = null;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const w = Number(points[i]?.weeksUntilSailing);
    if (!Number.isFinite(w)) continue;
    const dist = Math.abs(w - weeksExact);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  if (bestIdx == null) return null;

  // Interpolate between neighbouring week ticks when today falls between them.
  const wBest = Number(points[bestIdx].weeksUntilSailing);
  if (weeksExact === wBest || points.length < 2) return bestIdx;

  let neighbour = null;
  if (weeksExact > wBest && bestIdx > 0) neighbour = bestIdx - 1;
  else if (weeksExact < wBest && bestIdx < points.length - 1) neighbour = bestIdx + 1;
  if (neighbour == null) return bestIdx;

  const wNeigh = Number(points[neighbour].weeksUntilSailing);
  if (!Number.isFinite(wNeigh) || wNeigh === wBest) return bestIdx;
  const t = (weeksExact - wBest) / (wNeigh - wBest);
  if (!Number.isFinite(t) || t < 0 || t > 1) return bestIdx;
  return bestIdx + (neighbour - bestIdx) * t;
};

export const initChartDefaults = () => {
  const colors = getChartColors();
  const baseFontSize = getCSSFontSize('--theme-font-size', 10);
  const fontFamily = getCSSVar('--theme-font-family', 'Inter, sans-serif');

  // Global defaults
  defaults.color = colors.text;
  defaults.borderColor = colors.border;
  defaults.backgroundColor = colors.backgroundLight;
  
  // Font defaults -- derived from appearance settings
  defaults.font.family = fontFamily;
  defaults.font.size = baseFontSize;
  
  // Plugin defaults
  defaults.plugins.legend.labels.color = colors.text;
  defaults.plugins.legend.labels.usePointStyle = true;
  defaults.plugins.legend.labels.padding = Math.round(baseFontSize * 1.4);
  defaults.plugins.legend.labels.font = { size: baseFontSize, family: fontFamily };
  
  defaults.plugins.title.color = colors.text;
  defaults.plugins.title.font = { size: Math.round(baseFontSize * 1.2), weight: '600', family: fontFamily };
  
  defaults.plugins.tooltip.backgroundColor = colors.background;
  defaults.plugins.tooltip.titleColor = colors.text;
  defaults.plugins.tooltip.bodyColor = colors.textSecondary;
  defaults.plugins.tooltip.borderColor = colors.border;
  defaults.plugins.tooltip.borderWidth = 1;
  defaults.plugins.tooltip.padding = Math.round(baseFontSize * 1.1);
  defaults.plugins.tooltip.cornerRadius = 4;
  defaults.plugins.tooltip.titleFont = { size: baseFontSize, family: fontFamily };
  defaults.plugins.tooltip.bodyFont = { size: baseFontSize, family: fontFamily };
  
  // Scale defaults
  defaults.scale.grid.color = colors.grid;
  defaults.scale.grid.lineWidth = 1;
  defaults.scale.ticks.color = colors.textMuted;
  defaults.scale.ticks.font = { size: Math.max(8, baseFontSize - 1), family: fontFamily };
  defaults.scale.title.color = colors.textSecondary;
  defaults.scale.title.font = { size: baseFontSize, weight: '600', family: fontFamily };
  
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
      legend: getOverlayLegendOptions({
        visible: typeof window === 'undefined' || window.__taliaChartLegendsVisible !== false,
      }),
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
  getProfileSeriesColors,
  getOverlayLegendOptions,
  taliaHorizontalReferenceLinePlugin,
  taliaVerticalReferenceLinePlugin,
  resolveTodayWeekIndex,
  getChartOptions,
  createDataset,
};
