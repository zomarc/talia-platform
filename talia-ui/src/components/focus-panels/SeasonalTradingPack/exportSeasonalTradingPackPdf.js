/**
 * Print / PDF export for Seasonal Trading Pack (browser Print → Save as PDF).
 */

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmt = (value, metric = 'rev') => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (metric === 'rev') {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return n.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 1,
  });
};

const renderMatrix = (matrix, metric) => {
  if (!matrix?.rows?.length) return '<p>No matrix data.</p>';
  const head = [
    '<th>Metric</th>',
    ...(matrix.monthLabels || []).map((label) => `<th>${esc(label)}</th>`),
    '<th>Grand Total</th>',
  ].join('');
  const body = matrix.rows.map((row) => {
    const cells = (row.values || []).map((v) => `<td>${esc(fmt(v, metric))}</td>`).join('');
    return `<tr><th scope="row">${esc(row.label)}</th>${cells}<td>${esc(fmt(row.total, metric))}</td></tr>`;
  }).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

/**
 * @param {object} data - seasonalTradingPack payload
 * @param {{ metric?: 'rev'|'pax', fyLabel?: string, marketGroup?: string }} [options]
 */
export function exportSeasonalTradingPackPdf(data, options = {}) {
  if (!data) {
    throw new Error('No trading pack data to export');
  }
  const metric = options.metric === 'pax' ? 'pax' : 'rev';
  const matrix = metric === 'pax' ? data.paxMatrix : data.revMatrix;
  const fy = options.fyLabel || data.fyLabel || '';
  const narrative = (data.narrative?.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('');
  const trading = (data.trading?.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('');
  const methodology = (data.methodology || []).map((b) => `<li>${esc(b)}</li>`).join('');
  const markets = (data.trading?.marketMix || []).map((row) => (
    `<tr>
      <td>${esc(row.market)}</td>
      <td>${esc(fmt(row.last7Rev, 'rev'))}</td>
      <td>${esc(fmt(row.prior7Rev, 'rev'))}</td>
      <td>${row.wowPct == null ? '—' : `${row.wowPct > 0 ? '+' : ''}${row.wowPct}%`}</td>
    </tr>`
  )).join('');

  const facts = data.narrative?.facts || {};
  const last7 = data.trading?.last7 || {};

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Seasonal Trading Pack · ${esc(data.asOfDate || '')}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 11px; line-height: 1.35; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    .meta { color: #444; margin-bottom: 12px; }
    .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 10px 0 14px; }
    .kpi { border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px; }
    .kpi .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
    .kpi .value { font-size: 16px; font-weight: 700; font-family: ui-monospace, monospace; }
    .kpi .hint { font-size: 10px; color: #666; }
    ul { margin: 4px 0 8px 18px; padding: 0; }
    li { margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 10px; }
    th, td { border: 1px solid #ddd; padding: 3px 5px; text-align: right; white-space: nowrap; }
    th:first-child, td:first-child, tbody th { text-align: left; }
    thead th { background: #f2f2f2; }
    .pending { color: #777; font-style: italic; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>Seasonal Trading Pack</h1>
  <div class="meta">
    Week ending ${esc(data.asOfDate || '—')}
    · FY ${esc(fy)}
    · ${esc(data.currency || 'EUR')}
    ${options.marketGroup ? ` · Market group: ${esc(options.marketGroup)}` : ''}
    · Metric: ${metric === 'pax' ? 'Passengers' : 'Revenue (EUR)'}
  </div>

  <div class="kpis">
    <div class="kpi"><div class="label">Booked</div><div class="value">${esc(fmt(facts.bookedRevTotal, 'rev'))}</div><div class="hint">${facts.pctOfBudget != null ? `${facts.pctOfBudget}% of budget` : ''}</div></div>
    <div class="kpi"><div class="label">Budget</div><div class="value">${esc(fmt(facts.budgetRevTotal, 'rev'))}</div><div class="hint">${esc(fy)}</div></div>
    <div class="kpi"><div class="label">Held (MR)</div><div class="value">${esc(fmt(facts.heldRevTotal, 'rev'))}</div><div class="hint">${facts.reservedInclHeldPct != null ? `${facts.reservedInclHeldPct}% incl. held` : ''}</div></div>
    <div class="kpi"><div class="label">Last 7d</div><div class="value">${esc(fmt(last7.rev, 'rev'))}</div><div class="hint">${last7.pax != null ? `${Number(last7.pax).toLocaleString()} pax` : ''}</div></div>
    <div class="kpi"><div class="label">PPPD 7d</div><div class="value">${last7.pppd != null ? `€${esc(last7.pppd)}` : '—'}</div></div>
    <div class="kpi"><div class="label">FIT 7d</div><div class="value">${esc(fmt(last7.fitRev, 'rev'))}</div><div class="hint">${last7.fitPax != null ? `${Number(last7.fitPax).toLocaleString()} pax` : ''}</div></div>
  </div>

  <h2>Forward performance</h2>
  <ul>${narrative || '<li>No narrative bullets.</li>'}</ul>

  <h2>By Dep Month · ${metric === 'pax' ? 'Pax' : 'Rev (EUR)'}</h2>
  ${renderMatrix(matrix, metric)}

  <h2>Trading Performance</h2>
  <ul>${trading || '<li>No trading bullets.</li>'}</ul>

  <h2>Market mix (last 7d)</h2>
  <table>
    <thead><tr><th>Market</th><th>Last 7d Rev</th><th>Prior 7d Rev</th><th>WoW %</th></tr></thead>
    <tbody>${markets || '<tr><td colspan="4">No market mix.</td></tr>'}</tbody>
  </table>

  <h2>Methodology</h2>
  <ul>${methodology || '<li>No notes.</li>'}</ul>
</body>
</html>`;

  // Hidden iframe avoids popup blockers (window.open is blocked).
  const existing = document.getElementById('talia-seasonal-trading-pack-print');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'talia-seasonal-trading-pack-print';
  iframe.title = 'Seasonal Trading Pack print';
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

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 50);
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 50), { once: true });
  }
}

export default exportSeasonalTradingPackPdf;
