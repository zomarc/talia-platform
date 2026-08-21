import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CABIN_CATEGORY_MODE,
  indexCabinCategoryGroups,
} from '../../../lib/cabinCategoryGroups.js';
import {
  PRESSURE_FLAGS,
  PRESSURE_GRAINS,
  addUtcDays,
  buildPhysicalShipDays,
  buildPressureGrid,
  buildSailWindows,
  classifyPressure,
  dateInVoyageSpan,
  explodeDemandOntoDays,
  enumerateDateKeys,
  expandDateWindowForSailImpact,
  resolveSellableCabins,
  resolveSellableBerths,
  resolvePressureDateSpine,
  resolveSelectionRowBand,
  buildCategoryShipDays,
  splitBookedBySailingRole,
} from './shipDayPressureTransform.js';

test('enumerateDateKeys is inclusive UTC', () => {
  assert.deepEqual(enumerateDateKeys('2026-09-01', '2026-09-03'), [
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
  ]);
  assert.equal(addUtcDays('2026-09-01', 2), '2026-09-03');
});

test('physical ship-day uses MAX capacity across overlapping sails', () => {
  const rows = buildPhysicalShipDays([
    { ship_code: 'JOURNEY', date: '2026-09-05', sail_code: 'M7', sellable_berths: 1000, occupied_berths: 400 },
    { ship_code: 'JOURNEY', date: '2026-09-05', sail_code: 'S3', sellable_berths: 1000, occupied_berths: 420 },
  ], [{ ship_code: 'JOURNEY', ship_name: 'Journey' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sellable, 1000);
  assert.equal(rows[0].occupied, 420);
  assert.deepEqual(rows[0].sail_codes.sort(), ['M7', 'S3']);
});

test('demand explodes onto every occupancy day of the sail', () => {
  const windows = buildSailWindows(
    [{ sail_code: 'M7', ship_code: 'JOURNEY', reference_sail_code: 'M7', sailing_role: 'master' }],
    [{ sail_code: 'M7', ship_code: 'JOURNEY', sail_date_from: '2026-09-05', sail_date_to: '2026-09-11', sail_days: 7, is_main: 1 }]
  );
  windows.get('M7').occupancy_dates = new Set(enumerateDateKeys('2026-09-05', '2026-09-11'));
  const demand = explodeDemandOntoDays(
    [{ sail_code: 'M7', booked_guests: 100, estimated_guests: 20, contracted_guests: 40 }],
    windows
  );
  assert.equal(demand.get('JOURNEY|2026-09-05').booked, 100);
  assert.equal(demand.get('JOURNEY|2026-09-11').booked, 100);
  assert.equal(demand.get('JOURNEY|2026-09-05').booked_master, 100);
  assert.equal(demand.get('JOURNEY|2026-09-05').booked_segment, 0);
  assert.equal(demand.get('JOURNEY|2026-09-04'), undefined);
});

test('splitBookedBySailingRole separates master from segment', () => {
  const split = splitBookedBySailingRole([
    { sail_code: 'M7', reference_sail_code: 'M7', sailing_role: 'master', booked: 120 },
    { sail_code: 'S3', reference_sail_code: 'M7', sailing_role: 'segment', booked: 40 },
    { sail_code: 'S4', reference_sail_code: 'M7', sailing_role: 'segment', booked: 10 },
  ]);
  assert.equal(split.booked_master, 120);
  assert.equal(split.booked_segment, 50);
});

test('explodeDemandOntoDays carries FIT and Group booked splits', () => {
  const windows = buildSailWindows(
    [{ sail_code: 'M7', ship_code: 'JOURNEY', reference_sail_code: 'M7', sailing_role: 'master' }],
    [{ sail_code: 'M7', ship_code: 'JOURNEY', sail_date_from: '2026-09-05', sail_date_to: '2026-09-07', sail_days: 3, is_main: 1 }]
  );
  windows.get('M7').occupancy_dates = new Set(['2026-09-05']);
  const demand = explodeDemandOntoDays(
    [{
      sail_code: 'M7',
      booked_guests: 100,
      booked_fit_guests: 70,
      booked_group_guests: 30,
      estimated_guests: 0,
      contracted_guests: 0,
    }],
    windows
  );
  const day = demand.get('JOURNEY|2026-09-05');
  assert.equal(day.booked, 100);
  assert.equal(day.booked_fit, 70);
  assert.equal(day.booked_group, 30);
  assert.equal(day.booked_master, 100);
});

test('blocking when a high-occupancy day sits in a sparse longer voyage', () => {
  const dates = enumerateDateKeys('2026-09-05', '2026-09-11');
  const physicalByKey = new Map();
  dates.forEach((date) => {
    const occupied = date === '2026-09-07' ? 900 : 200;
    physicalByKey.set(`JOURNEY|${date}`, {
      ship_code: 'JOURNEY',
      date,
      sellable: 1000,
      occupied,
    });
  });
  const windows = buildSailWindows(
    [{ sail_code: 'M7', ship_code: 'JOURNEY', reference_sail_code: 'M7', sailing_role: 'master' }],
    [{ sail_code: 'M7', ship_code: 'JOURNEY', sail_date_from: '2026-09-05', sail_date_to: '2026-09-11', sail_days: 7, is_main: 1 }]
  );
  windows.get('M7').occupancy_dates = new Set(dates);
  windows.get('M7').nights = 7;
  const classified = classifyPressure({
    ship_code: 'JOURNEY',
    date: '2026-09-07',
    sellable: 1000,
    occupied: 900,
    booked: 200,
    estimated: 10,
  }, physicalByKey, windows);
  assert.equal(classified.flag, PRESSURE_FLAGS.BLOCKING);
  assert.match(classified.reasons[0], /blocking/i);
});

test('soft_group when estimated dwarfs booked versus remaining', () => {
  const classified = classifyPressure({
    ship_code: 'JOURNEY',
    date: '2026-09-07',
    sellable: 1000,
    occupied: 400,
    booked: 100,
    estimated: 400,
  }, new Map(), new Map());
  assert.equal(classified.flag, PRESSURE_FLAGS.SOFT_GROUP);
});

test('voyage grain does not invent a second physical pool', () => {
  const cells = [{
    ship_code: 'JOURNEY',
    ship_name: 'Journey',
    date: '2026-09-07',
    sellable: 1000,
    occupied: 400,
    booked: 80,
    estimated: 10,
    contracted: 20,
    flag: PRESSURE_FLAGS.OK,
    reasons: [],
    sail_codes: ['M7', 'S3'],
    by_sail: [
      { sail_code: 'M7', reference_sail_code: 'M7', sailing_role: 'master', booked: 50, estimated: 5, contracted: 10 },
      { sail_code: 'S3', reference_sail_code: 'M7', sailing_role: 'segment', booked: 30, estimated: 5, contracted: 10 },
    ],
  }];
  const windows = buildSailWindows(
    [{ sail_code: 'M7', ship_code: 'JOURNEY', ship_name: 'Journey', reference_sail_code: 'M7', sailing_role: 'master' }],
    []
  );
  const grid = buildPressureGrid({ cells, windows, grain: PRESSURE_GRAINS.VOYAGE });
  assert.equal(grid.columns[0].kind, 'day');
  assert.equal(grid.columns[0].label, 'Day');
  assert.equal(grid.columns[1].id, 'M7');
  assert.equal(grid.columns[1].title_full, 'M7');
  assert.equal(grid.columns.length, 2);
  assert.equal(grid.rows[0].M7.sellable, 1000);
  assert.equal(grid.rows[0].M7.booked, 80);
  assert.equal(grid.rows[0].M7.booked_master, 50);
  assert.equal(grid.rows[0].M7.booked_segment, 30);
  assert.equal(grid.rows[0]['__day__::JOURNEY'].grain, 'day');
  assert.equal(grid.rows[0]['__day__::JOURNEY'].booked, 80);
});

test('sellable cabins is nameplate minus offsale when the view field is absent', () => {
  assert.equal(resolveSellableCabins({ nameplate_cabins: 630, offsale_cabins: 12 }), 618);
  assert.equal(resolveSellableCabins({ nameplate_cabins: 630, offsale_cabins: 12, sellable_cabins: 600 }), 600);
  assert.equal(resolveSellableBerths({ nameplate_berths: 1693, offsale_berths: 20 }), 1673);
  const rows = buildPhysicalShipDays([
    {
      ship_code: 'JOURNEY',
      date: '2026-09-05',
      sail_code: 'M7',
      nameplate_cabins: 630,
      offsale_cabins: 12,
      occupied_cabins: 400,
      sellable_berths: 1673,
      occupied_berths: 800,
    },
  ], [{ ship_code: 'JOURNEY', ship_name: 'Journey' }]);
  assert.equal(rows[0].sellable_cabins, 618);
  assert.equal(rows[0].sellable_berths, 1673);
  assert.equal(rows[0].occupied_cabins, 400);
});

test('voyage grain only columns overlapping the date window', () => {
  const cells = [{
    ship_code: 'JOURNEY',
    ship_name: 'Journey',
    date: '2026-09-07',
    sellable: 1000,
    occupied: 400,
    booked: 80,
    estimated: 10,
    contracted: 20,
    flag: PRESSURE_FLAGS.OK,
    reasons: [],
    sail_codes: ['NEAR'],
    by_sail: [
      { sail_code: 'NEAR', reference_sail_code: 'NEAR', booked: 80, estimated: 10, contracted: 20 },
    ],
  }];
  const windows = buildSailWindows(
    [
      { sail_code: 'NEAR', ship_code: 'JOURNEY', ship_name: 'Journey', reference_sail_code: 'NEAR', sailing_role: 'master' },
      { sail_code: 'FAR', ship_code: 'JOURNEY', ship_name: 'Journey', reference_sail_code: 'FAR', sailing_role: 'master' },
    ],
    [
      { sail_code: 'NEAR', ship_code: 'JOURNEY', sail_date_from: '2026-09-05', sail_date_to: '2026-09-11', sail_days: 7, is_main: 1 },
      { sail_code: 'FAR', ship_code: 'JOURNEY', sail_date_from: '2027-01-01', sail_date_to: '2027-01-07', sail_days: 7, is_main: 1 },
    ]
  );
  windows.get('NEAR').occupancy_dates = new Set(['2026-09-07']);
  windows.get('FAR').occupancy_dates = new Set(['2027-01-01']);
  const grid = buildPressureGrid({
    cells,
    windows,
    grain: PRESSURE_GRAINS.VOYAGE,
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30',
  });
  assert.deepEqual(grid.columns.map((col) => col.id), ['__day__::JOURNEY', 'NEAR']);
});

test('voyage grain caps columns so Tabulator cannot mount thousands of sailings', () => {
  const windows = new Map();
  for (let i = 0; i < 80; i += 1) {
    const id = `V${String(i).padStart(2, '0')}`;
    windows.set(id, {
      sail_code: id,
      ship_code: 'JOURNEY',
      ship_name: 'Journey',
      reference_sail_code: id,
      sailing_role: 'master',
      date_from: '2026-09-01',
      date_to: '2026-09-07',
      occupancy_dates: new Set(['2026-09-05']),
    });
  }
  const grid = buildPressureGrid({
    cells: [{
      ship_code: 'JOURNEY',
      ship_name: 'Journey',
      date: '2026-09-05',
      sellable: 1000,
      occupied: 1,
      booked: 1,
      estimated: 0,
      contracted: 0,
      flag: PRESSURE_FLAGS.OK,
      reasons: [],
      sail_codes: [],
      by_sail: [],
    }],
    windows,
    grain: PRESSURE_GRAINS.VOYAGE,
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30',
  });
  assert.equal(grid.columns.filter((col) => col.kind === 'voyage').length, 48);
  assert.equal(grid.columns[0].kind, 'day');
});

test('category occupancy sums berth-config splits then MAX across overlapping sails', () => {
  const { byShipDateCat } = buildCategoryShipDays([
    { ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-05', cabin_category: 'IA', total_cabins: 40, occupied_cabins: 30, remaining_cabins: 10 },
    { ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-05', cabin_category: 'IA', total_cabins: 10, occupied_cabins: 8, remaining_cabins: 2 },
    { ship_code: 'CJ', sail_code: 'S3', sail_itinerary_date: '2026-09-05', cabin_category: 'IA', total_cabins: 50, occupied_cabins: 20, remaining_cabins: 30 },
  ]);
  const ia = byShipDateCat.get('CJ|2026-09-05|IA');
  assert.equal(ia.total, 50);
  assert.equal(ia.occupied, 38);
});

test('group mode rolls real cabin codes into generic_category via cabin_ctg', () => {
  const cabinCtgIndex = indexCabinCategoryGroups([
    { cabin_code: 'IA', generic_category: 'INSIDE', active_record_flag: 1 },
    { cabin_code: 'IB', generic_category: 'INSIDE', active_record_flag: 1 },
    { cabin_code: 'XA', generic_category: 'OUTSIDE', active_record_flag: 1 },
  ]);
  const { byShipDateCat, cabinCategoryMode } = buildCategoryShipDays(
    [
      { ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-05', cabin_category: 'IA', total_cabins: 40, occupied_cabins: 20, remaining_cabins: 20 },
      { ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-05', cabin_category: 'IB', total_cabins: 30, occupied_cabins: 10, remaining_cabins: 20 },
      { ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-05', cabin_category: 'XA', total_cabins: 25, occupied_cabins: 5, remaining_cabins: 20 },
      { ship_code: 'CJ', sail_code: 'S3', sail_itinerary_date: '2026-09-05', cabin_category: 'IA', total_cabins: 40, occupied_cabins: 15, remaining_cabins: 25 },
      { ship_code: 'CJ', sail_code: 'S3', sail_itinerary_date: '2026-09-05', cabin_category: 'IB', total_cabins: 30, occupied_cabins: 8, remaining_cabins: 22 },
    ],
    null,
    null,
    { cabinCategoryMode: CABIN_CATEGORY_MODE.GROUP, cabinCtgIndex }
  );
  assert.equal(cabinCategoryMode, CABIN_CATEGORY_MODE.GROUP);
  const inside = byShipDateCat.get('CJ|2026-09-05|INSIDE');
  const outside = byShipDateCat.get('CJ|2026-09-05|OUTSIDE');
  assert.equal(inside.total, 70);
  assert.equal(inside.occupied, 30);
  assert.equal(outside.total, 25);
  assert.equal(outside.occupied, 5);
  assert.equal(byShipDateCat.has('CJ|2026-09-05|IA'), false);
});

test('real mode keeps cabin codes even when cabin_ctg is present', () => {
  const cabinCtgIndex = indexCabinCategoryGroups([
    { cabin_code: 'IA', generic_category: 'INSIDE', active_record_flag: 1 },
  ]);
  const { byShipDateCat } = buildCategoryShipDays(
    [{ ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-05', cabin_category: 'IA', total_cabins: 40, occupied_cabins: 20, remaining_cabins: 20 }],
    null,
    null,
    { cabinCategoryMode: CABIN_CATEGORY_MODE.REAL, cabinCtgIndex }
  );
  assert.ok(byShipDateCat.get('CJ|2026-09-05|IA'));
  assert.equal(byShipDateCat.has('CJ|2026-09-05|INSIDE'), false);
});

test('blocking when a cabin category is full today but sparse on the rest of the longer voyage', () => {
  const dates = enumerateDateKeys('2026-09-05', '2026-09-11');
  const physicalByKey = new Map();
  dates.forEach((date) => {
    physicalByKey.set(`CJ|${date}`, {
      ship_code: 'CJ',
      date,
      sellable: 1000,
      occupied: 400,
    });
  });
  const windows = buildSailWindows(
    [{ sail_code: 'M7', ship_code: 'CJ', reference_sail_code: 'M7', sailing_role: 'master' }],
    [{ sail_code: 'M7', ship_code: 'CJ', sail_date_from: '2026-09-05', sail_date_to: '2026-09-11', sail_days: 7, is_main: 1 }]
  );
  windows.get('M7').occupancy_dates = new Set(dates);
  windows.get('M7').nights = 7;
  const occupancy = dates.flatMap((date) => ([{
    ship_code: 'CJ',
    sail_code: 'M7',
    sail_itinerary_date: date,
    cabin_category: 'IA',
    total_cabins: 50,
    occupied_cabins: date === '2026-09-07' ? 49 : 10,
    remaining_cabins: date === '2026-09-07' ? 1 : 40,
  }]));
  const categoryDays = buildCategoryShipDays(occupancy);
  const classified = classifyPressure({
    ship_code: 'CJ',
    date: '2026-09-07',
    sellable: 1000,
    occupied: 400,
    booked: 200,
    estimated: 10,
  }, physicalByKey, windows, categoryDays);
  assert.equal(classified.flag, PRESSURE_FLAGS.BLOCKING);
  assert.equal(classified.blocking_categories[0].category, 'IA');
  assert.match(classified.reasons[0], /IA/i);
});

test('ship filter keeps only that ship and cabin grain columns are categories', () => {
  const cells = [
    { ship_code: 'CD', ship_name: 'Discovery', date: '2026-09-07', sellable: 1000, occupied: 100, booked: 10, estimated: 0, contracted: 0, flag: PRESSURE_FLAGS.OK, reasons: [], sail_codes: [], by_sail: [], blocking_categories: [] },
    { ship_code: 'CJ', ship_name: 'Journey', date: '2026-09-07', sellable: 1000, occupied: 100, booked: 10, estimated: 0, contracted: 0, flag: PRESSURE_FLAGS.OK, reasons: [], sail_codes: [], by_sail: [], blocking_categories: [] },
  ];
  const shipGrid = buildPressureGrid({
    cells,
    windows: new Map(),
    grain: PRESSURE_GRAINS.SHIP,
    shipFilter: 'CJ',
  });
  assert.deepEqual(shipGrid.columns.map((col) => col.id), ['CJ']);

  const categoryDays = buildCategoryShipDays([
    { ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-07', cabin_category: 'IA', total_cabins: 50, occupied_cabins: 20, remaining_cabins: 30 },
    { ship_code: 'CJ', sail_code: 'M7', sail_itinerary_date: '2026-09-07', cabin_category: 'XA', total_cabins: 40, occupied_cabins: 10, remaining_cabins: 30 },
    { ship_code: 'CD', sail_code: 'N7', sail_itinerary_date: '2026-09-07', cabin_category: 'IA', total_cabins: 80, occupied_cabins: 10, remaining_cabins: 70 },
  ]);
  const cabinGrid = buildPressureGrid({
    cells,
    windows: new Map(),
    categoryDays,
    grain: PRESSURE_GRAINS.CABIN,
    shipFilter: 'CJ',
    dateFrom: '2026-09-07',
    dateTo: '2026-09-07',
  });
  assert.deepEqual(cabinGrid.columns.map((col) => col.category), ['IA', 'XA']);
  assert.equal(cabinGrid.rows[0]['CJ::IA'].sellable_cabins, 50);
  assert.equal(cabinGrid.rows[0]['CJ::IA'].grain, 'cabin');
});

test('expandDateWindowForSailImpact pulls earlier overlapping same-ship sails', () => {
  const windows = buildSailWindows(
    [
      { sail_code: 'M7', ship_code: 'CJ', reference_sail_code: 'M7', sailing_role: 'master' },
      { sail_code: 'S3', ship_code: 'CJ', reference_sail_code: 'S3', sailing_role: 'master' },
    ],
    [
      { sail_code: 'M7', ship_code: 'CJ', sail_date_from: '2026-09-05', sail_date_to: '2026-09-11', sail_days: 7, is_main: 1 },
      { sail_code: 'S3', ship_code: 'CJ', sail_date_from: '2026-09-01', sail_date_to: '2026-09-04', sail_days: 4, is_main: 1 },
    ]
  );

  const expanded = expandDateWindowForSailImpact({
    dateFrom: '2026-09-05',
    dateTo: '2026-10-18',
    windows,
    referenceSailCode: 'M7',
    shipCode: 'CJ',
  });
  // S3 ends before M7 starts — no overlap, so impact stays on M7 only
  assert.equal(expanded.from, '2026-09-05');
  assert.equal(expanded.impactFrom, '2026-09-05');

  windows.get('S3').date_to = '2026-09-06';
  windows.get('S3').occupancy_dates = new Set(enumerateDateKeys('2026-09-01', '2026-09-06'));
  const overlapping = expandDateWindowForSailImpact({
    dateFrom: '2026-09-05',
    dateTo: '2026-10-18',
    windows,
    referenceSailCode: 'M7',
    shipCode: 'CJ',
  });
  assert.equal(overlapping.from, '2026-09-01');
  assert.equal(overlapping.impactFrom, '2026-09-01');
  assert.equal(overlapping.to, '2026-10-18');

  const spine = resolvePressureDateSpine({
    dateFrom: '2026-09-01',
    dateTo: '2026-09-03',
    cellDates: ['2026-09-01'],
  });
  assert.deepEqual(spine, ['2026-09-01', '2026-09-02', '2026-09-03']);

  assert.equal(dateInVoyageSpan('2026-09-07', { date_from: '2026-09-05', date_to: '2026-09-11' }), true);
  assert.equal(dateInVoyageSpan('2026-09-04', { date_from: '2026-09-05', date_to: '2026-09-11' }), false);
});

test('resolveSelectionRowBand focuses departure and shades impact span', () => {
  const band = resolveSelectionRowBand({
    voyageCol: {
      id: 'M7',
      date_from: '2026-09-05',
      date_to: '2026-09-11',
    },
    impactFrom: '2026-09-01',
    impactTo: '2026-09-12',
  });
  assert.equal(band.focusDate, '2026-09-05');
  assert.equal(band.impactFrom, '2026-09-01');
  assert.equal(band.impactTo, '2026-09-12');

  const inferred = resolveSelectionRowBand({
    voyageCol: { id: 'M7', date_from: '2026-09-05', date_to: null },
    rows: [
      { date: '2026-09-05', M7: { booked: 1 } },
      { date: '2026-09-06', M7: { booked: 1 } },
      { date: '2026-09-11', M7: { booked: 1 } },
      { date: '2026-09-12', M7: null },
    ],
  });
  assert.equal(inferred.focusDate, '2026-09-05');
  assert.equal(inferred.impactFrom, '2026-09-05');
  assert.equal(inferred.impactTo, '2026-09-11');
});


