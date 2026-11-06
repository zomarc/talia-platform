/**
 * Client-side rescore of MR path day series when Views → source nudge changes.
 */

import { scoreTaliaHold } from '../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';

/**
 * @param {object} series
 * @param {{ useSourceNudge?: boolean }} [options]
 */
export function rescorePathDays(series, { useSourceNudge = true } = {}) {
  if (!series) return null;
  const days = (series.days || []).map((day) => {
    const probability = day.probability != null ? day.probability : day.sourceMr;
    const rescored = scoreTaliaHold({
      status: day.status,
      requested: day.requestedGuests,
      // Already-scored days carry resolved as-of named (incl. BK inference).
      named: day.namedGuests,
      probability,
      useSourceNudge: useSourceNudge !== false,
    });
    return {
      ...day,
      sourceMr: rescored.source_mr,
      taliaMr: rescored.talia_mr,
      sourceExpectedGuests: rescored.sourceExpectedGuests,
      taliaExpectedGuests: rescored.taliaExpectedGuests,
      cancelled: rescored.cancelled,
    };
  });
  return {
    ...series,
    days,
  };
}

/**
 * Rescore portfolio path groups when source nudge is toggled.
 * Totals omit currently cancelled groups.
 * @param {object} path
 * @param {{ useSourceNudge?: boolean }} [options]
 */
export function rescorePathPayload(path, { useSourceNudge = true } = {}) {
  if (!path) return null;
  const mapRow = (row) => {
    const rates = scoreTaliaHold({
      status: row.status,
      requested: row.requestedGuests,
      named: row.namedGuests,
      probability: row.sourceMr,
      useSourceNudge: useSourceNudge !== false,
    });
    const cancelled = rates.cancelled || Boolean(row.cancelled);
    return {
      ...row,
      sourceMr: rates.source_mr,
      taliaMr: rates.talia_mr,
      sourceExpectedGuests: rates.sourceExpectedGuests,
      taliaExpectedGuests: rates.taliaExpectedGuests,
      cancelled,
    };
  };
  const groups = (path.groups || []).map(mapRow);
  const highlights = (path.highlights || []).map(mapRow).filter((row) => !row.cancelled && row.highlighted);
  const active = groups.filter((row) => !row.cancelled);
  const totals = active.reduce((sum, row) => {
    sum.source += row.sourceExpectedGuests;
    sum.talia += row.taliaExpectedGuests;
    return sum;
  }, { source: 0, talia: 0 });
  const monthMap = new Map();
  active.forEach((row) => {
    const month = row.sailDateFrom ? String(row.sailDateFrom).slice(0, 7) : null;
    if (!month) return;
    const bucket = monthMap.get(month) || {
      month,
      groups: 0,
      highlightedGroups: 0,
      requestedGuests: 0,
      namedGuests: 0,
      sourceExpectedGuests: 0,
      taliaExpectedGuests: 0,
      qualifyingGap: 0,
      highlighted: false,
    };
    bucket.groups += 1;
    bucket.requestedGuests += Math.round(Number(row.requestedGuests) || 0);
    bucket.namedGuests += Math.round(Number(row.finalNamedGuests ?? row.namedGuests) || 0);
    bucket.sourceExpectedGuests += row.sourceExpectedGuests;
    bucket.taliaExpectedGuests += row.taliaExpectedGuests;
    if (row.highlighted) {
      bucket.highlightedGroups += 1;
      bucket.qualifyingGap += row.sourceExpectedGuests - Math.round(Number(row.namedGuests) || 0);
    }
    monthMap.set(month, bucket);
  });
  const months = [...monthMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      ...bucket,
      highlighted: bucket.qualifyingGap >= 2000,
    }));
  return {
    ...path,
    groups,
    highlights,
    months: months.length ? months : path.months,
    sourceExpectedGuests: totals.source,
    taliaExpectedGuests: totals.talia,
    namedGuests: path.namedGuests,
    sailedGroupCount: active.length,
  };
}
