import assert from 'node:assert/strict';
import { formatPlanDate, linkedElements, milestoneOffset, phaseSpans } from './projectPlan.js';

const phases = [
  { code: '0', label: 'Dev', sortOrder: 0, targetOn: null },
  { code: 'mvp', label: 'MVP', sortOrder: 1, targetOn: '2026-10-05' },
  { code: '1', label: 'Phase 1', sortOrder: 2, targetOn: '2026-11-16' },
  { code: '2', label: 'Phase 2', sortOrder: 3, targetOn: null },
  { code: '3', label: 'Phase 3', sortOrder: 4, targetOn: null },
];

const spans = phaseSpans(phases);
assert.equal(spans.length, 5);
assert.equal(spans.reduce((sum, span) => sum + span.share, 0).toFixed(6), '1.000000');
assert.ok(spans[1].endMs > spans[0].endMs);
assert.equal(new Date(spans[1].endMs).toISOString().slice(0, 10), '2026-10-05');
assert.equal(new Date(spans[2].endMs).toISOString().slice(0, 10), '2026-11-16');
assert.equal(formatPlanDate('2026-10-05'), '5 Oct 2026');

const equal = phaseSpans(phases.map((phase) => ({ ...phase, targetOn: null })));
assert.equal(equal[0].share, equal[4].share);
assert.equal(equal[0].startMs, null);

const marker = { targetOn: '2026-10-05' };
assert.equal(milestoneOffset(marker, spans[1]), 1);
const pulled = phaseSpans(
  [{ code: '0', sortOrder: 0, targetOn: '2025-10-31' }],
  [{ phaseCode: '0', targetOn: '2025-10-05' }],
);
assert.equal(new Date(pulled[0].startMs).toISOString().slice(0, 10), '2025-10-05');
assert.equal(milestoneOffset({ phaseCode: '0', targetOn: '2025-10-05' }, pulled[0]), 0);
assert.equal(milestoneOffset({ targetOn: null }, spans[1]), null);

const linked = linkedElements({
  phaseCode: 'mvp',
  milestones: [
    { id: 'm1', name: 'oct-5-demo', phaseCode: 'mvp' },
    { id: 'm2', name: 'later', phaseCode: '1' },
  ],
  matrixItems: [
    { id: 'mx', phase: 'mvp', referenceCode: 'R001', shortName: 'Dock', links: [{ requirementItemId: 'rq-assigned' }] },
    { id: 'other', phase: '1', referenceCode: 'R002', shortName: 'Later', links: [] },
  ],
  requirements: [
    { id: 'rq-demo', title: 'Demo', targetVersion: 'oct-5-demo' },
    { id: 'rq-assigned', title: 'Assigned', targetVersion: null },
    { id: 'rq-other', title: 'Other', targetVersion: 'later' },
  ],
  risks: [
    { id: 'rk', referenceCode: 'RK001', title: 'Supplier', links: [{ targetKind: 'matrix', targetId: 'mx' }] },
    { id: 'rk-other', referenceCode: 'RK009', title: 'Elsewhere', links: [{ targetKind: 'requirement', targetId: 'rq-other' }] },
  ],
  documents: [
    { id: 'doc', referenceCode: 'D001', title: 'Note', links: [{ targetKind: 'risk', targetId: 'rk' }] },
  ],
});
assert.deepEqual(linked.requirements.map((item) => item.id).sort(), ['rq-assigned', 'rq-demo']);
assert.deepEqual(linked.matrix.map((item) => item.id), ['mx']);
assert.deepEqual(linked.risks.map((item) => item.id), ['rk']);
assert.deepEqual(linked.documents.map((item) => item.id), ['doc']);

const one = linkedElements({
  phaseCode: 'mvp',
  milestoneName: 'oct-5-demo',
  milestones: [{ id: 'm1', name: 'oct-5-demo', phaseCode: 'mvp' }],
  matrixItems: [
    { id: 'mx', phase: 'mvp', links: [{ requirementItemId: 'rq-demo' }] },
  ],
  requirements: [
    { id: 'rq-demo', title: 'Demo', targetVersion: 'Oct-5-Demo' },
    { id: 'rq-assigned', title: 'Assigned', targetVersion: null },
  ],
  risks: [],
  documents: [],
});
assert.deepEqual(one.requirements.map((item) => item.id), ['rq-demo']);
assert.deepEqual(one.matrix.map((item) => item.id), ['mx']);

const acrossPhases = linkedElements({
  phaseCode: '0',
  milestoneName: 'oct-5-demo',
  milestones: [{ id: 'm1', name: 'oct-5-demo', phaseCode: '0' }],
  matrixItems: [
    { id: 'dock', phase: '0', referenceCode: 'R018', element: 'UI', links: [] },
    { id: 'price', phase: '1', referenceCode: 'R024', element: 'Pricing', links: [{ requirementItemId: 'rq-price' }] },
  ],
  requirements: [
    { id: 'rq-price', title: 'Price extraction', targetVersion: 'oct-5-demo' },
  ],
  risks: [],
  documents: [],
});
assert.deepEqual(acrossPhases.matrix.map((item) => item.id), ['price']);

const phaseWithLink = linkedElements({
  phaseCode: '0',
  milestones: [{ id: 'm1', name: 'oct-5-demo', phaseCode: '0' }],
  matrixItems: [
    { id: 'dock', phase: '0', referenceCode: 'R018', element: 'UI', links: [] },
    { id: 'price', phase: '1', referenceCode: 'R024', element: 'Pricing', links: [{ requirementItemId: 'rq-price' }] },
  ],
  requirements: [
    { id: 'rq-price', title: 'Price extraction', targetVersion: 'oct-5-demo' },
  ],
  risks: [],
  documents: [],
});
assert.deepEqual(phaseWithLink.matrix.map((item) => item.id), ['dock', 'price']);

console.log('projectPlan.test.mjs ok');
