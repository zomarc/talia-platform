/**
 * Service for parsing and mapping booking target data (CSV) with booking/time data
 * Supports BOOKINGTARGET_*.csv company target files and mapping to GraphQL booking data
 *
 * CSV format (BOOKINGTARGET_*.csv) - columns are auto-detected (case-insensitive):
 *   sail_code, ship_code, week_label, weeks_until_sailing, target_bookings, target_guests
 * Example:
 *   sail_code,week_label,weeks_until_sailing,target_bookings,target_guests
 *   CJ07250901,W-12,12,150,300
 *   CJ07250901,W-10,10,220,440
 */

import Papa from 'papaparse';

/**
 * Normalize CSV column names for flexible matching
 * Handles: sail_code, sailcode, Sail_Code, sail-code, etc.
 */
const normalizeCol = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, '');

/**
 * Find column by possible names
 */
const findColumn = (row, ...candidates) => {
  const keys = Object.keys(row || {});
  const norm = (k) => normalizeCol(k);
  for (const c of candidates) {
    const nc = normalizeCol(c);
    const found = keys.find((k) => norm(k) === nc);
    if (found) return row[found];
  }
  return undefined;
};

/**
 * Map CSV row to normalized build curve point
 * Supports: sail_code, ship_code, week_label, weeks_until_sailing, target_bookings, target_guests
 */
const csvRowToCurve = (row) => {
  const weekLabel =
    findColumn(row, 'week_label', 'weeklabel', 'week', 'Week_Label') ||
    findColumn(row, 'weeks_until_sailing', 'weeksuntilsailing');
  const weeksUntil = parseInt(findColumn(row, 'weeks_until_sailing', 'weeksuntilsailing'), 10);
  const targetBookings = parseInt(findColumn(row, 'target_bookings', 'targetbookings', 'target'), 10);
  const targetGuests = parseInt(findColumn(row, 'target_guests', 'targetguests'), 10);

  return {
    weekLabel: weekLabel || (weeksUntil >= 0 ? `W-${weeksUntil}` : null),
    weeksUntilSailing: Number.isFinite(weeksUntil) ? weeksUntil : null,
    targetBookings: Number.isFinite(targetBookings) ? targetBookings : 0,
    targetGuests: Number.isFinite(targetGuests) ? targetGuests : 0,
    raw: row,
  };
};

/**
 * Parse CSV file content into target curves grouped by sail_code
 * @param {string} csvText - Raw CSV text
 * @returns {Object} { bySailCode: Map<string, Array>, sailCodes: string[], errors: string[] }
 */
export function parseTargetCSV(csvText) {
  const errors = [];
  const bySailCode = new Map();

  if (!csvText || !String(csvText).trim()) {
    return { bySailCode, sailCodes: [], errors: ['Empty CSV content'] };
  }

  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors?.length) {
    result.errors.forEach((e) => errors.push(e.message || String(e)));
  }

  const rows = result.data || [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sailCode =
      findColumn(row, 'sail_code', 'sailcode', 'Sail_Code', 'sail') ||
      findColumn(row, 'reference_sail_code', 'referencesailcode');
    if (!sailCode) {
      errors.push(`Row ${i + 2}: Missing sail_code`);
      continue;
    }

    const curve = csvRowToCurve(row);
    if (!curve.weekLabel && curve.weeksUntilSailing == null) {
      errors.push(`Row ${i + 2}: Missing week_label or weeks_until_sailing`);
      continue;
    }

    if (!bySailCode.has(sailCode)) {
      bySailCode.set(sailCode, []);
    }
    bySailCode.get(sailCode).push(curve);
  }

  // Sort curves by weeks until sailing descending (W-12, W-10, ..., Sail)
  const weekOrder = (c) => (c.weeksUntilSailing != null ? -c.weeksUntilSailing : 999);
  bySailCode.forEach((curves) => {
    curves.sort((a, b) => weekOrder(a) - weekOrder(b));
  });

  const sailCodes = Array.from(bySailCode.keys()).sort();
  return { bySailCode, sailCodes, errors };
}

/**
 * Map booking build curves to shared week labels for chart alignment
 * @param {Array} buildCurves - From bookingProfileWithCurves
 * @param {Array} targetCurves - From CSV or target profile
 * @returns {{ labels: string[], actualByLabel: Map, targetByLabel: Map }}
 */
export function alignCurvesToLabels(buildCurves, targetCurves) {
  const labelSet = new Set();

  (buildCurves || []).forEach((c) => labelSet.add(c.weekLabel));
  (targetCurves || []).forEach((c) => labelSet.add(c.weekLabel || `W-${c.weeksUntilSailing}`));

  const labels = Array.from(labelSet).sort((a, b) => {
    const numA = parseInt(String(a).replace(/\D/g, ''), 10);
    const numB = parseInt(String(b).replace(/\D/g, ''), 10);
    if (a === 'Sail') return 1;
    if (b === 'Sail') return -1;
    return (numB || 0) - (numA || 0);
  });

  const actualByLabel = new Map();
  (buildCurves || []).forEach((c) => {
    const lbl = c.weekLabel;
    actualByLabel.set(lbl, {
      bookings: c.bookings ?? 0,
      guests: c.guests ?? 0,
      percentageOfTarget: c.percentageOfTarget,
      actualVsTarget: c.actualVsTarget,
    });
  });

  const targetByLabel = new Map();
  (targetCurves || []).forEach((c) => {
    const lbl = c.weekLabel || `W-${c.weeksUntilSailing}`;
    targetByLabel.set(lbl, {
      targetBookings: c.targetBookings ?? c.bookings ?? 0,
      targetGuests: c.targetGuests ?? 0,
    });
  });

  return { labels, actualByLabel, targetByLabel };
}

/**
 * Build chart-ready datasets from aligned data
 * @param {Object} aligned - From alignCurvesToLabels
 * @param {string} metric - 'bookings' | 'guests' | 'pctTarget'
 */
export function buildChartData(aligned, metric = 'bookings') {
  const { labels, actualByLabel, targetByLabel } = aligned;
  const actualData = labels.map((lbl) => {
    const a = actualByLabel.get(lbl);
    if (!a) return null;
    if (metric === 'bookings') return a.bookings;
    if (metric === 'guests') return a.guests;
    if (metric === 'pctTarget') {
      if (a.percentageOfTarget != null) return a.percentageOfTarget;
      const t = targetByLabel.get(lbl);
      const targetVal = t?.targetBookings ?? t?.targetGuests ?? 0;
      if (targetVal > 0) return Math.round((a.bookings / targetVal) * 100);
      return null;
    }
    return a.bookings;
  });

  const targetData = labels.map((lbl) => {
    if (metric === 'pctTarget') return 100; // Target reference line at 100%
    const t = targetByLabel.get(lbl);
    if (!t) return null;
    if (metric === 'bookings') return t.targetBookings;
    if (metric === 'guests') return t.targetGuests;
    return t.targetBookings;
  });

  return {
    labels,
    actual: actualData,
    target: targetData,
  };
}

const bookingTargetChartService = {
  parseTargetCSV,
  alignCurvesToLabels,
  buildChartData,
  findColumn,
};

export default bookingTargetChartService;
