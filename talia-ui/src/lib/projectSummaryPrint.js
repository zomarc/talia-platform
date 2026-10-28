/**
 * Print document for Project Summary: the written executive summary
 * and the high-level architecture diagram.
 */

import { formatPlanDate } from './projectPlan.js';
import { ARCHITECTURE_BANDS, briefHeadline } from './projectSummaryBrief.js';
import {
  RISK_BAND_LABELS,
  RISK_CATEGORY_LABELS,
  RISK_IMPACT_LABELS,
  RISK_LIKELIHOOD_LABELS,
  RISK_PROXIMITY_LABELS,
  RISK_RESPONSE_LABELS,
  RISK_SCALE,
  RISK_STATUS_LABELS,
  riskBand,
} from './riskRegister.js';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const shortDateStamp = (date) => {
  const ymd = date.toISOString().slice(0, 10);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${ymd}_${hh}${mm}`;
};

export const buildExportTitle = (summary, exportedAt = new Date()) => {
  const base = String(summary?.title || 'Project Summary')
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'Project-Summary';
  return `${base}-${shortDateStamp(exportedAt)}`;
};

const formatPublished = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

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

const BRIEFING_CSS = `
.page-brief h2 { margin: 0 0 2mm; font-size: 0.95rem; }
.brief-kicker { margin-bottom: 3mm; }
.brief-kicker__row { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
.brief-kicker__row span, .brief-note { color: var(--text-muted, rgba(232,221,208,0.58)); font-size: 0.72rem; }
.brief-note { margin: 3mm 0 0; }
.brief-snapshot { display: flex; gap: 8mm; list-style: none; margin: 0 0 4mm; padding: 0; }
.brief-snapshot li { min-width: 0; }
.brief-snapshot span { display: block; font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted, rgba(232,221,208,0.58)); }
.brief-snapshot strong { display: block; font-size: 1rem; color: #1c2430; font-weight: 700; }
.brief-snapshot em { font-style: normal; font-size: 0.72rem; color: var(--text-secondary, rgba(232,221,208,0.82)); }
.brief-split { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 7mm; align-items: start; }
.brief-plan { width: 100%; border-collapse: collapse; table-layout: fixed; }
.brief-plan th { text-align: left; font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted, rgba(232,221,208,0.58)); font-weight: 650; padding: 0 0.4rem 0.3rem 0; }
.brief-plan td { padding: 0.28rem 0.4rem 0.28rem 0; vertical-align: top; border-top: 1px solid var(--border, rgba(232,213,184,0.14)); font-size: 0.78rem; color: var(--text-secondary, rgba(232,221,208,0.82)); }
.brief-plan td:first-child { font-weight: 700; color: #1c2430; }
.brief-plan .when { white-space: nowrap; }
.brief-plan tr.is-current td:first-child { border-left: 3px solid var(--accent, #0d9488); padding-left: 0.4rem; }
.brief-arch { break-inside: avoid; margin: 0 0 3.5mm; }
.brief-arch h3 { margin: 0 0 1.5mm; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); font-weight: 650; }
.brief-arch__row { display: flex; flex-wrap: wrap; gap: 2mm; }
.brief-arch__item, .brief-arch__group { flex: 1 1 32mm; min-width: 28mm; border: 1px solid var(--border); border-radius: 4px; padding: 1.6mm 2.2mm; background: var(--card); }
.brief-arch__item strong, .brief-arch__group strong, .brief-arch__item em, .brief-arch__group em { display: block; }
.brief-arch__item em, .brief-arch__group em { font-style: normal; font-size: 0.68rem; color: var(--text-muted); }
.brief-arch__group div { display: flex; flex-wrap: wrap; gap: 1mm; margin-top: 1mm; }
.brief-arch__group span { font-size: 0.64rem; border: 1px solid var(--border); border-radius: 3px; padding: 0.4mm 1.2mm; }
.brief-arch--planned { border: 1px dashed var(--border); border-radius: 4px; padding: 2mm; }
.brief-arch--talia .brief-arch__item, .brief-arch--talia .brief-arch__group { border-color: var(--accent); }
.brief-timeline { display: flex; gap: 3mm; align-items: stretch; }
.brief-span { min-width: 0; border: 1px solid #b7c0ca; border-radius: 4px; padding: 2mm 2.5mm; background: #fff; color: #1c2430; }
.brief-span strong, .brief-span em, .brief-span span { display: block; }
.brief-span em { font-style: normal; font-size: 0.72rem; color: var(--text-muted); }
.brief-span.is-current { border-left: 3px solid var(--accent, #5b9bd5); }
.brief-span.is-quiet { opacity: 0.7; }
.brief-work { list-style: none; margin: 0; padding: 0; }
.brief-work li { padding: 1.2mm 0; border-top: 1px solid var(--border); font-size: 0.78rem; }
.brief-work strong { margin-right: 0.4rem; }
.brief-heat { width: 100%; border-collapse: separate; border-spacing: 3px; }
.brief-heat th { font-size: 0.6rem; font-weight: 650; color: var(--text-muted, rgba(232,221,208,0.58)); text-align: center; padding: 0 1px; }
.brief-heat th.axis { text-align: right; padding-right: 4px; white-space: nowrap; }
.brief-heat td { height: auto; min-height: 14mm; padding: 1.2mm; vertical-align: top; text-align: center; font-size: 0.62rem; font-weight: 700; color: #fff; border: 1px solid #9aa3ad; border-radius: 3px; line-height: 1.15; }
.brief-heat td span { display: block; }
.brief-heat td.band-low, .brief-legend i.band-low { background: #5c564e; }
.brief-heat td.band-medium, .brief-legend i.band-medium { background: #d4a017; }
.brief-heat td.band-medium { color: #1c1404; }
.brief-heat td.band-high, .brief-legend i.band-high { background: #d4537e; }
.brief-heat td.band-critical, .brief-legend i.band-critical { background: #c43b3b; }
.brief-legend { display: flex; gap: 0.85rem; list-style: none; margin: 0.4rem 0 0; padding: 0; font-size: 0.66rem; color: var(--text-secondary, rgba(232,221,208,0.82)); }
.brief-legend i { display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 2px; margin-right: 0.28rem; vertical-align: -1px; }
.brief-decisions { list-style: none; margin: 0; padding: 0; }
.brief-decisions li { break-inside: avoid; padding: 1.2mm 0; border-top: 1px solid var(--border, rgba(232,213,184,0.14)); font-size: 0.78rem; color: var(--text-secondary, rgba(232,221,208,0.82)); }
.brief-decisions strong { color: #1c2430; margin-right: 0.35rem; }
.brief-decisions p { margin: 0.4mm 0 0; }
@media print {
  .doc-page.page-brief, .doc-page.page-brief * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

const PRINT_THEME = {
  bg: '#ffffff',
  fg: '#1c2430',
  muted: '#5c6570',
  accent: '#1f4e79',
  border: '#b7c0ca',
  card: '#ffffff',
  font: 'Inter, "Source Sans 3", "IBM Plex Sans", system-ui, sans-serif',
};

const safeColor = (value, fallback) => {
  const text = String(value || '').trim();
  if (!text || text.length > 80 || !/^[#a-zA-Z0-9(),.%\s.+/-]+$/.test(text)) return fallback;
  return text;
};

const safeFont = (value, fallback) => {
  const text = String(value || '').trim();
  if (!text || text.length > 180 || !/^[a-zA-Z0-9(),.%\s.+"'/_-]+$/.test(text)) return fallback;
  return text;
};

export const summaryThemeStyle = (theme) => {
  const colors = Object.fromEntries(Object.entries(PRINT_THEME).map(([key, fallback]) => [
    key,
    key === 'font' ? safeFont(theme?.[key], fallback) : safeColor(theme?.[key], fallback),
  ]));
  return `:root {
  --bg-solid: ${colors.bg};
  --accent: ${colors.accent};
  --sun: ${colors.accent};
  --text: ${colors.fg};
  --text-secondary: ${colors.fg};
  --text-muted: ${colors.muted};
  --border: ${colors.border};
  --card: ${colors.card};
  --font: ${colors.font};
}`;
};

const STANDALONE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); color: #1c2430; background: #ffffff; line-height: 1.45; }
h2 { font-size: 1.05rem; font-weight: 650; color: #1f4e79; margin: 0 0 0.75rem; }
.hero__eyebrow { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #1f4e79; margin: 0 0 0.25rem; }
@page { size: A4 landscape; margin: 14mm; }
@media print {
  html, body { background: #ffffff !important; color: #1c2430 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.mast { display: flex; align-items: center; gap: 6mm; margin: 0 0 8mm; padding-bottom: 4mm; border-bottom: 1px solid #b7c0ca; }
.mast .talia-brand-mark { height: 11mm; width: auto; color: #1f4e79; display: block; }
.talia-brand-mark__word { font-family: Cinzel, "Times New Roman", Georgia, serif; }
.mast h1 { margin: 0; font-size: 1.15rem; font-weight: 650; color: #1c2430; }
.mast p { margin: 1mm 0 0; color: #5c6570; font-size: 0.78rem; }
.summary-box, .sheet { background: #ffffff; color: #1c2430; border: 1px solid #b7c0ca; border-radius: 4px; padding: 5mm 6mm; }
.summary-box p, .sheet p { margin: 0 0 0.7rem; color: #1c2430; }
.summary-box ul, .sheet ul { margin: 0; padding-left: 1.1rem; }
.summary-box li, .sheet li { color: #1c2430; }
.arch-intro { color: #5c6570; font-size: 0.8rem; }
.arch-figure { background: #1a1d33; border: 1px solid #b7c0ca; border-radius: 4px; padding: 3mm; }
.arch-diagram svg { width: auto; max-width: 100%; height: auto; max-height: 150mm; display: block; margin: 0 auto; }
.arch-block, .report-plan, .report-risk { break-before: page; page-break-before: always; }
.arch-legend { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 2mm; font-size: 0.72rem; color: #d9e2ec; }
.work-list { list-style: none; margin: 0; padding: 0; border: 1px solid #b7c0ca; border-radius: 4px; background: #fff; }
.work-list li { padding: 2.2mm 3mm; border-bottom: 1px solid #b7c0ca; color: #1c2430; }
.work-list li:last-child { border-bottom: 0; }
.work-list strong { display: block; }
.work-list span, .work-list p { display: block; margin: 0.6mm 0 0; color: #5c6570; font-size: 0.78rem; }
.risk-detail { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 0.68rem; background: #fff; }
.risk-detail th, .risk-detail td { border: 1px solid #b7c0ca; padding: 1.4mm 1.6mm; vertical-align: top; text-align: left; color: #1c2430; background: #fff; }
.risk-detail th { background: #eef2f6; font-weight: 650; }
.risk-detail tr { break-inside: avoid; }
.risk-detail p { margin: 0.6mm 0 0; }
.arch-legend i { display: inline-block; width: 0.7rem; height: 0.7rem; border: 1.5px solid #0d9488; border-radius: 2px; margin-right: 0.3rem; vertical-align: -1px; }
.arch-legend i.external { border-color: #d4a574; }
.arch-legend i.env { border-color: rgba(232, 213, 184, 0.55); }
.arch-legend i.future { border-color: #a78bfa; border-style: dashed; }
${BRIEFING_CSS}
`;

const timelineBars = (phases) => {
  const bars = (phases || []).map((phase) => {
    const when = formatPlanDate(phase.targetOn) || 'Date not set';
    const covers = phase.elements?.length ? phase.elements.join(' · ') : 'Nothing assigned yet';
    const marks = (phase.milestones || [])
      .map((item) => `${item.name}${item.targetOn ? ` · ${formatPlanDate(item.targetOn)}` : ''}`)
      .join('; ');
    const quiet = !phase.elements?.length && !phase.current;
    const rowClass = [phase.current ? 'is-current' : '', quiet ? 'is-quiet' : ''].filter(Boolean).join(' ');
    const grow = Math.max(Number(phase.share) || 0.12, 0.12);
    return `<div class="brief-span${rowClass ? ` ${rowClass}` : ''}" style="flex:${grow.toFixed(3)} 1 0">
      <strong>${esc(phase.label)}</strong>
      <em>${esc(when)}</em>
      <span>${esc(covers)}</span>
      ${marks ? `<span>${esc(marks)}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="brief-timeline">${bars}</div>`;
};

const architectureBlock = () => ARCHITECTURE_BANDS.map((band) => {
  const cards = band.groups
    ? band.groups.map((group) => {
      const chips = (group.chips || []).map((chip) => `<span>${esc(chip)}</span>`).join('');
      return `<div class="brief-arch__group"><strong>${esc(group.title)}</strong><em>${esc(group.detail || '')}</em><div>${chips}</div></div>`;
    }).join('')
    : (band.items || []).map((item) => (
      `<div class="brief-arch__item"><strong>${esc(item.title)}</strong>${item.detail ? `<em>${esc(item.detail)}</em>` : ''}</div>`
    )).join('');
  const note = band.note ? `<p class="brief-note">${esc(band.note)}</p>` : '';
  return `<section class="brief-arch brief-arch--${esc(band.kind)}"><h3>${esc(band.title)}</h3><div class="brief-arch__row">${cards}</div>${note}</section>`;
}).join('');

const recentBlock = (items) => {
  if (!items?.length) {
    return '<h2>Recent work</h2><p class="brief-note">Nothing is marked done or in progress.</p>';
  }
  const rows = items.map((item) => {
    const when = item.updatedAt ? formatPlanDate(item.updatedAt) : '';
    const meta = [item.targetVersion, when].filter(Boolean).join(' · ');
    return `<li><strong>${esc(item.statusLabel)}</strong>${esc(item.title)}${meta ? ` · ${esc(meta)}` : ''}</li>`;
  }).join('');
  return `<h2>Recent work</h2><ul class="brief-work">${rows}</ul>`;
};

const heatMap = (risks) => {
  const byCell = new Map();
  (risks || []).forEach((item) => {
    const key = `${item.likelihood}:${item.impact}`;
    const list = byCell.get(key) || [];
    list.push(item);
    byCell.set(key, list);
  });
  const head = RISK_SCALE.map((impact) => `<th>${esc(RISK_IMPACT_LABELS[impact])}</th>`).join('');
  const body = [...RISK_SCALE].reverse().map((likelihood) => {
    const cells = RISK_SCALE.map((impact) => {
      const items = (byCell.get(`${likelihood}:${impact}`) || [])
        .slice()
        .sort((a, b) => String(a.referenceCode).localeCompare(String(b.referenceCode), undefined, { numeric: true }));
      const codes = items.map((item) => `<span>${esc(item.referenceCode)}</span>`).join('');
      return `<td class="band-${riskBand(likelihood, impact)}">${codes}</td>`;
    }).join('');
    return `<tr><th class="axis">${esc(RISK_LIKELIHOOD_LABELS[likelihood])}</th>${cells}</tr>`;
  }).join('');
  const legend = ['low', 'medium', 'high', 'critical']
    .map((band) => `<li><i class="band-${band}"></i>${esc(RISK_BAND_LABELS[band])}</li>`)
    .join('');
  return `<table class="brief-heat" aria-label="Risk heat map">
    <thead><tr><th></th>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <ul class="brief-legend">${legend}</ul>`;
};

const snapshotList = (brief) => {
  const headline = briefHeadline(brief);
  const next = headline.current?.upcoming
    ? { value: formatPlanDate(headline.current.targetOn), hint: headline.current.label }
    : { value: 'None', hint: 'No date ahead' };
  const serious = [
    headline.criticalCount ? `${headline.criticalCount} critical` : '',
    headline.highCount ? `${headline.highCount} high` : '',
  ].filter(Boolean).join(', ');
  const delivered = headline.delivered;
  const covers = delivered?.elements?.length ? delivered.elements.join(' · ') : 'Nothing assigned yet';
  const items = [
    ['Next', next.value, next.hint],
    ['Open risks', String(headline.openCount), serious || 'None high'],
    ['Decisions', String(headline.decisions.length), 'Avoid'],
    ['Delivered', delivered?.label || '—', covers],
  ];
  return `<ul class="brief-snapshot">${items.map(([label, value, hint]) => (
    `<li><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(hint)}</em></li>`
  )).join('')}</ul>`;
};

const decisionList = (decisions) => {
  if (!decisions?.length) return '';
  const items = decisions.map((item) => {
    const band = RISK_BAND_LABELS[item.band] || item.band || '';
    const response = RISK_RESPONSE_LABELS[item.response] || item.response || '';
    const treatment = item.treatment ? `<p>${esc(item.treatment)}</p>` : '';
    return `<li><strong>${esc(item.referenceCode)}</strong>${esc(item.title)} · ${esc(band)} · ${esc(response)}${treatment}</li>`;
  }).join('');
  return `<h2>For this conversation</h2><ul class="brief-decisions">${items}</ul>`;
};

export function buildBriefingPages(brief, { exportedOn = '' } = {}) {
  const phases = brief?.phases || [];
  const risks = brief?.risks || [];
  const recent = brief?.recentWork || [];
  const when = exportedOn ? `<span>Exported ${esc(exportedOn)}</span>` : '';
  const decisions = brief ? decisionList(briefHeadline(brief).decisions) : '';
  const plan = phases.length ? timelineBars(phases) : '<p class="brief-note">No phases recorded.</p>';
  const riskMap = risks.length ? heatMap(risks) : '<p class="brief-note">No open risks.</p>';
  return `<div class="doc-page page-brief">
    <header class="brief-kicker">
      <p class="hero__eyebrow">Project overview</p>
      <div class="brief-kicker__row"><h2>Project summary</h2>${when}</div>
    </header>
    ${brief ? snapshotList(brief) : ''}
    <h2>Architecture</h2>
    ${architectureBlock()}
    <h2>Plan</h2>
    ${plan}
    ${recentBlock(recent)}
    <h2>Open risks</h2>
    ${riskMap}
    ${decisions}
  </div>`;
}

const BRAND_MARK = `<svg class="talia-brand-mark" viewBox="0 0 236 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Talia">
  <g fill="none" stroke="currentColor" stroke-width="2.55" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30.5 55c-1.2-2.5-1.8-5-1.8-8 0-8-.5-16-1.2-23.5"/>
    <path d="M28.8 39.5C17.5 35.5 9 26.5 10.8 14.5c8 4 15.2 13.2 17.5 22"/>
    <path d="M29.5 37.5c11.5-4.2 19.5-13.5 17.8-25.5-7.5 3.5-14.5 12.5-17 22"/>
    <path d="M28.5 28.5C22 17 22.5 7.5 28.5 3c6 4.5 6.5 14 0 25.5z"/>
  </g>
  <text class="talia-brand-mark__word" x="56" y="44" fill="currentColor" font-family="Cinzel, Times New Roman, Georgia, serif" font-size="34" font-weight="600" letter-spacing="0.14em">TALIA</text>
</svg>`;

const standaloneDocument = ({ title, pages }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&amp;family=Inter:wght@400;600&amp;display=swap" />
  <style>${summaryThemeStyle(PRINT_THEME)}${STANDALONE_CSS}</style>
</head>
<body>
  <div class="doc">${pages}</div>
</body>
</html>`;

/**
 * @returns {{ html: string, title: string }}
 */
const stripTags = (value) => String(value || '').replace(/<script[\s\S]*?<\/script>/gi, '');

/** Keep deploy and sync labels in the gaps between boxes. */
export function placeArchitectureLabels(svg) {
  return String(svg || '')
    .replace(
      'd="M340,76 Q362,140 340,208"',
      'd="M340,76 C328,96 319,112 319,140 C319,168 328,188 340,208"',
    )
    .replace(
      '<text x="348" y="150" fill="#d4a574" font-size="8">tarball deploy</text>',
      '<text x="328" y="184" fill="#d4a574" font-size="8">tarball deploy</text>',
    )
    .replace(
      'd="M239,154 Q360,290 579,372"',
      'd="M239,154 C300,170 448,170 448,230 C448,310 520,348 579,372"',
    )
    .replace(
      '<text x="360" y="250" fill="#d4a574" font-size="8">batch sync (CLI / GraphQL)</text>',
      '<text x="458" y="186" fill="#d4a574" font-size="8">batch sync</text>',
    );
}

export function extractOverviewParts(html) {
  const source = String(html || '');
  const take = (pattern) => {
    const match = source.match(pattern);
    return match ? stripTags(match[1].trim()) : '';
  };
  const svg = source.match(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 920 820"[\s\S]*?<\/svg>/);
  return {
    summary: take(/<div class="summary-box">([\s\S]*?)<\/div>/),
    intro: take(/<p class="arch-intro">([\s\S]*?)<\/p>/),
    legend: take(/<div class="arch-legend">([\s\S]*?)<\/div>/),
    achievements: take(/<ul class="item-list">([\s\S]*?)<\/ul>/),
    nextSteps: take(/<ul class="next-list">([\s\S]*?)<\/ul>/),
    svg: svg ? placeArchitectureLabels(svg[0]) : '',
  };
}

const labelOf = (map, value) => map?.[value] || (value == null || value === '' ? '' : String(value));

const riskDetailTable = (risks) => {
  const headers = ['Reference', 'Risk', 'Likelihood', 'Impact', 'Band', 'Response', 'Proximity', 'Owner', 'Treatment'];
  const head = headers.map((label) => `<th>${esc(label)}</th>`).join('');
  const body = (risks || []).map((item) => {
    const title = `<strong>${esc(item.title || '')}</strong>`;
    const category = item.category ? `<span>${esc(labelOf(RISK_CATEGORY_LABELS, item.category))}</span>` : '';
    const statement = item.statement ? `<p>${esc(item.statement)}</p>` : '';
    const cells = [
      esc(item.referenceCode || ''),
      `${title}${category}${statement}`,
      esc(labelOf(RISK_LIKELIHOOD_LABELS, item.likelihood)),
      esc(labelOf(RISK_IMPACT_LABELS, item.impact)),
      esc(labelOf(RISK_BAND_LABELS, item.band)),
      esc(labelOf(RISK_RESPONSE_LABELS, item.response)),
      esc(labelOf(RISK_PROXIMITY_LABELS, item.proximity)),
      esc(item.owner || '—'),
      esc(item.treatment || '—'),
    ];
    return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
  }).join('');
  return `<table class="risk-detail"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

const currentWorkBlock = (items) => {
  if (!items?.length) return '';
  const rows = items.map((item) => {
    const meta = [
      item.statusLabel,
      item.area,
      item.priority,
      item.targetVersion,
      item.updatedAt ? formatPlanDate(item.updatedAt) : '',
    ].filter(Boolean).join(' · ');
    const detail = item.detail ? `<p>${esc(item.detail)}</p>` : '';
    return `<li><strong>${esc(item.title)}</strong>${meta ? `<span>${esc(meta)}</span>` : ''}${detail}</li>`;
  }).join('');
  return `<section class="report-work"><h2>Current work</h2><ul class="work-list">${rows}</ul></section>`;
};

const publishedList = (heading, html) => (
  html ? `<section><h2>${esc(heading)}</h2><div class="sheet"><ul>${html}</ul></div></section>` : ''
);

export function composeProjectSummaryHtml({ summary, brief, exportedAt = new Date(), title: titleOverride } = {}) {
  const title = titleOverride || buildExportTitle(summary, exportedAt);
  const content = typeof summary?.content === 'string' ? summary.content.trim() : '';
  const parts = extractOverviewParts(content);
  const phases = brief?.phases || [];
  const risks = brief?.risks || [];
  const work = brief?.recentWork || [];
  if (!parts.summary && !parts.svg && !phases.length && !risks.length && !work.length) {
    throw new Error('No project summary content to export');
  }
  const published = formatPublished(summary?.generatedAt);
  const meta = [summary?.version, published ? `Published ${published}` : ''].filter(Boolean).join(' · ');
  const plan = phases.length
    ? `<section class="report-plan"><h2>Project plan</h2><div class="sheet">${timelineBars(phases)}</div></section>`
    : '';
  const riskMap = risks.length
    ? `<section class="report-risk"><h2>Risk register</h2><div class="sheet">${heatMap(risks)}${riskDetailTable(risks)}</div></section>`
    : '';
  const pages = `<header class="mast">${BRAND_MARK}<div><h1>${esc(summary?.title || 'Project Summary')}</h1>${meta ? `<p>${esc(meta)}</p>` : ''}</div></header>
    ${parts.summary ? `<section><h2>Executive summary</h2><div class="summary-box">${parts.summary}</div></section>` : ''}
    ${publishedList('What we have achieved', parts.achievements)}
    ${publishedList('Next steps', parts.nextSteps)}
    ${parts.svg ? `<section class="arch-block">
      <h2>High-level architecture</h2>
      ${parts.intro ? `<p class="arch-intro">${parts.intro}</p>` : ''}
      <div class="arch-figure"><div class="arch-diagram">${parts.svg}</div>
      ${parts.legend ? `<div class="arch-legend">${parts.legend}</div>` : ''}</div>
    </section>` : ''}
    ${plan}
    ${currentWorkBlock(work)}
    ${riskMap}`;
  return { html: standaloneDocument({ title, pages }), title };
}

const plainText = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function projectSummaryExportPayload({ summary, brief, theme, exportedAt = new Date() } = {}) {
  const { html } = composeProjectSummaryHtml({ summary, brief, theme, exportedAt });
  const risks = brief?.risks || [];
  const phases = brief?.phases || [];
  if (risks.length) {
    return {
      title: summary?.title || 'Project Summary',
      html,
      columns: [
        { field: 'referenceCode', title: 'Reference' },
        { field: 'title', title: 'Title' },
        { field: 'statement', title: 'Statement' },
        { field: 'likelihood', title: 'Likelihood' },
        { field: 'impact', title: 'Impact' },
        { field: 'band', title: 'Band' },
        { field: 'response', title: 'Response' },
        { field: 'proximity', title: 'Proximity' },
        { field: 'owner', title: 'Owner' },
        { field: 'treatment', title: 'Treatment' },
      ],
      rows: risks.map((item) => ({
        referenceCode: item.referenceCode || '',
        title: item.title || '',
        statement: item.statement || '',
        likelihood: RISK_LIKELIHOOD_LABELS[item.likelihood] || item.likelihood || '',
        impact: RISK_IMPACT_LABELS[item.impact] || item.impact || '',
        band: RISK_BAND_LABELS[item.band] || item.band || '',
        response: RISK_RESPONSE_LABELS[item.response] || item.response || '',
        proximity: RISK_PROXIMITY_LABELS[item.proximity] || item.proximity || '',
        owner: item.owner || '',
        treatment: item.treatment || '',
      })),
    };
  }
  if (phases.length) {
    return {
      title: summary?.title || 'Project Summary',
      html,
      columns: [
        { field: 'label', title: 'Phase' },
        { field: 'targetOn', title: 'Target' },
        { field: 'elements', title: 'Elements' },
      ],
      rows: phases.map((phase) => ({
        label: phase.label || '',
        targetOn: formatPlanDate(phase.targetOn) || '',
        elements: (phase.elements || []).join(' · '),
      })),
    };
  }
  const text = plainText(extractOverviewParts(summary?.content).summary);
  return {
    title: summary?.title || 'Project Summary',
    html,
    columns: [{ field: 'summary', title: 'Executive summary' }],
    rows: [{ summary: text || 'Project summary' }],
  };
}
