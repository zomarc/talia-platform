import {
  buildCapacityValidationLedger,
  summarizeCabinOccupancyBerths,
} from './capacityValidationTransform.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

const berths = [
  { sail_code: 'MASTER', ship_code: 'CJ', date: '2026-07-18', berth_capacity: 600, berths_occupied: 400, berths_available: 200 },
  { sail_code: 'MASTER', ship_code: 'CJ', date: '2026-07-19', berth_capacity: 632, berths_occupied: 500, berths_available: 132 },
  { sail_code: 'SEG', ship_code: 'CJ', date: '2026-07-19', berth_capacity: 632, berths_occupied: 10, berths_available: 622 },
];

const occupancy = [
  { sail_code: 'MASTER', ship_code: 'CJ', sail_itinerary_date: '2026-07-18', cabin_category: 'IA', cabin_capacity: 2, total_cabins: 300, occupied_cabins: 200 },
  { sail_code: 'MASTER', ship_code: 'CJ', sail_itinerary_date: '2026-07-18', cabin_category: 'IB', cabin_capacity: 2, total_cabins: 16, occupied_cabins: 10 },
];

const occ = summarizeCabinOccupancyBerths(occupancy, { sailCode: 'MASTER', shipCode: 'CJ' });
assert(occ.capacity === 632, `occ capacity got ${occ.capacity}`);
assert(occ.cabins === 316, `occ cabins got ${occ.cabins}`);
assert(occ.occupied === 420, `occ occupied got ${occ.occupied}`);

const ledger = buildCapacityValidationLedger({
  referenceSailCode: 'MASTER',
  sailCodes: ['MASTER', 'SEG'],
  shipCode: 'CJ',
  masterSailRow: { sail_code: 'MASTER', sail_date_from: '2026-07-18', package_name: 'Idyllic' },
  berthRows: berths,
  occupancyRows: occupancy,
  cabinRows: [
    { sail_code: 'MASTER', cabin_category: 'IA', total_cabins: 50, occupied_cabins: 40, available_cabins: 10, cabin_capacity: 2 },
    { sail_code: 'MASTER', cabin_category: 'OB', total_cabins: 40, occupied_cabins: 20, available_cabins: 20, cabin_capacity: 2 },
  ],
  inventoryDayRows: [
    { sail_code: 'MASTER', ship_code: 'CJ', date: '2026-07-18', capacity: 620, sold: 400, available: 220 },
    { sail_code: 'MASTER', ship_code: 'CJ', date: '2026-07-19', capacity: 630, sold: 410, available: 220 },
  ],
  ships: [{ ship_code: 'CJ', ship_pax_capacity: 640 }],
  reservationRows: [
    { sail_code: 'MASTER', guest_count: 100 },
    { sail_code: 'SEG', guest_count: 50 },
  ],
});

assert(Array.isArray(ledger.sources) && ledger.sources.length >= 5, 'sources present');
const byId = Object.fromEntries(ledger.sources.map((s) => [s.id, s]));
assert(byId['mse-physical'].capacity.berths === 632, 'mse berths');
assert(byId['mse-physical'].capacity.cabins === 316, 'mse cabins = berths/2');
assert(byId['mse-physical'].booked.berths === 500, 'mse booked berths');
assert(byId['mse-physical'].available.berths === 132, 'mse avail berths');
assert(byId['cabin-occupancy'].capacity.cabins === 316, 'occ cabins');
assert(byId['cabin-availability'].capacity.cabins === 90, 'cabin units');
assert(byId['cabin-availability'].capacity.berths === 180, 'cabin berths');
assert(byId['guests-selling'].booked.berths === 150, 'guests');
assert(byId['mse-physical'].highlight === true, 'mse highlighted');
assert(byId['mse-physical'].table === 'ship_day_capacity', 'table');

console.log('capacityValidationTransform.test.mjs: ok');
