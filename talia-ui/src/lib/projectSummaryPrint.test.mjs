import assert from 'node:assert/strict';
import { composeProjectSummaryHtml, extractOverviewParts } from './projectSummaryPrint.js';

const overview = `<!doctype html>
<html><head><title>Old title</title></head>
<body><div class="doc">
<div class="summary-box">
  <p><strong>Talia</strong> is Celestyal's revenue and inventory intelligence platform.</p>
  <ul class="summary-points"><li><strong>Source:</strong> Azure Synapse</li></ul>
</div>
<p class="arch-intro">Teal = Talia components · Gold = external systems</p>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><text>logo</text></svg>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 820"><text>DEPLOYMENT HOSTS</text><text>talia-ui</text>
<path d="M340,76 Q362,140 340,208" fill="none"/>
<text x="348" y="150" fill="#d4a574" font-size="8">tarball deploy</text>
<path d="M239,154 Q360,290 579,372" fill="none"/>
<text x="360" y="250" fill="#d4a574" font-size="8">batch sync (CLI / GraphQL)</text>
</svg>
<div class="arch-legend"><span><i class="talia"></i> Talia component</span></div>
<div class="doc-page page-cover">Executive summary stays in the old chrome</div>
</div></body></html>`;

const parts = extractOverviewParts(overview);
assert.ok(parts.summary.includes('revenue and inventory intelligence'));
assert.ok(parts.svg.includes('DEPLOYMENT HOSTS'));
assert.equal(parts.svg.includes('logo'), false);
assert.ok(parts.svg.includes('y="184"'));
assert.ok(parts.svg.includes('>batch sync</text>'));
assert.equal(parts.svg.includes('y="250"'), false);

const exportedAt = new Date('2026-10-22T15:00:00Z');
const { html, title } = composeProjectSummaryHtml({
  summary: { title: 'Project Summary', content: overview, generatedAt: '2026-08-28T12:17:28Z' },
  exportedAt,
});

assert.ok(html.includes(`<title>${title}</title>`));
assert.ok(title.startsWith('Project-Summary-2026-10-22_'));
assert.ok(html.includes('Executive summary'));
assert.ok(html.includes('High-level architecture'));
assert.ok(html.includes('revenue and inventory intelligence'));
assert.ok(html.includes('DEPLOYMENT HOSTS'));
assert.ok(html.includes('Talia component'));
assert.equal(html.includes('Executive summary stays in the old chrome'), false);
assert.ok(html.includes('talia-brand-mark'));
assert.ok(html.includes('>TALIA</text>'));
assert.equal(html.includes('People and access'), false);

const withRecord = composeProjectSummaryHtml({
  summary: { title: 'Project Summary', content: overview },
  brief: {
    phases: [{
      code: '3',
      label: 'Phase 3',
      targetOn: '2026-10-31',
      share: 0.2,
      elements: ['Pricing'],
      milestones: [],
      current: true,
    }],
    risks: [{
      referenceCode: 'RK005',
      title: 'Plan dates are not a forecast',
      statement: 'The dates are a first guess.',
      category: 'benefits',
      likelihood: 4,
      impact: 4,
      band: 'high',
      response: 'avoid',
      proximity: 'immediate',
      owner: 'Admin',
      treatment: 'Say what the date is for.',
    }],
    recentWork: [{
      title: 'Access model',
      statusLabel: 'In progress',
      area: 'Admin',
      detail: 'The preview is still the access model.',
    }],
  },
  theme: { accent: '#5b9bd5', bg: '#1a1d33', fg: '#bcc9db' },
});
assert.ok(withRecord.html.includes('Project plan'));
assert.ok(withRecord.html.includes('Phase 3'));
assert.ok(withRecord.html.includes('Risk register'));
assert.ok(withRecord.html.includes('RK005'));
assert.ok(withRecord.html.includes('The dates are a first guess.'));
assert.ok(withRecord.html.includes('Say what the date is for.'));
assert.ok(withRecord.html.includes('Current work'));
assert.ok(withRecord.html.includes('Access model'));
assert.ok(withRecord.html.includes('band-high'));
assert.ok(withRecord.html.includes('background: #ffffff'));
assert.ok(withRecord.html.includes('--bg-solid: #ffffff'));
assert.equal(withRecord.html.includes('--bg-solid: #1a1d33'), false);
assert.ok(withRecord.html.includes('border: 1px solid #b7c0ca'));
assert.ok(withRecord.html.includes('margin: 14mm'));

assert.throws(() => composeProjectSummaryHtml({ summary: { content: '<p>no</p>' } }));

console.log('projectSummaryPrint.test.mjs ok');
