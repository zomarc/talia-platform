import {
  buildCapacityValidationRow,
  peakBerthCapacity,
} from './capacityValidationTransform.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

const berths = [
  { sail_code: 'A', ship_code: 'CJ', berth_capacity: 600 },
  { sail_code: 'A', ship_code: 'CJ', berth_capacity: 632 },
  { sail_code: 'B', ship_code: 'CJ', berth_capacity: 500 },
];

assert(peakBerthCapacity(berths, { sailCodes: ['A', 'B'], shipCode: 'CJ' }) === 632, 'peak berth');

const row = buildCapacityValidationRow({
  referenceSailCode: 'A',
  sailCodes: ['A'],
  shipCode: 'CJ',
  berthRows: berths,
  cabinRows: [
    { sail_code: 'A', cabin_category: 'IA', total_cabins: 50 },
    { sail_code: 'A', cabin_category: 'OB', total_cabins: 40 },
  ],
  inventoryDayRows: [
    { sail_code: 'A', capacity: 620 },
    { sail_code: 'A', capacity: 630 },
  ],
  ships: [{ ship_code: 'CJ', ship_pax_capacity: 640 }],
  reservationRows: [
    { sail_code: 'A', guest_count: 100 },
    { sail_code: 'A', guest_count: 50 },
  ],
});

assert(row.physical_berth_capacity === 632, 'physical');
assert(row.cabin_availability_total_cabins === 90, 'cabins');
assert(row.inventory_status_capacity === 630, 'inventory peak');
assert(row.ship_pax_capacity === 640, 'nameplate');
assert(row.sold_guests === 150, 'sold guests');
assert(row.delta_physical_vs_nameplate === -8, 'delta nameplate');

console.log('capacityValidationTransform.test.mjs: ok');
