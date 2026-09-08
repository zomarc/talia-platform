import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChecklistHeatmap,
  condenseRationale,
  formatActionLabel,
  severityRank,
} from './rmChecklistHeatmapTransform.js';

const finding = (overrides = {}) => ({
  findingId: overrides.findingId || 'f1',
  subjectId: overrides.subjectId || 'CD01',
  subject: {
    sail_code: overrides.subjectId || 'CD01',
    sail_date_from: overrides.date || '2026-09-04',
  },
  severity: overrides.severity || 'action',
  score: overrides.score ?? 0.6,
  actionType: overrides.actionType || 'REVIEW_PRICING',
  rationale: overrides.rationale || 'Price is behind the curve. Review the offer.',
});

describe('condenseRationale', () => {
  it('keeps the first sentence', () => {
    assert.equal(
      condenseRationale('Price is behind the curve. Review the offer.'),
      'Price is behind the curve.'
    );
  });

  it('truncates a long first sentence', () => {
    const next = condenseRationale('A'.repeat(160), 40);
    assert.equal(next.endsWith('…'), true);
    assert.ok(next.length <= 40);
  });
});

describe('buildChecklistHeatmap', () => {
  it('labels known actions and ranks severity', () => {
    assert.equal(formatActionLabel('REVIEW_PRICING'), 'Pricing');
    assert.ok(severityRank('critical') > severityRank('action'));
  });

  it('builds date × action cells using the worst severity', () => {
    const grid = buildChecklistHeatmap([
      finding({
        findingId: 'a',
        date: '2026-09-07',
        actionType: 'REVIEW_TARGET',
        severity: 'info',
      }),
      finding({
        findingId: 'b',
        date: '2026-09-04',
        actionType: 'REVIEW_PRICING',
        severity: 'action',
        rationale: 'Offer is soft versus the target load factor.',
      }),
      finding({
        findingId: 'c',
        date: '2026-09-04',
        actionType: 'REVIEW_PRICING',
        severity: 'critical',
        score: 0.9,
        rationale: 'Occupancy is 16 points behind with 12 days to sail.',
      }),
    ]);

    assert.deepEqual(grid.dates, ['2026-09-04', '2026-09-07']);
    assert.deepEqual(grid.actions.map((item) => item.id), ['REVIEW_PRICING', 'REVIEW_TARGET']);
    const pricing = grid.rows[0].cells.find((cell) => cell.action === 'REVIEW_PRICING');
    assert.equal(pricing.severity, 'critical');
    assert.equal(pricing.count, 2);
    assert.match(pricing.tooltip, /Occupancy is 16 points behind/);
    assert.equal(grid.rows[1].cells.find((cell) => cell.action === 'REVIEW_PRICING').empty, true);
  });
});
