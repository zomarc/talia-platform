/**
 * White-paper copies of the Source MR charts for PDF export.
 * Screen charts stay on the theme. These are drawn only when export runs.
 */

import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const INK = '#1c2430';
const GRID = '#e4e9ee';
const SOURCE = '#2f5f93';
const TALIA = '#3d7a52';
const NAMED = '#b26a24';

const whiteBackground = {
  id: 'sourceMrPrintBackground',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

const axis = (title, showTitle) => ({
  beginAtZero: true,
  title: { display: showTitle !== false, text: title, color: INK },
  ticks: { color: showTitle === false ? 'transparent' : INK },
  grid: { color: GRID },
});

const legend = (visible) => ({
  display: visible !== false,
  position: 'top',
  align: 'start',
  labels: {
    color: INK,
    boxWidth: 12,
    boxHeight: 12,
  },
});

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
      image: renderChart({
        type: 'bar',
        data: {
          labels: sailed.map((row) => row.label),
          datasets: [
            bar('Source expected', sailed.map((row) => Math.round(Number(row.sailedSourceExpectedGuests) || 0)), SOURCE),
            bar('Talia expected', sailed.map((row) => Math.round(Number(row.sailedTaliaExpectedGuests) || 0)), TALIA),
          ],
        },
        options: {
          plugins: { legend: legend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: { ...axis('Status', showAxisLabels), beginAtZero: undefined },
            y: axis('Expected guests', showAxisLabels),
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
      image: renderChart({
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
          plugins: { legend: legend(showLegends), tooltip: { enabled: false } },
          scales: {
            x: axis('Guests', showAxisLabels),
            y: { ...axis('Sail month', showAxisLabels), beginAtZero: undefined },
          },
        },
      }, 1400, height),
    });
  }
  return charts;
}
