import assert from 'node:assert/strict';
import {
  buildMrRetrospectExport,
  buildMrRetrospectExportRows,
  MR_RETROSPECT_EXPORT_COLUMNS,
} from './mrRetrospectPrint.js';

const steps = [
  {
    dtd: 90,
    asOfDate: '2025-01-01',
    holdDate: '2024-12-01',
    holdDtd: 120,
    status: 'OF',
    requestedGuests: 100,
    sourceMr: 0.4,
    taliaMr: 0.55,
    sourceExpectedGuests: 40,
    taliaExpectedGuests: 55,
    outcomeNamed: 48,
    taliaGap: 7,
  },
  {
    dtd: 30,
    asOfDate: '2025-03-02',
    holdDate: '2025-02-15',
    holdDtd: 45,
    status: 'BK',
    requestedGuests: 100,
    sourceMr: 0.5,
    taliaMr: 0.62,
    sourceExpectedGuests: 50,
    taliaExpectedGuests: 62,
    outcomeNamed: 48,
    taliaGap: 14,
  },
];

const retrospect = {
  steps,
  groupCount: 1,
  assumptions: ['Hold dates use feed through.'],
};

const html = buildMrRetrospectExport({
  path: { feedThrough: '2025-04-01', assumptions: ['Sailed groups only.'] },
  retrospect,
  annotations: [{
    kind: 'source',
    dtd: 90,
    changedDate: '2024-12-01',
    label: 'Source hold applied',
  }],
  charts: [{
    id: 'dtd',
    title: 'Days before departure',
    image: 'data:image/png;base64,AAA',
  }],
  scopeMode: 'group',
  selectedGroupId: 'G-100',
  selectedDtd: 90,
  shipLabel: 'SH01',
  dateFrom: '2025-01-01',
  dateTo: '2025-06-01',
  criteriaSummary: '2025 H1',
});

assert.match(html, /<h1>MR Retrospect<\/h1>/);
assert.match(html, /One group · G-100/);
assert.match(html, /Ship SH01/);
assert.match(html, /Checkpoint · 90 DTD/);
assert.match(html, /data:image\/png;base64,AAA/);
assert.match(html, /Days before departure/);
assert.match(html, /<td class="num">90<\/td>/);
assert.match(html, /<td class="num">30<\/td>/);
assert.match(html, /Source hold applied/);
assert.match(html, /Hold dates use feed through/);
assert.match(html, /Sailed groups only/);

const withoutChart = buildMrRetrospectExport({
  retrospect,
  charts: [],
  selectedDtd: 30,
});
assert.doesNotMatch(withoutChart, /<figure class="chart">/);
assert.match(withoutChart, /Checkpoint · 30 DTD/);

const rows = buildMrRetrospectExportRows(retrospect);
assert.equal(rows.length, 2);
assert.equal(rows[0].dtd, 90);
assert.equal(rows[1].named, 48);
assert.ok(MR_RETROSPECT_EXPORT_COLUMNS.some((col) => col.field === 'taliaGap'));

console.log('mrRetrospectPrint.test.mjs: ok');
