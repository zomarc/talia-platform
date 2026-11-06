/**
 * MR Retrospect — white A4/landscape report for PDF export.
 */

import { formatDayMonYear } from './dateFormat.js';
import { formatMrPctPrecise } from '../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';
import { pickStep } from './mrRetrospect.js';

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
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return formatMrPctPrecise(value);
};

const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #ffffff; color: #1c2430; font-family: Inter, "Source Sans 3", system-ui, sans-serif; font-size: 10px; line-height: 1.4; }
@page { size: A4 landscape; margin: 12mm; }
@media print {
  html, body { background: #ffffff !important; color: #1c2430 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
h1 { margin: 0 0 1mm; font-size: 16px; font-weight: 650; }
h2 { margin: 5mm 0 1.5mm; font-size: 12px; font-weight: 650; }
.meta, .lead, p { margin: 0 0 1.5mm; color: #3c4654; }
ul { margin: 0 0 2mm; padding-left: 5mm; }
li { margin: 0 0 1mm; }
table { width: 100%; border-collapse: collapse; margin: 0 0 2mm; }
th, td { border: 1px solid #b7c0ca; padding: 1.3mm 1.6mm; vertical-align: top; text-align: left; }
th { background: #f4f4f4; font-weight: 650; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
dl.snapshot { display: grid; grid-template-columns: auto 1fr; gap: 0.6mm 3mm; margin: 0 0 3mm; }
dl.snapshot dt { color: #5a6572; }
dl.snapshot dd { margin: 0; font-variant-numeric: tabular-nums; }
figure.chart { margin: 0 0 4mm; }
figure.chart img { display: block; width: 100%; max-height: 120mm; object-fit: contain; object-position: left center; background: #ffffff; }
h2, tr, li, figure, dl { break-inside: avoid; page-break-inside: avoid; }
`;

const chartFigure = (charts, id) => {
  const chart = (Array.isArray(charts) ? charts : []).find((item) => item?.id === id);
  const image = typeof chart?.image === 'string' && chart.image.startsWith('data:image/')
    ? chart.image
    : '';
  if (!image) return '';
  const title = chart.title || 'Chart';
  return `<figure class="chart"><h2>${esc(title)}</h2><img src="${image}" alt="${esc(title)}" /></figure>`;
};

/**
 * @param {{
 *   path?: object|null,
 *   retrospect?: object|null,
 *   annotations?: object[],
 *   charts?: { id: string, title?: string, image?: string }[],
 *   scopeMode?: string,
 *   selectedGroupId?: string|null,
 *   selectedDtd?: number|null,
 *   shipLabel?: string,
 *   dateFrom?: string,
 *   dateTo?: string,
 *   criteriaSummary?: string,
 * }} model
 */
export function buildMrRetrospectExport(model = {}) {
  const path = model.path || {};
  const retrospect = model.retrospect || null;
  const steps = retrospect?.steps || [];
  const selectedDtd = model.selectedDtd;
  const step = pickStep(retrospect, selectedDtd);
  const scopeMode = model.scopeMode === 'sail' ? 'sail' : 'group';
  const scopeLabel = scopeMode === 'sail'
    ? `All groups in window (${formatInt(retrospect?.groupCount || 0)} groups)`
    : `One group${model.selectedGroupId ? ` · ${model.selectedGroupId}` : ''}`;
  const ship = model.shipLabel || 'All';
  const dates = [model.dateFrom, model.dateTo].filter(Boolean).join(' → ') || 'Full sailed history';
  const assumptions = [
    ...(retrospect?.assumptions || []),
    ...(path.assumptions || []),
  ].filter(Boolean);
  const uniqueAssumptions = [...new Set(assumptions)];

  const stepRows = steps.map((row) => (
    `<tr>
      <td class="num">${esc(row.dtd)}</td>
      <td>${esc(formatDayMonYear(row.asOfDate, row.asOfDate || '—'))}</td>
      <td class="num">${formatInt(row.requestedGuests)}</td>
      <td class="num">${formatPct(row.sourceMr)}</td>
      <td class="num">${formatPct(row.taliaMr)}</td>
      <td class="num">${formatInt(row.sourceExpectedGuests)}</td>
      <td class="num">${formatInt(row.taliaExpectedGuests)}</td>
      <td class="num">${formatInt(row.outcomeNamed)}</td>
      <td class="num">${formatInt(row.taliaGap)}</td>
    </tr>`
  )).join('');

  const annotationItems = (Array.isArray(model.annotations) ? model.annotations : [])
    .map((mark) => {
      const kind = mark.kind === 'named' ? 'Named' : 'Source';
      const when = mark.changedDate
        ? formatDayMonYear(mark.changedDate, mark.changedDate)
        : '—';
      return `<li><strong>${esc(kind)}</strong> · ${esc(mark.dtd)} DTD · ${esc(when)} — ${esc(mark.label || '')}</li>`;
    })
    .join('');

  const snapshotBlock = step
    ? `<h2>Checkpoint · ${esc(selectedDtd)} DTD</h2>
  <dl class="snapshot">
    <dt>As of</dt><dd>${esc(formatDayMonYear(step.asOfDate, step.asOfDate || '—'))}</dd>
    <dt>Hold used</dt><dd>${step.holdDate
      ? `${esc(formatDayMonYear(step.holdDate, step.holdDate))} (${esc(step.holdDtd)} DTD)`
      : 'Mixed holds'}</dd>
    <dt>Status</dt><dd>${esc(step.status || '—')}</dd>
    <dt>Requested</dt><dd>${formatInt(step.requestedGuests)}</dd>
    <dt>Source MR</dt><dd>${formatPct(step.sourceMr)}</dd>
    <dt>Talia MR</dt><dd>${formatPct(step.taliaMr)}</dd>
    <dt>Source expected</dt><dd>${formatInt(step.sourceExpectedGuests)}</dd>
    <dt>Talia expected</dt><dd>${formatInt(step.taliaExpectedGuests)}</dd>
    <dt>Named outcome</dt><dd>${formatInt(step.outcomeNamed)}</dd>
    <dt>Talia − named</dt><dd>${formatInt(step.taliaGap)}</dd>
  </dl>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>MR Retrospect</title><style>${PRINT_CSS}</style></head>
<body>
  <h1>MR Retrospect</h1>
  <p class="lead">What Talia MR would have suggested at each days-before-departure step, versus the named outcome.</p>
  <p class="meta">${esc(scopeLabel)} · Ship ${esc(ship)} · ${esc(dates)}</p>
  ${model.criteriaSummary ? `<p class="meta">Header ${esc(model.criteriaSummary)}</p>` : ''}
  <p class="meta">Feed through ${esc(formatDayMonYear(path.feedThrough, path.feedThrough || '—'))}.</p>
  ${snapshotBlock}
  ${chartFigure(model.charts, 'dtd')}
  <h2>DTD path</h2>
  <table>
    <thead>
      <tr>
        <th class="num">DTD</th>
        <th>As of</th>
        <th class="num">Requested</th>
        <th class="num">Source MR</th>
        <th class="num">Talia MR</th>
        <th class="num">Source expected</th>
        <th class="num">Talia expected</th>
        <th class="num">Named</th>
        <th class="num">Talia gap</th>
      </tr>
    </thead>
    <tbody>${stepRows || '<tr><td colspan="9">No checkpoints.</td></tr>'}</tbody>
  </table>
  ${annotationItems ? `<h2>Annotations</h2><ul>${annotationItems}</ul>` : ''}
  ${uniqueAssumptions.length ? `<h2>Assumptions</h2><ul>${uniqueAssumptions.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
</body></html>`;
}

/** Flat rows for CSV / Markdown dock export. */
export function buildMrRetrospectExportRows(retrospect) {
  return (retrospect?.steps || []).map((row) => ({
    dtd: row.dtd,
    asOf: row.asOfDate || '',
    requested: row.requestedGuests,
    sourceMr: row.sourceMr,
    taliaMr: row.taliaMr,
    sourceExpected: row.sourceExpectedGuests,
    taliaExpected: row.taliaExpectedGuests,
    named: row.outcomeNamed,
    taliaGap: row.taliaGap,
  }));
}

export const MR_RETROSPECT_EXPORT_COLUMNS = [
  { field: 'dtd', title: 'DTD' },
  { field: 'asOf', title: 'As of' },
  { field: 'requested', title: 'Requested' },
  { field: 'sourceMr', title: 'Source MR' },
  { field: 'taliaMr', title: 'Talia MR' },
  { field: 'sourceExpected', title: 'Source expected' },
  { field: 'taliaExpected', title: 'Talia expected' },
  { field: 'named', title: 'Named outcome' },
  { field: 'taliaGap', title: 'Talia gap' },
];
