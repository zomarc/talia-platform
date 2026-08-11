/**
 * Departure-month range helpers for Seasonal Trading Pack filters.
 */

export const RANGE_PRESETS = {
  THIS_MONTH: 'this_month',
  NEXT_3: 'next_3',
  NEXT_6: 'next_6',
  FY_CORE: 'fy_core',
  CUSTOM: 'custom',
};

/** @returns {string} YYYY-MM for the given Date (local calendar month). */
export function currentDepMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Add `delta` calendar months to a YYYY-MM key. */
export function addDepMonths(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + Number(delta), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Resolve a range preset to concrete From/To months.
 * - this_month: current month only
 * - next_3: this month through +2 months (3 months inclusive)
 * - next_6: this month through +5 months
 * - fy_core: May → following March (Celestyal core season window)
 */
export function resolveRangePreset(preset, fromYm, toYm, today = new Date()) {
  const thisMonth = currentDepMonth(today);

  switch (preset) {
    case RANGE_PRESETS.THIS_MONTH:
      return { preset: RANGE_PRESETS.THIS_MONTH, from: thisMonth, to: thisMonth };
    case RANGE_PRESETS.NEXT_3:
      return {
        preset: RANGE_PRESETS.NEXT_3,
        from: thisMonth,
        to: addDepMonths(thisMonth, 2),
      };
    case RANGE_PRESETS.NEXT_6:
      return {
        preset: RANGE_PRESETS.NEXT_6,
        from: thisMonth,
        to: addDepMonths(thisMonth, 5),
      };
    case RANGE_PRESETS.FY_CORE: {
      // Core season: May of current FY start → March next year.
      // If before May, use previous May; else this May.
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const fyStartYear = month >= 5 ? year : year - 1;
      return {
        preset: RANGE_PRESETS.FY_CORE,
        from: `${fyStartYear}-05`,
        to: `${fyStartYear + 1}-03`,
      };
    }
    case RANGE_PRESETS.CUSTOM:
    default:
      return {
        preset: RANGE_PRESETS.CUSTOM,
        from: fromYm || thisMonth,
        to: toYm || addDepMonths(fromYm || thisMonth, 2),
      };
  }
}

/** Build selectable YYYY-MM options spanning a few years around today. */
export function buildMonthOptions(today = new Date()) {
  const start = addDepMonths(currentDepMonth(today), -18);
  const end = addDepMonths(currentDepMonth(today), 24);
  const out = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 60) {
    out.push(cur);
    cur = addDepMonths(cur, 1);
    guard += 1;
  }
  return out;
}

export function detectRangePreset(fromYm, toYm, today = new Date()) {
  const candidates = [
    RANGE_PRESETS.THIS_MONTH,
    RANGE_PRESETS.NEXT_3,
    RANGE_PRESETS.NEXT_6,
    RANGE_PRESETS.FY_CORE,
  ];
  for (const preset of candidates) {
    const resolved = resolveRangePreset(preset, fromYm, toYm, today);
    if (resolved.from === fromYm && resolved.to === toYm) return preset;
  }
  return RANGE_PRESETS.CUSTOM;
}
