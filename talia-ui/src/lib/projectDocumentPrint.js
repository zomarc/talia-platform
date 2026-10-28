/**
 * Print document for the repository: the open note, or the visible list,
 * on a white page. CSV stays the index of those documents.
 */

import { parseMarkdown } from './markdownLite.js';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const assetSrc = (assets, id) => {
  if (!id || !assets) return '';
  return assets[id] || assets[String(id).toLowerCase()] || '';
};

const renderInlines = (tokens, assets) => (tokens || []).map((token) => {
  if (token.type === 'strong') return `<strong>${esc(token.text)}</strong>`;
  if (token.type === 'em') return `<em>${esc(token.text)}</em>`;
  if (token.type === 'code') return `<code>${esc(token.text)}</code>`;
  if (token.type === 'link') return `<a href="${esc(token.href)}">${esc(token.text)}</a>`;
  if (token.type === 'image') {
    const src = token.assetId ? assetSrc(assets, token.assetId) : (token.href || '');
    if (!src) return `<span class="missing">${esc(token.alt || 'Image')}</span>`;
    return `<img src="${esc(src)}" alt="${esc(token.alt || '')}" />`;
  }
  return esc(token.text);
}).join('');

const renderList = (block, assets) => {
  const tag = block.type === 'ol' ? 'ol' : 'ul';
  const items = (block.items || []).map((item) => {
    const nested = item.children ? renderList(item.children, assets) : '';
    return `<li>${renderInlines(item.inlines, assets)}${nested}</li>`;
  }).join('');
  return `<${tag}>${items}</${tag}>`;
};

/** Drop the on-screen Mermaid theme so print is black on white. */
const monochromeSvg = (svg) => String(svg || '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/\sstyle="([^"]*)"/gi, (_match, style) => {
    const kept = style
      .replace(/(?:^|;)\s*(?:fill|stroke|color|stop-color|flood-color|background(?:-color)?)\s*:[^;]*/gi, '')
      .replace(/^[\s;]+|[\s;]+$/g, '');
    return kept ? ` style="${kept}"` : '';
  })
  .replace(/\s(?:fill|stroke|color)="(?!none\b)[^"]*"/gi, '');

const renderBlocks = (blocks, assets, diagrams) => {
  let diagramIndex = 0;
  return (blocks || []).map((block) => {
    if (block.type === 'ul' || block.type === 'ol') return renderList(block, assets);
    if (block.type === 'hr') return '<hr />';
    if (block.type === 'code') {
      if (String(block.lang || '').toLowerCase() === 'mermaid') {
        const svg = diagrams[diagramIndex] || '';
        diagramIndex += 1;
        if (svg.includes('<svg')) return `<figure class="diagram">${monochromeSvg(svg)}</figure>`;
        return `<pre><code>${esc(block.text)}</code></pre>`;
      }
      const lang = block.lang ? `<span class="lang">${esc(block.lang)}</span>` : '';
      return `<pre>${lang}<code>${esc(block.text)}</code></pre>`;
    }
    if (block.type === 'table') {
      const head = (block.header || []).map((cell) => `<th>${renderInlines(cell, assets)}</th>`).join('');
      const body = (block.rows || []).map((row) => (
        `<tr>${row.map((cell) => `<td>${renderInlines(cell, assets)}</td>`).join('')}</tr>`
      )).join('');
      return `<table>${head ? `<thead><tr>${head}</tr></thead>` : ''}<tbody>${body}</tbody></table>`;
    }
    if (block.type === 'quote') return `<blockquote>${renderInlines(block.inlines, assets)}</blockquote>`;
    const tag = /^h[1-4]$/.test(block.type) ? block.type : 'p';
    return `<${tag}>${renderInlines(block.inlines, assets)}</${tag}>`;
  }).join('\n');
};

const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #ffffff; color: #1c2430; font-family: Inter, "Source Sans 3", system-ui, sans-serif; line-height: 1.45; }
@page { size: A4 portrait; margin: 16mm; }
@media print {
  html, body { background: #ffffff !important; color: #1c2430 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
article + article { break-before: page; page-break-before: always; }
h1 { margin: 0 0 2mm; font-size: 1.35rem; color: #1c2430; }
.meta { margin: 0 0 6mm; padding-bottom: 3mm; border-bottom: 1px solid #b7c0ca; color: #5c6570; font-size: 0.85rem; }
h2, h3, h4, a { color: #1c2430; }
p { margin: 0 0 3mm; }
ul, ol { margin: 0 0 3mm; padding-left: 5mm; }
table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; }
th, td { border: 1px solid #b7c0ca; padding: 1.4mm 2mm; vertical-align: top; text-align: left; }
th { background: #f4f4f4; color: #1c2430; }
pre { border: 1px solid #b7c0ca; background: #f7f7f7; padding: 3mm; white-space: pre-wrap; color: #1c2430; }
blockquote { margin: 0 0 3mm; padding-left: 4mm; border-left: 3px solid #1c2430; color: #1c2430; }
img, .diagram svg { max-width: 100%; height: auto; }
.diagram { margin: 0 0 4mm; border: 1px solid #b7c0ca; padding: 2mm; background: #ffffff; }
.diagram svg { background: #ffffff; color: #1c2430; }
.diagram svg :is(rect, polygon, circle, ellipse) { fill: #ffffff !important; stroke: #1c2430 !important; }
.diagram svg path { fill: none !important; stroke: #1c2430 !important; }
.diagram svg marker path { fill: #1c2430 !important; stroke: none !important; }
.diagram svg text, .diagram svg tspan { fill: #1c2430 !important; }
.diagram svg foreignObject, .diagram svg foreignObject * { color: #1c2430 !important; background: transparent !important; }
.missing { color: #5c6570; }
`;

const inlineText = (tokens) => (tokens || []).map((token) => token.text || '').join('').trim();

const articleHtml = (document, assets, diagrams) => {
  const links = (document?.links || []).map((link) => link.label || link.targetKind).filter(Boolean);
  const meta = [document?.referenceCode, links.join(' · ')].filter(Boolean).join(' — ');
  const blocks = parseMarkdown(document?.body || '');
  const title = String(document?.title || '').trim();
  if (blocks[0]?.type === 'h1' && inlineText(blocks[0].inlines) === title) blocks.shift();
  const body = renderBlocks(blocks, assets, diagrams || []);
  return `<article>
    <h1>${esc(document?.title || 'Document')}</h1>
    ${meta ? `<p class="meta">${esc(meta)}</p>` : ''}
    ${body}
  </article>`;
};

export function composeProjectDocumentsHtml({ documents, assets, diagramsById } = {}) {
  const list = documents || [];
  if (!list.length) throw new Error('Nothing to export');
  const pages = list.map((document) => articleHtml(
    document,
    assets,
    diagramsById?.[document.id] || [],
  )).join('\n');
  const title = list.length === 1
    ? (list[0].title || list[0].referenceCode || 'Document')
    : 'Documents';
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&amp;display=swap" />
  <style>${PRINT_CSS}</style>
</head>
<body>${pages}</body>
</html>`;
  return { html, title };
}

const markdownDocument = (document) => {
  const title = String(document?.title || document?.referenceCode || 'Document').trim();
  const body = String(document?.body || '').replace(/\r\n/g, '\n').trim();
  const heading = `# ${title}`;
  if (!body) return `${heading}\n`;
  if (body === heading || body.startsWith(`${heading}\n`)) return `${body}\n`;
  return `${heading}\n\n${body}\n`;
};

export function projectDocumentExportPayload({
  documents,
  selected,
  assets,
  diagrams = [],
} = {}) {
  const index = documents || [];
  const printed = selected ? [selected] : index;
  if (!printed.length) throw new Error('Nothing to export');
  const diagramsById = selected?.id ? { [selected.id]: diagrams } : {};
  const { html, title } = composeProjectDocumentsHtml({ documents: printed, assets, diagramsById });
  return {
    title,
    html,
    markdown: printed.map(markdownDocument).join('\n'),
    columns: [
      { field: 'referenceCode', title: 'Reference' },
      { field: 'title', title: 'Title' },
      { field: 'links', title: 'Links' },
      { field: 'body', title: 'Body' },
    ],
    rows: index.map((document) => ({
      referenceCode: document.referenceCode || '',
      title: document.title || '',
      links: (document.links || []).map((link) => link.label || link.targetKind).filter(Boolean).join(' · '),
      body: document.body || '',
    })),
  };
}
