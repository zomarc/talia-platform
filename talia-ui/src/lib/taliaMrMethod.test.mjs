import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTaliaMaterialisation } from '../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';
import {
  activeCase,
  buildIllustrationCases,
  TALIA_MR_SOURCES,
} from './taliaMrMethod.js';
import { buildTaliaMrMethodExport } from './taliaMrMethodPrint.js';

test('quote illustration does not copy a 100% source rate', () => {
  const worked = buildIllustrationCases().find((item) => item.id === '28657');
  assert.ok(worked);
  assert.ok(Math.abs(worked.explanation.talia_mr - 0.2764375) < 1e-9);
  assert.equal(worked.explanation.taliaExpected, 11);
  assert.equal(worked.explanation.sourceExpected, 40);
  const text = worked.explanation.steps.map((item) => item.sentence).join(' ');
  assert.match(text, /65%/);
  assert.match(text, /cut to 85%/);
  assert.match(text, /15% of that gap/);
  assert.equal(
    worked.explanation.talia_mr,
    computeTaliaMaterialisation(worked.input).talia_mr
  );
});

test('future illustration follows named guests and leaves a close source rate alone', () => {
  const worked = buildIllustrationCases().find((item) => item.id === '55576');
  assert.equal(worked.explanation.talia_mr, 0.58);
  assert.equal(worked.explanation.taliaExpected, 9);
  assert.equal(worked.explanation.sourceExpected, 10);
  const source = worked.explanation.steps.find((item) => item.id === 'source');
  assert.equal(source.applied, false);
  assert.match(source.sentence, /within 5 points/);
  assert.equal(worked.sailed, false);
});

test('pdf names every source and keeps the step sentences', () => {
  const worked = activeCase(buildIllustrationCases(), '28657');
  const html = buildTaliaMrMethodExport({
    subtitle: 'Worked example',
    worked,
    charts: [{ id: 'steps', image: 'javascript:alert(1)' }, { id: 'steps', image: 'data:image/png;base64,abc' }],
  });
  assert.match(html, /background: #ffffff/);
  assert.match(html, /stg\.SW_ETL_GROUPS/);
  assert.match(html, /GROUP_ExpectedAddition/);
  assert.match(html, /data:image\/png/);
  assert.doesNotMatch(html, /javascript:/);
  TALIA_MR_SOURCES.forEach((source) => {
    assert.match(html, new RegExp(source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(html, /Start at 50%/);
});
