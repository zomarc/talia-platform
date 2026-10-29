/**
 * Source MR effectiveness export — the tables on screen, as text.
 */

import { formatDayMonYear, formatMonYear } from './dateFormat.js';
import { summariseExposure } from './sourceMrExposure.js';

const STATUS_LABELS = { QT: 'Quote', OF: 'Open', BK: 'Booked' };

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

const formatWhen = (value) => formatDayMonYear(value, '—');
const formatMonth = (month) => formatMonYear(`${month}-01`, month || '—');

const COLUMNS = [
  { field: 'section', title: 'Section' },
  { field: 'item', title: 'Item' },
  { field: 'groups', title: 'Groups', numeric: true },
  { field: 'requested', title: 'Requested', numeric: true },
  { field: 'named', title: 'Named', numeric: true },
  { field: 'source', title: 'Source', numeric: true },
  { field: 'talia', title: 'Talia', numeric: true },
  { field: 'note', title: 'Note' },
];

const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #ffffff; color: #1c2430; font-family: Inter, "Source Sans 3", system-ui, sans-serif; font-size: 10px; line-height: 1.4; }
@page { size: A4 landscape; margin: 12mm; }
@media print {
  html, body { background: #ffffff !important; color: #1c2430 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
h1 { margin: 0 0 1mm; font-size: 16px; font-weight: 650; color: #1c2430; }
h2 { margin: 5mm 0 1.5mm; font-size: 12px; font-weight: 650; color: #1c2430; }
.meta, .lead { margin: 0 0 2mm; color: #3c4654; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 2mm; }
th, td { border: 1px solid #b7c0ca; padding: 1.4mm 1.6mm; vertical-align: top; text-align: left; overflow-wrap: break-word; }
th { background: #f4f4f4; font-weight: 650; }
td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr { break-inside: avoid; page-break-inside: avoid; }
h2, table, figure { break-inside: avoid; page-break-inside: avoid; }
figure.chart { margin: 0 0 4mm; }
figure.chart img { display: block; width: 100%; max-height: 150mm; object-fit: contain; object-position: left center; background: #ffffff; }
`;

const chartImage = (value) => (
  typeof value === 'string' && value.startsWith('data:image/') ? value : ''
);

const chartFigure = (charts, id) => {
  const chart = (Array.isArray(charts) ? charts : []).find((item) => item?.id === id);
  const image = chartImage(chart?.image);
  if (!image) return '';
  const title = chart.title || 'Chart';
  return `<figure class="chart"><h2>${esc(title)}</h2><img src="${image}" alt="${esc(title)}" /></figure>`;
};

const row = (section, item, fields = {}) => ({
  section,
  item,
  groups: fields.groups ?? '',
  requested: fields.requested ?? '',
  named: fields.named ?? '',
  source: fields.source ?? '',
  talia: fields.talia ?? '',
  note: fields.note ?? '',
});

const tableHtml = (rows) => {
  if (!rows.length) return '<p class="lead">No rows.</p>';
  const head = COLUMNS.filter((column) => column.field !== 'section')
    .map((column) => `<th class="${column.numeric ? 'num' : ''}">${esc(column.title)}</th>`)
    .join('');
  const body = rows.map((entry) => (
    `<tr>${COLUMNS.filter((column) => column.field !== 'section').map((column) => (
      `<td class="${column.numeric ? 'num' : ''}">${esc(entry[column.field])}</td>`
    )).join('')}</tr>`
  )).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

export function buildSourceMrReviewExport({
  review,
  statusFilter = 'QT',
  selectedGroup = null,
  history = [],
  includeDetails = true,
  charts = [],
} = {}) {
  if (!review) return null;
  const statuses = Array.isArray(review.statuses) ? review.statuses : [];
  const statusLabel = STATUS_LABELS[statusFilter] || statusFilter;
  const quote = statuses.find((entry) => entry.status === 'QT');
  const sailed = statuses.filter((entry) => entry.sailedGroups > 0);
  const open = statuses.filter((entry) => entry.openGroups > 0);
  const bands = (review.bands || []).filter((entry) => entry.status === statusFilter);
  const months = (review.months || []).filter((entry) => entry.status === statusFilter);
  const allocations = review.allocations || [];

  const exposure = summariseExposure(sailed);
  const statusExposure = summariseExposure(sailed.filter((entry) => entry.status === statusFilter));
  const exposureRows = [
    row('Exposure', 'All departed', {
      groups: formatInt(exposure.groups),
      named: formatInt(exposure.named),
      source: formatInt(exposure.source),
      talia: formatInt(exposure.talia),
      note: `source above Talia ${formatInt(exposure.sourceAboveTalia)} · source above named ${formatInt(exposure.sourceAboveNamed)}`,
    }),
    row('Exposure', statusLabel, {
      groups: formatInt(statusExposure.groups),
      named: formatInt(statusExposure.named),
      source: formatInt(statusExposure.source),
      talia: formatInt(statusExposure.talia),
      note: `source above Talia ${formatInt(statusExposure.sourceAboveTalia)} · source above named ${formatInt(statusExposure.sourceAboveNamed)}`,
    }),
  ];
  const sailedRows = sailed.map((entry) => row('Departed', entry.label, {
    groups: formatInt(entry.sailedGroups),
    requested: formatInt(entry.sailedRequestedGuests),
    named: formatInt(entry.sailedNamedGuests),
    source: formatInt(entry.sailedSourceExpectedGuests),
    talia: formatInt(entry.sailedTaliaExpectedGuests),
    note: `difference ${formatInt((entry.sailedSourceExpectedGuests || 0) - (entry.sailedTaliaExpectedGuests || 0))} · realised ${formatPct(entry.sailedRealisedRate)}`,
  }));
  const openRows = open.map((entry) => row('Still open', entry.label, {
    groups: formatInt(entry.openGroups),
    requested: formatInt(entry.openRequestedGuests),
    source: formatInt(entry.openSourceExpectedGuests),
    talia: formatInt(entry.openTaliaExpectedGuests),
  }));
  const bandRows = bands.map((entry) => row(`${statusLabel} calibration`, entry.band, {
    groups: formatInt(entry.groups),
    requested: formatInt(entry.requestedGuests),
    named: formatInt(entry.namedGuests),
    source: formatInt(entry.sourceExpectedGuests),
    talia: formatInt(entry.taliaExpectedGuests),
    note: formatPct(entry.realisedRate),
  }));
  const monthRows = months.map((entry) => row(`${statusLabel} by month`, formatMonth(entry.month), {
    requested: formatInt(entry.requestedGuests),
    named: formatInt(entry.namedGuests),
    source: formatInt(entry.sourceExpectedGuests),
    talia: formatInt(entry.taliaExpectedGuests),
  }));
  const allocationRows = allocations.map((entry) => row('Allocation rate', entry.ownerType, {
    groups: formatInt(entry.owners),
    requested: formatInt(entry.allocationRows),
    note: formatPct(entry.avgProbability),
  }));

  const detailRows = [];
  if (includeDetails && selectedGroup) {
    detailRows.push(row('Selected group', selectedGroup.groupId, {
      requested: formatInt(selectedGroup.requestedGuests),
      named: formatInt(selectedGroup.namedGuests),
      source: formatInt(selectedGroup.sourceExpectedGuests),
      talia: formatInt(selectedGroup.taliaExpectedGuests),
      note: [
        selectedGroup.shipCode,
        formatWhen(selectedGroup.sailDateFrom),
        `source ${formatPct(selectedGroup.sourceMr)}`,
        `Talia ${formatPct(selectedGroup.taliaMr)}`,
      ].filter(Boolean).join(' · '),
    }));
    (history || []).forEach((point) => {
      detailRows.push(row('History', formatWhen(point.changedDate), {
        requested: formatInt(point.requestedGuests),
        note: `${point.status || '—'} · source ${formatPct(point.probability)} · ${point.manual ? 'manual' : 'system'}`,
      }));
    });
  }

  const rows = [
    row('Snapshot', 'Extract through', { note: formatWhen(review.feedThrough) }),
    row('Snapshot', 'Groups', { groups: formatInt(review.groupCount) }),
    row('Snapshot', 'Sailed quotes', {
      requested: formatInt(quote?.sailedRequestedGuests),
      named: formatInt(quote?.sailedNamedGuests),
      source: formatInt(quote?.sailedSourceExpectedGuests),
      talia: formatInt(quote?.sailedTaliaExpectedGuests),
    }),
    ...exposureRows,
    ...sailedRows,
    ...openRows,
    ...bandRows,
    ...monthRows,
    ...allocationRows,
    ...detailRows,
  ];

  const sections = [
    ['Exposure on sailed groups', 'Source above Talia is extra guests the source rate counted. This extract has no fare, so the exposure is in guests.', exposureRows],
    ['Sailings that departed before the extract ended', 'Requested guests times the rate. Named is the outcome.', sailedRows],
    ['Still open when the extract stopped', 'These sailings had not departed. Named guests are not an outcome yet.', openRows],
    [`${statusLabel} calibration`, 'Named guests divided by requested guests, by source MR band.', bandRows],
    [`${statusLabel} by sail month`, 'The same comparison for each departure month.', monthRows],
    ['Header rate versus allocation rate', 'Average probability on inventory allocations. Groups is the owner count. Requested is the allocation count.', allocationRows],
  ];
  if (detailRows.length) {
    sections.push(['Selected group', 'Source MR on each saved version, with the current Talia MR for the group.', detailRows]);
  }

  const title = 'Source MR effectiveness';
  const subtitle = `Extract through ${formatWhen(review.feedThrough)} · ${formatInt(review.groupCount)} groups`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="meta">${esc(subtitle)}</p>
  <p class="lead">Sailed quotes: source expected ${esc(formatInt(quote?.sailedSourceExpectedGuests))}, Talia expected ${esc(formatInt(quote?.sailedTaliaExpectedGuests))}, named ${esc(formatInt(quote?.sailedNamedGuests))}.</p>
  ${chartFigure(charts, 'status')}
  ${chartFigure(charts, 'month')}
  ${sections.map(([heading, lead, sectionRows]) => (
    `<h2>${esc(heading)}</h2><p class="lead">${esc(lead)}</p>${tableHtml(sectionRows)}`
  )).join('\n')}
</body>
</html>`;

  return {
    title,
    subtitle,
    html,
    columns: COLUMNS.map(({ field, title: columnTitle }) => ({ field, title: columnTitle })),
    rows,
  };
}
