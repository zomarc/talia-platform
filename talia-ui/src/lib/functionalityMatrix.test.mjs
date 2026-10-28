import assert from 'node:assert/strict';
import {
  buildFunctionalityMatrixExport,
  FUNCTIONALITY_MATRIX_EXPORT_ROOT_KEY,
  groupMatrixRows,
  nextReferenceCode,
} from './functionalityMatrix.js';

assert.equal(nextReferenceCode([]), 'R001');
assert.equal(nextReferenceCode([{ referenceCode: 'R001' }, { referenceCode: 'R009' }]), 'R010');
assert.equal(nextReferenceCode([{ referenceCode: 'note' }, { referenceCode: 'R2' }]), 'R003');

const rows = groupMatrixRows([
  { element: 'Engine', referenceCode: 'R002', sortOrder: 2, shortName: 'Forecast' },
  { element: 'UI', referenceCode: 'R010', sortOrder: 1, shortName: 'Later' },
  { element: 'UI', referenceCode: 'R001', sortOrder: 0, shortName: 'Admin' },
  { element: 'Engine', referenceCode: 'R003', sortOrder: 2, shortName: 'Rules' },
]);

assert.deepEqual(rows.map((row) => row.element), ['UI', 'Engine']);
assert.deepEqual(rows[0].items.map((item) => item.referenceCode), ['R001', 'R010']);
assert.deepEqual(rows[1].items.map((item) => item.referenceCode), ['R002', 'R003']);

const pack = buildFunctionalityMatrixExport({
  referenceCode: 'R001',
  element: 'UI',
  functionName: 'Admin',
  shortName: 'Access',
  name: 'Focus access',
  concept: 'Who can open a focus',
  rationale: 'Demos need a clear gate',
  technicalRequirement: null,
  complexity: 'M',
  size: 'L',
  phase: 'mvp',
  sortOrder: 0,
  createdBy: '1000',
  notes: [{ body: 'Start with admin only', createdAt: '2026-10-13T00:00:00Z', createdBy: '1000' }],
  links: [{ requirementItemId: 'abc', title: 'Log row', section: 'deliverable', status: 'backlog' }],
});

const exported = pack[FUNCTIONALITY_MATRIX_EXPORT_ROOT_KEY];
assert.equal(exported.version, 1);
assert.equal(exported.items.length, 1);
assert.equal(exported.items[0].function, 'Admin');
assert.equal(exported.items[0].size, 'L');
assert.equal(exported.items[0].createdBy, undefined);
assert.equal(exported.items[0].notes[0].createdBy, undefined);
assert.equal(exported.items[0].assignedRequirements[0].id, 'abc');

console.log('functionalityMatrix.test.mjs ok');
