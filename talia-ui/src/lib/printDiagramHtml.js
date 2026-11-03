/**
 * Framework print-diagram primitives — HTML/CSS only.
 *
 * Rule: interactive UIs may use Mermaid/Canvas/etc. Print/PDF must use these
 * (or equivalent HTML) so Chrome print always shows boxes + text. Never embed
 * Mermaid SVG in print documents (foreignObject / theme styles → blank nodes).
 */

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function printStatusLabel(state) {
  if (state === 'blocked') return 'BLOCKED';
  if (state === 'warn') return 'ATTN';
  if (state === 'ok') return 'OK';
  if (state === 'unknown') return 'UNKNOWN';
  if (state === 'policy') return 'POLICY';
  return '';
}

/**
 * @param {{ title?: string, blurb?: string, address?: string, state?: string, badge?: string }} node
 */
export function printDiagramCard(node = {}) {
  const state = node.state || 'static';
  const status = printStatusLabel(state);
  const showStatus = Boolean(status && state !== 'static');
  const classes = [
    'pd-card',
    `pd-card--${esc(state)}`,
    node.compact ? 'pd-card--compact' : '',
  ].filter(Boolean).join(' ');

  return `<article class="${classes}">
    <div class="pd-card__title">${esc(node.title || '')}</div>
    ${node.blurb ? `<div class="pd-card__blurb">${esc(node.blurb)}</div>` : ''}
    ${node.address ? `<div class="pd-card__addr">${esc(node.address)}</div>` : ''}
    <div class="pd-card__meta">
      ${node.badge ? `<span class="pd-card__badge">${esc(node.badge)}</span>` : ''}
      ${showStatus ? `<span class="pd-card__status pd-card__status--${esc(state)}">${esc(status)}</span>` : ''}
    </div>
  </article>`;
}

export function printDiagramBand(title, cardsHtml, { note = '' } = {}) {
  return `<section class="pd-band">
    <h3 class="pd-band__title">${esc(title)}</h3>
    ${note ? `<p class="pd-band__note">${esc(note)}</p>` : ''}
    <div class="pd-band__cards">${cardsHtml}</div>
  </section>`;
}

export function printDiagramVArrow(label = '', blocked = false) {
  return `<div class="pd-varrow${blocked ? ' pd-varrow--blocked' : ''}" aria-hidden="true">
    <span class="pd-varrow__line"></span>
    ${label ? `<span class="pd-varrow__label">${esc(label)}</span>` : ''}
    <span class="pd-varrow__tip">▼</span>
  </div>`;
}

export function printDiagramHFlow(nodes = []) {
  return `<div class="pd-hflow">${nodes.map((node, index) => (
    `${index > 0 ? '<span class="pd-hflow__arrow">→</span>' : ''}${printDiagramCard(node)}`
  )).join('')}</div>`;
}

/** Shared CSS for print diagrams — include once in the print document <style>. */
export const PRINT_DIAGRAM_CSS = `
.pd-band {
  border: 1px solid #111111;
  padding: 2mm 2.5mm;
  margin: 0;
  background: #ffffff;
}
.pd-band__title {
  margin: 0 0 1.2mm;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #111111;
}
.pd-band__note {
  margin: 0 0 1.5mm;
  font-size: 8px;
  color: #555555;
}
.pd-band__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm;
  align-items: stretch;
}
.pd-card {
  flex: 1 1 30mm;
  min-width: 28mm;
  max-width: 70mm;
  border: 1.25px solid #111111;
  padding: 1.8mm 2mm;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.7mm;
  break-inside: avoid;
  page-break-inside: avoid;
}
.pd-card--compact { max-width: 42mm; flex-basis: 24mm; }
.pd-card--blocked { background: #e8e8e8; border-width: 2px; }
.pd-card--warn { border-style: dashed; }
.pd-card__title {
  font-weight: 700;
  font-size: 10.5px;
  color: #111111;
  line-height: 1.25;
}
.pd-card__blurb {
  font-size: 8.5px;
  color: #333333;
  line-height: 1.3;
}
.pd-card__addr {
  font-size: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #111111;
  word-break: break-all;
}
.pd-card__meta {
  margin-top: auto;
  padding-top: 1mm;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5mm 3mm;
  align-items: center;
}
.pd-card__badge,
.pd-card__status {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #111111;
}
.pd-card__status--blocked { text-decoration: underline; }
.pd-varrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4mm;
  margin: 1.2mm 0;
  color: #111111;
}
.pd-varrow__line {
  width: 0;
  height: 2.5mm;
  border-left: 1.25px solid #111111;
}
.pd-varrow__label {
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.pd-varrow__tip { font-size: 8px; line-height: 1; }
.pd-varrow--blocked .pd-varrow__line {
  border-left-style: dashed;
  border-left-width: 2px;
}
.pd-hflow {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 2mm;
  margin: 0 0 2mm;
}
.pd-hflow__arrow {
  align-self: center;
  font-size: 12px;
  color: #111111;
  padding: 0 0.5mm;
}
.pd-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5mm;
}
`;
