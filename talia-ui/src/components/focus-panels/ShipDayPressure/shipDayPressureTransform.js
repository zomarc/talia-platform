/**
 * Ship × Day Pressure — dead-bed / blocking visualisation (WIP).
 *
 * Physical capacity is ship × calendar day (MAX across overlapping sail_codes).
 * Selling demand is exploded onto every occupancy date of that sail_code so a
 * 7-night booking occupies all seven ship-days, not only departure.
 */

import { SHIP_FILTER_ALL } from '../../../lib/globalShipFilter.js';
import {
  indexCabinReservesForSail,
  summarizeCabinReserves,
} from '../../../lib/shipCabinReserve.js';
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
  PACKAGE: 'package',
  MARKET: 'market',
  IMPACT: 'impact',
  CABIN: 'cabin',
};

/** Nights at or above this threshold are styled as long-duration holds (e.g. 22N group). */
export const LONG_DURATION_NIGHTS = 14;

const MAX_DURATION_COLUMNS = 16;

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
const MAX_PACKAGE_COLUMNS = 48;
const MAX_CABIN_COLUMNS = 48;

/** Package / port-to-port product key (prefer Dim_Sale package_type). */
export const resolvePackageKey = (win = {}) => {
  const type = String(win?.package_type || '').trim();
  if (type) return type;
  const from = String(win?.port_from || '').trim();
  const to = String(win?.port_to || '').trim();
  const nights = toNumber(win?.nights) || 0;
  if (from || to) return `${from || '?'}-${to || '?'}-${nights}`;
  return null;
};

export const formatPackageLabel = (win = {}) => {
  const from = String(win?.port_from || '').trim() || '?';
  const to = String(win?.port_to || '').trim() || '?';
  const nights = toNumber(win?.nights) || 0;
  return nights ? `${from}→${to} · ${nights}N` : `${from}→${to}`;
};

export const formatDurationLabel = (nights) => {
  const n = toNumber(nights);
  return n > 0 ? `${n}N` : '?N';
};

/** Long-duration group holds: contracted/estimated can block FIT even when booked is low. */
export const classifyDurationImpact = ({
  nights = 0,
  booked = 0,
  booked_fit = 0,
  estimated = 0,
  contracted = 0,
  sellable = 0,
} = {}) => {
  const long = toNumber(nights) >= LONG_DURATION_NIGHTS;
  const fit = toNumber(booked_fit) || toNumber(booked);
  const planning = toNumber(estimated) + toNumber(contracted);
  if (!long || sellable <= 0) return { flag: PRESSURE_FLAGS.OK, reasons: [] };
  const planningPct = planning / sellable;
  const estPct = toNumber(estimated) / sellable;
  if (planningPct >= 0.12 && estPct >= 0.08 && planning > fit * 0.35) {
    return {
      flag: PRESSURE_FLAGS.SOFT_GROUP,
      reasons: [
        `${nights}N hold: contracted ${Math.round(contracted)} + estimated ${Math.round(estimated)} vs FIT booked ${Math.round(fit)} — low-probability group may be blocking shorter products.`,
      ],
    };
  }
  if (planningPct >= 0.2 && fit / sellable < 0.25) {
    return {
      flag: PRESSURE_FLAGS.BLOCKING,
      reasons: [
        `${nights}N product occupies ship-days with only ${Math.round((fit / sellable) * 100)}% FIT booked but ${Math.round(planningPct * 100)}% contracted/expected — beds blocked for other sails.`,
      ],
    };
  }
  return { flag: PRESSURE_FLAGS.OK, reasons: [] };
};

const buildDemandCellFromParts = (physical, parts, extra = {}) => {
  if (!physical || !parts?.length) return null;
  const booked = parts.reduce((s, p) => s + p.booked, 0);
  const estimated = parts.reduce((s, p) => s + p.estimated, 0);
  const contracted = parts.reduce((s, p) => s + p.contracted, 0);
  const split = splitBookedBySailingRole(parts);
  const bookedFit = parts.reduce((s, p) => s + toNumber(p.booked_fit), 0);
  const bookedGroup = parts.reduce((s, p) => s + toNumber(p.booked_group), 0);
  const nights = toNumber(extra.nights ?? parts[0]?.nights);
  const impact = classifyDurationImpact({
    nights,
    booked,
    booked_fit: bookedFit,
    estimated,
    contracted,
    sellable: physical.sellable || physical.sellable_berths,
  });
  return {
    ...physical,
    booked,
    booked_master: split.booked_master,
    booked_segment: split.booked_segment,
    booked_fit: bookedFit,
    booked_group: bookedGroup,
    estimated,
    contracted,
    by_sail: parts,
    nights,
    ...impact,
    ...extra,
  };
};

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
      package_type: String(row?.package_type || '').trim() || null,
      package_name: String(row?.package_name || '').trim() || null,
      port_from: String(row?.port_from || '').trim() || null,
      port_to: String(row?.port_to || '').trim() || null,
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
      package_type: null,
      package_name: null,
      port_from: null,
      port_to: null,
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
        package_key: resolvePackageKey(win),
        package_type: win.package_type,
        package_name: win.package_name,
        port_from: win.port_from,
        port_to: win.port_to,
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
 * Narrow keeps the highlighted sailing dates (and a clicked focus date).
 * Wide returns every row. No sailing band → leave the grid unchanged.
 */
export const filterPressureRowsForScope = (rows = [], band = null, scope = 'narrow') => {
  const list = asArray(rows);
  if (scope === 'wide') return list;
  const from = toDateKey(band?.impactFrom);
  const to = toDateKey(band?.impactTo);
  const focus = toDateKey(band?.focusDate);
  if (!from && !to) return list;
  return list.filter((row) => {
    const date = toDateKey(row?.date);
    if (!date) return false;
    if (focus && date === focus) return true;
    return dateInRange(date, from, to);
  });
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
 * When MONTH criteria is set, extend `to` through full occupancy of sailings
 * that depart in that month (e.g. late-Feb 7N into March) so blocking stays visible.
 */
export const expandDateWindowForDepartingSails = ({
  dateFrom = null,
  dateTo = null,
  windows = new Map(),
  departureMonth = null,
} = {}) => {
  const monthKey = typeof departureMonth === 'string' && /^\d{4}-\d{2}$/.test(departureMonth.trim())
    ? departureMonth.trim()
    : null;
  let from = toDateKey(dateFrom);
  let to = toDateKey(dateTo);
  if (!monthKey) return { from, to };

  windows.forEach?.((win) => {
    const dep = toDateKey(win?.date_from);
    if (!dep || dep.slice(0, 7) !== monthKey) return;
    const end = toDateKey(win?.date_to) || dep;
    if (end && (!to || end > to)) to = end;
  });

  return { from, to };
};

/** Exclude Celestyal / own-line rows from peer competitor overlays. */
export const isOwnCruiseLine = (value) => /celestyal/i.test(String(value || '').trim());

const pushUniqueCap = (list, item, cap = 8) => {
  if (!item || list.length >= cap) return;
  if (list.includes(item)) return;
  list.push(item);
};

/**
 * Index promotions + both competitor feeds onto ship × departure-date.
 * Pricing = stg.COMPETITOR; Benchmark = RateGain dwh. Peers attach to every
 * Celestyal ship that departs that calendar day (no competitor ship_code join).
 */
export const buildMarketDayIndex = ({
  publishedRateRows = [],
  competitorPricingRows = [],
  competitorBenchmarkRows = [],
  windows = new Map(),
  dateFrom = null,
  dateTo = null,
} = {}) => {
  const start = toDateKey(dateFrom);
  const end = toDateKey(dateTo);
  const inWindow = (dateKey) => {
    if (!dateKey) return false;
    if (start && dateKey < start) return false;
    if (end && dateKey > end) return false;
    return true;
  };

  const shipDepartures = new Map();
  windows.forEach?.((win) => {
    const shipCode = String(win?.ship_code || '').trim();
    const dateKey = toDateKey(win?.date_from);
    if (!shipCode || !inWindow(dateKey)) return;
    const key = shipDayKey(shipCode, dateKey);
    const existing = shipDepartures.get(key) || {
      ship_code: shipCode,
      ship_name: win.ship_name || shipCode,
      date: dateKey,
      sail_codes: new Set(),
    };
    if (win.sail_code) existing.sail_codes.add(win.sail_code);
    if (win.ship_name) existing.ship_name = win.ship_name;
    shipDepartures.set(key, existing);
  });

  const promosByShipDate = new Map();
  asArray(publishedRateRows).forEach((row) => {
    const shipCode = String(row?.ship_code || '').trim();
    const dateKey = toDateKey(row?.departure_date);
    const promoName = String(row?.promo_name || '').trim();
    if (!shipCode || !dateKey || !promoName || !inWindow(dateKey)) return;
    const key = shipDayKey(shipCode, dateKey);
    if (!shipDepartures.has(key)) {
      shipDepartures.set(key, {
        ship_code: shipCode,
        ship_name: shipCode,
        date: dateKey,
        sail_codes: new Set([String(row?.sail_code || '').trim()].filter(Boolean)),
      });
    } else if (row?.sail_code) {
      shipDepartures.get(key).sail_codes.add(String(row.sail_code).trim());
    }
    const bucket = promosByShipDate.get(key) || new Map();
    const fare = toNumber(row?.fare_per_person);
    const prev = bucket.get(promoName) || {
      name: promoName,
      type: String(row?.promo_type || '').trim() || null,
      min_fare: null,
      count: 0,
    };
    prev.count += 1;
    if (fare > 0 && (prev.min_fare == null || fare < prev.min_fare)) prev.min_fare = fare;
    if (!prev.type && row?.promo_type) prev.type = String(row.promo_type).trim();
    bucket.set(promoName, prev);
    promosByShipDate.set(key, bucket);
  });

  const pricingByDate = new Map();
  asArray(competitorPricingRows).forEach((row) => {
    const dateKey = toDateKey(row?.departure_date);
    if (!inWindow(dateKey)) return;
    const line = String(row?.cruise_line || row?.cruiseLine || '').trim();
    if (isOwnCruiseLine(line)) return;
    const price = toNumber(row?.lowest_price ?? row?.lowestPrice ?? row?.pppd);
    const existing = pricingByDate.get(dateKey) || {
      date: dateKey,
      source: 'pricing',
      peer_count: 0,
      min_price: null,
      lines: [],
      offers: [],
    };
    existing.peer_count += 1;
    if (price > 0 && (existing.min_price == null || price < existing.min_price)) {
      existing.min_price = price;
    }
    pushUniqueCap(existing.lines, line);
    const offer = String(row?.available_offer || row?.cruise_name || '').trim();
    pushUniqueCap(existing.offers, offer);
    pricingByDate.set(dateKey, existing);
  });

  const benchmarkByDate = new Map();
  asArray(competitorBenchmarkRows).forEach((row) => {
    const dateKey = toDateKey(row?.departure_date);
    if (!inWindow(dateKey)) return;
    const latest = String(row?.is_latest_snapshot || 'Y').trim().toUpperCase();
    if (latest && latest !== 'Y' && latest !== '1') return;
    const line = String(row?.cruise_line_name || row?.cruise_line_code || '').trim();
    if (isOwnCruiseLine(line)) return;
    const pppd = toNumber(row?.pppd);
    const total = toNumber(row?.total_rate_pp_eur ?? row?.total_rate_pp);
    const existing = benchmarkByDate.get(dateKey) || {
      date: dateKey,
      source: 'benchmark',
      peer_count: 0,
      min_pppd: null,
      min_total: null,
      lines: [],
      offers: [],
    };
    existing.peer_count += 1;
    if (pppd > 0 && (existing.min_pppd == null || pppd < existing.min_pppd)) {
      existing.min_pppd = pppd;
    }
    if (total > 0 && (existing.min_total == null || total < existing.min_total)) {
      existing.min_total = total;
    }
    pushUniqueCap(existing.lines, line);
    const offer = String(row?.available_offer || '').trim();
    pushUniqueCap(existing.offers, offer);
    benchmarkByDate.set(dateKey, existing);
  });

  const byShipDate = new Map();
  shipDepartures.forEach((dep, key) => {
    const promoMap = promosByShipDate.get(key);
    const promos = promoMap
      ? [...promoMap.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)))
      : [];
    const pricing = pricingByDate.get(dep.date) || null;
    const benchmark = benchmarkByDate.get(dep.date) || null;
    if (!promos.length && !pricing && !benchmark) return;
    byShipDate.set(key, {
      ship_code: dep.ship_code,
      ship_name: dep.ship_name,
      date: dep.date,
      sail_codes: [...dep.sail_codes],
      promos,
      pricing,
      benchmark,
      has_promo: promos.length > 0,
      has_pricing: Boolean(pricing?.peer_count),
      has_benchmark: Boolean(benchmark?.peer_count),
    });
  });

  return { byShipDate, pricingByDate, benchmarkByDate };
};

/**
 * Blocked / reserved cabins per ship-day (offsale from capacity + ship_cabin_reserve).
 */
export const buildShipDayReserveIndex = ({
  reserveRows = [],
  cells = [],
} = {}) => {
  const byShipDate = new Map();
  asArray(cells).forEach((cell) => {
    const key = shipDayKey(cell.ship_code, cell.date);
    const reserveIndex = indexCabinReservesForSail(reserveRows, {
      shipCode: cell.ship_code,
      dateKey: cell.date,
    });
    const summary = summarizeCabinReserves(reserveIndex);
    const offsaleFromCapacity = toNumber(cell.offsale_cabins);
    const blockedCabins = Math.max(offsaleFromCapacity, summary.offsale);
    byShipDate.set(key, {
      ...summary,
      offsale_from_capacity: offsaleFromCapacity,
      blocked_cabins: blockedCabins,
      nameplate_cabins: toNumber(cell.nameplate_cabins),
    });
  });
  return { byShipDate };
};

/** Worst cabin-category loading on a ship-day (for Impact pressure strip). */
export const summarizeShipDayCabinPressure = (physical, categoryDays, shipCode, date) => {
  const cats = categoriesForShipDate(categoryDays, shipCode, date);
  if (!cats.length) return null;
  let maxOcc = 0;
  let tightest = null;
  let tightCount = 0;
  cats.forEach((cat) => {
    const occ = categoryOccPct(cat);
    if (occ > maxOcc) {
      maxOcc = occ;
      tightest = cat;
    }
    if (categoryIsTight(cat)) tightCount += 1;
  });
  const blockingCats = physical?.blocking_categories || [];
  let flag = PRESSURE_FLAGS.OK;
  if (blockingCats.length) flag = PRESSURE_FLAGS.BLOCKING;
  else if (tightCount >= 2) flag = PRESSURE_FLAGS.OVER;
  else if (maxOcc >= 0.85) flag = PRESSURE_FLAGS.BLOCKING;
  return {
    grain: 'cabin_pressure',
    category_count: cats.length,
    tightest_category: tightest?.category || null,
    max_occ_pct: maxOcc,
    tight_categories: tightCount,
    blocking_categories: blockingCats,
    flag,
    reasons: blockingCats.length
      ? blockingCats.map((item) => `${item.category} ${Math.round((item.occ_pct || 0) * 100)}% full`)
      : tightCount
        ? [`${tightCount} cabin categories at ≥85% on this ship-day`]
        : [],
  };
};

const buildDurationColumnMap = (windows, shipFilter, start, end) => {
  const colMap = new Map();
  windows.forEach((win) => {
    if (!matchesShipFilter(win.ship_code, shipFilter)) return;
    const nights = toNumber(win.nights);
    if (!nights) return;
    if (!voyageOverlapsRange(win, start, end)) return;
    const id = `${win.ship_code}::${nights}N`;
    if (!colMap.has(id)) {
      colMap.set(id, {
        id,
        kind: 'duration',
        nights,
        label: formatDurationLabel(nights),
        title_full: `${nights}-night products`,
        ship_code: win.ship_code,
        ship_name: win.ship_name,
        is_long_duration: nights >= LONG_DURATION_NIGHTS,
        date_from: win.date_from,
        date_to: win.date_to || win.date_from,
        sail_codes: new Set([win.sail_code]),
        reference_sail_codes: new Set([win.reference_sail_code].filter(Boolean)),
        package_keys: new Set([resolvePackageKey(win)].filter(Boolean)),
      });
    } else {
      const col = colMap.get(id);
      if (win.date_from && (!col.date_from || win.date_from < col.date_from)) col.date_from = win.date_from;
      if (win.date_to && (!col.date_to || win.date_to > col.date_to)) col.date_to = win.date_to;
      const pkg = resolvePackageKey(win);
      if (pkg) col.package_keys.add(pkg);
    }
    colMap.get(id).sail_codes.add(win.sail_code);
    if (win.reference_sail_code) colMap.get(id).reference_sail_codes.add(win.reference_sail_code);
  });
  return [...colMap.values()]
    .sort((a, b) => (
      String(a.ship_code).localeCompare(String(b.ship_code))
      || (a.nights || 0) - (b.nights || 0)
    ))
    .slice(0, MAX_DURATION_COLUMNS)
    .map((col) => ({
      ...col,
      sail_codes: [...col.sail_codes],
      reference_sail_codes: [...col.reference_sail_codes],
      package_keys: [...col.package_keys],
      primary_sail_code: [...col.sail_codes][0] || null,
      primary_reference_sail_code: [...col.reference_sail_codes][0] || [...col.sail_codes][0] || null,
      title_full: `${col.nights}N · ${[...col.sail_codes].slice(0, 6).join(', ')}${col.sail_codes.size > 6 ? '…' : ''}`,
    }));
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
  marketIndex = null,
  reserveIndex = null,
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
  const marketEntries = grain === PRESSURE_GRAINS.MARKET
    ? [...(marketIndex?.byShipDate?.values?.() || [])].filter((entry) => (
      matchesShipFilter(entry.ship_code, shipFilter)
    ))
    : [];
  const dates = resolvePressureDateSpine({
    dateFrom: start,
    dateTo: end,
    cellDates: [
      ...scopedCells.map((c) => c.date),
      ...marketEntries.map((entry) => entry.date),
    ],
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
  } else if (grain === PRESSURE_GRAINS.PACKAGE) {
    // Segments by package_type / port→port — sail_code is secondary (blocked beds).
    const colMap = new Map();
    windows.forEach((win) => {
      if (!matchesShipFilter(win.ship_code, shipFilter)) return;
      // Prefer sellable package products (segments); masters rarely carry package_type.
      if (isVoyageIdentity(win) && !resolvePackageKey(win)) return;
      const packageKey = resolvePackageKey(win);
      if (!packageKey) return;
      if (!voyageOverlapsRange(win, start, end)) return;
      const id = `${win.ship_code}::${packageKey}`;
      if (!colMap.has(id)) {
        colMap.set(id, {
          id,
          kind: 'package',
          package_key: packageKey,
          label: formatPackageLabel(win),
          title_full: win.package_name || packageKey,
          ship_code: win.ship_code,
          ship_name: win.ship_name,
          port_from: win.port_from,
          port_to: win.port_to,
          package_type: win.package_type,
          nights: win.nights,
          date_from: win.date_from,
          date_to: win.date_to || win.date_from,
          sail_codes: new Set([win.sail_code]),
          reference_sail_codes: new Set([win.reference_sail_code].filter(Boolean)),
        });
      } else {
        const col = colMap.get(id);
        if (win.date_from && (!col.date_from || win.date_from < col.date_from)) {
          col.date_from = win.date_from;
        }
        if (win.date_to && (!col.date_to || win.date_to > col.date_to)) {
          col.date_to = win.date_to;
        }
        if (!col.title_full && win.package_name) col.title_full = win.package_name;
      }
      colMap.get(id).sail_codes.add(win.sail_code);
      if (win.reference_sail_code) {
        colMap.get(id).reference_sail_codes.add(win.reference_sail_code);
      }
    });
    const packageColumns = [...colMap.values()]
      .sort((a, b) => (
        String(a.ship_code).localeCompare(String(b.ship_code))
        || String(a.port_from || '').localeCompare(String(b.port_from || ''))
        || (a.nights || 0) - (b.nights || 0)
        || String(a.package_key).localeCompare(String(b.package_key))
      ))
      .slice(0, MAX_PACKAGE_COLUMNS)
      .map((col) => ({
        ...col,
        sail_codes: [...col.sail_codes],
        reference_sail_codes: [...col.reference_sail_codes],
        primary_sail_code: [...col.sail_codes][0] || null,
        primary_reference_sail_code: [...col.reference_sail_codes][0] || [...col.sail_codes][0] || null,
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
    packageColumns.forEach((col) => rememberDayShip(col.ship_code, col.ship_name));
    const dayColumns = [...dayShipMap.values()].sort((a, b) => (
      String(a.ship_name || a.ship_code).localeCompare(String(b.ship_name || b.ship_code))
    ));
    if (dayColumns.length > 1) {
      dayColumns.forEach((col) => {
        col.label = col.ship_code;
      });
    }
    columns = [...dayColumns, ...packageColumns];
  } else if (grain === PRESSURE_GRAINS.MARKET) {
    const singleShip = shipFilter && shipFilter !== SHIP_FILTER_ALL;
    if (singleShip) {
      const shipName = marketEntries.find((e) => e.ship_code === shipFilter)?.ship_name
        || scopedCells.find((c) => c.ship_code === shipFilter)?.ship_name
        || shipFilter;
      columns = [
        {
          id: `__promo__::${shipFilter}`,
          kind: 'market_promo',
          label: 'Promo',
          title_full: 'Published rate promotions',
          ship_code: shipFilter,
          ship_name: shipName,
        },
        {
          id: `__pricing__::${shipFilter}`,
          kind: 'market_pricing',
          label: 'Pricing',
          title_full: 'Competitor Pricing (stg.COMPETITOR)',
          ship_code: shipFilter,
          ship_name: shipName,
        },
        {
          id: `__bench__::${shipFilter}`,
          kind: 'market_benchmark',
          label: 'Benchmark',
          title_full: 'Competitor Benchmark (RateGain)',
          ship_code: shipFilter,
          ship_name: shipName,
        },
      ];
    } else {
      const colMap = new Map();
      marketEntries.forEach((entry) => {
        if (!colMap.has(entry.ship_code)) {
          colMap.set(entry.ship_code, {
            id: entry.ship_code,
            kind: 'market',
            label: entry.ship_name || entry.ship_code,
            ship_code: entry.ship_code,
            ship_name: entry.ship_name,
          });
        }
      });
      scopedCells.forEach((cell) => {
        if (!colMap.has(cell.ship_code)) {
          colMap.set(cell.ship_code, {
            id: cell.ship_code,
            kind: 'market',
            label: cell.ship_name || cell.ship_code,
            ship_code: cell.ship_code,
            ship_name: cell.ship_name,
          });
        }
      });
      columns = [...colMap.values()].sort((a, b) => (
        String(a.ship_name || a.ship_code).localeCompare(String(b.ship_name || b.ship_code))
      ));
    }
  } else if (grain === PRESSURE_GRAINS.IMPACT) {
    const singleShip = shipFilter && shipFilter !== SHIP_FILTER_ALL;
    const durationColumns = buildDurationColumnMap(windows, shipFilter, start, end);
    const shipCodes = new Set([
      ...scopedCells.map((c) => c.ship_code),
      ...durationColumns.map((c) => c.ship_code),
    ]);
    const fixed = [];
    [...shipCodes]
      .filter((code) => matchesShipFilter(code, shipFilter))
      .sort((a, b) => a.localeCompare(b))
      .forEach((shipCode) => {
        const shipName = scopedCells.find((c) => c.ship_code === shipCode)?.ship_name
          || durationColumns.find((c) => c.ship_code === shipCode)?.ship_name
          || shipCode;
        fixed.push({
          id: `__block__::${shipCode}`,
          kind: 'block',
          label: 'Block',
          title_full: 'Offsale / reserved cabins (capacity + ship_cabin_reserve)',
          ship_code: shipCode,
          ship_name: shipName,
        });
        fixed.push({
          id: `__day__::${shipCode}`,
          kind: 'day',
          label: singleShip ? 'Day' : shipCode,
          ship_code: shipCode,
          ship_name: shipName,
        });
        if (singleShip) {
          fixed.push({
            id: `__cabin__::${shipCode}`,
            kind: 'cabin_pressure',
            label: 'Cabin',
            title_full: 'Tightest cabin-category loading on this ship-day',
            ship_code: shipCode,
            ship_name: shipName,
          });
          fixed.push({
            id: `__impact_market__::${shipCode}`,
            kind: 'market',
            label: 'Market',
            title_full: 'Promo + competitor peers on departure days',
            ship_code: shipCode,
            ship_name: shipName,
          });
        }
      });
    columns = [...fixed, ...durationColumns];
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
  const marketCellIndex = marketIndex?.byShipDate || new Map();

  const buildMarketCell = (shipCode, date, columnId, lane = 'all') => {
    const market = marketCellIndex.get(shipDayKey(shipCode, date));
    if (!market) return null;
    if (lane === 'promo' && !market.has_promo) return null;
    if (lane === 'pricing' && !market.has_pricing) return null;
    if (lane === 'benchmark' && !market.has_benchmark) return null;
    return {
      ...market,
      column_id: columnId,
      grain: 'market',
      market_lane: lane,
      flag: PRESSURE_FLAGS.OK,
    };
  };

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
      } else if (col.kind === 'market') {
        row[col.id] = buildMarketCell(col.ship_code, date, col.id, 'all');
      } else if (col.kind === 'market_promo') {
        row[col.id] = buildMarketCell(col.ship_code, date, col.id, 'promo');
      } else if (col.kind === 'market_pricing') {
        row[col.id] = buildMarketCell(col.ship_code, date, col.id, 'pricing');
      } else if (col.kind === 'market_benchmark') {
        row[col.id] = buildMarketCell(col.ship_code, date, col.id, 'benchmark');
      } else if (col.kind === 'block') {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        if (!physical) {
          row[col.id] = null;
          return;
        }
        const reserve = reserveIndex?.byShipDate?.get?.(shipDayKey(col.ship_code, date));
        const blockedCabins = reserve?.blocked_cabins ?? toNumber(physical.offsale_cabins);
        row[col.id] = {
          ...physical,
          grain: 'block',
          blocked_cabins: blockedCabins,
          reserved_cabins: reserve?.offsale ?? 0,
          constrained_cabins: reserve?.constrained ?? 0,
          column_id: col.id,
          flag: blockedCabins > 0 ? PRESSURE_FLAGS.BLOCKING : PRESSURE_FLAGS.OK,
          reasons: blockedCabins > 0
            ? [`${blockedCabins} cabin${blockedCabins === 1 ? '' : 's'} offsale / reserved on this ship-day`]
            : ['No offsale / reserved cabins on this ship-day'],
        };
      } else if (col.kind === 'duration') {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        if (!physical) {
          row[col.id] = null;
          return;
        }
        const parts = (physical.by_sail || []).filter((p) => (
          toNumber(p.nights) === col.nights
          || (col.sail_codes || []).includes(p.sail_code)
        ));
        if (!parts.length) {
          row[col.id] = null;
          return;
        }
        const cell = buildDemandCellFromParts(physical, parts, {
          column_id: col.id,
          grain: 'duration',
          nights: col.nights,
          duration_nights: col.nights,
          is_long_duration: col.is_long_duration,
          sail_codes: col.sail_codes,
        });
        if (cell && cell.flag === PRESSURE_FLAGS.OK && physical.flag && physical.flag !== PRESSURE_FLAGS.OK) {
          cell.flag = physical.flag;
        }
        row[col.id] = cell;
      } else if (col.kind === 'cabin_pressure') {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        const summary = summarizeShipDayCabinPressure(physical, categoryDays, col.ship_code, date);
        row[col.id] = summary
          ? { ...(physical || {}), ...summary, column_id: col.id, ship_code: col.ship_code, date }
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
      } else if (col.kind === 'package') {
        const physical = cellIndex.get(shipDayKey(col.ship_code, date));
        if (!physical) {
          row[col.id] = null;
          return;
        }
        const parts = (physical.by_sail || []).filter((p) => (
          p.package_key === col.package_key
          || (col.sail_codes || []).includes(p.sail_code)
        ));
        if (!parts.length) {
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
          package_key: col.package_key,
          package_type: col.package_type,
          port_from: col.port_from,
          port_to: col.port_to,
          column_id: col.id,
          grain: 'package',
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
