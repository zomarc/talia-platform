/**
 * Cabin Deck Inventory transform — allocations + ship_cabin + ship_cabin_ctg_link.
 * Empty cabins use linked default category from ship_cabin_ctg_link (fallback Open).
 * No customer/PII fields — inventory ownership signals only.
 */

import {
  CABIN_CATEGORY_MODE,
  normalizeCabinCategoryMode,
  resolveGenericCabinCategory,
} from '../../../lib/cabinCategoryGroups.js';
import {
  describeOwner,
  hasAssignedCabin,
  isFitOwner,
  isGtyOnly,
  isGroupOwner,
  resolveAllocationStatus,
} from '../../../lib/shipInventoryAlloc.js';
import {
  CABIN_RESERVE_KIND,
  indexCabinReservesForSail,
  summarizeCabinReserves,
} from '../../../lib/shipCabinReserve.js';

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

const applyReserveToCabinItem = (item, reserve) => {
  if (!item || !reserve) return item;
  if (reserve.kind === CABIN_RESERVE_KIND.OFFSALE) {
    return {
      ...item,
      is_empty: false,
      is_offsale: true,
      status_key: 'offsale',
      status_label: reserve.reserve_type || 'Offsale',
      owner_label: reserve.reserve_type || 'Offsale',
      reserve_kind: reserve.kind,
      reserve_type: reserve.reserve_type,
    };
  }
  return {
    ...item,
    is_offsale: false,
    status_key: reserve.kind,
    status_label: reserve.reserve_type || reserve.kind,
    owner_label: reserve.reserve_type || item.owner_label,
    reserve_kind: reserve.kind,
    reserve_type: reserve.reserve_type,
  };
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

const categoryLabelForCabin = (cabin, sourceCategory, cabinCtgIndex, mode) => {
  const source = sourceCategory || 'Uncategorized';
  if (normalizeCabinCategoryMode(mode) !== CABIN_CATEGORY_MODE.GROUP) return source;
  const code = cabin?.cabin_category || cabin?.link_cabin_category || source;
  return resolveGenericCabinCategory(code, cabinCtgIndex) || source;
};

const summarizeCabins = (cabins, overAlloc) => {
  const sorted = sortCabins([...cabins]);
  const emptyCount = sorted.filter((cabin) => cabin.is_empty).length;
  const offsaleCount = sorted.filter((cabin) => cabin.is_offsale).length;
  const bookedCount = sorted.filter((cabin) => !cabin.is_empty && !cabin.is_offsale).length;
  return {
    cabins: sorted,
    booked_count: bookedCount,
    empty_count: emptyCount,
    offsale_count: offsaleCount,
    over_alloc: overAlloc,
    cabin_count: sorted.length,
  };
};

/**
 * Collapse deck sections into one row per cabin category.
 * Real mode keeps the category code. Group mode rolls codes up through cabin_ctg.
 * over_alloc is a category total copied onto each deck: max per real code, then
 * sum those codes when they share a generic group.
 */
export const groupDecksByCabinType = (
  decks = [],
  { cabinCtgIndex = null, mode = CABIN_CATEGORY_MODE.REAL } = {}
) => {
  const useGroup = normalizeCabinCategoryMode(mode) === CABIN_CATEGORY_MODE.GROUP;
  const byCategory = new Map();
  const overBySource = new Map();
  const sourcesByLabel = new Map();
  (decks || []).forEach((deck) => {
    (deck.categories || []).forEach((cat) => {
      const source = cat.category || 'Uncategorized';
      overBySource.set(
        source,
        Math.max(overBySource.get(source) || 0, Number(cat.over_alloc) || 0)
      );
      (cat.cabins || []).forEach((cabin) => {
        const label = categoryLabelForCabin(cabin, source, cabinCtgIndex, mode);
        if (!byCategory.has(label)) byCategory.set(label, []);
        byCategory.get(label).push(cabin);
        if (!sourcesByLabel.has(label)) sourcesByLabel.set(label, new Set());
        sourcesByLabel.get(label).add(source);
      });
    });
  });
  return [...byCategory.entries()]
    .sort((a, b) => categorySortKey(a[0]).localeCompare(categorySortKey(b[0])))
    .map(([category, cabins]) => {
      const sources = sourcesByLabel.get(category) || new Set([category]);
      const overAlloc = useGroup
        ? [...sources].reduce((sum, source) => sum + (overBySource.get(source) || 0), 0)
        : (overBySource.get(category) || 0);
      return {
        category,
        ...summarizeCabins(cabins, overAlloc),
      };
    });
};

/**
 * Roll categories inside each deck up to generic cabin groups.
 * Real mode returns the same deck list.
 */
export const relabelDecksByCabinGroup = (
  decks = [],
  cabinCtgIndex = null,
  mode = CABIN_CATEGORY_MODE.REAL
) => {
  if (normalizeCabinCategoryMode(mode) !== CABIN_CATEGORY_MODE.GROUP) return decks;
  return (decks || []).map((deck) => {
    const buckets = new Map();
    const overBySource = new Map();
    const sourcesByLabel = new Map();
    (deck.categories || []).forEach((cat) => {
      const source = cat.category || 'Uncategorized';
      overBySource.set(
        source,
        Math.max(overBySource.get(source) || 0, Number(cat.over_alloc) || 0)
      );
      (cat.cabins || []).forEach((cabin) => {
        const label = categoryLabelForCabin(cabin, source, cabinCtgIndex, mode);
        if (!buckets.has(label)) buckets.set(label, []);
        buckets.get(label).push(cabin);
        if (!sourcesByLabel.has(label)) sourcesByLabel.set(label, new Set());
        sourcesByLabel.get(label).add(source);
      });
    });
    const categories = [...buckets.entries()]
      .sort((a, b) => categorySortKey(a[0]).localeCompare(categorySortKey(b[0])))
      .map(([category, cabins]) => {
        const sources = sourcesByLabel.get(category) || new Set();
        const overAlloc = [...sources].reduce((sum, source) => sum + (overBySource.get(source) || 0), 0);
        return { category, ...summarizeCabins(cabins, overAlloc) };
      });
    const cabinCount = categories.reduce((sum, cat) => sum + cat.cabin_count, 0);
    const emptyCount = categories.reduce((sum, cat) => sum + cat.empty_count, 0);
    const offsaleCount = categories.reduce((sum, cat) => sum + cat.offsale_count, 0);
    return {
      ...deck,
      categories,
      cabin_count: cabinCount,
      empty_count: emptyCount,
      offsale_count: offsaleCount,
      booked_count: cabinCount - emptyCount - offsaleCount,
    };
  });
};

export const relabelGtyHoldsByCabinGroup = (
  holds = [],
  cabinCtgIndex = null,
  mode = CABIN_CATEGORY_MODE.REAL
) => {
  if (normalizeCabinCategoryMode(mode) !== CABIN_CATEGORY_MODE.GROUP) return holds;
  const buckets = new Map();
  (holds || []).forEach((group) => {
    (group.items || []).forEach((item) => {
      const label = categoryLabelForCabin(item, group.category, cabinCtgIndex, mode);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label).push(item);
    });
  });
  return [...buckets.entries()]
    .sort((a, b) => categorySortKey(a[0]).localeCompare(categorySortKey(b[0])))
    .map(([category, items]) => ({ category, items }));
};

export const buildCabinDeckInventoryBundle = ({
  allocationRows = [],
  shipCabinRows = [],
  cabinCategoryLinkRows = [],
  occupancyRows = [],
  reservationRows = [],
  reserveRows = [],
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
  const reserveIndex = indexCabinReservesForSail(reserveRows, {
    shipCode,
    dateKey: sailDateFrom,
  });
  const reserveSummary = summarizeCabinReserves(reserveIndex);

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
      reserve_kind: cabinKey ? (reserveIndex.get(cabinKey)?.kind || null) : null,
      reserve_type: cabinKey ? (reserveIndex.get(cabinKey)?.reserve_type || null) : null,
      is_offsale: cabinKey
        ? reserveIndex.get(cabinKey)?.kind === CABIN_RESERVE_KIND.OFFSALE
        : false,
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
    const item = applyReserveToCabinItem(
      buildEmptyCabinItem(meta, counters, cabinKey, categoryLinkIndex),
      reserveIndex.get(cabinKey)
    );
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
          booked_count: cabins.filter((c) => !c.is_empty && !c.is_offsale).length,
          empty_count: cabins.filter((c) => c.is_empty).length,
          offsale_count: cabins.filter((c) => c.is_offsale).length,
          over_alloc: 0,
        }));
      const cabinCount = categories.reduce((sum, cat) => sum + cat.cabins.length, 0);
      const emptyCount = categories.reduce((sum, cat) => sum + cat.empty_count, 0);
      const offsaleCount = categories.reduce((sum, cat) => sum + (cat.offsale_count || 0), 0);
      return {
        deck,
        categories,
        cabin_count: cabinCount,
        empty_count: emptyCount,
        offsale_count: offsaleCount,
        booked_count: cabinCount - emptyCount - offsaleCount,
      };
    });

  const gtyByCategory = new Map();
  gtyHolds.forEach((item) => {
    if (!gtyByCategory.has(item.cabin_category)) gtyByCategory.set(item.cabin_category, []);
    gtyByCategory.get(item.cabin_category).push(item);
  });

  const assignedCount = assigned.length;
  const emptyCount = emptyCabins.filter((c) => c.is_empty).length;
  const offsaleCount = emptyCabins.filter((c) => c.is_offsale).length
    + assigned.filter((c) => c.is_offsale).length;
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
      offsale_count: offsaleCount,
      reserve_offsale: reserveSummary.offsale,
      reserve_segment: reserveSummary.segment,
      reserve_constrained: reserveSummary.constrained,
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

/**
 * Find a deck/GTY chip that belongs to a reservation selection.
 * Prefer assigned cabin by FIT owner id / group delegate res; then cabin_number;
 * then GTY hold by owner id.
 */
export const findCabinItemForReservation = (bundle, detail = {}) => {
  const resId = detail?.res_id ?? detail?.row_data?.res_id ?? null;
  const resKey = resId != null && String(resId).trim() !== '' ? String(resId).trim() : null;
  const cabinNumber = String(
    detail?.cabin_number
    || detail?.row_data?.cabin_number
    || detail?.row_data?.Cabin_Number
    || ''
  ).trim() || null;
  const groupId = detail?.group_id ?? detail?.row_data?.group_id ?? null;
  const groupKey = groupId != null && String(groupId).trim() !== '' ? String(groupId).trim() : null;

  const assigned = [];
  const gty = [];
  (bundle?.decks || []).forEach((deck) => {
    (deck.categories || []).forEach((cat) => {
      (cat.cabins || []).forEach((item) => {
        if (item && !item.is_empty) assigned.push(item);
      });
    });
  });
  // gtyHolds is normally [{ category, items }] (bundle + allocate preview).
  const pushGtyEntry = (entry) => {
    if (!entry) return;
    if (Array.isArray(entry.items)) {
      entry.items.forEach((item) => {
        if (item) gty.push(item);
      });
      return;
    }
    gty.push(entry);
  };
  (bundle?.gtyHolds || bundle?.gty_holds || []).forEach(pushGtyEntry);
  (bundle?.gty_by_category || []).forEach(pushGtyEntry);

  const byResOwner = resKey
    ? assigned.find((item) => {
      // FIT / OBJ FIT owner id is the reservation id.
      if (String(item.allocation_owner_id ?? '').trim() === resKey) {
        // Prefer FIT owners; still accept exact owner-id match if type is atypical.
        if (isFitOwner(item.allocation_owner_type) || !isGroupOwner(item.allocation_owner_type)) {
          return true;
        }
      }
      if (item.dlgt_res_id != null && String(item.dlgt_res_id).trim() === resKey) {
        return true;
      }
      return false;
    })
    : null;
  if (byResOwner) return byResOwner;

  if (cabinNumber) {
    const byCabin = assigned.find(
      (item) => String(item.cabin_number || '').trim() === cabinNumber
    );
    if (byCabin) return byCabin;
  }

  if (resKey) {
    const gtyByRes = gty.find((item) => (
      String(item.allocation_owner_id ?? '').trim() === resKey
      || (item.dlgt_res_id != null && String(item.dlgt_res_id).trim() === resKey)
    ));
    if (gtyByRes) return gtyByRes;
  }

  if (groupKey) {
    const gtyByGroup = gty.find((item) => (
      isGroupOwner(item.allocation_owner_type)
      && String(item.allocation_owner_id ?? '').trim() === groupKey
    ));
    if (gtyByGroup) return gtyByGroup;
    const assignedByGroup = assigned.find((item) => (
      isGroupOwner(item.allocation_owner_type)
      && String(item.allocation_owner_id ?? '').trim() === groupKey
    ));
    if (assignedByGroup) return assignedByGroup;
  }

  return null;
};

export default {
  inferDeckFromCabinNumber,
  filterAllocationsForSailing,
  indexShipCabins,
  indexCabinCategoryLinks,
  buildCabinDeckInventoryBundle,
  findCabinItemForReservation,
  groupDecksByCabinType,
  relabelDecksByCabinGroup,
  relabelGtyHoldsByCabinGroup,
};
