/**
 * White-paper step chart for the Talia MR PDF.
 * Drawn only when export runs. The on-screen chart stays on the theme.
 */

import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const INK = '#1c2430';
const GRID = '#e4e9ee';
const TALIA = '#3d7a52';
const SOURCE = '#2f5f93';

const whiteBackground = {
  id: 'taliaMrPrintBackground',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

export function captureTaliaMrPrintChart({
  steps = [],
  sourceRate = null,
  showLegends = true,
  showAxisLabels = true,
} = {}) {
  if (typeof document === 'undefined' || !steps.length) return null;
  const labels = steps.map((item) => item.title);
  const rates = steps.map((item) => Math.round((Number(item.rate) || 0) * 1000) / 10);
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 520;
  const sourcePct = sourceRate == null ? null : Math.round(Number(sourceRate) * 1000) / 10;
  const chart = new Chart(canvas, {
    type: 'bar',
    plugins: [whiteBackground],
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Rate after this step',
          data: rates,
          backgroundColor: TALIA,
          borderColor: TALIA,
          borderWidth: 1,
          order: 2,
        },
        ...(sourcePct == null ? [] : [{
          type: 'line',
          label: 'Source rate',
          data: labels.map(() => sourcePct),
          borderColor: SOURCE,
          backgroundColor: SOURCE,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 4],
          order: 1,
        }]),
      ],
    },
    options: {
      animation: false,
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: showLegends !== false,
          position: 'top',
          align: 'start',
          labels: { color: INK, boxWidth: 12 },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { color: showAxisLabels === false ? 'transparent' : INK },
          title: { display: showAxisLabels !== false, text: 'Step', color: INK },
          grid: { color: GRID },
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: showAxisLabels === false ? 'transparent' : INK },
          title: { display: showAxisLabels !== false, text: 'Rate (%)', color: INK },
          grid: { color: GRID },
        },
      },
    },
  });
  chart.update('none');
  const image = chart.toBase64Image('image/png', 1);
  chart.destroy();
  return {
    id: 'steps',
    title: 'Rate after each step',
    image,
  };
}
