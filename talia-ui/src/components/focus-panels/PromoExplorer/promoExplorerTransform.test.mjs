import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPromoExplorerRows,
  buildPromoExplorerSnapshot,
} from './promoExplorerTransform.js';

test('buildPromoExplorerRows flags deep discount vs baseline', () => {
  const rows = buildPromoExplorerRows([
    {
      sail_code: 'CD01',
      promo_name: '',
      rate_type: 'BAR',
      cabin_category: 'IA',
      fare_per_person: 1000,
      departure_date: '2027-03-01',
    },
    {
      sail_code: 'CD01',
      promo_name: 'Flash Sale',
      promo_type: 'Tactical',
      rate_type: 'PROMO',
      cabin_category: 'IA',
      fare_per_person: 600,
      discount: 40,
      departure_date: '2027-03-01',
    },
    {
      sail_code: 'CD02',
      promo_name: 'Flash Sale',
      promo_type: 'Tactical',
      rate_type: 'PROMO',
      cabin_category: 'IB',
      fare_per_person: 620,
      departure_date: '2027-03-08',
    },
  ], { selectedSailCode: 'CD01', todayIso: '2027-01-01' });

  const flash = rows.find((row) => row.promo_name === 'Flash Sale');
  assert.ok(flash);
  assert.equal(flash.active_on_sail, true);
  assert.equal(flash.worked_before, true);
  assert.equal(flash.detrimental, true);
  assert.ok(flash.flags.includes('deep_discount'));
  assert.equal(flash.sail_count, 2);

  const snap = buildPromoExplorerSnapshot(rows);
  assert.equal(snap.flagged_count >= 1, true);
  assert.equal(snap.active_count >= 1, true);
});
