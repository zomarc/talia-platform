/**
 * Ship × Day Pressure — dead-bed / blocking visualisation (WIP).
 *
 * Physical capacity is ship × calendar day (MAX across overlapping sail_codes).
 * Selling demand is exploded onto every occupancy date of that sail_code so a
 * 7-night booking occupies all seven ship-days, not only departure.
 */

import { SHIP_FILTER_ALL } from '../../../lib/globalShipFilter.js';
import {
  DEFAULT_CABIN_CATEGORY_MODE,
  normalizeCabinCategoryMode,
  resolveCabinCategoryLabel,
} from '../../../lib/cabinCategoryGroups.js';

export { SHIP_FILTER_ALL };

const asArray = (value) => (Array.isArray(value) ? value : []);

export const PRESSURE_FLAGS = {
  OK: 'ok',
  OVER: 'over',
  UNDER: 'under',
  BLOCKING: 'blocking',
  SOFT_GROUP: 'soft_group',
};

export const PRESSURE_GRAINS = {
  SHIP: 'ship',
  VOYAGE: 'voyage',
  CABIN: 'cabin',
};

/** Bar fill composition — panel Options `barSplit`. */
export const BAR_SPLIT = {
  MASTER_SEGMENT: 'master_segment',
  FIT_GROUP: 'fit_group',
};

export const DEFAULT_BAR_SPLIT = BAR_SPLIT.MASTER_SEGMENT;

export const normalizeBarSplit = (value) => (
  String(value || '').trim() === BAR_SPLIT.FIT_GROUP
    ? BAR_SPLIT.FIT_GROUP
    : BAR_SPLIT.MASTER_SEGMENT
);

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

export const addUtcDays = (dateKey, days) => {
  const key = toDateKey(dateKey);
  if (!key) return null;
  const cursor = new Date(`${key}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + Number(days || 0));
  return cursor.toISOString().slice(0, 10);
};

export const enumerateDateKeys = (fromValue, toValue) => {
  const from = toDateKey(fromValue);
  const to = toDateKey(toValue) || from;
  if (!from) return [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return from ? [from] : [];
  const dates = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
};

const monthLabelFromKey = (dateKey) => {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mi = Number.parseInt(month, 10) - 1;
  const d = Number.parseInt(day, 10);
  if (mi < 0 || mi > 11) return dateKey;
  return `${d} ${months[mi]}`;
};

export const defaultDateWindow = (today = new Date()) => {
  const start = today.toISOString().slice(0, 10);
  return { from: start, to: addUtcDays(start, 59) };
};

/** Practical open-ended spine when global dateTo is blank (e.g. all_future). */
export const OPEN_ENDED_SPINE_DAYS = 120;

const shipDayKey = (shipCode, dateKey) => `${shipCode}|${dateKey}`;

const MAX_VOYAGE_COLUMNS = 48;
const MAX_CABIN_COLUMNS = 48;

const categoryDayKey = (shipCode, dateKey, category) => `${shipCode}|${dateKey}|${category}`;

/** True sellable = nameplate minus offsale / reserved. Prefer the view field when present. */
export const resolveSellableCabins = (row = {}) => {
  const nameplate = toNumber(row?.nameplate_cabins ?? row?.total_cabins);
  const offsale = toNumber(row?.offsale_cabins);
  if (row?.sellable_cabins != null && row.sellable_cabins !== '') {
    return Math.max(0, toNumber(row.sellable_cabins));
  }
  return Math.max(0, nameplate - offsale);
};

export const resolveSellableBerths = (row = {}) => {
  const nameplate = toNumber(row?.nameplate_berths ?? row?.berth_capacity);
  const offsale = toNumber(row?.offsale_berths);
  if (row?.sellable_berths != null && row.sellable_berths !== '') {
    return Math.max(0, toNumber(row.sellable_berths));
  }
  return Math.max(0, nameplate - offsale);
};

const isVoyageIdentity = (win) => (
  win?.sailing_role === 'master' || win?.sail_code === win?.reference_sail_code
);

const isMasterSailPart = (part) => (
  part?.sailing_role === 'master'
  || (!part?.sailing_role && part?.sail_code && part?.sail_code === part?.reference_sail_code)
);

/** Split sail demand into master vs segment booked (guests). */
export const splitBookedBySailingRole = (parts = []) => {
  let booked_master = 0;
  let booked_segment = 0;
  asArray(parts).forEach((part) => {
    const booked = toNumber(part?.booked);
    if (isMasterSailPart(part)) booked_master += booked;
    else booked_segment += booked;
  });
  return { booked_master, booked_segment };
};

const voyageOverlapsRange = (win, start, end) => {
  if (!win) return false;
  if (!start && !end) return true;
  const from = start || end;
  const to = end || start;
  if (win.date_from && win.date_to && (win.date_from > to || win.date_to < from)) {
    return false;
  }
  if (win.occupancy_dates?.size) {
    for (const dateKey of win.occupancy_dates) {
      if (dateKey >= from && dateKey <= to) return true;
    }
    return false;
  }
  return Boolean(win.date_from && win.date_to);
};

const indexWindowsByShip = (windows) => {
  const byShip = new Map();
  windows?.forEach?.((win) => {
    if (!win?.ship_code) return;
    const list = byShip.get(win.ship_code) || [];
    list.push(win);
    byShip.set(win.ship_code, list);
  });
  return byShip;
};

/**
 * Map sail_code → window + voyage identity. Prefer occupancy dates later;
 * master_sail supplies duration labels and fallback ranges.
 */
export const buildSailWindows = (inventoryRows = [], masterSailRows = []) => {
  const bySail = new Map();
  asArray(masterSailRows).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    const shipCode = String(row?.ship_code || '').trim();
    if (!sailCode || !shipCode) return;
    bySail.set(sailCode, {
      sail_code: sailCode,
      ship_code: shipCode,
      ship_name: String(row?.ship_name || shipCode).trim(),
      reference_sail_code: sailCode,
      sailing_role: Number(row?.is_main) === 1 ? 'master' : 'segment',
      date_from: toDateKey(row?.sail_date_from),
      date_to: toDateKey(row?.sail_date_to) || toDateKey(row?.sail_date_from),
      nights: toNumber(row?.sail_days) || 0,
      occupancy_dates: new Set(),
    });
  });

  asArray(inventoryRows).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    const shipCode = String(row?.ship_code || '').trim();
    if (!sailCode || !shipCode) return;
    const existing = bySail.get(sailCode) || {
      sail_code: sailCode,
      ship_code: shipCode,
      ship_name: String(row?.ship_name || shipCode).trim(),
      reference_sail_code: sailCode,
      sailing_role: 'segment',
      date_from: null,
      date_to: null,
      nights: 0,
      occupancy_dates: new Set(),
    };
    existing.ship_code = shipCode;
    existing.ship_name = String(row?.ship_name || existing.ship_name || shipCode).trim();
    existing.reference_sail_code = String(row?.reference_sail_code || existing.reference_sail_code || sailCode).trim();
    existing.sailing_role = String(row?.sailing_role || existing.sailing_role || 'segment').trim();
    bySail.set(sailCode, existing);
  });

  return bySail;
};

const attachOccupancyDates = (windows, capacityRows = []) => {
  asArray(capacityRows).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    const dateKey = toDateKey(row?.date);
    const win = windows.get(sailCode);
    if (!win || !dateKey) return;
    win.occupancy_dates.add(dateKey);
    if (!win.date_from || dateKey < win.date_from) win.date_from = dateKey;
    if (!win.date_to || dateKey > win.date_to) win.date_to = dateKey;
  });
  windows.forEach((win) => {
    if (win.occupancy_dates.size === 0 && win.date_from) {
      enumerateDateKeys(win.date_from, win.date_to).forEach((d) => win.occupancy_dates.add(d));
    }
    if (!win.nights) win.nights = Math.max(win.occupancy_dates.size - 1, 0);
  });
};

/**
 * Physical ship × day: MAX nameplate / sellable / occupied — never sum master + segments.
 */
export const buildPhysicalShipDays = (capacityRows = [], shipRows = []) => {
  const shipNames = new Map();
  asArray(shipRows).forEach((row) => {
    const code = String(row?.ship_code || '').trim();
    if (code) shipNames.set(code, String(row?.ship_name || code).trim());
  });

  const dayIndex = new Map();
  asArray(capacityRows).forEach((row) => {
    const shipCode = String(row?.ship_code || '').trim();
    const dateKey = toDateKey(row?.date);
    if (!shipCode || !dateKey) return;
    const sellableCabins = resolveSellableCabins(row);
    const sellableBerths = resolveSellableBerths(row);
    const occupied = toNumber(row?.occupied_berths ?? row?.berths_occupied);
    const occupiedCabins = toNumber(row?.occupied_cabins);
    const nameplate = toNumber(row?.nameplate_berths ?? row?.berth_capacity);
    const nameplateCabins = toNumber(row?.nameplate_cabins ?? row?.total_cabins);
    const offsaleCabins = toNumber(row?.offsale_cabins);
    const offsaleBerths = toNumber(row?.offsale_berths);
    const sailCode = String(row?.sail_code || '').trim();
    const key = shipDayKey(shipCode, dateKey);
    const existing = dayIndex.get(key) || {
      ship_code: shipCode,
      ship_name: shipNames.get(shipCode) || shipCode,
      date: dateKey,
      sellable: 0,
      sellable_cabins: 0,
      sellable_berths: 0,
      occupied: 0,
      occupied_cabins: 0,
      nameplate: 0,
      nameplate_cabins: 0,
      offsale_cabins: 0,
      offsale_berths: 0,
      sail_codes: new Set(),
    };
    existing.sellable_cabins = Math.max(existing.sellable_cabins, sellableCabins);
    existing.sellable_berths = Math.max(existing.sellable_berths, sellableBerths);
    existing.sellable = Math.max(existing.sellable, sellableBerths);
    existing.occupied = Math.max(existing.occupied, occupied);
    existing.occupied_cabins = Math.max(existing.occupied_cabins, occupiedCabins);
    existing.nameplate = Math.max(existing.nameplate, nameplate);
    existing.nameplate_cabins = Math.max(existing.nameplate_cabins, nameplateCabins);
    existing.offsale_cabins = Math.max(existing.offsale_cabins, offsaleCabins);
    existing.offsale_berths = Math.max(existing.offsale_berths, offsaleBerths);
    if (sailCode) existing.sail_codes.add(sailCode);
    existing.ship_name = shipNames.get(shipCode) || existing.ship_name;
    dayIndex.set(key, existing);
  });

  return [...dayIndex.values()].map((row) => ({
    ...row,
    sail_codes: [...row.sail_codes],
  }));
};

/**
 * Spread sail-level booked / estimated / contracted onto every occupancy day
 * of that sail (before and after a given calendar day).
 */
export const explodeDemandOntoDays = (bookingSummaryRows = [], windows = new Map()) => {
  const byShipDay = new Map();
  asArray(bookingSummaryRows).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    const win = windows.get(sailCode);
    if (!sailCode || !win) return;
    const booked = toNumber(row?.booked_guests ?? row?.guest_count);
    const bookedFit = toNumber(row?.booked_fit_guests);
    const bookedGroup = toNumber(row?.booked_group_guests);
    const estimated = toNumber(row?.estimated_guests);
    const contracted = toNumber(row?.contracted_guests);
    win.occupancy_dates.forEach((dateKey) => {
      const key = shipDayKey(win.ship_code, dateKey);
      const existing = byShipDay.get(key) || {
        booked: 0,
        booked_fit: 0,
        booked_group: 0,
        estimated: 0,
        contracted: 0,
        by_sail: [],
      };
      existing.booked += booked;
      existing.booked_fit += bookedFit;
      existing.booked_group += bookedGroup;
      existing.estimated += estimated;
      existing.contracted += contracted;
      existing.by_sail.push({
        sail_code: sailCode,
        reference_sail_code: win.reference_sail_code,
        sailing_role: win.sailing_role,
        nights: win.nights,
        booked,
        booked_fit: bookedFit,
        booked_group: bookedGroup,
        estimated,
        contracted,
      });
      byShipDay.set(key, existing);
    });
  });
  byShipDay.forEach((entry) => {
    const split = splitBookedBySailingRole(entry.by_sail);
    entry.booked_master = split.booked_master;
    entry.booked_segment = split.booked_segment;
    // If FIT/Group columns are absent, keep zeros (UI falls back to master/segment).
    if (!entry.booked_fit && !entry.booked_group && entry.booked) {
      // no-op — leave fit/group at 0 until migration is applied
    }
  });
  return byShipDay;
};

const coveringMasters = (windows, shipCode, dateKey) => {
  const list = [];
  const direct = windows?.get?.(shipCode);
  const candidates = Array.isArray(direct)
    ? direct
    : [];
  if (candidates.length) {
    candidates.forEach((win) => {
      if (!isVoyageIdentity(win)) return;
      if (!win.occupancy_dates?.has?.(dateKey)) return;
      list.push(win);
    });
  } else {
    windows?.forEach?.((win) => {
      if (win?.ship_code !== shipCode) return;
      if (!isVoyageIdentity(win)) return;
      if (!win.occupancy_dates?.has?.(dateKey)) return;
      list.push(win);
    });
  }
  list.sort((a, b) => (b.nights || 0) - (a.nights || 0));
  return list;
};

const voyageOccupiedOnDate = (physicalByKey, shipCode, dateKey) => {
  const row = physicalByKey.get(shipDayKey(shipCode, dateKey));
  return row ? row.occupied : 0;
};

/**
 * Flag why a day looks wrong: over-capacity, short product punching a longer
 * voyage, or low-probability group making remaining look full.
 */
export const classifyPressure = (cell, physicalByKey, windows, categoryDays = null) => {
  const sellable = cell.sellable || 0;
  const occupied = cell.occupied || 0;
  const booked = cell.booked || 0;
  const estimated = cell.estimated || 0;
  const reasons = [];
  let flag = PRESSURE_FLAGS.OK;
  const blockingCategories = [];

  if (sellable > 0 && occupied > sellable + 0.5) {
    flag = PRESSURE_FLAGS.OVER;
    reasons.push(`Occupied ${Math.round(occupied)} exceeds sellable ${Math.round(sellable)}.`);
  }

  const planning = booked + estimated;
  if (sellable > 0 && (planning - booked) > sellable * 0.15 && estimated > booked * 0.25) {
    if (flag === PRESSURE_FLAGS.OK) flag = PRESSURE_FLAGS.SOFT_GROUP;
    reasons.push(
      `Estimated ${Math.round(estimated)} vs booked ${Math.round(booked)} — low-probability group holds may overstate fill.`
    );
  }

  const masters = coveringMasters(windows, cell.ship_code, cell.date);
  const longest = masters[0] || null;
  const categories = categoriesForShipDate(categoryDays, cell.ship_code, cell.date);
  if (longest && categories.length) {
    const otherDates = [...longest.occupancy_dates].filter((d) => d !== cell.date);
    categories.forEach((entry) => {
      if (!categoryIsTight(entry)) return;
      const occPct = categoryOccPct(entry);
      let otherPct = occPct;
      if (otherDates.length) {
        const otherEntries = otherDates
          .map((dateKey) => categoryDays?.byShipDateCat?.get?.(categoryDayKey(cell.ship_code, dateKey, entry.category)))
          .filter(Boolean);
        if (otherEntries.length) {
          otherPct = otherEntries.reduce((sum, item) => sum + categoryOccPct(item), 0) / otherEntries.length;
        }
      }
      if (otherDates.length >= 2 && otherPct <= occPct - 0.2) {
        blockingCategories.push({
          category: entry.category,
          occupied: entry.occupied,
          total: entry.total,
          remaining: entry.remaining,
          occ_pct: occPct,
          other_pct: otherPct,
        });
      }
    });
    if (blockingCategories.length && flag !== PRESSURE_FLAGS.OVER) {
      flag = PRESSURE_FLAGS.BLOCKING;
      const names = blockingCategories.map((item) => item.category).join(', ');
      const first = blockingCategories[0];
      reasons.unshift(
        `${names} ${Math.round((first.occ_pct || 0) * 100)}% full today vs ${Math.round((first.other_pct || 0) * 100)}% on the rest of ${longest.nights || otherDates?.length || ''}-night ${longest.reference_sail_code} — cabin-category loading is blocking the longer voyage.`
      );
    }
  }

  if (longest && sellable > 0 && flag !== PRESSURE_FLAGS.OVER && !blockingCategories.length) {
    const otherDates = [...longest.occupancy_dates].filter((d) => d !== cell.date);
    if (otherDates.length >= 2) {
      const otherOcc = otherDates.map((d) => voyageOccupiedOnDate(physicalByKey, cell.ship_code, d));
      const avgOther = otherOcc.reduce((s, n) => s + n, 0) / otherOcc.length;
      const occPct = occupied / sellable;
      const otherPct = sellable > 0 ? avgOther / sellable : 0;
      if (occPct >= 0.7 && otherPct <= occPct - 0.25) {
        flag = PRESSURE_FLAGS.BLOCKING;
        reasons.push(
          `${longest.nights || otherDates.length}-night ${longest.reference_sail_code} is sparse on adjacent days (${Math.round(otherPct * 100)}% vs ${Math.round(occPct * 100)}% today) — a shorter product may be blocking the longer voyage.`
        );
      }
    }
  }

  if (flag === PRESSURE_FLAGS.OK && sellable > 0 && occupied / sellable < 0.4 && booked / sellable < 0.4) {
    flag = PRESSURE_FLAGS.UNDER;
    reasons.push(`Under-booked (${Math.round((occupied / sellable) * 100)}% occupied).`);
  }

  if (!reasons.length) {
    reasons.push('Load looks consistent with sellable capacity on this ship-day.');
  }

  return {
    flag,
    reasons,
    longest_voyage: longest?.reference_sail_code || null,
    blocking_categories: blockingCategories,
    categories,
  };
};

export const filterPhysicalToWindow = (dayRows = [], from, to) => {
  const start = toDateKey(from);
  const end = toDateKey(to);
  return asArray(dayRows).filter((row) => {
    if (start && row.date < start) return false;
    if (end && row.date > end) return false;
    return true;
  });
};

/**
 * Cabin-category loading by ship × day.
 * SUM berth-config splits within a sail, then MAX across overlapping sails.
 * When cabinCategoryMode is Group, real codes roll up via cabin_ctg → generic_category.
 */
export const buildCategoryShipDays = (
  occupancyRows = [],
  dateFrom = null,
  dateTo = null,
  {
    cabinCategoryMode = DEFAULT_CABIN_CATEGORY_MODE,
    cabinCtgIndex = null,
  } = {}
) => {
  const start = toDateKey(dateFrom);
  const end = toDateKey(dateTo);
  const mode = normalizeCabinCategoryMode(cabinCategoryMode);
  const perSail = new Map();
  asArray(occupancyRows).forEach((row) => {
    const shipCode = String(row?.ship_code || '').trim();
    const rawCategory = String(row?.cabin_category || '').trim();
    const dateKey = toDateKey(row?.sail_itinerary_date || row?.date);
    const sailCode = String(row?.sail_code || '').trim();
    if (!shipCode || !rawCategory || !dateKey) return;
    if (start && dateKey < start) return;
    if (end && dateKey > end) return;
    const category = resolveCabinCategoryLabel(rawCategory, cabinCtgIndex, mode);
    if (!category) return;
    const key = `${shipDayKey(shipCode, dateKey)}|${sailCode}|${category}`;
    const existing = perSail.get(key) || {
      ship_code: shipCode,
      ship_name: String(row?.ship_name || shipCode).trim(),
      date: dateKey,
      sail_code: sailCode,
      category,
      total: 0,
      occupied: 0,
      remaining: 0,
    };
    existing.total += toNumber(row?.total_cabins);
    existing.occupied += toNumber(row?.occupied_cabins);
    existing.remaining += toNumber(row?.remaining_cabins);
    perSail.set(key, existing);
  });

  const byShipDateCat = new Map();
  perSail.forEach((part) => {
    const key = categoryDayKey(part.ship_code, part.date, part.category);
    const existing = byShipDateCat.get(key);
    if (!existing) {
      byShipDateCat.set(key, {
        ship_code: part.ship_code,
        ship_name: part.ship_name,
        date: part.date,
        category: part.category,
        total: part.total,
        occupied: part.occupied,
        remaining: part.remaining,
      });
      return;
    }
    existing.total = Math.max(existing.total, part.total);
    existing.occupied = Math.max(existing.occupied, part.occupied);
    existing.remaining = Math.max(existing.remaining, part.remaining);
  });

  const byShipDate = new Map();
  byShipDateCat.forEach((entry) => {
    const key = shipDayKey(entry.ship_code, entry.date);
    const list = byShipDate.get(key) || [];
    list.push(entry);
    byShipDate.set(key, list);
  });
  byShipDate.forEach((list) => list.sort((a, b) => a.category.localeCompare(b.category)));
  return {
    byShipDateCat,
    byShipDate,
    cabinCategoryMode: mode,
  };
};

const categoriesForShipDate = (categoryDays, shipCode, dateKey) => (
  categoryDays?.byShipDate?.get?.(shipDayKey(shipCode, dateKey)) || []
);

const categoryOccPct = (entry) => {
  const total = Number(entry?.total) || 0;
  if (!total) return 0;
  return (Number(entry?.occupied) || 0) / total;
};

const categoryIsTight = (entry) => {
  if (!entry) return false;
  const total = Number(entry.total) || 0;
  if (!total) return false;
  const remaining = Number(entry.remaining);
  const remainingKnown = Number.isFinite(remaining);
  return (remainingKnown && remaining <= 1) || categoryOccPct(entry) >= 0.85;
};

export const buildPressureCells = ({
  capacityRows = [],
  shipRows = [],
  inventoryRows = [],
  masterSailRows = [],
  bookingSummaryRows = [],
  occupancyRows = [],
  cabinCtgIndex = null,
  cabinCategoryMode = DEFAULT_CABIN_CATEGORY_MODE,
  dateFrom = null,
  dateTo = null,
} = {}) => {
  const windows = buildSailWindows(inventoryRows, masterSailRows);
  attachOccupancyDates(windows, capacityRows);
  const physical = filterPhysicalToWindow(
    buildPhysicalShipDays(capacityRows, shipRows),
    dateFrom,
    dateTo
  );
  const demand = explodeDemandOntoDays(bookingSummaryRows, windows);
  const physicalByKey = new Map(physical.map((row) => [shipDayKey(row.ship_code, row.date), row]));
  const windowsByShip = indexWindowsByShip(windows);
  const categoryDays = buildCategoryShipDays(occupancyRows, dateFrom, dateTo, {
    cabinCategoryMode,
    cabinCtgIndex,
  });

  const cells = physical.map((row) => {
    const d = demand.get(shipDayKey(row.ship_code, row.date)) || {
      booked: 0,
      booked_fit: 0,
      booked_group: 0,
      booked_master: 0,
      booked_segment: 0,
      estimated: 0,
      contracted: 0,
      by_sail: [],
    };
    const base = {
      ...row,
      booked: d.booked,
      booked_master: d.booked_master || 0,
      booked_segment: d.booked_segment || 0,
      booked_fit: d.booked_fit || 0,
      booked_group: d.booked_group || 0,
      estimated: d.estimated,
      contracted: d.contracted,
      by_sail: d.by_sail,
      planning: d.booked + d.estimated,
    };
    const classified = classifyPressure(base, physicalByKey, windowsByShip, categoryDays);
    return { ...base, ...classified };
  });

  return { cells, windows, categoryDays };
};

const uniqueSorted = (values) => [...new Set(values)].sort();
const matchesShipFilter = (shipCode, shipFilter) => (
  !shipFilter || shipFilter === SHIP_FILTER_ALL || String(shipCode) === String(shipFilter)
);

const minDateKey = (...keys) => {
  const valid = keys.map(toDateKey).filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (a < b ? a : b));
};

const maxDateKey = (...keys) => {
  const valid = keys.map(toDateKey).filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (a > b ? a : b));
};

/** True when dateKey falls in a voyage column's occupancy span. */
export const dateInVoyageSpan = (dateKey, voyageCol) => {
  const date = toDateKey(dateKey);
  if (!date || !voyageCol) return false;
  const from = toDateKey(voyageCol.date_from);
  const to = toDateKey(voyageCol.date_to);
  if (from && to) return date >= from && date <= to;
  if (from) return date >= from;
  if (to) return date <= to;
  return false;
};

export const dateInRange = (dateKey, fromKey, toKey) => {
  const date = toDateKey(dateKey);
  const from = toDateKey(fromKey);
  const to = toDateKey(toKey);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return Boolean(from || to);
};

/**
 * Row band for sail.select: focus = departure; impact = voyage + overlapping pressure days.
 * Falls back to dates that already have a bar in the selected voyage column.
 */
export const resolveSelectionRowBand = ({
  voyageCol = null,
  impactFrom = null,
  impactTo = null,
  rows = [],
} = {}) => {
  if (!voyageCol) return { focusDate: null, impactFrom: null, impactTo: null };
  const focusDate = toDateKey(voyageCol.date_from);
  let from = toDateKey(impactFrom) || toDateKey(voyageCol.date_from);
  let to = toDateKey(impactTo) || toDateKey(voyageCol.date_to);

  if ((!from || !to || from === to) && voyageCol.id) {
    const occupied = asArray(rows)
      .filter((row) => row?.[voyageCol.id] != null)
      .map((row) => toDateKey(row.date))
      .filter(Boolean)
      .sort();
    if (occupied.length) {
      from = minDateKey(from, occupied[0]) || occupied[0];
      to = maxDateKey(to, occupied[occupied.length - 1]) || occupied[occupied.length - 1];
    }
  }

  to = to || from;

  if (focusDate) {
    from = minDateKey(from, focusDate) || focusDate;
    to = maxDateKey(to, focusDate) || focusDate;
  }

  return { focusDate, impactFrom: from, impactTo: to };
};

/**
 * Resolve the master voyage window for a selection (reference / sail code).
 */
export const resolveVoyageWindow = (windows, referenceSailCode, shipCode = null) => {
  const code = String(referenceSailCode || '').trim();
  if (!code || !windows) return null;
  let found = null;
  windows.forEach?.((win) => {
    if (!win) return;
    if (shipCode && String(win.ship_code) !== String(shipCode)) return;
    const matches = win.reference_sail_code === code || win.sail_code === code;
    if (!matches) return;
    if (!isVoyageIdentity(win) && found) return;
    if (isVoyageIdentity(win) || !found) found = win;
  });
  return found;
};

/**
 * Expand the display window so a selected master includes:
 * - its full occupancy span
 * - earlier/later same-ship sails that overlap that span (capacity impact)
 * Global/base ends are preserved when wider; never shrink past the base range.
 */
export const expandDateWindowForSailImpact = ({
  dateFrom = null,
  dateTo = null,
  windows = null,
  referenceSailCode = null,
  shipCode = null,
} = {}) => {
  let from = toDateKey(dateFrom);
  let to = toDateKey(dateTo);
  const voyage = resolveVoyageWindow(windows, referenceSailCode, shipCode);
  if (!voyage) {
    return { from, to, voyage: null, impactFrom: from, impactTo: to };
  }

  let impactFrom = toDateKey(voyage.date_from);
  let impactTo = toDateKey(voyage.date_to) || impactFrom;
  const ship = shipCode || voyage.ship_code;

  windows.forEach?.((win) => {
    if (!win || (ship && String(win.ship_code) !== String(ship))) return;
    if (!voyageOverlapsRange(win, voyage.date_from, voyage.date_to)) return;
    impactFrom = minDateKey(impactFrom, win.date_from) || impactFrom;
    impactTo = maxDateKey(impactTo, win.date_to) || impactTo;
  });

  from = minDateKey(from, impactFrom) || from || impactFrom;
  to = maxDateKey(to, impactTo) || to || impactTo;

  return { from, to, voyage, impactFrom, impactTo };
};

/**
 * Continuous calendar spine for the pressure grid.
 * Prefer explicit from/to; when to is open, extend through data / impact / practical cap.
 */
export const resolvePressureDateSpine = ({
  dateFrom = null,
  dateTo = null,
  cellDates = [],
  impactFrom = null,
  impactTo = null,
  openEndedDays = OPEN_ENDED_SPINE_DAYS,
} = {}) => {
  const start = toDateKey(dateFrom) || minDateKey(...asArray(cellDates), impactFrom);
  let end = toDateKey(dateTo);
  if (!end) {
    end = maxDateKey(
      ...asArray(cellDates),
      impactTo,
      start ? addUtcDays(start, openEndedDays - 1) : null
    );
  }
  if (!start || !end) {
    return uniqueSorted(
      asArray(cellDates).filter((d) => {
        if (start && d < start) return false;
        if (end && d > end) return false;
        return Boolean(d);
      })
    );
  }
  return enumerateDateKeys(start, end);
};

export const buildPressureGrid = ({
  cells = [],
  windows = new Map(),
  categoryDays = null,
  grain = PRESSURE_GRAINS.SHIP,
  dateFrom = null,
  dateTo = null,
  shipFilter = SHIP_FILTER_ALL,
  impactFrom = null,
  impactTo = null,
} = {}) => {
  const start = toDateKey(dateFrom);
  const end = toDateKey(dateTo);
  const scopedCells = asArray(cells).filter((cell) => matchesShipFilter(cell.ship_code, shipFilter));
  const dates = resolvePressureDateSpine({
    dateFrom: start,
    dateTo: end,
    cellDates: scopedCells.map((c) => c.date),
    impactFrom,
    impactTo,
  });

  let columns;
  if (grain === PRESSURE_GRAINS.CABIN) {
    const colMap = new Map();
    const source = categoryDays?.byShipDateCat || new Map();
    source.forEach((entry) => {
      if (!matchesShipFilter(entry.ship_code, shipFilter)) return;
      if (start && entry.date < start) return;
      if (end && entry.date > end) return;
      const id = `${entry.ship_code}::${entry.category}`;
      if (!colMap.has(id)) {
        const multiShip = shipFilter === SHIP_FILTER_ALL || !shipFilter;
        colMap.set(id, {
          id,
          kind: 'cabin',
          label: multiShip ? `${entry.ship_code} ${entry.category}` : entry.category,
          ship_code: entry.ship_code,
          ship_name: entry.ship_name,
          category: entry.category,
        });
      }
    });
    columns = [...colMap.values()]
      .sort((a, b) => String(a.ship_code).localeCompare(String(b.ship_code)) || String(a.category).localeCompare(String(b.category)))
      .slice(0, MAX_CABIN_COLUMNS);
  } else if (grain === PRESSURE_GRAINS.VOYAGE) {
    const colMap = new Map();
    windows.forEach((win) => {
      if (!matchesShipFilter(win.ship_code, shipFilter)) return;
      if (!isVoyageIdentity(win)) return;
      if (!voyageOverlapsRange(win, start, end)) return;
      const id = win.reference_sail_code;
      if (!id) return;
      if (!colMap.has(id)) {
        colMap.set(id, {
          id,
          kind: 'voyage',
          label: monthLabelFromKey(win.date_from) || id,
          title_full: id,
          ship_code: win.ship_code,
          ship_name: win.ship_name,
          date_from: win.date_from,
          date_to: win.date_to || win.date_from,
          sail_codes: new Set([win.sail_code]),
        });
      } else {
        const col = colMap.get(id);
        if (win.date_from && (!col.date_from || win.date_from < col.date_from)) {
          col.date_from = win.date_from;
          col.label = monthLabelFromKey(win.date_from) || id;
        }
        if (win.date_to && (!col.date_to || win.date_to > col.date_to)) {
          col.date_to = win.date_to;
        }
      }
      colMap.get(id).sail_codes.add(win.sail_code);
    });
    cells.forEach((cell) => {
      if (!matchesShipFilter(cell.ship_code, shipFilter)) return;
      (cell.by_sail || []).forEach((part) => {
        const id = part.reference_sail_code;
        if (!id || !colMap.has(id)) return;
        colMap.get(id).sail_codes.add(part.sail_code);
      });
    });
    const voyageColumns = [...colMap.values()]
      .sort((a, b) => String(a.date_from || '').localeCompare(String(b.date_from || '')) || String(a.id).localeCompare(String(b.id)))
      .slice(0, MAX_VOYAGE_COLUMNS)
      .map((col) => ({
        ...col,
        sail_codes: [...col.sail_codes],
      }));

    const dayShipMap = new Map();
    const rememberDayShip = (shipCode, shipName) => {
      if (!shipCode || !matchesShipFilter(shipCode, shipFilter)) return;
      if (!dayShipMap.has(shipCode)) {
        dayShipMap.set(shipCode, {
          id: `__day__::${shipCode}`,
          kind: 'day',
          label: 'Day',
          ship_code: shipCode,
          ship_name: shipName || shipCode,
        });
      } else if (shipName) {
        dayShipMap.get(shipCode).ship_name = shipName;
      }
    };
    scopedCells.forEach((cell) => rememberDayShip(cell.ship_code, cell.ship_name));
    voyageColumns.forEach((col) => rememberDayShip(col.ship_code, col.ship_name));
    const dayColumns = [...dayShipMap.values()].sort((a, b) => (
      String(a.ship_name || a.ship_code).localeCompare(String(b.ship_name || b.ship_code))
    ));
    if (dayColumns.length > 1) {
      dayColumns.forEach((col) => {
        col.label = col.ship_code;
      });
    }
    columns = [...dayColumns, ...voyageColumns];
  } else {
    const colMap = new Map();
    scopedCells.forEach((cell) => {
      if (!colMap.has(cell.ship_code)) {
        colMap.set(cell.ship_code, {
          id: cell.ship_code,
          kind: 'ship',
          label: cell.ship_name || cell.ship_code,
          ship_code: cell.ship_code,
          ship_name: cell.ship_name,
        });
      }
    });
    columns = [...colMap.values()];
  }

  const cellIndex = new Map();
  cells.forEach((cell) => {
    cellIndex.set(shipDayKey(cell.ship_code, cell.date), cell);
  });

  const rows = dates.map((date) => {
    const row = {
      date,
      date_label: monthLabelFromKey(date),
    };
    columns.forEach((col) => {
      if (col.kind === 'day') {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        row[col.id] = physical
          ? { ...physical, column_id: col.id, grain: 'day' }
          : null;
      } else if (col.kind === 'voyage') {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        if (!physical) {
          row[col.id] = null;
          return;
        }
        const parts = (physical.by_sail || []).filter((p) => p.reference_sail_code === col.id);
        if (!parts.length && !(physical.sail_codes || []).some((s) => col.sail_codes.includes(s))) {
          row[col.id] = null;
          return;
        }
        const booked = parts.reduce((s, p) => s + p.booked, 0);
        const estimated = parts.reduce((s, p) => s + p.estimated, 0);
        const contracted = parts.reduce((s, p) => s + p.contracted, 0);
        const split = splitBookedBySailingRole(parts);
        const bookedFit = parts.reduce((s, p) => s + toNumber(p.booked_fit), 0);
        const bookedGroup = parts.reduce((s, p) => s + toNumber(p.booked_group), 0);
        row[col.id] = {
          ...physical,
          booked,
          booked_master: split.booked_master,
          booked_segment: split.booked_segment,
          booked_fit: bookedFit,
          booked_group: bookedGroup,
          estimated,
          contracted,
          by_sail: parts,
          column_id: col.id,
          grain: 'voyage',
        };
      } else if (col.kind === 'cabin') {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        const cat = categoryDays?.byShipDateCat?.get?.(categoryDayKey(col.ship_code, date, col.category));
        if (!cat) {
          row[col.id] = null;
          return;
        }
        const catBlocking = (physical?.blocking_categories || []).some((item) => item.category === col.category);
        const total = Number(cat.total) || 0;
        const occupiedCabins = Number(cat.occupied) || 0;
        const remaining = Number(cat.remaining) || 0;
        const occPct = total ? occupiedCabins / total : 0;
        let flag = PRESSURE_FLAGS.OK;
        if (total && occupiedCabins > total + 0.5) flag = PRESSURE_FLAGS.OVER;
        else if (catBlocking) flag = PRESSURE_FLAGS.BLOCKING;
        else if (total && occPct < 0.4) flag = PRESSURE_FLAGS.UNDER;
        row[col.id] = {
          ...(physical || {}),
          ship_code: col.ship_code,
          ship_name: col.ship_name || physical?.ship_name,
          date,
          cabin_category: col.category,
          sellable_cabins: total,
          occupied_cabins: occupiedCabins,
          remaining_cabins: remaining,
          nameplate_cabins: total,
          offsale_cabins: 0,
          booked: occupiedCabins,
          estimated: 0,
          contracted: 0,
          flag,
          reasons: catBlocking
            ? (physical?.reasons || []).filter((reason) => String(reason).includes(col.category))
            : flag === PRESSURE_FLAGS.OVER
              ? [`${col.category} occupied ${occupiedCabins} exceeds ${total} sellable cabins.`]
              : flag === PRESSURE_FLAGS.UNDER
                ? [`${col.category} has spare sellable (${Math.round(occPct * 100)}% occupied).`]
                : [`${col.category} loading looks consistent.`],
          blocking_categories: (physical?.blocking_categories || []).filter((item) => item.category === col.category),
          column_id: col.id,
          grain: 'cabin',
        };
      } else {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        row[col.id] = physical
          ? { ...physical, column_id: col.id, grain: 'ship' }
          : null;
      }
    });
    return row;
  });

  const counts = { blocking: 0, over: 0, under: 0, soft_group: 0 };
  rows.forEach((row) => {
    columns.forEach((col) => {
      const cell = row[col.id];
      if (!cell) return;
      if (cell.flag === PRESSURE_FLAGS.BLOCKING) counts.blocking += 1;
      if (cell.flag === PRESSURE_FLAGS.OVER) counts.over += 1;
      if (cell.flag === PRESSURE_FLAGS.UNDER) counts.under += 1;
      if (cell.flag === PRESSURE_FLAGS.SOFT_GROUP) counts.soft_group += 1;
    });
  });

  return { rows, columns, dates, counts, grain };
};

export const buildShipDayPressureBundle = (args = {}) => {
  const window = {
    from: toDateKey(args.dateFrom) || defaultDateWindow().from,
    to: toDateKey(args.dateTo) || defaultDateWindow().to,
  };
  const { cells, windows, categoryDays } = buildPressureCells({
    ...args,
    dateFrom: window.from,
    dateTo: window.to,
  });
  const grid = buildPressureGrid({
    cells,
    windows,
    categoryDays,
    grain: args.grain || PRESSURE_GRAINS.SHIP,
    dateFrom: window.from,
    dateTo: window.to,
    shipFilter: args.shipFilter || SHIP_FILTER_ALL,
  });
  return {
    window,
    cells,
    ...grid,
    meta: {
      wip: true,
      cabinGrain: args.grain === PRESSURE_GRAINS.CABIN,
    },
  };
};

export default buildShipDayPressureBundle;
