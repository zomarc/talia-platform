import assert from 'node:assert/strict';
import {
  buildCommercialCurveOverlay,
  buildCommercialDistribution,
  commercialPaxBucket,
  commercialPppd,
  cumulativeCommercialWeeks,
  indexCommercialByVoyage,
  normalizeCommercialTargets,
} from './commercialBookTargets.js';

assert.equal(normalizeCommercialTargets(undefined), 'off');
assert.equal(normalizeCommercialTargets(false), 'off');
assert.equal(normalizeCommercialTargets('on'), 'on');
assert.equal(commercialPaxBucket('A'), null);
assert.equal(commercialPaxBucket('F'), 'FIT');
assert.equal(commercialPaxBucket('G'), 'Group');

assert.equal(commercialPppd(90.9, 0.136842105, 0.957894735, 7), 94.9);

const weeks = cumulativeCommercialWeeks([
  {
    pax_type: 'F',
    wc_snapshot_date: '2026-07-06',
    guest_count: 10,
    gross_ticket_revenue_eur: 700,
    pax_nights: 70,
    master_voyage_length: 7,
  },
  {
    pax_type: 'A',
    wc_snapshot_date: '2026-07-06',
    guest_count: 99,
    gross_ticket_revenue_eur: 9999,
    pax_nights: 99,
  },
  {
    pax_type: 'G',
    wc_snapshot_date: '2026-07-13',
    guest_count: 5,
    gross_ticket_revenue_eur: 350,
    pax_nights: 35,
    master_voyage_length: 7,
  },
], '2026-07-20', [2, 1, 0]);

assert.equal(weeks[0].guests, 10);
assert.equal(weeks[1].guests, 15);
assert.equal(weeks[2].guests, 15);
assert.equal(weeks[2].pppd, 10);

const indexed = indexCommercialByVoyage([
  { master_voyage: 'CD1', pax_type: 'F', guest_count: 10.4, gross_ticket_revenue_eur: 100 },
  { master_voyage: 'CD1', pax_type: 'G', guest_count: 4, gross_ticket_revenue_eur: 40 },
  { master_voyage: 'CD1', pax_type: 'A', guest_count: 50, gross_ticket_revenue_eur: 500 },
]);
assert.equal(indexed.get('CD1').fitGuests, 10.4);
assert.equal(indexed.get('CD1').groupGuests, 4);
assert.equal(indexed.get('CD1').ticketEur, 140);

const dist = buildCommercialDistribution([
  { pax_type: 'F', guest_count: 10, agency_channel: 'Travel Agency', market_grouping: 'HOME', agency_market: 'UK' },
  { pax_type: 'G', guest_count: 4, agency_channel: 'Direct', market_grouping: 'NORAM', agency_market: 'US' },
  { pax_type: 'A', guest_count: 20, agency_channel: 'Direct', market_grouping: 'HOME', agency_market: 'UK' },
], { marketDimension: 'market_group' });
assert.deepEqual(dist.channelSlices.map((s) => s.label), ['Agency', 'Direct']);
assert.deepEqual(dist.marketSlices.map((s) => s.label), ['HOME', 'NORAM']);
assert.deepEqual(dist.groupFitSlices.map((s) => s.label), ['FIT', 'Group']);

const overlay = buildCommercialCurveOverlay([
  {
    pax_type: 'F',
    wc_snapshot_date: '2026-07-06',
    guest_count: 8,
    gross_ticket_revenue_eur: 80,
    pax_nights: 56,
    market_grouping: 'HOME',
  },
  {
    pax_type: 'G',
    wc_snapshot_date: '2026-07-06',
    guest_count: 2,
    gross_ticket_revenue_eur: 20,
    pax_nights: 14,
    market_grouping: 'NORAM',
  },
], {
  sailDate: '2026-07-20',
  axisWeeks: [2],
  marketDimension: 'market_group',
  splitByDimension: true,
});
assert.equal(overlay.total[0].guests, 10);
assert.equal(overlay.byDimension.length, 2);

console.log('commercialBookTargets tests passed');
