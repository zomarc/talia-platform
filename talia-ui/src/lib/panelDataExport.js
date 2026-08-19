/**
 * Framework panel data export — Export to CSV / PDF via dock-tab ⬇.
 * Used when a panel registers window.__taliaPanelDataExport.
 * Tabulator tables auto-register from tabulatorConfig when panel IDs are passed.
 */

export const PANEL_DATA_EXPORT_CHANGED_EVENT = 'talia:panel.dataExportChanged';

const notifyPanelDataExportChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PANEL_DATA_EXPORT_CHANGED_EVENT));
};

const escHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Compact unique stamp: YYYY-MM-DD_HHmmss_mmm (local clock). */
export function shortDateStamp(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${y}-${mo}-${d}_${hh}${mm}${ss}_${ms}`;
}

export function buildExportFilename(panelTitle, format) {
  const base = String(panelTitle || 'Export')
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'Export';
  const ext = format === 'pdf' ? 'pdf' : 'csv';
  return `${base}-${shortDateStamp()}.${ext}`;
}

export function escapeCsvCell(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return escapeCsvCell(JSON.stringify(value));
    } catch {
      return '';
    }
  }
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {{ field: string, title?: string }[]} columns
 * @param {Record<string, unknown>[]} rows
 */
export function rowsToCsv(columns, rows) {
  const cols = Array.isArray(columns) ? columns.filter((c) => c?.field) : [];
  const header = cols.map((c) => escapeCsvCell(c.title || c.field)).join(',');
  const body = (Array.isArray(rows) ? rows : []).map((row) => (
    cols.map((c) => escapeCsvCell(row?.[c.field])).join(',')
  ));
  return [header, ...body].join('\n');
}

export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Build export payload from a live Tabulator instance (visible/filtered rows).
 * @param {object|null} table
 * @param {string} [title]
 * @returns {{ title: string, columns: { field: string, title: string }[], rows: object[] } | null}
 */
export function payloadFromTabulator(table, title = 'Export') {
  if (!table) return null;

  const columns = (typeof table.getColumns === 'function' ? table.getColumns() : [])
    .map((col) => {
      const def = typeof col.getDefinition === 'function' ? col.getDefinition() : {};
      const field = def?.field;
      if (!field) return null;
      if (def.visible === false) return null;
      if (def.formatter === 'rowSelection') return null;
      if (def.download === false) return null;
      return {
        field: String(field),
        title: String(def.titleShort || def.title || field),
      };
    })
    .filter(Boolean);

  let rows = [];
  try {
    rows = typeof table.getData === 'function' ? (table.getData('active') || []) : [];
  } catch {
    try {
      rows = typeof table.getData === 'function' ? (table.getData() || []) : [];
    } catch {
      rows = [];
    }
  }

  return {
    title: String(title || 'Export'),
    columns,
    rows: Array.isArray(rows) ? rows : [],
  };
}

/**
 * Build export payload from plain row objects (non-Tabulator panels).
 * @param {string} title
 * @param {{ field: string, title?: string }[]} columns
 * @param {Record<string, unknown>[]} rows
 */
export function payloadFromRows(title, columns, rows) {
  const cols = (Array.isArray(columns) ? columns : [])
    .filter((c) => c?.field)
    .map((c) => ({ field: String(c.field), title: String(c.title || c.field) }));
  return {
    title: String(title || 'Export'),
    columns: cols,
    rows: Array.isArray(rows) ? rows : [],
  };
}

/**
 * @param {{ title?: string, columns: { field: string, title?: string }[], rows: object[] }} payload
 */
export function exportPanelDataCsv(payload) {
  const title = payload?.title || 'Export';
  const columns = Array.isArray(payload?.columns) ? payload.columns : [];
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!columns.length) {
    throw new Error('Nothing to export');
  }
  if (!rows.length) {
    throw new Error('Nothing to export');
  }
  const csv = rowsToCsv(columns, rows);
  downloadTextFile(buildExportFilename(title, 'csv'), `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}

/**
 * Print-iframe PDF (browser Save as PDF). No PDF library.
 * Optional `chartImage` (data URL / Chart.js toBase64Image) is rendered above the table.
 * @param {{ title?: string, subtitle?: string, columns?: { field: string, title?: string }[], rows?: object[], chartImage?: string|null }} payload
 */
export function exportPanelDataPdf(payload) {
  const title = String(payload?.title || 'Export');
  const subtitle = payload?.subtitle != null ? String(payload.subtitle) : '';
  const columns = Array.isArray(payload?.columns) ? payload.columns.filter((c) => c?.field) : [];
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const chartImage = typeof payload?.chartImage === 'string' && payload.chartImage.startsWith('data:image/')
    ? payload.chartImage
    : null;

  const hasTable = columns.length > 0 && rows.length > 0;
  if (!hasTable && !chartImage) {
    throw new Error('Nothing to export');
  }

  const exportTitle = buildExportFilename(title, 'pdf').replace(/\.pdf$/i, '');
  const generatedAt = new Date().toLocaleString();

  const thead = hasTable
    ? columns.map((c) => `<th>${escHtml(c.title || c.field)}</th>`).join('')
    : '';
  const tbody = hasTable
    ? rows.map((row) => {
      const cells = columns.map((c) => {
        const raw = row?.[c.field];
        const text = raw == null ? '' : (typeof raw === 'object' ? JSON.stringify(raw) : String(raw));
        return `<td>${escHtml(text)}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('')
    : '';

  const metaParts = [];
  if (hasTable) metaParts.push(`${rows.length} row${rows.length === 1 ? '' : 's'}`);
  if (chartImage) metaParts.push('chart');
  metaParts.push(`exported ${generatedAt}`);

  const chartBlock = chartImage
    ? `<figure class="chart"><img src="${chartImage}" alt="Chart" /></figure>`
    : '';
  const tableBlock = hasTable
    ? `<table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>`
    : '';
  const subtitleBlock = subtitle
    ? `<p class="subtitle">${escHtml(subtitle)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(exportTitle)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body {
      font-family: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
      color: #111;
      line-height: 1.35;
      margin: 0;
      padding: 8px 4px;
    }
    h1 {
      font-size: 16px;
      margin: 0 0 4px;
      font-weight: 650;
    }
    .subtitle {
      font-size: 12px;
      color: #333;
      margin: 0 0 6px;
    }
    .meta {
      font-size: 11px;
      color: #444;
      margin: 0 0 12px;
    }
    .chart {
      margin: 0 0 14px;
      padding: 0;
    }
    .chart img {
      display: block;
      width: 100%;
      max-height: 420px;
      object-fit: contain;
      background: #fff;
      border: 1px solid #ddd;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 3px 5px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: #f0f0f0;
      font-weight: 600;
    }
    tr:nth-child(even) td { background: #fafafa; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  ${subtitleBlock}
  <p class="meta">${escHtml(metaParts.join(' · '))}</p>
  ${chartBlock}
  ${tableBlock}
</body>
</html>`;

  const existing = document.getElementById('talia-panel-data-export-print');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'talia-panel-data-export-print';
  iframe.title = exportTitle;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    throw new Error('Could not prepare print frame for PDF export');
  }

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.remove();
    }, 1000);
  };

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      cleanup();
    }
  };

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  // Data-URL images decode sync; short delay still helps print layout settle.
  const delayMs = chartImage ? 120 : 80;
  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, delayMs);
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, delayMs), { once: true });
  }
}

/**
 * @param {'csv'|'pdf'} format
 * @param {() => ({ title?: string, columns?: object[], rows?: object[], chartImage?: string|null } | null | undefined)} getPayload
 */
export function runPanelDataExport(format, getPayload) {
  const payload = typeof getPayload === 'function' ? getPayload() : getPayload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Nothing to export');
  }
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const chartImage = typeof payload.chartImage === 'string' && payload.chartImage.startsWith('data:image/')
    ? payload.chartImage
    : null;

  if (format === 'pdf') {
    if ((!columns.length || !rows.length) && !chartImage) {
      throw new Error('Nothing to export');
    }
    exportPanelDataPdf({ ...payload, columns, rows, chartImage });
    return;
  }

  if (!columns.length || !rows.length) {
    throw new Error('Nothing to export');
  }
  exportPanelDataCsv({ ...payload, columns, rows });
}

/**
 * Register / unregister panel export handlers (mirror of __taliaPanelGroupActions).
 * @param {{ panelInstanceId?: string|null, panelComponentId?: string|null, getPayload: () => object|null }} opts
 * @returns {() => void} cleanup
 */
export function registerPanelDataExport({ panelInstanceId, panelComponentId, getPayload }) {
  window.__taliaPanelDataExport = window.__taliaPanelDataExport || {};
  const entry = { getPayload };
  const componentKey = panelComponentId || null;
  const instanceKey = panelInstanceId || null;
  if (componentKey) window.__taliaPanelDataExport[componentKey] = entry;
  if (instanceKey) window.__taliaPanelDataExport[instanceKey] = entry;
  notifyPanelDataExportChanged();

  return () => {
    if (!window.__taliaPanelDataExport) return;
    if (componentKey && window.__taliaPanelDataExport[componentKey] === entry) {
      delete window.__taliaPanelDataExport[componentKey];
    }
    if (instanceKey && window.__taliaPanelDataExport[instanceKey] === entry) {
      delete window.__taliaPanelDataExport[instanceKey];
    }
    notifyPanelDataExportChanged();
  };
}

export function resolvePanelDataExport(panelId, panelComponent) {
  const registered = window.__taliaPanelDataExport || {};
  return registered[panelId]
    || (panelComponent ? registered[panelComponent] : null)
    || null;
}
