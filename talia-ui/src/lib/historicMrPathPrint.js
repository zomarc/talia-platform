/**
 * Historic MR path — white A4 for PDF export.
 */

import { formatMonYear, formatDayMonYear } from './dateFormat.js';
import { PLANNING_ASSUMPTION } from './historicMrPath.js';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-GB');
};

const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rate = n > 1 ? n / 100 : n;
  return `${Math.round(rate * 100)}%`;
};

const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #ffffff; color: #1c2430; font-family: Inter, "Source Sans 3", system-ui, sans-serif; font-size: 10px; line-height: 1.4; }
@page { size: A4 landscape; margin: 12mm; }
@media print {
  html, body { background: #ffffff !important; color: #1c2430 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
h1 { margin: 0 0 1mm; font-size: 16px; }
h2 { margin: 5mm 0 1.5mm; font-size: 12px; }
p, li { margin: 0 0 1.5mm; }
ul { margin: 0 0 2mm; padding-left: 5mm; }
table { width: 100%; border-collapse: collapse; margin: 0 0 2mm; }
th, td { border: 1px solid #b7c0ca; padding: 1.3mm 1.6mm; vertical-align: top; text-align: left; }
th { background: #f4f4f4; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
figure.chart img { display: block; width: 100%; max-height: 120mm; object-fit: contain; background: #ffffff; }
h2, tr, li, figure { break-inside: avoid; page-break-inside: avoid; }
`;

const chartImage = (charts, id) => {
  const image = (Array.isArray(charts) ? charts : [])
    .filter((item) => item?.id === id)
    .map((item) => (typeof item.image === 'string' && item.image.startsWith('data:image/') ? item.image : ''))
    .find(Boolean);
  if (!image) return '';
  return `<figure class="chart"><img src="${image}" alt="" /></figure>`;
};

export function buildHistoricMrPathExport({
  path = {},
  series = null,
  planning = null,
  charts = [],
  includeAssumptions = true,
} = {}) {
  const assumptions = [...(path.assumptions || []), PLANNING_ASSUMPTION];
  const months = path.months || [];
  const highlights = path.highlights || [];
  const monthRows = months.map((row) => (
    `<tr>
      <td>${esc(formatMonYear(`${row.month}-01`, row.month))}</td>
      <td class="num">${formatInt(row.groups)}</td>
      <td class="num">${formatInt(row.sourceExpectedGuests)}</td>
      <td class="num">${formatInt(row.taliaExpectedGuests)}</td>
      <td class="num">${formatInt(row.namedGuests)}</td>
      <td class="num">${formatInt(row.qualifyingGap)}</td>
      <td>${row.highlighted ? 'Highlighted' : ''}</td>
    </tr>`
  )).join('');
  const highlightRows = highlights.map((row) => (
    `<tr>
      <td>${esc(row.groupId)}</td>
      <td>${esc(row.shipCode || '')}</td>
      <td>${esc(formatDayMonYear(row.sailDateFrom, ''))}</td>
      <td>${esc(row.status)}</td>
      <td class="num">${formatInt(row.changeDays)}</td>
      <td class="num">${formatPct(row.sourceMr)}</td>
      <td class="num">${formatPct(row.taliaMr)}</td>
      <td class="num">${formatInt(row.sourceExpectedGuests)}</td>
      <td class="num">${formatInt(row.taliaExpectedGuests)}</td>
      <td class="num">${formatInt(row.namedGuests)}</td>
    </tr>`
  )).join('');
  const planningLine = planning
    ? `<p>Planning value at ${formatInt(planning.eurosPerGuest)} per guest: ${formatInt(planning.euros)} on a guest gap of ${formatInt(planning.guestGap)}.</p>`
    : '<p>No planning rate entered. The comparison stays in guests.</p>';
  const dayRows = (series?.days || []).map((row) => (
    `<tr>
      <td>${esc(formatDayMonYear(row.changedDate, ''))}</td>
      <td>${esc(row.status)}</td>
      <td class="num">${formatInt(row.requestedGuests)}</td>
      <td class="num">${formatPct(row.sourceMr)}</td>
      <td class="num">${formatInt(row.sourceExpectedGuests)}</td>
      <td class="num">${formatInt(row.taliaExpectedGuests)}</td>
      <td class="num">${formatInt(row.namedGuests)}</td>
    </tr>`
  )).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Historic MR path</title><style>${PRINT_CSS}</style></head>
<body>
  <h1>Historic MR path</h1>
  <p>Through ${esc(formatDayMonYear(path.feedThrough, '—'))}. Sailed groups ${formatInt(path.sailedGroupCount)}.</p>
  ${includeAssumptions ? `<h2>Assumptions</h2><ul>${assumptions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
  ${planningLine}
  ${chartImage(charts, 'range') ? `<h2>This range</h2>${chartImage(charts, 'range')}` : ''}
  <h2>By sail month</h2>
  ${chartImage(charts, 'months')}
  <table>
    <thead><tr><th>Month</th><th class="num">Groups</th><th class="num">Source</th><th class="num">Talia</th><th class="num">Named</th><th class="num">Highlight gap</th><th></th></tr></thead>
    <tbody>${monthRows}</tbody>
  </table>
  <h2>Groups that could have been held differently</h2>
  <table>
    <thead><tr><th>Group</th><th>Ship</th><th>Sail</th><th>Status</th><th class="num">Days</th><th class="num">Source</th><th class="num">Talia</th><th class="num">Source guests</th><th class="num">Talia guests</th><th class="num">Named</th></tr></thead>
    <tbody>${highlightRows}</tbody>
  </table>
  ${dayRows ? `<h2>Group ${esc(series.groupId)} change days</h2>${chartImage(charts, 'path')}<table><thead><tr><th>Day</th><th>Status</th><th class="num">Requested</th><th class="num">Source</th><th class="num">Source guests</th><th class="num">Talia guests</th><th class="num">Named</th></tr></thead><tbody>${dayRows}</tbody></table>` : ''}
</body></html>`;
}
