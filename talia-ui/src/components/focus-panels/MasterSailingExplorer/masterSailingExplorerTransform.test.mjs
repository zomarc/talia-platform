import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhysicalBerthsBySailDate,
  buildPhysicalBerthsFromShipDayRows,
  mergeCabinOccupancyOntoBerths,
  buildDayDetailsForMaster,
  buildMasterSailingExplorerBundle,
  buildExplorerDisplayRows,
  buildSellingSegmentSummaries,
  buildGuestsBySailCode,
  masterRowMatchesReference,
  resolvePhysicalDay,
  resolveSelectionReferenceCode,
} from './masterSailingExplorerTransform.js';

const occupancyFixture = [
  { ship_code: 'CJ', sail_code: 'CJ07260718', sail_itinerary_date: '2026-07-18', cabin_category: 'IA', cabin_capacity: 2, total_cabins: 500, occupied_cabins: 400 },
  { ship_code: 'CJ', sail_code: 'CJ07260718', sail_itinerary_date: '2026-07-18', cabin_category: 'IB', cabin_capacity: 2, total_cabins: 100, occupied_cabins: 50 },
  { ship_code: 'CJ', sail_code: 'CJ07260718', sail_itinerary_date: '2026-07-19', cabin_category: 'IA', cabin_capacity: 2, total_cabins: 500, occupied_cabins: 380 },
  { ship_code: 'CJ', sail_code: 'CJ07260718', sail_itinerary_date: '2026-07-19', cabin_category: 'IB', cabin_capacity: 2, total_cabins: 100, occupied_cabins: 40 },
  // Segment sail_code on same ship/day must NOT be added to master physical totals
  { ship_code: 'CJ', sail_code: 'CJ07260719', sail_itinerary_date: '2026-07-19', cabin_category: 'IA', cabin_capacity: 2, total_cabins: 500, occupied_cabins: 10 },
];

test('physical berths are keyed by ship+sail+date without cross-sail summing', () => {
  const index = buildPhysicalBerthsBySailDate(occupancyFixture);
  const masterDay = index.get('CJ|CJ07260718|2026-07-19');
  assert.equal(masterDay.berth_capacity, 1200);
  assert.equal(masterDay.berths_occupied, 840);
  assert.equal(masterDay.berths_available, 360);
});

test('cabin occupancy overlays berth÷2 estimates for Bk C / Tot C', () => {
  const berthIndex = buildPhysicalBerthsFromShipDayRows([
    {
      ship_code: 'CJ',
      sail_code: 'CJ07260718',
      date: '2026-07-18',
      berth_capacity: 1200,
      berths_occupied: 1072,
      berths_available: 128,
    },
  ]);
  assert.equal(berthIndex.get('CJ|CJ07260718|2026-07-18').occupied_cabins, 536);
  const cabinIndex = buildPhysicalBerthsBySailDate([
    {
      ship_code: 'CJ',
      sail_code: 'CJ07260718',
      sail_itinerary_date: '2026-07-18',
      cabin_category: 'IA',
      cabin_capacity: 2,
      total_cabins: 630,
      occupied_cabins: 402,
    },
  ]);
  const merged = mergeCabinOccupancyOntoBerths(berthIndex, cabinIndex);
  const day = merged.get('CJ|CJ07260718|2026-07-18');
  assert.equal(day.berths_occupied, 1072);
  assert.equal(day.occupied_cabins, 402);
  assert.equal(day.total_cabins, 630);
  assert.equal(day.cabin_source, 'sail_by_cabin_occupancy');
});

test('master explorer uses physical berths for booked/capacity not selling guest sums', () => {
  const bundle = buildMasterSailingExplorerBundle({
    masterSailRows: [{
      sail_code: 'CJ07260718',
      ship_code: 'CJ',
      sail_date_from: '2026-07-18',
      sail_date_to: '2026-07-19',
      sail_days: 2,
      ship_name: 'Celestyal Journey',
      is_main: 1,
    }],
    inventoryItems: [
      { sail_code: 'CJ07260718', reference_sail_code: 'CJ07260718', sailing_role: 'master', is_operational: true },
      { sail_code: 'CJ07260719', reference_sail_code: 'CJ07260718', sailing_role: 'segment', is_operational: true },
    ],
    reservationRows: [
      { sail_code: 'CJ07260718', guest_count: 1973, res_id: 44122 },
      { sail_code: 'CJ07260719', guest_count: 195, res_probability: 100 },
    ],
    hierarchyRows: [{
      master_sail_code: 'CJ07260718',
      segment_sail_code: 'CJ07260719',
      sail_date_from: '2026-07-19',
      sail_date_to: '2026-07-20',
      ship_code: 'CJ',
      is_operational: true,
    }],
    occupancyRows: occupancyFixture,
  });

  const master = bundle.masters[0];
  assert.equal(master.total_capacity, 1200);
  assert.equal(master.total_booked, 900);
  assert.equal(master.total_cabins, 600);
  assert.equal(master.booked_cabins, 450);
  assert.equal(master.available_cabins, 150);
  assert.equal(master.guaranteed_cabins, 98);
  assert.equal(master.actual_booked_pct, 75);
  assert.equal(master.potential_booked_pct, 91.25);
  assert.equal(master.booking_upside_pct, 16.25);
  assert.equal(master.selling_guests_total, 2168);
  assert.ok(master.total_booked < master.selling_guests_total);

  const days = bundle.dayDetailsByMaster.get('CJ07260718');
  assert.equal(days[0].booked, 900);
  assert.equal(days[0].booked_cabins, 450);
  assert.equal(days[0].available, 300);
  assert.equal(days[1].booked, 840);
});

test('selling segment summaries show guests only', () => {
  const guestsBySailCode = buildGuestsBySailCode([
    { sail_code: 'CJ07260719', guest_count: 195 },
  ]);
  const summaries = buildSellingSegmentSummaries({
    masterRow: { sail_code: 'CJ07260718', sail_date_from: '2026-07-18', sail_date_to: '2026-07-25' },
    segments: [{ sail_code: 'CJ07260719', sail_date_from: '2026-07-19', sail_date_to: '2026-07-26' }],
    guestsBySailCode,
  });
  assert.equal(summaries.find((s) => s.sail_code === 'CJ07260719').guests, 195);
  assert.equal(summaries.find((s) => s.sail_code === 'CJ07260719').layer, 'selling');
});

test('buildExplorerDisplayRows inserts day rows only for expanded masters', () => {
  const masters = [{ sail_code: 'M1', row_type: 'master', departure_month_label: 'Jul 2026', ship_group_label: 'Ship' }];
  const dayDetailsByMaster = new Map([
    ['M1', [{ row_type: 'day', row_key: 'M1|2026-07-01', day_label: '2026-07-01' }]],
  ]);

  assert.equal(buildExplorerDisplayRows(masters, dayDetailsByMaster, new Set()).length, 1);
  assert.equal(buildExplorerDisplayRows(masters, dayDetailsByMaster, new Set(['M1'])).length, 2);
});

test('resolvePhysicalDay uses master sail_code snapshot only', () => {
  const index = buildPhysicalBerthsBySailDate(occupancyFixture);
  const physical = resolvePhysicalDay({
    shipCode: 'CJ',
    masterSailCode: 'CJ07260718',
    dateKey: '2026-07-19',
    physicalBerthsIndex: index,
  });
  assert.equal(physical.berths_occupied, 840);
});

test('resolveSelectionReferenceCode prefers reference_sail_code', () => {
  assert.equal(
    resolveSelectionReferenceCode({
      sail_code: 'CJ07260719',
      reference_sail_code: 'CJ07260718',
      canonical_scope: { reference_sail_code: 'CJ07260718' },
    }),
    'CJ07260718'
  );
  assert.equal(
    resolveSelectionReferenceCode({ row_data: { sail_code: 'CJ07260718' } }),
    'CJ07260718'
  );
});

test('masterRowMatchesReference matches master and reference sail codes', () => {
  const master = { row_type: 'master', sail_code: 'CJ07260718', reference_sail_code: 'CJ07260718' };
  assert.equal(masterRowMatchesReference(master, 'CJ07260718'), true);
  assert.equal(masterRowMatchesReference({ row_type: 'day', sail_code: 'CJ07260718' }, 'CJ07260718'), false);
  assert.equal(masterRowMatchesReference(master, 'OTHER'), false);
});
