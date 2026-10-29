import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceMrReviewExport } from './sourceMrReviewPrint.js';
import { summariseExposure } from './sourceMrExposure.js';

const payload = buildSourceMrReviewExport({
  statusFilter: 'QT',
  includeDetails: true,
  review: {
    feedThrough: '2025-02-10',
    groupCount: 13965,
    statuses: [{
      status: 'QT',
      label: 'Quote',
      sailedGroups: 3909,
      sailedRequestedGuests: 170913,
      sailedNamedGuests: 0,
      sailedSourceExpectedGuests: 170431,
      sailedTaliaExpectedGuests: 47174,
      sailedRealisedRate: 0,
      openGroups: 1824,
      openRequestedGuests: 78462,
      openSourceExpectedGuests: 78456,
      openTaliaExpectedGuests: 21689,
    }],
    bands: [{
      status: 'QT',
      band: '90–100',
      groups: 3880,
      requestedGuests: 169154,
      namedGuests: 0,
      sourceExpectedGuests: 169154,
      taliaExpectedGuests: 46761,
      realisedRate: 0,
    }, {
      status: 'BK',
      band: '90–100',
      groups: 1,
      requestedGuests: 10,
      namedGuests: 10,
      sourceExpectedGuests: 10,
      taliaExpectedGuests: 10,
      realisedRate: 1,
    }],
    months: [{
      status: 'QT',
      month: '2024-06',
      requestedGuests: 13562,
      namedGuests: 0,
      sourceExpectedGuests: 13562,
      taliaExpectedGuests: 3749,
    }],
    allocations: [{
      ownerType: 'GROUP',
      allocationRows: 183234,
      owners: 12000,
      avgProbability: 83.25,
    }],
  },
  selectedGroup: {
    groupId: '28657',
    shipCode: 'CO',
    sailDateFrom: '2024-06-28',
    requestedGuests: 40,
    namedGuests: 0,
    sourceMr: 1,
    taliaMr: 0.28,
    sourceExpectedGuests: 40,
    taliaExpectedGuests: 11,
  },
  history: [{
    changedDate: '2023-08-01',
    status: 'QT',
    requestedGuests: 40,
    probability: 100,
    manual: false,
  }],
});

test('export follows the tables on screen', () => {
  assert.equal(payload.title, 'Source MR effectiveness');
  assert.match(payload.html, /123,257/);
  assert.match(payload.html, /Exposure on sailed groups/);
  const exposure = summariseExposure(payload ? [{
    sailedGroups: 3909,
    sailedSourceExpectedGuests: 170431,
    sailedTaliaExpectedGuests: 47174,
    sailedNamedGuests: 0,
  }] : []);
  assert.equal(exposure.sourceAboveTalia, 123257);
  assert.equal(exposure.sourceAboveNamed, 170431);
  assert.ok(payload.subtitle.includes('10 Feb 2025'));
  assert.ok(payload.html.includes('background: #ffffff'));
  assert.ok(payload.html.includes('170,431'));
  assert.ok(payload.html.includes('47,174'));
  assert.ok(payload.html.includes('Quote calibration'));
  assert.ok(payload.html.includes('90–100'));
  assert.equal(payload.html.includes('Booked calibration'), false);
  assert.ok(payload.html.includes('Jun 2024'));
  assert.ok(payload.html.includes('GROUP'));
  assert.ok(payload.html.includes('83%'));
  assert.ok(payload.html.includes('28657'));
  assert.ok(payload.html.includes('01 Aug 2023'));
  assert.ok(payload.rows.some((entry) => entry.section === 'Departed' && entry.named === '0'));
  assert.ok(payload.rows.some((entry) => entry.section === 'History'));
  assert.equal(JSON.stringify(payload.rows).includes('group_expected_addition'), false);
  assert.equal(payload.html.includes('<img'), false);
});

test('pdf html includes the charts that are on screen', () => {
  const withCharts = buildSourceMrReviewExport({
    statusFilter: 'QT',
    review: {
      feedThrough: '2025-02-10',
      groupCount: 1,
      statuses: [],
    },
    charts: [
      { id: 'status', title: 'Source expected against Talia expected', image: 'data:image/png;base64,abc' },
      { id: 'month', title: 'Quote by sail month', image: 'data:image/png;base64,def' },
      { id: 'month', title: 'Ignored', image: 'javascript:alert(1)' },
    ],
  });
  assert.match(withCharts.html, /<img src="data:image\/png;base64,abc" alt="Source expected against Talia expected"/);
  assert.match(withCharts.html, /<img src="data:image\/png;base64,def" alt="Quote by sail month"/);
  assert.equal(withCharts.html.includes('javascript:'), false);
});
