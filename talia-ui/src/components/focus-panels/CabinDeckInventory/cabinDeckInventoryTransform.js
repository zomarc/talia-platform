/**
 * Cabin Deck Inventory transform — allocations + ship_cabin + ship_cabin_ctg_link.
 * Empty cabins use linked default category from ship_cabin_ctg_link (fallback Open).
 * No customer/PII fields — inventory ownership signals only.
 */

import {
  describeOwner,
  hasAssignedCabin,
  isGtyOnly,
  isGroupOwner,
  resolveAllocationStatus,
} from '../../../lib/shipInventoryAlloc.js';

const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeCabinKey = (value) => String(value || '').trim().toUpperCase();

const inSailWindow = (sailDateFrom, effFrom, effTo) => {
  const day = toDateKey(sailDateFrom);
  if (!day) return true;
  const from = toDateKey(effFrom);
  const to = toDateKey(effTo);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

/** Fallback when ship_cabin row is missing — Celestyal cabin numbers encode deck. */
export const inferDeckFromCabinNumber = (cabinNumber) => {
  const raw = String(cabinNumber || '').trim();
  if (!raw) return null;
  if (/^\d{5}/.test(raw)) {
    const deck = Number(raw.slice(0, 2));
    return Number.isFinite(deck) ? deck : null;
  }
  if (/^\d{4}/.test(raw)) {
    const deck = Number(raw[0]);
    return Number.isFinite(deck) ? deck : null;
  }
  return null;
};

export const filterAllocationsForSailing = (rows, { shipCode, sailDateFrom } = {}) => {
  const ship = String(shipCode || '').trim();
  const depart = toDateKey(sailDateFrom);
  return (rows || []).filter((row) => {
    if (ship && String(row?.ship_code || '').trim() !== ship) return false;
    if (depart) {
      const from = toDateKey(row?.sail_date_from);
      if (!from || from !== depart) return false;
    }
    return true;
  });
};

export const indexShipCabins = (rows = [], shipCode = null) => {
  const ship = String(shipCode || '').trim();
  const map = new Map();
  (rows || []).forEach((row) => {
    if (ship && String(row?.ship_code || '').trim() !== ship) return;
    if (row?.active_record_flag != null && Number(row.active_record_flag) !== 1) return;
    const cabin = normalizeCabinKey(row?.cabin_number);
    if (!cabin || map.has(cabin)) return;
    const deckRaw = row?.deck_number;
    const deckNumber = deckRaw != null && deckRaw !== '' ? Number(deckRaw) : null;
    map.set(cabin, {
      cabin_number: String(row?.cabin_number || '').trim(),
      deck_number: Number.isFinite(deckNumber) ? deckNumber : null,
      cabin_rank: row?.cabin_rank != null ? Number(row.cabin_rank) : null,
      cabin_name: row?.cabin_name || null,
      deck_source: 'ship_cabin',
    });
  });
  return map;
};

/**
 * Map cabin_number → default cabin_category from fou.SHIP_CABIN_CTG_LINK.
 * Prefers ACTIVE_RECORD_FLAG=1 / IS_ACTIVE=Y and sail-effective windows.
 */
export const indexCabinCategoryLinks = (rows = [], { shipCode = null, sailDateFrom = null } = {}) => {
  const ship = String(shipCode || '').trim();
  const map = new Map();
  (rows || []).forEach((row) => {
    if (ship && String(row?.ship_code || '').trim() !== ship) return;
    if (row?.active_record_flag != null && Number(row.active_record_flag) !== 1) return;
    const isActive = String(row?.is_active || '').trim().toUpperCase();
    if (isActive && isActive !== 'Y' && isActive !== '1') return;
    if (!inSailWindow(sailDateFrom, row?.eff_sail_from, row?.eff_sail_to)) return;
    const cabin = normalizeCabinKey(row?.cabin_number);
    const category = String(row?.cabin_category || '').trim();
    if (!cabin || !category) return;
    if (!map.has(cabin)) {
      map.set(cabin, {
        cabin_category: category,
        cabin_capacity: row?.cabin_capacity != null ? Number(row.cabin_capacity) : null,
      });
    }
  });
  return map;
};

const sumOccupancyCabins = (occupancyRows = [], { sailCode, sailDateFrom } = {}) => {
  const code = String(sailCode || '').trim();
  const day = toDateKey(sailDateFrom);
  let occupied = 0;
  let total = 0;
  (occupancyRows || []).forEach((row) => {
    if (code && String(row?.sail_code || '').trim() !== code) return;
    if (day) {
      const itinerary = toDateKey(row?.sail_itinerary_date || row?.date);
      if (itinerary && itinerary !== day) return;
    }
    occupied += Number(row?.occupied_cabins) || 0;
    total += Number(row?.total_cabins) || 0;
  });
  return {
    occupied_cabins: Math.round(occupied),
    total_cabins: Math.round(total),
  };
};

const resolveDeckMeta = (cabinNumber, meta, counters) => {
  let deckNumber = meta?.deck_number ?? null;
  let deckSource = meta?.deck_source || null;
  if (cabinNumber && deckNumber == null) {
    const inferred = inferDeckFromCabinNumber(cabinNumber);
    if (inferred != null) {
      deckNumber = inferred;
      deckSource = 'inferred';
      counters.deckInferred += 1;
    } else {
      counters.deckUnknown += 1;
    }
  } else if (cabinNumber && deckSource === 'ship_cabin') {
    counters.deckFromShipCabin += 1;
  }
  return { deckNumber, deckSource };
};

const resolveEmptyCategory = (cabinKey, categoryLinkIndex) => {
  const linked = categoryLinkIndex.get(cabinKey)?.cabin_category;
  return linked || 'Open';
};

const buildEmptyCabinItem = (meta, counters, cabinKey, categoryLinkIndex) => {
  const cabinNumber = meta.cabin_number;
  const { deckNumber, deckSource } = resolveDeckMeta(cabinNumber, meta, counters);
  const linked = categoryLinkIndex.get(cabinKey);
  return {
    allocation_id: null,
    cabin_number: cabinNumber,
    cabin_category: resolveEmptyCategory(cabinKey, categoryLinkIndex),
    link_cabin_category: linked?.cabin_category || null,
    deck_number: deckNumber,
    deck_source: deckSource,
    cabin_rank: meta.cabin_rank ?? null,
    occupancy: null,
    price_category: null,
    allocation_owner_type: null,
    allocation_owner_id: null,
    owner_label: 'Empty',
    dlgt_res_id: null,
    missing_dlgt: false,
    probability: null,
    inventory_request_type: null,
    inventory_result_type: null,
    status_key: 'empty',
    status_label: 'Empty',
    owner_kind: 'empty',
    is_gty: false,
    is_empty: true,
    is_gty_fit: false,
  };
};

const pushIntoDeckMap = (deckMap, item) => {
  const deckKey = item.deck_number != null && Number.isFinite(item.deck_number)
    ? item.deck_number
    : 'Unknown';
  if (!deckMap.has(deckKey)) deckMap.set(deckKey, new Map());
  const catMap = deckMap.get(deckKey);
  const category = item.cabin_category || 'Uncategorized';
  if (!catMap.has(category)) catMap.set(category, []);
  catMap.get(category).push(item);
};

const sortCabins = (cabins) => cabins.sort((a, b) => (
  String(a.cabin_number || '').localeCompare(String(b.cabin_number || ''), undefined, { numeric: true })
));

const categorySortKey = (category) => {
  if (category === 'Open') return '~~~~';
  if (category === 'Uncategorized') return '~~~';
  return category;
};

export const buildCabinDeckInventoryBundle = ({
  allocationRows = [],
  shipCabinRows = [],
  cabinCategoryLinkRows = [],
  occupancyRows = [],
  reservationRows = [],
  shipCode = null,
  sailCode = null,
  sailDateFrom = null,
  truncations = [],
} = {}) => {
  const filtered = filterAllocationsForSailing(allocationRows, { shipCode, sailDateFrom });
  const cabinIndex = indexShipCabins(shipCabinRows, shipCode);
  const categoryLinkIndex = indexCabinCategoryLinks(cabinCategoryLinkRows, {
    shipCode,
    sailDateFrom,
  });
  const occupancy = sumOccupancyCabins(occupancyRows, {
    sailCode,
    sailDateFrom,
  });

  const gtyHolds = [];
  const assigned = [];
  const assignedKeys = new Set();
  const counters = {
    deckFromShipCabin: 0,
    deckInferred: 0,
    deckUnknown: 0,
    emptiesLinked: 0,
    emptiesOpenFallback: 0,
  };

  filtered.forEach((row) => {
    const status = resolveAllocationStatus(row);
    const cabinNumber = String(row?.cabin_number || '').trim();
    const cabinKey = normalizeCabinKey(cabinNumber);
    const meta = cabinKey ? cabinIndex.get(cabinKey) : null;
    const gty = isGtyOnly(row?.inventory_request_type) || !hasAssignedCabin(row);
    const { deckNumber, deckSource } = resolveDeckMeta(cabinNumber, meta, counters);
    const group = isGroupOwner(row?.allocation_owner_type);
    const dlgt = row?.dlgt_res_id != null && String(row.dlgt_res_id).trim() !== ''
      ? Number(row.dlgt_res_id)
      : null;
    const probability = row?.probability != null && row?.probability !== ''
      ? Number(row.probability)
      : null;

    const item = {
      allocation_id: row?.allocation_id ?? null,
      cabin_number: cabinNumber || null,
      cabin_category: String(row?.cabin_category || '').trim() || 'Uncategorized',
      link_cabin_category: cabinKey ? (categoryLinkIndex.get(cabinKey)?.cabin_category || null) : null,
      deck_number: deckNumber,
      deck_source: deckSource,
      cabin_rank: meta?.cabin_rank ?? null,
      occupancy: row?.occupancy ?? null,
      price_category: row?.price_category || null,
      allocation_owner_type: row?.allocation_owner_type || null,
      allocation_owner_id: row?.allocation_owner_id ?? null,
      owner_label: describeOwner(row),
      dlgt_res_id: dlgt,
      missing_dlgt: Boolean(group && dlgt == null),
      probability: Number.isFinite(probability) ? probability : null,
      inventory_request_type: row?.inventory_request_type || null,
      inventory_result_type: row?.inventory_result_type || null,
      status_key: status.key,
      status_label: status.label,
      owner_kind: status.owner_kind,
      is_gty: gty,
      is_empty: false,
      is_gty_fit: false,
    };

    if (!cabinNumber) {
      gtyHolds.push(item);
    } else {
      assigned.push(item);
      assignedKeys.add(cabinKey);
    }
  });

  const emptyCabins = [];
  cabinIndex.forEach((meta, cabinKey) => {
    if (assignedKeys.has(cabinKey)) return;
    const item = buildEmptyCabinItem(meta, counters, cabinKey, categoryLinkIndex);
    if (item.link_cabin_category) counters.emptiesLinked += 1;
    else counters.emptiesOpenFallback += 1;
    emptyCabins.push(item);
  });

  const deckMap = new Map();
  assigned.forEach((item) => pushIntoDeckMap(deckMap, item));
  emptyCabins.forEach((item) => pushIntoDeckMap(deckMap, item));

  const decks = [...deckMap.entries()]
    .sort((a, b) => {
      if (a[0] === 'Unknown') return 1;
      if (b[0] === 'Unknown') return -1;
      return Number(b[0]) - Number(a[0]);
    })
    .map(([deck, catMap]) => {
      const categories = [...catMap.entries()]
        .sort((a, b) => categorySortKey(a[0]).localeCompare(categorySortKey(b[0])))
        .map(([category, cabins]) => ({
          category,
          cabins: sortCabins(cabins),
          booked_count: cabins.filter((c) => !c.is_empty).length,
          empty_count: cabins.filter((c) => c.is_empty).length,
          over_alloc: 0,
        }));
      const cabinCount = categories.reduce((sum, cat) => sum + cat.cabins.length, 0);
      const emptyCount = categories.reduce((sum, cat) => sum + cat.empty_count, 0);
      return {
        deck,
        categories,
        cabin_count: cabinCount,
        empty_count: emptyCount,
        booked_count: cabinCount - emptyCount,
      };
    });

  const gtyByCategory = new Map();
  gtyHolds.forEach((item) => {
    if (!gtyByCategory.has(item.cabin_category)) gtyByCategory.set(item.cabin_category, []);
    gtyByCategory.get(item.cabin_category).push(item);
  });

  const assignedCount = assigned.length;
  const emptyCount = emptyCabins.length;
  const gtyCount = gtyHolds.length;
  const bookedLikeCount = assignedCount + gtyCount;
  const occupancyBooked = occupancy.occupied_cabins || 0;
  const reservationCount = (reservationRows || []).length;
  const reservationGuests = (reservationRows || []).reduce(
    (sum, row) => sum + (Number(row?.guest_count) || 0),
    0
  );

  const deltaVsOccupancy = occupancyBooked > 0
    ? bookedLikeCount - occupancyBooked
    : null;

  return {
    decks,
    gtyHolds: [...gtyByCategory.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => String(a.owner_label).localeCompare(String(b.owner_label))),
      })),
    emptyCabins,
    categoryLinkIndexSize: categoryLinkIndex.size,
    summary: {
      allocation_count: filtered.length,
      assigned_count: assignedCount,
      empty_count: emptyCount,
      physical_cabin_count: cabinIndex.size,
      gty_count: gtyCount,
      booked_like_count: bookedLikeCount,
      fit_count: assigned.filter((i) => i.owner_kind === 'fit').length
        + gtyHolds.filter((i) => i.owner_kind === 'fit').length,
      group_count: assigned.filter((i) => i.owner_kind === 'group').length + gtyHolds.length,
      group_missing_dlgt: assigned.filter((i) => i.missing_dlgt).length
        + gtyHolds.filter((i) => i.missing_dlgt).length,
      deck_count: decks.length,
      deck_from_ship_cabin: counters.deckFromShipCabin,
      deck_inferred: counters.deckInferred,
      deck_unknown: counters.deckUnknown,
      empties_linked: counters.emptiesLinked,
      empties_open_fallback: counters.emptiesOpenFallback,
      occupancy_booked_cabins: occupancyBooked || null,
      occupancy_total_cabins: occupancy.total_cabins || null,
      reservation_count: reservationCount,
      reservation_guests: reservationGuests,
      delta_vs_occupancy: deltaVsOccupancy,
      truncations: truncations || [],
      limit_hit: (truncations || []).some((entry) => entry?.hit),
    },
  };
};

export default {
  inferDeckFromCabinNumber,
  filterAllocationsForSailing,
  indexShipCabins,
  indexCabinCategoryLinks,
  buildCabinDeckInventoryBundle,
};
