import { indexCabinCategoryGroups } from '../../../lib/cabinCategoryGroups.js';
import {
  buildCabinDeckInventoryBundle,
  filterAllocationsForSailing,
  findCabinItemForReservation,
  groupDecksByCabinType,
  inferDeckFromCabinNumber,
  relabelDecksByCabinGroup,
  relabelGtyHoldsByCabinGroup,
} from './cabinDeckInventoryTransform.js';
import {
  ALLOCATE_MODE,
  allocateGtyPreview,
  selectGtyHoldsForMode,
  sortGtyByProbability,
} from './cabinDeckAllocate.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

assert(inferDeckFromCabinNumber('10018') === 10, 'deck 10 from 5-digit');
assert(inferDeckFromCabinNumber('9043') === 9, 'deck 9 from 4-digit');
assert(inferDeckFromCabinNumber('G101') == null, 'non-numeric no infer');

const alloc = [
  {
    allocation_id: 1,
    ship_code: 'CJ',
    sail_date_from: '2026-08-01',
    cabin_category: 'IA',
    cabin_number: '8001',
    allocation_owner_type: 'FIT',
    allocation_owner_id: 1001,
    inventory_request_type: 'STANDARD',
    probability: 100,
  },
  {
    allocation_id: 2,
    ship_code: 'CJ',
    sail_date_from: '2026-08-01',
    cabin_category: 'IA',
    cabin_number: '8002',
    allocation_owner_type: 'GROUP',
    allocation_owner_id: 55,
    inventory_request_type: 'STANDARD',
    dlgt_res_id: null,
    probability: 40,
  },
  {
    allocation_id: 3,
    ship_code: 'CJ',
    sail_date_from: '2026-08-01',
    cabin_category: 'IB',
    cabin_number: null,
    allocation_owner_type: 'GROUP',
    allocation_owner_id: 77,
    inventory_request_type: 'GTY ONLY',
    probability: 70,
  },
  {
    allocation_id: 4,
    ship_code: 'CJ',
    sail_date_from: '2026-07-01',
    cabin_category: 'IA',
    cabin_number: '9001',
    allocation_owner_type: 'FIT',
    allocation_owner_id: 9,
    inventory_request_type: 'STANDARD',
  },
  {
    allocation_id: 5,
    ship_code: 'CJ',
    sail_date_from: '2026-08-01',
    cabin_category: 'IB',
    cabin_number: null,
    allocation_owner_type: 'GROUP',
    allocation_owner_id: 88,
    inventory_request_type: 'GTY ONLY',
    probability: 50,
  },
];

const cabins = [
  { ship_code: 'CJ', cabin_number: '8001', deck_number: 8, active_record_flag: 1 },
  { ship_code: 'CJ', cabin_number: '8002', deck_number: 8, active_record_flag: 1 },
  { ship_code: 'CJ', cabin_number: '8003', deck_number: 8, active_record_flag: 1 },
];

const links = [
  {
    ship_code: 'CJ',
    cabin_number: '8003',
    cabin_category: 'IA',
    is_active: 'Y',
    active_record_flag: 1,
    eff_sail_from: '2020-01-01',
    eff_sail_to: '2099-12-31',
  },
];

const filtered = filterAllocationsForSailing(alloc, { shipCode: 'CJ', sailDateFrom: '2026-08-01' });
assert(filtered.length === 4, 'filters ship + exact date');

const bundle = buildCabinDeckInventoryBundle({
  allocationRows: alloc,
  shipCabinRows: cabins,
  cabinCategoryLinkRows: links,
  occupancyRows: [
    { sail_code: 'CJ07260801', sail_itinerary_date: '2026-08-01', occupied_cabins: 3, total_cabins: 100 },
  ],
  reservationRows: [
    { guest_count: 2 },
    { guest_count: 4 },
  ],
  shipCode: 'CJ',
  sailCode: 'CJ07260801',
  sailDateFrom: '2026-08-01',
});

assert(bundle.summary.assigned_count === 2, 'assigned');
assert(bundle.summary.empty_count === 1, 'one empty physical cabin');
assert(bundle.summary.physical_cabin_count === 3, 'physical cabins');
assert(bundle.summary.gty_count === 2, 'gty');
assert(bundle.summary.booked_like_count === 4, 'booked like');
assert(bundle.summary.group_missing_dlgt === 3, 'groups without dlgt (1 assigned + 2 gty)');
const byType = groupDecksByCabinType([
  {
    deck: 9,
    categories: [{
      category: 'IA',
      over_alloc: 2,
      cabins: [{ cabin_number: '9001', is_empty: false, is_offsale: false }],
    }],
  },
  {
    deck: 8,
    categories: [
      {
        category: 'IA',
        over_alloc: 2,
        cabins: [{ cabin_number: '8001', is_empty: true, is_offsale: false }],
      },
      {
        category: 'IB',
        over_alloc: 0,
        cabins: [{ cabin_number: '8101', is_empty: false, is_offsale: false }],
      },
    ],
  },
]);
assert(byType.map((row) => row.category).join(',') === 'IA,IB', 'cabin type order');
assert(byType[0].cabins.map((cabin) => cabin.cabin_number).join(',') === '8001,9001', 'IA cabins from every deck');
assert(byType[0].over_alloc === 2, 'over-alloc is not summed across decks');
assert(byType[0].empty_count === 1 && byType[0].booked_count === 1, 'IA counts across decks');

const cabinCtgIndex = indexCabinCategoryGroups([
  { cabin_code: 'IA', generic_category: 'INSIDE', active_record_flag: 1 },
  { cabin_code: 'IB', generic_category: 'INSIDE', active_record_flag: 1 },
  { cabin_code: 'XA', generic_category: 'DELUXE', active_record_flag: 1 },
]);
const groupedType = groupDecksByCabinType([
  {
    deck: 9,
    categories: [{
      category: 'XA',
      over_alloc: 4,
      cabins: [{ cabin_number: '9002', cabin_category: 'XA', is_empty: false, is_offsale: false }],
    }],
  },
  {
    deck: 8,
    categories: [
      {
        category: 'IA',
        over_alloc: 2,
        cabins: [{ cabin_number: '8001', cabin_category: 'IA', is_empty: true, is_offsale: false }],
      },
      {
        category: 'IB',
        over_alloc: 3,
        cabins: [{ cabin_number: '8101', cabin_category: 'IB', is_empty: false, is_offsale: false }],
      },
    ],
  },
], { cabinCtgIndex, mode: 'group' });
assert(groupedType.map((row) => row.category).join(',') === 'DELUXE,INSIDE', 'cabin type group order');
assert(
  groupedType.find((row) => row.category === 'INSIDE').cabins.map((cabin) => cabin.cabin_number).join(',') === '8001,8101',
  'inside cabins merge across codes and decks'
);
assert(groupedType.find((row) => row.category === 'INSIDE').over_alloc === 5, 'group over-alloc sums distinct codes');
assert(groupedType.find((row) => row.category === 'DELUXE').over_alloc === 4, 'deluxe keeps its own over-alloc');

const groupedDecks = relabelDecksByCabinGroup([
  {
    deck: 8,
    categories: [
      {
        category: 'IA',
        over_alloc: 2,
        cabins: [{ cabin_number: '8001', cabin_category: 'IA', is_empty: false, is_offsale: false }],
      },
      {
        category: 'IB',
        over_alloc: 3,
        cabins: [{ cabin_number: '8101', cabin_category: 'IB', is_empty: true, is_offsale: false }],
      },
    ],
  },
], cabinCtgIndex, 'group');
assert(groupedDecks[0].categories.length === 1, 'deck categories roll into one group');
assert(groupedDecks[0].categories[0].category === 'INSIDE', 'deck group label');
assert(groupedDecks[0].categories[0].over_alloc === 5, 'deck group over-alloc');
assert(groupedDecks[0].cabin_count === 2 && groupedDecks[0].empty_count === 1, 'deck counts survive rollup');
const realDecks = relabelDecksByCabinGroup([
  {
    deck: 8,
    categories: [{ category: 'IA', over_alloc: 2, cabins: [{ cabin_number: '8001', cabin_category: 'IA' }] }],
  },
], cabinCtgIndex, 'real');
assert(realDecks[0].categories[0].category === 'IA', 'real mode keeps cabin codes');

const groupedGty = relabelGtyHoldsByCabinGroup([
  { category: 'IA', items: [{ cabin_category: 'IA', allocation_id: 1 }] },
  { category: 'IB', items: [{ cabin_category: 'IB', allocation_id: 2 }] },
  { category: 'XA', items: [{ cabin_category: 'XA', allocation_id: 3 }] },
], cabinCtgIndex, 'group');
assert(groupedGty.map((group) => group.category).join(',') === 'DELUXE,INSIDE', 'gty groups');
assert(groupedGty.find((group) => group.category === 'INSIDE').items.length === 2, 'gty inside merges');

assert(bundle.decks[0].deck === 8, 'deck from ship_cabin');
assert(bundle.decks[0].cabin_count === 3, 'deck includes empty');
const iaCat = bundle.decks[0].categories.find((c) => c.category === 'IA');
assert(iaCat?.empty_count === 1, 'empty folded into IA via link');
assert(!bundle.decks[0].categories.find((c) => c.category === 'Open'), 'no Open bucket');
assert(bundle.gtyHolds[0].items[0].owner_label === 'Group 77', 'group owner label');

const ranked = sortGtyByProbability(bundle.gtyHolds.flatMap((g) => g.items));
assert(ranked[0].allocation_id === 3, 'higher probability GTY first');

const expectedPick = selectGtyHoldsForMode(ranked, ALLOCATE_MODE.EXPECTED);
// 0.70 + 0.50 = 1.20 → round 1
assert(expectedPick.expectedCount === 1, 'expected room count from probabilities');
assert(expectedPick.toPlace.length === 1, 'place top expected hold');
assert(expectedPick.toPlace[0].allocation_id === 3, 'places 70% hold');
assert(expectedPick.deferred.length === 1, 'defers lower probability');

const preview = allocateGtyPreview(bundle, { mode: ALLOCATE_MODE.PRIORITY });
assert(preview.placementCount === 0, 'no IB empties so IB GTY unplaced');
assert(preview.unplacedCount === 2, 'both GTY unplaced');
assert(preview.overAllocCategories.includes('IB'), 'IB over-alloc');

const withIbEmpty = buildCabinDeckInventoryBundle({
  allocationRows: alloc.filter((r) => r.allocation_id !== 2),
  shipCabinRows: [
    ...cabins,
    { ship_code: 'CJ', cabin_number: '8101', deck_number: 8, active_record_flag: 1 },
    { ship_code: 'CJ', cabin_number: '8102', deck_number: 8, active_record_flag: 1 },
  ],
  cabinCategoryLinkRows: [
    ...links,
    {
      ship_code: 'CJ',
      cabin_number: '8101',
      cabin_category: 'IB',
      is_active: 'Y',
      active_record_flag: 1,
      eff_sail_from: '2020-01-01',
      eff_sail_to: '2099-12-31',
    },
    {
      ship_code: 'CJ',
      cabin_number: '8102',
      cabin_category: 'IB',
      is_active: 'Y',
      active_record_flag: 1,
      eff_sail_from: '2020-01-01',
      eff_sail_to: '2099-12-31',
    },
  ],
  shipCode: 'CJ',
  sailDateFrom: '2026-08-01',
});

const fitPriority = allocateGtyPreview(withIbEmpty, { mode: ALLOCATE_MODE.PRIORITY });
assert(fitPriority.placementCount === 2, 'priority places both IB GTY');
assert(fitPriority.unplacedCount === 0, 'priority none unplaced when empties exist');

const fitExpected = allocateGtyPreview(withIbEmpty, { mode: ALLOCATE_MODE.EXPECTED });
assert(fitExpected.placementCount === 1, 'expected places one IB room');
assert(fitExpected.unplacedCount === 1, 'expected defers one IB hold');
const placed = fitExpected.decks[0].categories
  .flatMap((c) => c.cabins)
  .find((c) => c.is_gty_fit);
assert(placed?.allocation_id === 3, 'expected places higher probability hold');
assert(placed?.status_key === 'gty-fit', 'placed chip is gty-fit');

const resBundle = {
  decks: [
    {
      deck: 8,
      categories: [
        {
          category: 'IA',
          cabins: [
            {
              cabin_number: '8001',
              allocation_owner_type: 'FIT',
              allocation_owner_id: 1001,
              status_key: 'fit',
            },
            {
              cabin_number: '8002',
              allocation_owner_type: 'GROUP',
              allocation_owner_id: 55,
              dlgt_res_id: 2002,
              status_key: 'group',
            },
          ],
        },
      ],
    },
  ],
  gtyHolds: [
    {
      category: 'IB',
      items: [
        {
          allocation_owner_type: 'FIT',
          allocation_owner_id: 3003,
          status_key: 'gty',
          cabin_category: 'IB',
        },
      ],
    },
  ],
};

assert(
  findCabinItemForReservation(resBundle, { res_id: 1001 })?.cabin_number === '8001',
  'FIT owner id maps to cabin'
);
assert(
  findCabinItemForReservation(resBundle, { res_id: 2002 })?.cabin_number === '8002',
  'group delegate res maps to cabin'
);
assert(
  findCabinItemForReservation(resBundle, { cabin_number: '8001' })?.allocation_owner_id === 1001,
  'cabin_number fallback'
);
assert(
  findCabinItemForReservation(resBundle, { res_id: 3003 })?.allocation_owner_id === 3003,
  'GTY hold by owner id (grouped gtyHolds)'
);
assert(
  findCabinItemForReservation(resBundle, { res_id: 9999 }) == null,
  'unknown reservation yields null'
);

console.log('cabinDeckInventoryTransform.test.mjs: ok');
