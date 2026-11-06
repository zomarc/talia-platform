/**
 * White-paper copies of the Source MR charts for PDF export.
 * Screen charts stay on the theme. These are drawn only when export runs.
 */

import {
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

const bar = (label, data, color) => ({
  label,
  data,
  backgroundColor: color,
  borderColor: color,
  borderWidth: 1,
});

export function captureSourceMrPrintCharts({
  sailed = [],
  months = [],
  monthTitle = 'By sail month',
  includeStatus = false,
  includeMonth = false,
  showLegends = true,
  showAxisLabels = true,
} = {}) {
  if (typeof document === 'undefined') return [];
  const charts = [];
  if (includeStatus && sailed.length) {
    charts.push({
      id: 'status',
      title: 'Source expected against Talia expected',
      image: renderPrintChart({
        type: 'bar',
        data: {
          labels: sailed.map((row) => row.label),
          datasets: [
            bar('Source expected', sailed.map((row) => Math.round(Number(row.sailedSourceExpectedGuests) || 0)), SOURCE),
            bar('Talia expected', sailed.map((row) => Math.round(Number(row.sailedTaliaExpectedGuests) || 0)), TALIA),
          ],
        },
        options: {
          plugins: { legend: printLegend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: { ...printAxis('Status', showAxisLabels), beginAtZero: undefined },
            y: printAxis('Expected guests', showAxisLabels),
          },
        },
      }, 1400, 520),
    });
  }
  if (includeMonth && months.length) {
    const height = Math.max(520, months.length * 36 + 80);
    charts.push({
      id: 'month',
      title: monthTitle,
      image: renderPrintChart({
        type: 'bar',
        data: {
          labels: months.map((row) => row.label),
          datasets: [
            bar('Source expected', months.map((row) => Math.round(Number(row.sourceExpectedGuests) || 0)), SOURCE),
            bar('Talia expected', months.map((row) => Math.round(Number(row.taliaExpectedGuests) || 0)), TALIA),
            bar('Named', months.map((row) => Math.round(Number(row.namedGuests) || 0)), NAMED),
          ],
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: printLegend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: printAxis('Guests', showAxisLabels),
            y: { ...printAxis('Sail month', showAxisLabels), beginAtZero: undefined },
          },
        },
      }, 1400, height),
    });
  }
  return charts;
}
