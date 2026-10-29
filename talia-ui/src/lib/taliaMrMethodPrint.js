/**
 * Talia MR method — white A4 explanation for PDF export.
 */

import { TALIA_MR_ISSUES, TALIA_MR_LEAD, TALIA_MR_SOURCES } from './taliaMrMethod.js';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #ffffff; color: #1c2430; font-family: Inter, "Source Sans 3", system-ui, sans-serif; font-size: 11px; line-height: 1.45; }
@page { size: A4 portrait; margin: 14mm; }
@media print {
  html, body { background: #ffffff !important; color: #1c2430 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
h1 { margin: 0 0 2mm; font-size: 18px; font-weight: 650; }
h2 { margin: 6mm 0 2mm; font-size: 13px; font-weight: 650; }
.meta, .lead, p { margin: 0 0 2mm; }
ol, ul { margin: 0 0 2mm; padding-left: 5mm; }
li { margin: 0 0 2mm; }
table { width: 100%; border-collapse: collapse; margin: 0 0 2mm; }
th, td { border: 1px solid #b7c0ca; padding: 1.6mm 2mm; vertical-align: top; text-align: left; }
th { background: #f4f4f4; font-weight: 650; }
figure.chart { margin: 0 0 4mm; }
figure.chart img { display: block; width: 100%; max-height: 90mm; object-fit: contain; object-position: left center; background: #ffffff; }
h2, li, tr, figure { break-inside: avoid; page-break-inside: avoid; }
`;

const chartImage = (value) => (
  typeof value === 'string' && value.startsWith('data:image/') ? value : ''
);

/**
 * @param {{
 *   subtitle?: string,
 *   worked?: object|null,
 *   charts?: { id: string, title?: string, image?: string }[],
 * }} model
 */
export function buildTaliaMrMethodExport(model = {}) {
  const worked = model.worked;
  const explanation = worked?.explanation;
  const steps = explanation?.steps || [];
  const caseIssues = worked?.issues || [];
  const image = (Array.isArray(model.charts) ? model.charts : [])
    .filter((item) => item?.id === 'steps')
    .map((item) => chartImage(item.image))
    .find(Boolean) || '';
  const figure = image
    ? `<figure class="chart"><h2>Rate after each step</h2><img src="${image}" alt="Rate after each step" /></figure>`
    : '';

  const stepItems = steps.map((item) => (
    `<li><strong>${esc(item.title)}</strong> — ${esc(item.sentence)}</li>`
  )).join('');

  const sourceRows = TALIA_MR_SOURCES.map((item) => (
    `<tr><td>${esc(item.scope)}</td><td>${esc(item.name)}</td><td>${esc(item.usedFor)}</td><td>${esc(item.why)}</td></tr>`
  )).join('');

  const issueItems = [...caseIssues, ...TALIA_MR_ISSUES].map((item) => (
    `<li><strong>${esc(item.title)}</strong> — ${esc(item.text)}</li>`
  )).join('');

  const heading = worked
    ? `${esc(worked.title)} · ${esc(worked.sailing)}`
    : 'Worked example';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Talia MR</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <h1>Talia MR</h1>
  <p class="meta">${esc(model.subtitle || '')}</p>
  <p class="lead">${esc(TALIA_MR_LEAD)}</p>
  ${figure}
  <h2>${heading}</h2>
  <p>${esc(worked?.note || '')}</p>
  <h2>How the rate is calculated</h2>
  <ol>${stepItems}</ol>
  <h2>Sources</h2>
  <table>
    <thead><tr><th>Where</th><th>Source</th><th>Used for</th><th>Why</th></tr></thead>
    <tbody>${sourceRows}</tbody>
  </table>
  <h2>Issues</h2>
  <ul>${issueItems}</ul>
</body>
</html>`;
}
