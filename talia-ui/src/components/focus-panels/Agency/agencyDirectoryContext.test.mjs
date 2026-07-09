import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENCY_SELECTION_MODES,
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
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.RESERVATION);
  assert.deepEqual(result.rows, [{ agency_id: 10, agency_name: 'Alpha' }]);
});

test('resolveAgencyDirectoryData filters agencies by sail reservations', () => {
  const agencies = [
    { agency_id: 10, agency_name: 'Alpha' },
    { agency_id: 20, agency_name: 'Beta' },
    { agency_id: 30, agency_name: 'Gamma' },
  ];
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [{ agency_id: 10 }, { agency_id: 30 }],
    hasSailSelection: true,
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.SAIL);
  assert.deepEqual(
    result.rows.map((row) => row.agency_id),
    [10, 30]
  );
});

test('resolveAgencyDirectoryData returns full directory with no selection', () => {
  const agencies = [{ agency_id: 1 }, { agency_id: 2 }];
  const result = resolveAgencyDirectoryData({
    agencies,
    reservationAgencyId: null,
    sailReservationRows: [],
    hasSailSelection: false,
  });
  assert.equal(result.mode, AGENCY_SELECTION_MODES.ALL);
  assert.equal(result.rows.length, 2);
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
