import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildReservationHoverIndex,
  normalizeProbabilityPct,
} from './reservationHover.js';

describe('normalizeProbabilityPct', () => {
  it('treats 0–1 fractions as percent', () => {
    assert.equal(normalizeProbabilityPct(0.8), 80);
  });

  it('clamps 0–100 values', () => {
    assert.equal(normalizeProbabilityPct(100), 100);
    assert.equal(normalizeProbabilityPct(73.4), 73.4);
    assert.equal(normalizeProbabilityPct(150), 100);
  });

  it('returns null for missing', () => {
    assert.equal(normalizeProbabilityPct(null), null);
    assert.equal(normalizeProbabilityPct(''), null);
  });
});

describe('buildReservationHoverIndex', () => {
  const rows = [
    {
      res_id: 101,
      res_status: 'BK',
      pax_type: 'F',
      agency_id: 55,
      guest_count: 2,
      res_probability: 100,
      net_ticket_revenue_eur: 1000,
      cabin_category: 'IC',
      currency: 'EUR',
    },
    {
      res_id: 102,
      res_status: 'OF',
      pax_type: 'F',
      agency_id: 55,
      guest_count: 4,
      res_probability: 50,
      net_ticket_revenue_eur: 2000,
      cabin_category: 'XB',
      currency: 'EUR',
    },
    {
      res_id: 103,
      res_status: 'CX',
      pax_type: 'G',
      agency_id: 55,
      guest_count: 6,
      res_probability: 100,
      net_ticket_revenue_eur: 3000,
      cabin_category: 'SJC',
    },
    {
      res_id: 201,
      res_status: 'BK',
      pax_type: 'G',
      group_id: 'G1',
      agency_id: 99,
      guest_count: 3,
      res_probability: 80,
      net_ticket_revenue_eur: 1500,
      cabin_category: 'XD',
    },
  ];

  const agencyById = new Map([
    ['55', { agency_id: 55, agency_name: 'Acme Travel' }],
  ]);

  it('builds O(1) cards with sail-scoped agency totals', () => {
    const index = buildReservationHoverIndex(rows, agencyById);
    const card = index.get('101');
    assert.ok(card);
    assert.equal(card.composition, 'FIT');
    assert.equal(card.agencyName, 'Acme Travel');
    assert.equal(card.probabilityPct, 100);
    assert.equal(card.cabinCategory, 'IC');
    assert.equal(card.bookedCabin, null);
    assert.equal(card.upgradeValue, null);

    // Cancelled excluded from agency active totals.
    assert.equal(card.agencyOnSail.bookingCount, 2);
    assert.equal(card.agencyOnSail.guestTotal, 6);
    assert.equal(card.agencyOnSail.netRevenueEur, 3000);
    // Other = OF only (4 guests × 50%).
    assert.equal(card.agencyOnSail.otherBookingCount, 1);
    assert.equal(card.agencyOnSail.otherExpectedPax, 2);
  });

  it('weights other expected pax by probability and excludes self', () => {
    const index = buildReservationHoverIndex(rows, agencyById);
    const ofCard = index.get('102');
    assert.equal(ofCard.agencyOnSail.otherBookingCount, 1);
    // Other = BK 101: 2 guests × 100% = 2
    assert.equal(ofCard.agencyOnSail.otherExpectedPax, 2);
  });

  it('classifies Group from pax_type', () => {
    const index = buildReservationHoverIndex(rows, agencyById);
    assert.equal(index.get('201').composition, 'Group');
    assert.equal(index.get('201').agencyOnSail.bookingCount, 1);
    assert.equal(index.get('201').agencyOnSail.otherBookingCount, 0);
  });
});
