/**
 * Clean HTML / row payload for Data Lineage PDF + CSV export.
 */

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Flatten the current selection detail into CSV/MD rows.
 */
export function buildDataLineageExportRows({ detail, listRows = [], orientation = 'tables' } = {}) {
  const rows = [];

  (listRows || []).forEach((row) => {
    if (orientation === 'components') {
      rows.push({
        section: 'Catalog',
        item: row.title || row.componentKey,
        synapse: '',
        talia: row.tableNames || '',
        field: '',
        provenance: `${row.usageCount || 0} refreshes · ${row.rolesLabel || '—'}`,
        lastOpen: formatWhen(row.lastAt),
      });
      return;
    }
    if (orientation === 'fields') {
      rows.push({
        section: 'Catalog',
        item: row.label || row.field || '',
        synapse: row.sourceLabel || '',
        talia: row.tableNames || '',
        field: row.field || '',
        provenance: `${row.componentCount || 0} components · ${row.usageCount || 0} refreshes · ${row.topComponents || ''}`,
        lastOpen: formatWhen(row.lastAt),
      });
      return;
    }
    rows.push({
      section: 'Catalog',
      item: row.taliaTable || '',
      synapse: row.synapseSource || row.sourceLabel || '',
      talia: row.taliaTable || '',
      field: '',
      provenance: row.topConsumers || '',
      lastOpen: formatWhen(row.lastAt),
    });
  });

  if (!detail) return rows;

  (detail.summary || []).forEach((item) => {
    rows.push({
      section: 'Summary',
      item: detail.title,
      synapse: '',
      talia: '',
      field: item.label,
      provenance: item.value,
      lastOpen: '',
    });
  });

  (detail.lineage || detail.tables || []).forEach((edge) => {
    rows.push({
      section: 'Lineage',
      item: detail.title,
      synapse: edge.sourceLabel || '—',
      talia: edge.taliaTable || '',
      field: '',
      provenance: `${edge.sourceLabel || '—'} → ${edge.taliaTable || ''}`,
      lastOpen: '',
    });
  });

  (detail.columnGroups || []).forEach((group) => {
    (group.columns || []).forEach((col) => {
      rows.push({
        section: 'Columns',
        item: detail.title,
        synapse: group.synapseSource || '',
        talia: group.table,
        field: col.name,
        provenance: col.provenance || '',
        lastOpen: '',
      });
    });
  });

  (detail.unmappedColumns || []).forEach((col) => {
    rows.push({
      section: 'Presenter',
      item: detail.title,
      synapse: '',
      talia: '',
      field: col.name,
      provenance: col.provenance || 'Presenter / computed',
      lastOpen: '',
    });
  });

  (detail.consumers || []).forEach((consumer) => {
    rows.push({
      section: 'Consumers',
      item: detail.title,
      synapse: '',
      talia: '',
      field: consumer.title || consumer.componentKey,
      provenance: `${consumer.openCount || 0} opens`,
      lastOpen: '',
    });
  });

  return rows;
}

export const DATA_LINEAGE_EXPORT_COLUMNS = [
  { field: 'section', title: 'Section' },
  { field: 'item', title: 'Selection' },
  { field: 'synapse', title: 'Synapse source' },
  { field: 'talia', title: 'Talia table' },
  { field: 'field', title: 'Field' },
  { field: 'provenance', title: 'Provenance' },
  { field: 'lastOpen', title: 'Last open' },
];

/**
 * Printable HTML mirroring the on-screen detail card + compact catalog summary.
 * @param {string} [diagramSvg] Inline Mermaid SVG for the Synapse → Talia → Component graph.
 */
export function buildDataLineageExportHtml({
  detail = null,
  listRows = [],
  orientation = 'tables',
  scopeLabel = '',
  filtersLabel = '',
  diagramSvg = '',
} = {}) {
  const catalogRows = (listRows || []).slice(0, 200).map((row) => {
    if (orientation === 'components') {
      return `<tr>
        <td>${esc(row.title)}</td>
        <td>${esc(row.category)}</td>
        <td>${esc(row.tableNames)}</td>
        <td class="num">${esc(row.usageCount || 0)}</td>
        <td>${esc(formatWhen(row.lastAt))}</td>
      </tr>`;
    }
    if (orientation === 'fields') {
      return `<tr>
        <td>${esc(row.field)}</td>
        <td>${esc(row.label || '—')}</td>
        <td>${esc(row.sourceLabel || '—')}</td>
        <td class="num">${esc(row.componentCount || 0)}</td>
        <td>${esc(row.topComponents || '—')}</td>
        <td class="num">${esc(row.usageCount || 0)}</td>
        <td>${esc(formatWhen(row.lastAt))}</td>
      </tr>`;
    }
    return `<tr>
      <td>${esc(row.synapseSource || row.sourceLabel || '—')}</td>
      <td>${esc(row.taliaTable)}</td>
      <td class="num">${esc(row.consumerCount || 0)}</td>
      <td>${esc(row.topConsumers || '—')}</td>
      <td class="num">${esc(row.usageCount || 0)}</td>
      <td>${esc(formatWhen(row.lastAt))}</td>
    </tr>`;
  }).join('');

  const catalogHead = orientation === 'components'
    ? '<tr><th>Component</th><th>Category</th><th>Tables</th><th>Refreshes</th><th>Last</th></tr>'
    : orientation === 'fields'
      ? '<tr><th>Field</th><th>Label</th><th>Source</th><th>#</th><th>Components</th><th>Refreshes</th><th>Last</th></tr>'
      : '<tr><th>Synapse</th><th>Talia</th><th>#</th><th>Used by</th><th>Refreshes</th><th>Last</th></tr>';

  const summaryHtml = (detail?.summary || []).map((item) => (
    `<div class="metric"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`
  )).join('');

  const lineageHtml = (detail?.lineage || detail?.tables || []).map((edge) => (
    `<li><code>${esc(edge.sourceLabel || '—')}</code> → <code>${esc(edge.taliaTable)}</code></li>`
  )).join('');

  const groupsHtml = (detail?.columnGroups || []).map((group) => {
    const rows = (group.columns || []).map((col) => (
      `<tr><td><code>${esc(col.name)}</code>${col.label ? `<div class="muted">${esc(col.label)}</div>` : ''}</td><td>${esc(col.provenance)}</td></tr>`
    )).join('');
    return `<section class="group">
      <h3><code>${esc(group.table)}</code>${group.synapseSource ? ` <span class="muted">← ${esc(group.synapseSource)}</span>` : ''}</h3>
      <table><thead><tr><th>Field</th><th>Provenance</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
  }).join('');

  const unmappedRows = (detail?.unmappedColumns || []).map((col) => (
    `<tr><td><code>${esc(col.name)}</code></td><td>${esc(col.provenance)}</td></tr>`
  )).join('');

  const notesHtml = (detail?.notes || []).map((line) => `<li>${esc(line)}</li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(detail?.title ? `Data Lineage — ${detail.title}` : 'Data Lineage')}</title>
  <style>
    body { font-family: "IBM Plex Sans", Helvetica, Arial, sans-serif; color: #111; font-size: 11px; line-height: 1.35; margin: 12mm; }
    h1 { font-size: 18px; margin: 0 0 2mm; }
    h2 { font-size: 13px; margin: 5mm 0 2mm; border-bottom: 1px solid #ccc; padding-bottom: 1mm; }
    h3 { font-size: 11px; margin: 0 0 1.5mm; }
    .meta { color: #444; margin: 0 0 4mm; }
    .metrics { display: flex; gap: 3mm; flex-wrap: wrap; margin: 0 0 3mm; }
    .metric { border: 1px solid #ccc; padding: 1.5mm 2.5mm; min-width: 28mm; }
    .metric span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
    .metric strong { font-size: 12px; }
    .muted { color: #666; font-size: 10px; }
    ul { margin: 0 0 3mm; padding-left: 4mm; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 3mm; }
    th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 1.2mm 1.5mm; vertical-align: top; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; color: #555; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
    .group { break-inside: avoid; page-break-inside: avoid; border: 1px solid #e2e2e2; padding: 2mm; }
    code { font-family: "IBM Plex Mono", Menlo, Consolas, monospace; font-size: 10px; }
    .diagram {
      margin: 0 0 4mm;
      padding: 3mm;
      border: 1px solid #d5dee4;
      border-radius: 3mm;
      background: #f8fafb;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .diagram svg {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
    }
    @media print {
      body { margin: 8mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .groups { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <h1>Data Lineage${detail?.title ? ` — ${esc(detail.title)}` : ''}</h1>
  <p class="meta">${esc(filtersLabel || scopeLabel || 'Current view')}${detail?.subtitle ? ` · ${esc(detail.subtitle)}` : ''}</p>

  ${diagramSvg ? `
    <h2>Source lineage diagram</h2>
    <p class="muted">Synapse → Talia → Component (pipeline lineage, not FK relationships).</p>
    <p class="muted">Edges: solid = some usage · thick teal = high refreshes · dashed muted = zero usage in window · dashed gold = advisory logical link (not a Synapse FK).</p>
    <div class="diagram">${diagramSvg}</div>
  ` : ''}

  ${detail ? `
    <h2>Selection</h2>
    ${summaryHtml ? `<div class="metrics">${summaryHtml}</div>` : ''}
    ${notesHtml ? `<ul>${notesHtml}</ul>` : ''}
    <h2>Lineage (Synapse → Talia)</h2>
    ${lineageHtml ? `<ul>${lineageHtml}</ul>` : '<p class="muted">No lineage edges.</p>'}
    <h2>Columns by table</h2>
    ${groupsHtml ? `<div class="groups">${groupsHtml}</div>` : '<p class="muted">No attributed columns.</p>'}
    ${unmappedRows ? `<h2>Presenter / computed</h2><table><thead><tr><th>Field</th><th>Provenance</th></tr></thead><tbody>${unmappedRows}</tbody></table>` : ''}
  ` : ''}

  <h2>Catalog (${orientation === 'components' ? 'components' : orientation === 'fields' ? 'fields' : 'tables'})</h2>
  <table>
    <thead>${catalogHead}</thead>
    <tbody>${catalogRows || '<tr><td colspan="6">No rows in current filter.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}
