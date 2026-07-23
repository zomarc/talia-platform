import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENCY_SELECTION_MODES,
  buildSailScopeKey,
  buildSailScopeKeyFromDetail,
  collectAgencyIdsFromReservations,
  filterAgenciesByIds,
  filterAgenciesForReservation,
  mapSailCodesToReservationFilters,
  resolveAgencyDirectoryData,
  resolveAgencyIdFromDetail,
  resolveReferenceSailCodeFromDetail,
  resolveSailCodesFromDetail,
} from './agencyDirectoryContext.js';

test('resolveSailCodesFromDetail prefers canonical_scope.sail_codes', () => {
  assert.deepEqual(
    resolveSailCodesFromDetail({
      sail_code: 'SEG1',
      canonical_scope: {
        reference_sail_code: 'MASTER1',
        sail_codes: ['MASTER1', 'SEG1', 'SEG2'],
      },
    }),
    ['MASTER1', 'SEG1', 'SEG2']
  );
});

test('resolveSailCodesFromDetail falls back to sail_code', () => {
  assert.deepEqual(resolveSailCodesFromDetail({ sail_code: 'SC001' }), ['SC001']);
});

test('mapSailCodesToReservationFilters uses sail_codes for multi-segment scope', () => {
  assert.deepEqual(
    mapSailCodesToReservationFilters(['MASTER1', 'SEG1']),
    { sail_codes: ['MASTER1', 'SEG1'] }
  );
  assert.deepEqual(
    mapSailCodesToReservationFilters(['SC001']),
    { sail_code: 'SC001' }
  );
});

test('collectAgencyIdsFromReservations dedupes agency_id values', () => {
  const ids = collectAgencyIdsFromReservations([
    { agency_id: 10 },
    { agency_id: '10' },
    { agency_id: 20 },
    { agency_id: null },
  ]);
  assert.deepEqual([...ids].sort(), ['10', '20']);
});

test('filterAgenciesForReservation returns a single agency row', () => {
  const agencies = [
    { agency_id: 10, agency_name: 'Alpha' },
    { agency_id: 20, agency_name: 'Beta' },
  ];
  assert.deepEqual(filterAgenciesForReservation(agencies, 20), [
    { agency_id: 20, agency_name: 'Beta' },
  ]);
});

test('filterAgenciesForReservation returns empty without agency id', () => {
  assert.deepEqual(
    filterAgenciesForReservation([{ agency_id: 1 }], null),
    []
  );
});

test('resolveAgencyDirectoryData prioritizes reservation over sail selection', () => {
  const agencies = [
    { agency_id: 10, agency_name: 'Alpha' },
    { agency_id: 20, agency_name: 'Beta' },
  ];
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: '10',
    sailReservationRows: [{ agency_id: 20 }],
    hasSailSelection: true,
    expectedReservationFiltersKey: '{"include_non_real_sailings":false,"sail_code":"SAIL-A"}',
    loadedReservationFiltersKey: '{"include_non_real_sailings":false,"sail_code":"SAIL-A"}',
    sailReservationsLoading: false,
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.RESERVATION);
  assert.equal(result.pendingSailScope, false);
  assert.deepEqual(result.rows, [{ agency_id: 10, agency_name: 'Alpha' }]);
});

test('resolveAgencyDirectoryData returns sail view once reservation link is cleared', () => {
  const agencies = [
    { agency_id: 10, agency_name: 'Alpha' },
    { agency_id: 20, agency_name: 'Beta' },
  ];
  const filtersKey = '{"include_non_real_sailings":false,"sail_code":"SAIL-B"}';
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [{ agency_id: 20 }, { agency_id: 10 }],
    hasSailSelection: true,
    expectedReservationFiltersKey: filtersKey,
    loadedReservationFiltersKey: filtersKey,
    sailReservationsLoading: false,
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.SAIL);
  assert.deepEqual(
    result.rows.map((row) => row.agency_id),
    [10, 20]
  );
});

test('resolveAgencyDirectoryData filters agencies by sail reservations', () => {
  const agencies = [
    { agency_id: 10, agency_name: 'Alpha' },
    { agency_id: 20, agency_name: 'Beta' },
    { agency_id: 30, agency_name: 'Gamma' },
  ];
  const filtersKey = '{"include_non_real_sailings":false,"sail_codes":["SC001"]}';
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [{ agency_id: 10 }, { agency_id: 30 }],
    hasSailSelection: true,
    expectedReservationFiltersKey: filtersKey,
    loadedReservationFiltersKey: filtersKey,
    sailReservationsLoading: false,
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.SAIL);
  assert.equal(result.pendingSailScope, false);
  assert.deepEqual(
    result.rows.map((row) => row.agency_id),
    [10, 30]
  );
});

test('resolveAgencyDirectoryData waits while sail reservations are loading', () => {
  const agencies = [{ agency_id: 10 }, { agency_id: 20 }];
  const filtersKey = '{"include_non_real_sailings":false,"sail_code":"SAIL-B"}';
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [{ agency_id: 10 }],
    hasSailSelection: true,
    expectedReservationFiltersKey: filtersKey,
    loadedReservationFiltersKey: filtersKey,
    sailReservationsLoading: true,
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.SAIL);
  assert.equal(result.pendingSailScope, true);
  assert.deepEqual(result.rows, []);
});

test('resolveAgencyDirectoryData ignores stale sail rows when filter keys differ', () => {
  const agencies = [{ agency_id: 10 }, { agency_id: 20 }];
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [{ agency_id: 10 }],
    hasSailSelection: true,
    expectedReservationFiltersKey: '{"include_non_real_sailings":false,"sail_code":"SAIL-B"}',
    loadedReservationFiltersKey: '{"include_non_real_sailings":false,"sail_code":"SAIL-A"}',
    sailReservationsLoading: false,
  });
  assert.equal(result.pendingSailScope, true);
  assert.deepEqual(result.rows, []);
});

test('resolveAgencyDirectoryData ignores sail rows before loaded filter key is set', () => {
  const agencies = [{ agency_id: 10 }, { agency_id: 20 }];
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [{ agency_id: 10 }],
    hasSailSelection: true,
    expectedReservationFiltersKey: '{"include_non_real_sailings":false,"sail_code":"SAIL-A"}',
    loadedReservationFiltersKey: null,
    sailReservationsLoading: false,
  });
  assert.equal(result.pendingSailScope, true);
  assert.deepEqual(result.rows, []);
});

test('resolveAgencyDirectoryData returns empty with no selection (never full directory)', () => {
  const agencies = [{ agency_id: 1 }, { agency_id: 2 }];
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [],
    hasSailSelection: false,
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.NONE);
  assert.deepEqual(result.rows, []);
});

test('resolveAgencyIdFromDetail reads row_data agency_id', () => {
  assert.equal(
    resolveAgencyIdFromDetail({ row_data: { agency_id: 42, res_id: 1001 } }),
    '42'
  );
});

test('resolveReferenceSailCodeFromDetail reads canonical scope', () => {
  assert.equal(
    resolveReferenceSailCodeFromDetail({
      canonical_scope: { reference_sail_code: 'REF123' },
    }),
    'REF123'
  );
});

test('filterAgenciesByIds returns empty when no ids match', () => {
  assert.deepEqual(
    filterAgenciesByIds([{ agency_id: 1 }], new Set(['99'])),
    []
  );
});

test('buildSailScopeKey normalizes and sorts sail codes', () => {
  assert.equal(buildSailScopeKey(['SEG2', 'MASTER1', 'SEG1']), 'MASTER1|SEG1|SEG2');
  assert.equal(buildSailScopeKey([]), null);
});

test('buildSailScopeKeyFromDetail uses canonical sail_codes', () => {
  assert.equal(
    buildSailScopeKeyFromDetail({
      canonical_scope: { sail_codes: ['B', 'A'] },
    }),
    'A|B'
  );
});
