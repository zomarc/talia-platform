/**
 * Shared offscreen Chart.js capture for white PDF exports.
 * Panel print-charts modules supply series/layout; this owns canvas + white bg.
 */

import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export const PRINT_INK = '#1c2430';
export const PRINT_GRID = '#e4e9ee';
export const PRINT_SOURCE = '#2f5f93';
export const PRINT_TALIA = '#3d7a52';
export const PRINT_NAMED = '#b26a24';

const whiteBackground = {
  id: 'taliaPrintChartBackground',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

/**
 * Render a Chart.js config on an offscreen canvas and return a PNG data URL.
 * @param {object} config Chart.js config (type, data, options, optional plugins)
 * @param {number} width
 * @param {number} height
 * @returns {string} data:image/png;...
 */
export function renderPrintChart(config, width, height) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const extraPlugins = Array.isArray(config?.plugins) ? config.plugins : [];
  const chart = new Chart(canvas, {
    ...config,
    plugins: [whiteBackground, ...extraPlugins],
    options: {
      ...config?.options,
      animation: false,
      responsive: false,
      maintainAspectRatio: false,
    },
  });
  chart.update('none');
  const image = chart.toBase64Image('image/png', 1);
  chart.destroy();
  return image;
}

export const printLegend = (visible) => ({
  display: visible !== false,
  position: 'top',
  align: 'start',
  labels: { color: PRINT_INK, boxWidth: 12, boxHeight: 12 },
});

export const printAxis = (title, showTitle) => ({
  beginAtZero: true,
  title: { display: showTitle !== false, text: title, color: PRINT_INK },
  ticks: { color: showTitle === false ? 'transparent' : PRINT_INK },
  grid: { color: PRINT_GRID },
});
