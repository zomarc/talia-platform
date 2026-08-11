/**
 * Print / PDF export for Project Summary (browser Print → Save as PDF).
 * Uses the stored executive-overview HTML as-is (self-contained branded doc).
 * Document title includes a short date so "Save as PDF" suggests a new filename.
 */

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const shortDateStamp = () => {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${ymd}_${hh}${mm}`;
};

const buildExportTitle = (summary) => {
  const base = String(summary?.title || 'Project Summary')
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'Project-Summary';
  return `${base}-${shortDateStamp()}`;
};

/**
 * Ensure the HTML document <title> carries the dated export name
 * (browsers use this as the default Save as PDF filename).
 */
const withDatedTitle = (html, title) => {
  const safeTitle = esc(title);
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  }
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (match) => `${match}\n  <title>${safeTitle}</title>`);
  }
  return html;
};

/**
 * @param {{ content?: string, title?: string, version?: string, generatedAt?: string }} summary
 */
export function exportProjectSummaryPdf(summary) {
  const content = typeof summary?.content === 'string' ? summary.content.trim() : '';
  if (!content) {
    throw new Error('No project summary content to export');
  }

  const exportTitle = buildExportTitle(summary);

  const existing = document.getElementById('talia-project-summary-print');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'talia-project-summary-print';
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

  let html = /<!doctype html|<html[\s>]/i.test(content)
    ? content
    : `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(exportTitle)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #111; line-height: 1.45; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${content}</body>
</html>`;

  html = withDatedTitle(html, exportTitle);

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 80);
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 80), { once: true });
  }
}

export default exportProjectSummaryPdf;
