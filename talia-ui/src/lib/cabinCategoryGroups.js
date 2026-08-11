/**
 * Cabin category groupings from lkp.CABIN_CTG (cabin_ctg).
 * Real codes (IA, XB, …) → GENERIC_CATEGORY (INSIDE | OUTSIDE | DELUXE).
 */

export const CABIN_CATEGORY_MODE = {
  REAL: 'real',
  GROUP: 'group',
};

export const DEFAULT_CABIN_CATEGORY_MODE = CABIN_CATEGORY_MODE.REAL;

export const CABIN_CATEGORY_MODE_OPTIONS = [
  { key: CABIN_CATEGORY_MODE.REAL, label: 'Real' },
  { key: CABIN_CATEGORY_MODE.GROUP, label: 'Group' },
];

export const normalizeCabinCategoryMode = (value) => (
  String(value || '').trim() === CABIN_CATEGORY_MODE.GROUP
    ? CABIN_CATEGORY_MODE.GROUP
    : CABIN_CATEGORY_MODE.REAL
);

/**
 * Index active cabin_ctg rows: cabin_code → generic_category.
 */
export const indexCabinCategoryGroups = (rows = []) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const code = String(row?.cabin_code || '').trim().toUpperCase();
    if (!code) return;
    if (row?.active_record_flag != null && Number(row.active_record_flag) !== 1) return;
    if (map.has(code)) return;
    const group = String(row?.generic_category || '').trim() || null;
    map.set(code, {
      cabin_code: code,
      generic_category: group,
      effective_from: row?.effective_from || null,
      effective_to: row?.effective_to || null,
    });
  });
  return map;
};

export const resolveGenericCabinCategory = (cabinCode, cabinCtgIndex) => {
  const code = String(cabinCode || '').trim().toUpperCase();
  if (!code) return null;
  return cabinCtgIndex?.get?.(code)?.generic_category || null;
};

/**
 * Label for charts/tables: real cabin code or generic group depending on mode.
 */
export const resolveCabinCategoryLabel = (cabinCode, cabinCtgIndex, mode = DEFAULT_CABIN_CATEGORY_MODE) => {
  const code = String(cabinCode || '').trim();
  if (!code) return 'Uncategorized';
  const normalized = normalizeCabinCategoryMode(mode);
  if (normalized === CABIN_CATEGORY_MODE.REAL) return code.toUpperCase();
  return resolveGenericCabinCategory(code, cabinCtgIndex) || code.toUpperCase();
};

export default {
  CABIN_CATEGORY_MODE,
  DEFAULT_CABIN_CATEGORY_MODE,
  CABIN_CATEGORY_MODE_OPTIONS,
  normalizeCabinCategoryMode,
  indexCabinCategoryGroups,
  resolveGenericCabinCategory,
  resolveCabinCategoryLabel,
};
