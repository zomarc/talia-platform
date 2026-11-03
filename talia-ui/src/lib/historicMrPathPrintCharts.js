/**
 * White-paper charts for the historic MR path PDF.
 */

import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const INK = '#1c2430';
const GRID = '#e4e9ee';
const SOURCE = '#2f5f93';
const TALIA = '#3d7a52';
const NAMED = '#b26a24';

const whiteBackground = {
  id: 'historicMrPathPrintBackground',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

const renderChart = (config, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const chart = new Chart(canvas, {
    ...config,
    plugins: [whiteBackground],
    options: {
      ...config.options,
      animation: false,
      responsive: false,
      maintainAspectRatio: false,
    },
  });
  chart.update('none');
  const image = chart.toBase64Image('image/png', 1);
  chart.destroy();
  return image;
};

const legend = (visible) => ({
  display: visible !== false,
  position: 'top',
  align: 'start',
  labels: { color: INK, boxWidth: 12 },
});

const axis = (title, showTitle) => ({
  beginAtZero: true,
  title: { display: showTitle !== false, text: title, color: INK },
  ticks: { color: showTitle === false ? 'transparent' : INK },
  grid: { color: GRID },
});

const bars = (labels, rows, value) => ([
  { label: 'Source expected', data: rows.map((row) => value(row, 'source')), backgroundColor: SOURCE, borderColor: SOURCE, borderWidth: 1 },
  { label: 'Talia expected', data: rows.map((row) => value(row, 'talia')), backgroundColor: TALIA, borderColor: TALIA, borderWidth: 1 },
  { label: 'Named', data: rows.map((row) => value(row, 'named')), backgroundColor: NAMED, borderColor: NAMED, borderWidth: 1 },
]);

export function captureHistoricMrPathCharts({
  months = [],
  days = [],
  range = null,
  includeMonths = false,
  includeRange = false,
  includePath = false,
  showLegends = true,
  showAxisLabels = true,
} = {}) {
  if (typeof document === 'undefined') return [];
  const charts = [];
  if (includeRange && range) {
    const values = [
      Math.round(Number(range.source) || 0),
      Math.round(Number(range.talia) || 0),
      Math.round(Number(range.named) || 0),
    ];
    charts.push({
      id: 'range',
      title: 'This range',
      image: renderChart({
        type: 'bar',
        data: {
          labels: ['Source expected', 'Talia expected', 'Named'],
          datasets: [{
            label: 'Guests',
            data: values,
            backgroundColor: [SOURCE, TALIA, NAMED],
            borderColor: [SOURCE, TALIA, NAMED],
            borderWidth: 1,
          }],
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: axis('Guests', showAxisLabels),
            y: {
              ticks: { color: showAxisLabels === false ? 'transparent' : INK, autoSkip: false },
              grid: { color: GRID },
            },
          },
        },
      }, 1400, 320),
    });
  }
  if (includeMonths && months.length) {
    charts.push({
      id: 'months',
      title: 'By sail month',
      image: renderChart({
        type: 'bar',
        data: {
          labels: months.map((row) => row.label),
          datasets: bars(months, months, (row, key) => Math.round(Number(row[key]) || 0)),
        },
        options: {
          plugins: { legend: legend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: { ...axis('Sail month', showAxisLabels), beginAtZero: undefined },
            y: axis('Guests', showAxisLabels),
          },
        },
      }, 1400, 520),
    });
  }
  if (includePath && days.length) {
    charts.push({
      id: 'path',
      title: 'Change days',
      image: renderChart({
        type: 'bar',
        data: {
          labels: days.map((row) => row.label),
          datasets: bars(days, days, (row, key) => Math.round(Number(row[key]) || 0)),
        },
        options: {
          plugins: { legend: legend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: { ...axis('Change day', showAxisLabels), beginAtZero: undefined },
            y: axis('Guests', showAxisLabels),
          },
        },
      }, 1400, 520),
    });
  }
  return charts;
}
