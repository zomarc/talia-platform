import assert from 'node:assert/strict';
import { composeProjectDocumentsHtml, projectDocumentExportPayload } from './projectDocumentPrint.js';

const { html, title } = composeProjectDocumentsHtml({
  documents: [{
    id: 'doc-1',
    referenceCode: 'D004',
    title: 'Celestyal instance',
    links: [{ label: 'RK001' }],
    body: [
      '# Purpose',
      '',
      'A **white** page with <script>alert(1)</script>.',
      '',
      '| Size | Value |',
      '| --- | --- |',
      '| VM | D4s_v5 |',
      '',
      '![Plate](asset:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)',
      '',
      '```mermaid',
      'flowchart LR',
      '  A-->B',
      '```',
    ].join('\n'),
  }],
  assets: {
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee': 'data:image/png;base64,abc',
  },
  diagramsById: {
    'doc-1': [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
      <style>.node rect { fill: #1f2020 !important; } .label { color: #ffffff; }</style>
      <rect style="fill:#1f2020;stroke:#eeeeee" fill="#1f2020" stroke="#eeeeee" />
      <text fill="#ffffff">Inputs</text>
    </svg>`],
  },
});

assert.equal(title, 'Celestyal instance');
assert.ok(html.includes('background: #ffffff'));
assert.ok(html.includes('size: A4 portrait'));
assert.ok(html.includes('margin: 16mm'));
assert.ok(html.includes('<h1>Celestyal instance</h1>'));
assert.ok(html.includes('D004'));
assert.ok(html.includes('RK001'));
assert.ok(html.includes('<h2>Purpose</h2>') || html.includes('<h1>Purpose</h1>'));
assert.ok(html.includes('<strong>white</strong>'));
assert.ok(html.includes('&lt;script&gt;'));
assert.equal(html.includes('<script>alert'), false);
assert.ok(html.includes('<table>'));
assert.ok(html.includes('border: 1px solid #b7c0ca'));
assert.ok(html.includes('data:image/png;base64,abc'));
assert.ok(html.includes('<svg'));
assert.equal(html.includes('#1f4e79'), false);
assert.equal(html.includes('#1f2020'), false);
assert.equal(html.includes('color: #ffffff'), false);
assert.ok(html.includes('fill: #ffffff !important'));
assert.ok(html.includes('color: #1c2430 !important'));

const payload = projectDocumentExportPayload({
  documents: [
    { id: 'a', referenceCode: 'D001', title: 'One', body: 'First', links: [] },
    { id: 'b', referenceCode: 'D004', title: 'Spec', body: 'Second', links: [{ label: 'Plan' }] },
  ],
  selected: { id: 'b', referenceCode: 'D004', title: 'Spec', body: 'Second', links: [{ label: 'Plan' }] },
});
assert.equal(payload.title, 'Spec');
assert.ok(payload.markdown.startsWith('# Spec\n'));
assert.equal(payload.markdown.includes('# One'), false);
assert.equal(payload.rows.length, 2);
assert.ok(payload.html.includes('Second'));
assert.equal(payload.html.includes('>First<'), false);
assert.equal(payload.rows[1].links, 'Plan');

assert.throws(() => composeProjectDocumentsHtml({ documents: [] }));

console.log('projectDocumentPrint.test.mjs ok');
