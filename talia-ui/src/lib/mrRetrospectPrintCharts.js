/**
 * White-paper DTD chart for the MR Retrospect PDF.
 */

import {
  PRINT_NAMED,
  PRINT_SOURCE,
  PRINT_TALIA,
  printAxis,
  printLegend,
  renderPrintChart,
} from './printChartCapture.js';

/**
 * @param {{
 *   steps?: object[],
 *   selectedDtd?: number|null,
 *   showLegends?: boolean,
 *   showAxisLabels?: boolean,
 * }} [options]
 * @returns {{ id: string, title: string, image: string }[]}
 */
export function captureMrRetrospectCharts({
  steps = [],
  selectedDtd = null,
  showLegends = true,
  showAxisLabels = true,
} = {}) {
  if (typeof document === 'undefined' || !steps.length) return [];
  const labels = steps.map((row) => String(row.dtd));
  const pointRadius = steps.map((row) => (
    selectedDtd != null && Number(row.dtd) === Number(selectedDtd) ? 5 : 3
  ));
  const image = renderPrintChart({
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Source expected',
          data: steps.map((row) => Math.round(Number(row.sourceExpectedGuests) || 0)),
          borderColor: PRINT_SOURCE,
          backgroundColor: PRINT_SOURCE,
          tension: 0.15,
          pointRadius,
        },
        {
          label: 'Talia expected',
          data: steps.map((row) => Math.round(Number(row.taliaExpectedGuests) || 0)),
          borderColor: PRINT_TALIA,
          backgroundColor: PRINT_TALIA,
          tension: 0.15,
          pointRadius,
        },
        {
          label: 'Named (outcome)',
          data: steps.map((row) => Math.round(Number(row.outcomeNamed) || 0)),
          borderColor: PRINT_NAMED,
          backgroundColor: PRINT_NAMED,
          borderDash: [5, 4],
          tension: 0,
          pointRadius: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: printLegend(showLegends),
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          reverse: true,
          ...printAxis('Days before departure', showAxisLabels),
          beginAtZero: undefined,
        },
        y: printAxis('Guests', showAxisLabels),
      },
    },
  }, 1400, 560);

  return [{
    id: 'dtd',
    title: 'Days before departure',
    image,
  }];
}
