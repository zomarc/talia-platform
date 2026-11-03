/**
 * Platform-wide print document chrome for panel PDF exports.
 * Logo + generated date/time masthead — inject into every print HTML document.
 */

export const TALIA_PRINT_BRAND_MARK = `<svg class="talia-print-brand" viewBox="0 0 236 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Talia">
  <g fill="none" stroke="currentColor" stroke-width="2.55" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30.5 55c-1.2-2.5-1.8-5-1.8-8 0-8-.5-16-1.2-23.5"/>
    <path d="M28.8 39.5C17.5 35.5 9 26.5 10.8 14.5c8 4 15.2 13.2 17.5 22"/>
    <path d="M29.5 37.5c11.5-4.2 19.5-13.5 17.8-25.5-7.5 3.5-14.5 12.5-17 22"/>
    <path d="M28.5 28.5C22 17 22.5 7.5 28.5 3c6 4.5 6.5 14 0 25.5z"/>
  </g>
  <text x="56" y="44" fill="currentColor" font-family="Cinzel, Times New Roman, Georgia, serif" font-size="34" font-weight="600" letter-spacing="0.14em">TALIA</text>
</svg>`;

export const TALIA_PRINT_CHROME_CSS = `
.talia-print-masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
  margin: 0 0 4mm;
  padding: 0 0 2.5mm;
  border-bottom: 1.25px solid #111111;
  color: #111111;
  break-inside: avoid;
  page-break-inside: avoid;
}
.talia-print-brand {
  display: block;
  height: 9mm;
  width: auto;
  color: #111111;
}
.talia-print-masthead__meta {
  text-align: right;
  font-size: 9px;
  line-height: 1.35;
  color: #333333;
}
.talia-print-masthead__when {
  font-weight: 650;
  color: #111111;
  font-variant-numeric: tabular-nums;
}
.talia-print-masthead__doc {
  margin-top: 0.4mm;
  color: #555555;
}
`;

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function formatPrintTimestamp(date = new Date()) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return String(date || '');
    const dateLabel = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeLabel = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateLabel} · ${timeLabel}`;
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Masthead HTML: Talia logo left, generated timestamp (+ optional doc title) right.
 */
export function buildPrintMastheadHtml({
  generatedAt = formatPrintTimestamp(),
  documentTitle = '',
} = {}) {
  return `<header class="talia-print-masthead" role="banner">
  ${TALIA_PRINT_BRAND_MARK}
  <div class="talia-print-masthead__meta">
    <div class="talia-print-masthead__when">${esc(generatedAt)}</div>
    ${documentTitle ? `<div class="talia-print-masthead__doc">${esc(documentTitle)}</div>` : ''}
  </div>
</header>`;
}

/**
 * Inject platform chrome into a full HTML print document (after <body>).
 * Idempotent if masthead already present. Ensures chrome CSS is in <head>.
 */
export function ensurePrintDocumentChrome(html, {
  generatedAt = formatPrintTimestamp(),
  documentTitle = '',
} = {}) {
  let out = String(html || '');
  if (!out) return out;
  // Skip when this document already carries platform branding (any known masthead).
  if (
    out.includes('talia-print-masthead')
    || out.includes('talia-brand-mark')
    || out.includes('class="mast"')
  ) {
    return out;
  }

  if (!out.includes('talia-print-masthead') && /<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `<style>${TALIA_PRINT_CHROME_CSS}</style></head>`);
  } else if (!/<\/head>/i.test(out) && /<html[\s>]/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head><style>${TALIA_PRINT_CHROME_CSS}</style></head>`);
  }

  const masthead = buildPrintMastheadHtml({ generatedAt, documentTitle });
  if (/<body[^>]*>/i.test(out)) {
    out = out.replace(/<body([^>]*)>/i, `<body$1>\n${masthead}\n`);
  } else {
    out = `${masthead}\n${out}`;
  }
  return out;
}
