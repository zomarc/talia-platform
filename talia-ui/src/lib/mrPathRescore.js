/**
 * Client-side rescore of MR path day series when Views → model / params change.
 */

import { scoreWithModel, DEFAULT_MR_MODEL_ID, mergeMr01Params } from './mrModels/index.js';

/**
 * Resolve scoring options from Views (modelId + MR01 params, including source nudge).
 * @param {{
 *   modelId?: string,
 *   useSourceNudge?: boolean,
 *   mr01Params?: object,
 *   mr01Preset?: string,
 * }} [options]
 */
export function resolveScoreOptions({
  modelId = DEFAULT_MR_MODEL_ID,
  useSourceNudge,
  mr01Params,
  mr01Preset,
} = {}) {
  const id = String(modelId || DEFAULT_MR_MODEL_ID).trim().toUpperCase();
  const params = mergeMr01Params({
    ...(mr01Params || {}),
    ...(useSourceNudge === false ? { useSourceNudge: false } : {}),
    ...(useSourceNudge === true ? { useSourceNudge: true } : {}),
  });
  return { modelId: id, params, mr01Preset: mr01Preset || 'default' };
}

/**
 * @param {object} series
 * @param {{ modelId?: string, useSourceNudge?: boolean, mr01Params?: object }} [options]
 */
export function rescorePathDays(series, options = {}) {
  if (!series) return null;
  const { modelId, params } = resolveScoreOptions(options);
  const days = (series.days || []).map((day) => {
    const probability = day.probability != null ? day.probability : day.sourceMr;
    const rescored = scoreWithModel(modelId, {
      status: day.status,
      requested: day.requestedGuests,
      // Already-scored days carry resolved as-of named (incl. BK inference).
      named: day.namedGuests,
      probability,
    }, params);
    return {
      ...day,
      modelId,
      sourceMr: rescored.source_mr,
      taliaMr: rescored.rate ?? rescored.talia_mr,
      sourceExpectedGuests: rescored.sourceExpectedGuests,
      taliaExpectedGuests: rescored.expectedGuests ?? rescored.taliaExpectedGuests,
      cancelled: rescored.cancelled,
    };
  });
  return {
    ...series,
    modelId,
    days,
  };
}

/**
 * Score one series with multiple models (Retrospect compare).
 * @param {object} series
 * @param {string[]} modelIds
 * @param {{ useSourceNudge?: boolean, mr01Params?: object }} [options]
 */
export function rescorePathDaysMulti(series, modelIds = [], options = {}) {
  if (!series) return null;
  const ids = (modelIds || []).length ? modelIds : [DEFAULT_MR_MODEL_ID];
  const byModel = {};
  for (const id of ids) {
    byModel[id] = rescorePathDays(series, { ...options, modelId: id });
  }
  return byModel;
}

/**
 * Rescore portfolio path groups when model / params change.
 * Totals omit currently cancelled groups.
 * @param {object} path
 * @param {{ modelId?: string, useSourceNudge?: boolean, mr01Params?: object }} [options]
 */
export function rescorePathPayload(path, options = {}) {
  if (!path) return null;
  const { modelId, params } = resolveScoreOptions(options);
  const mapRow = (row) => {
    const rates = scoreWithModel(modelId, {
      status: row.status,
      requested: row.requestedGuests,
      named: row.namedGuests,
      probability: row.sourceMr,
    }, params);
    const cancelled = rates.cancelled || Boolean(row.cancelled);
    const expected = rates.expectedGuests ?? rates.taliaExpectedGuests;
    return {
      ...row,
      modelId,
      sourceMr: rates.source_mr,
      taliaMr: rates.rate ?? rates.talia_mr,
      sourceExpectedGuests: rates.sourceExpectedGuests,
      taliaExpectedGuests: expected,
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
    modelId,
    groups,
    highlights,
    months: months.length ? months : path.months,
    sourceExpectedGuests: totals.source,
    taliaExpectedGuests: totals.talia,
    namedGuests: path.namedGuests,
    sailedGroupCount: active.length,
  };
}
