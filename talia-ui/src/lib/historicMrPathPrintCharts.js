/**
 * White-paper charts for the historic MR path PDF.
 */

import {
  PRINT_INK,
  PRINT_GRID,
  PRINT_NAMED,
  PRINT_SOURCE,
  PRINT_TALIA,
  printAxis,
  printLegend,
  renderPrintChart,
} from './printChartCapture.js';

const SOURCE = PRINT_SOURCE;
const TALIA = PRINT_TALIA;
const NAMED = PRINT_NAMED;
const INK = PRINT_INK;
const GRID = PRINT_GRID;

const bars = (rows, value) => ([
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
      image: renderPrintChart({
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
            x: printAxis('Guests', showAxisLabels),
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
      image: renderPrintChart({
        type: 'bar',
        data: {
          labels: months.map((row) => row.label),
          datasets: bars(months, (row, key) => Math.round(Number(row[key]) || 0)),
        },
        options: {
          plugins: { legend: printLegend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: { ...printAxis('Sail month', showAxisLabels), beginAtZero: undefined },
            y: printAxis('Guests', showAxisLabels),
          },
        },
      }, 1400, 520),
    });
  }
  if (includePath && days.length) {
    charts.push({
      id: 'path',
      title: 'Change days',
      image: renderPrintChart({
        type: 'bar',
        data: {
          labels: days.map((row) => row.label),
          datasets: bars(days, (row, key) => Math.round(Number(row[key]) || 0)),
        },
        options: {
          plugins: { legend: printLegend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: { ...printAxis('Change day', showAxisLabels), beginAtZero: undefined },
            y: printAxis('Guests', showAxisLabels),
          },
        },
      }, 1400, 520),
    });
  }
  return charts;
}
