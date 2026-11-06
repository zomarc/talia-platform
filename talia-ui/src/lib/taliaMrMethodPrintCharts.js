/**
 * White-paper step chart for the Talia MR PDF.
 * Drawn only when export runs. The on-screen chart stays on the theme.
 */

import {
  PRINT_INK,
  PRINT_GRID,
  PRINT_SOURCE,
  PRINT_TALIA,
  renderPrintChart,
} from './printChartCapture.js';

export function captureTaliaMrPrintChart({
  steps = [],
  sourceRate = null,
  showLegends = true,
  showAxisLabels = true,
} = {}) {
  if (typeof document === 'undefined' || !steps.length) return null;
  const labels = steps.map((item) => item.title);
  const rates = steps.map((item) => Math.round((Number(item.rate) || 0) * 1000) / 10);
  const sourcePct = sourceRate == null ? null : Math.round(Number(sourceRate) * 1000) / 10;
  const image = renderPrintChart({
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Rate after this step',
          data: rates,
          backgroundColor: PRINT_TALIA,
          borderColor: PRINT_TALIA,
          borderWidth: 1,
          order: 2,
        },
        ...(sourcePct == null ? [] : [{
          type: 'line',
          label: 'Source rate',
          data: labels.map(() => sourcePct),
          borderColor: PRINT_SOURCE,
          backgroundColor: PRINT_SOURCE,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 4],
          order: 1,
        }]),
      ],
    },
    options: {
      plugins: {
        legend: {
          display: showLegends !== false,
          position: 'top',
          align: 'start',
          labels: { color: PRINT_INK, boxWidth: 12 },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { color: showAxisLabels === false ? 'transparent' : PRINT_INK },
          title: { display: showAxisLabels !== false, text: 'Step', color: PRINT_INK },
          grid: { color: PRINT_GRID },
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: showAxisLabels === false ? 'transparent' : PRINT_INK },
          title: { display: showAxisLabels !== false, text: 'Rate (%)', color: PRINT_INK },
          grid: { color: PRINT_GRID },
        },
      },
    },
  }, 1100, 520);
  return {
    id: 'steps',
    title: 'Rate after each step',
    image,
  };
}
