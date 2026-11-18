import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessLineageCoverage,
  buildSuggestedKeySet,
  countAttributedColumns,
  filterRowsByCoverage,
  filterRowsByKey,
  indexKeyPanels,
  summarizeLineageCoverage,
  withLineageCoverage,
} from './dataLineageCoverage.js';

test('suggested keys use 28d opens guide', () => {
  const set = buildSuggestedKeySet([
    { panelComponent: 'a', openCount: 10 },
    { panelComponent: 'b', openCount: 2 },
    { panelComponent: 'c', openCount: 5 },
  ], { minOpens: 3, topN: 2 });
  assert.ok(set.has('a'));
  assert.ok(set.has('c'));
  assert.ok(!set.has('b'));
});

test('coverage flags missing columns on key panels only as issues', () => {
  const rows = withLineageCoverage([
    {
      id: 'component:Pack',
      kind: 'component',
      componentKey: 'SeasonalTradingPack',
      panelId: 'seasonal-trading-pack',
      title: 'Seasonal Trading Pack',
      tableCount: 2,
      tables: [
        { taliaTable: 'reservation', sourceLabel: 'stg.RES_HEADER' },
        { taliaTable: 'budget', sourceLabel: 'lkp.BUDGET' },
      ],
      columns: [],
    },
  ], {
    keySet: indexKeyPanels([{ panelComponent: 'seasonal-trading-pack', isKey: true }]),
    suggestedSet: new Set(),
    fieldByPanel: new Map(),
    panelTableColumns: {},
    syncTableColumns: {},
  });
  assert.equal(rows[0].isKey, true);
  assert.equal(rows[0].coverageStatus, 'missing_columns');
  assert.equal(rows[0].coverageGap, true);
  assert.equal(rows[0].coverageIssue, true);
});

test('non-key gaps are informational not issues', () => {
  const rows = withLineageCoverage([
    {
      id: 'component:X',
      kind: 'component',
      componentKey: 'X',
      panelId: 'x',
      title: 'X',
      tableCount: 1,
      tables: [{ taliaTable: 'agency', sourceLabel: 'dwh.Dim_Agency' }],
      columns: [],
    },
  ], {
    keySet: new Set(),
    suggestedSet: new Set(['x']),
  });
  assert.equal(rows[0].isSuggested, true);
  assert.equal(rows[0].coverageGap, true);
  assert.equal(rows[0].coverageIssue, false);
});

test('attributed columns count overrides and matching fields', () => {
  const n = countAttributedColumns({
    tables: ['reservation'],
    panelColumns: [{ name: 'group_id' }],
    tabulatorFields: ['sail_code', 'presenterOnly'],
    panelTableColumns: { reservation: ['sail_code'] },
    syncTableColumns: { reservation: ['sail_code', 'res_id'] },
  });
  assert.equal(n, 2);
});

test('key and issues filters', () => {
  const rows = [
    { id: '1', isKey: true, isSuggested: false, coverageIssue: true, coverageGap: true },
    { id: '2', isKey: false, isSuggested: true, coverageIssue: false, coverageGap: true },
    { id: '3', isKey: true, isSuggested: false, coverageIssue: false, coverageGap: false },
  ];
  assert.equal(filterRowsByKey(rows, 'key').length, 2);
  assert.equal(filterRowsByKey(rows, 'suggested').length, 3);
  assert.equal(filterRowsByCoverage(rows, 'issues').length, 1);
  const summary = summarizeLineageCoverage(rows);
  assert.equal(summary.keyCount, 2);
  assert.equal(summary.keyIssueCount, 1);
});

test('table coverage missing source', () => {
  const result = assessLineageCoverage({ kind: 'table', synapseSource: '—' });
  assert.equal(result.status, 'missing_source');
  assert.equal(result.isIssue, true);
});
