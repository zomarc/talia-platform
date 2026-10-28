/**
 * Data management export: the columns on screen, as text.
 * Raw row objects (date ranges, health) are not dumped as JSON.
 */

import { formatDayMonYear, formatSailDateRange } from './dateFormat.js';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatCount = (value) => {
  if (value == null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-GB').format(number);
};

const formatWhen = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dateLabel = formatDayMonYear(date, String(value));
  const timeLabel = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateLabel} ${timeLabel}`;
};

const formatRange = (range) => {
  if (!range || (!range.min && !range.max)) return 'N/A';
  if (range.min === range.max) return formatDayMonYear(range.min, 'N/A');
  return formatSailDateRange(range.min, range.max, 'N/A');
};

const formatDuration = (durationMs) => {
  if (durationMs == null || durationMs === '') return 'N/A';
  const ms = Number(durationMs);
  if (!Number.isFinite(ms)) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return ms < 1000 ? `${ms}ms` : `${seconds}s`;
};

const formatQuality = (health) => {
  if (!health || typeof health !== 'object') return 'Unknown';
  const label = health.qualityLabel || health.label || 'Unknown';
  const detail = String(health.gridMeta || '').replace(/^N\/A\s*\|\s*/, '').trim();
  if (!detail || detail === 'N/A') return label;
  return `${label} · ${detail}`;
};

const formatStatus = (row) => {
  if (row?._isSyncing) return `Syncing ${row._progress?.percentage || 0}%`;
  return row?.status || 'N/A';
};

const COLUMNS = [
  { field: 'tableName', title: 'Table', className: 'name' },
  { field: 'source', title: 'Source' },
  { field: 'load', title: 'Load' },
  { field: 'rows', title: 'Rows', className: 'num' },
  { field: 'range', title: 'Range' },
  { field: 'lastSync', title: 'Last sync' },
  { field: 'latestData', title: 'Latest data' },
  { field: 'quality', title: 'Quality' },
  { field: 'records', title: 'Records', className: 'num' },
  { field: 'changes', title: 'Changes', className: 'num' },
  { field: 'duration', title: 'Duration', className: 'num' },
  { field: 'status', title: 'Status' },
];

const displayRow = (row) => ({
  tableName: row?.tableName || '',
  source: row?.source || 'N/A',
  load: row?.loadMethod || 'N/A',
  rows: formatCount(row?.rowCount),
  range: formatRange(row?.dateRange),
  lastSync: formatWhen(row?.lastSync),
  latestData: formatWhen(row?.latestAvailableData),
  quality: formatQuality(row?._health),
  records: formatCount(row?.recordsProcessed),
  changes: formatCount(row?.changesDetected),
  duration: formatDuration(row?.syncDuration),
  status: formatStatus(row),
});

const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #ffffff; color: #1c2430; font-family: Inter, "Source Sans 3", system-ui, sans-serif; font-size: 9px; line-height: 1.35; }
@page { size: A4 landscape; margin: 10mm; }
@media print {
  html, body { background: #ffffff !important; color: #1c2430 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
h1 { margin: 0 0 1mm; font-size: 14px; font-weight: 650; color: #1c2430; }
.meta { margin: 0 0 4mm; color: #5c6570; font-size: 9px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #b7c0ca; padding: 1.2mm 1.4mm; vertical-align: top; text-align: left; overflow-wrap: break-word; word-break: normal; }
th { background: #f4f4f4; font-weight: 650; color: #1c2430; }
td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
td.name { font-weight: 650; }
tr { break-inside: avoid; page-break-inside: avoid; }
`;

const cellHtml = (value) => esc(value).replace(/_/g, '_<wbr>');

export function buildDataManagementExport(tables) {
  const list = Array.isArray(tables) ? tables : [];
  const rows = list.map(displayRow);
  const head = COLUMNS.map((column) => `<th class="${column.className || ''}">${esc(column.title)}</th>`).join('');
  const body = rows.map((row) => (
    `<tr>${COLUMNS.map((column) => `<td class="${column.className || ''}">${cellHtml(row[column.field])}</td>`).join('')}</tr>`
  )).join('\n');
  const title = 'Data management';
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="meta">${rows.length} table${rows.length === 1 ? '' : 's'}</p>
  <table>
    <colgroup>
      <col style="width:13%" /><col style="width:10%" /><col style="width:7%" /><col style="width:6%" />
      <col style="width:11%" /><col style="width:9%" /><col style="width:9%" /><col style="width:12%" />
      <col style="width:6%" /><col style="width:5%" /><col style="width:5%" /><col style="width:7%" />
    </colgroup>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
  return {
    title,
    html,
    columns: COLUMNS.map(({ field, title: columnTitle }) => ({ field, title: columnTitle })),
    rows,
  };
}
