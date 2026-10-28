import assert from 'node:assert/strict';
import { briefHeadline, buildManagementBrief, selectCurrentWork, selectRecentWork } from './projectSummaryBrief.js';
import { milestoneOffset } from './projectPlan.js';

const brief = buildManagementBrief({
  today: '2026-02-01',
  phases: [
    { code: '0', label: 'Dev', sortOrder: 0, targetOn: '2025-10-31' },
    { code: 'mvp', label: 'MVP', sortOrder: 1, targetOn: '2026-01-31' },
    { code: '1', label: 'Phase 1', sortOrder: 2, targetOn: '2026-04-30' },
  ],
  milestones: [
    { name: 'oct-5-demo', phaseCode: '0', targetOn: '2025-10-05' },
  ],
  matrixItems: [
    { phase: '0', element: 'UI' },
    { phase: '0', element: 'UI' },
    { phase: '0', element: 'Integration' },
    { phase: 'mvp', element: 'MR' },
  ],
  risks: [
    { referenceCode: 'RK002', title: 'People', status: 'open', likelihood: 3, impact: 4 },
    { referenceCode: 'RK009', title: 'Closed', status: 'closed', likelihood: 5, impact: 5 },
    { referenceCode: 'RK001', title: 'Supplier', status: 'open', likelihood: 4, impact: 4, response: 'reduce' },
    { referenceCode: 'RK004', title: 'Measure', status: 'open', likelihood: 4, impact: 4, response: 'avoid' },
  ],
});

assert.deepEqual(brief.phases.map((phase) => phase.label), ['Dev', 'MVP', 'Phase 1']);
assert.deepEqual(brief.phases[0].elements, ['UI', 'Integration']);
assert.equal(brief.phases[0].milestones[0].name, 'oct-5-demo');
assert.ok(milestoneOffset(brief.phases[0].milestones[0], brief.phases[0]) != null);
assert.deepEqual(brief.phases[1].elements, ['MR']);
assert.deepEqual(brief.phases[2].elements, []);
assert.deepEqual(brief.risks.map((risk) => risk.referenceCode), ['RK001', 'RK002', 'RK004']);
assert.equal(brief.risks[0].band, 'high');
assert.equal(brief.phases.find((phase) => phase.current).label, 'Phase 1');
assert.equal(brief.phases.find((phase) => phase.upcoming).label, 'Phase 1');
const headline = briefHeadline(brief);
assert.equal(headline.delivered.label, 'Dev');
assert.deepEqual(headline.decisions.map((risk) => risk.referenceCode), ['RK004']);
assert.equal(headline.openCount, 3);

const work = selectRecentWork([
  { id: 'a', title: 'Moving', status: 'in_progress', updatedAt: '2026-10-02' },
  { id: 'b', title: 'Finished', status: 'done', updatedAt: '2026-09-01' },
  { id: 'c', title: 'Waiting', status: 'backlog', updatedAt: '2026-10-20' },
]);
assert.deepEqual(work.map((item) => item.title), ['Finished', 'Moving']);
assert.equal(work[0].statusLabel, 'Done');
const current = selectCurrentWork([
  { id: 'a', title: 'Moving', status: 'in_progress', updatedAt: '2026-10-02', detail: 'Still open' },
  { id: 'b', title: 'Finished', status: 'done', updatedAt: '2026-10-20' },
  { id: 'c', title: 'Waiting', status: 'backlog', updatedAt: '2026-10-21' },
]);
assert.deepEqual(current.map((item) => item.title), ['Moving', 'Finished']);
assert.equal(current[0].detail, 'Still open');

console.log('projectSummaryBrief.test.mjs ok');
