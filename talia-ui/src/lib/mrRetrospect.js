/**
 * MR Retrospect — replay Talia vs source expectation at days-before-departure,
 * compared with the final named outcome.
 *
 * As-of state at DTD N is the last header change day on or before (sailDate − N).
 * Named guests on that hold are as-of only (0 when the header version has none).
 * Final named is attached as outcomeNamed for gap / chart comparison only.
 */

export const DEFAULT_DTD_STEPS = [120, 90, 60, 45, 30, 21, 14, 7, 3, 0];

const MS_PER_DAY = 86_400_000;

const dateKey = (value) => {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const utcDay = (value) => {
  const key = dateKey(value);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole calendar days from `fromDate` to `toDate` (to − from). */
export function daysBetween(fromDate, toDate) {
  const from = utcDay(fromDate);
  const to = utcDay(toDate);
  if (from == null || to == null) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

export function addDays(dateValue, deltaDays) {
  const base = utcDay(dateValue);
  if (base == null || !Number.isFinite(deltaDays)) return '';
  const next = new Date(base + deltaDays * MS_PER_DAY);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Days before departure for a change on `changedDate`. */
export function dtdForChangeDay(changedDate, sailDate) {
  return daysBetween(changedDate, sailDate);
}

/**
 * Last path day whose change date is on or before (sailDate − dtd).
 * Returns null when no history exists before that checkpoint.
 */
export function asOfAtDtd(days, sailDate, dtd) {
  const sail = dateKey(sailDate);
  const step = Number(dtd);
  if (!sail || !Number.isFinite(step) || step < 0) return null;
  const asOfDate = addDays(sail, -step);
  if (!asOfDate) return null;
  const list = [...(days || [])]
    .filter((day) => dateKey(day?.changedDate))
    .sort((a, b) => dateKey(a.changedDate).localeCompare(dateKey(b.changedDate)));
  let match = null;
  for (const day of list) {
    const changed = dateKey(day.changedDate);
    if (changed <= asOfDate) match = day;
    else break;
  }
  if (!match) return null;
  return {
    dtd: step,
    asOfDate,
    holdDate: dateKey(match.changedDate),
    holdDtd: dtdForChangeDay(match.changedDate, sail),
    status: match.status,
    requestedGuests: Math.round(Number(match.requestedGuests) || 0),
    namedAtHold: Math.round(Number(match.namedGuests) || 0),
    sourceMr: match.sourceMr ?? null,
    taliaMr: match.taliaMr ?? null,
    sourceExpectedGuests: Math.round(Number(match.sourceExpectedGuests) || 0),
    taliaExpectedGuests: Math.round(Number(match.taliaExpectedGuests) || 0),
    manual: Boolean(match.manual),
  };
}

export function buildDtdStepsFromDays(days, sailDate, presets = DEFAULT_DTD_STEPS) {
  const sail = dateKey(sailDate);
  const holdDtds = (days || [])
    .map((day) => dtdForChangeDay(day?.changedDate, sail))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const maxHold = holdDtds.length ? Math.max(...holdDtds) : 0;
  const preset = (presets || []).filter((n) => Number.isFinite(n) && n >= 0 && n <= Math.max(maxHold, 0));
  const merged = new Set([0, ...preset, ...holdDtds.filter((n) => n <= 180)]);
  return [...merged].sort((a, b) => b - a);
}

/**
 * Chart markers for a single group's header history.
 * - source: days where source MR or expected guests changed vs the prior hold
 * - named: first day named guests appear (only when names are on the history)
 */
export function buildRetrospectAnnotations(series) {
  const sail = dateKey(series?.sailDateFrom);
  const days = [...(series?.days || [])]
    .filter((day) => dateKey(day?.changedDate))
    .sort((a, b) => dateKey(a.changedDate).localeCompare(dateKey(b.changedDate)));
  if (!sail || !days.length) return [];

  const annotations = [];
  let prevSourceMr = null;
  let prevSourceExpected = null;
  let namedMarked = false;

  days.forEach((day) => {
    const dtd = dtdForChangeDay(day.changedDate, sail);
    if (!Number.isFinite(dtd) || dtd < 0) return;

    const sourceMr = day.sourceMr == null ? null : Number(day.sourceMr);
    const sourceExpected = Math.round(Number(day.sourceExpectedGuests) || 0);
    const sourceChanged = prevSourceMr != null && (
      (sourceMr != null && Math.abs(sourceMr - prevSourceMr) > 1e-9)
      || sourceExpected !== prevSourceExpected
    );
    if (sourceChanged) {
      const fromPct = prevSourceMr == null ? null : Math.round(prevSourceMr * 100);
      const toPct = sourceMr == null ? null : Math.round(sourceMr * 100);
      const label = fromPct != null && toPct != null && fromPct !== toPct
        ? `Source ${fromPct}→${toPct}%`
        : `Source hold · ${sourceExpected} exp`;
      const changed = dateKey(day.changedDate);
      annotations.push({
        dtd,
        kind: 'source',
        changedDate: changed,
        label,
        tip: [
          label,
          `${dtd} days before departure`,
          changed ? `Hold date ${changed}` : null,
          `Expected guests ${sourceExpected}`,
          toPct != null ? `Source MR ${toPct}%` : null,
        ].filter(Boolean).join('\n'),
      });
    }
    if (sourceMr != null) prevSourceMr = sourceMr;
    prevSourceExpected = sourceExpected;

    if (namedMarked || !series?.namesFromHistory) return;
    const named = Number(day.namedGuests);
    if (!Number.isFinite(named) || named <= 0) return;
    namedMarked = true;
    const namedCount = Math.round(named);
    const changed = dateKey(day.changedDate);
    annotations.push({
      dtd,
      kind: 'named',
      changedDate: changed,
      label: `Named ${namedCount}`,
      tip: [
        `Named guests ${namedCount}`,
        `${dtd} days before departure`,
        changed ? `First on header ${changed}` : null,
      ].filter(Boolean).join('\n'),
    });
  });

  return annotations;
}

/**
 * Build a DTD series for one group's path-day payload.
 * `outcomeNamed` is the final named guest count for the comparison.
 */
export function buildDtdSeries(series, {
  steps = null,
  presets = DEFAULT_DTD_STEPS,
} = {}) {
  const sailDate = dateKey(series?.sailDateFrom);
  const days = series?.days || [];
  const outcomeNamed = Math.round(Number(series?.namedGuests) || 0);
  const dtdSteps = steps || buildDtdStepsFromDays(days, sailDate, presets);
  const checkpoints = dtdSteps
    .map((dtd) => asOfAtDtd(days, sailDate, dtd))
    .filter(Boolean)
    .map((row) => ({
      ...row,
      outcomeNamed,
      taliaGap: row.taliaExpectedGuests - outcomeNamed,
      sourceGap: row.sourceExpectedGuests - outcomeNamed,
    }));
  return {
    groupId: series?.groupId == null ? null : String(series.groupId),
    sailDateFrom: sailDate || null,
    namesFromHistory: Boolean(series?.namesFromHistory),
    outcomeNamed,
    assumptions: series?.assumptions || [],
    steps: checkpoints,
  };
}

/** Sum several group DTD series at shared checkpoints (sailing roll-up). */
export function aggregateDtdSeries(seriesList, presets = DEFAULT_DTD_STEPS) {
  const list = (seriesList || []).filter(Boolean);
  if (!list.length) {
    return {
      groupId: null,
      sailDateFrom: null,
      namesFromHistory: false,
      outcomeNamed: 0,
      assumptions: [],
      steps: [],
      groupCount: 0,
    };
  }

  // One shared DTD axis (presets + every group's hold days). Each group is then
  // evaluated at every tick via asOfAtDtd — otherwise a hold unique to one group
  // would drop the other groups from that point and the chart spikes.
  const stepSet = new Set([0]);
  (presets || []).forEach((dtd) => {
    if (Number.isFinite(dtd) && dtd >= 0) stepSet.add(dtd);
  });
  list.forEach((series) => {
    buildDtdStepsFromDays(series?.days || [], series?.sailDateFrom, presets)
      .forEach((dtd) => stepSet.add(dtd));
  });
  const dtds = [...stepSet].sort((a, b) => b - a);
  const built = list.map((series) => buildDtdSeries(series, { steps: dtds, presets }));

  const steps = dtds.map((dtd) => {
    const hits = built
      .map((row) => row.steps.find((step) => step.dtd === dtd))
      .filter(Boolean);
    if (!hits.length) return null;
    const sourceExpectedGuests = hits.reduce((sum, row) => sum + row.sourceExpectedGuests, 0);
    const taliaExpectedGuests = hits.reduce((sum, row) => sum + row.taliaExpectedGuests, 0);
    const outcomeNamed = hits.reduce((sum, row) => sum + row.outcomeNamed, 0);
    const requestedGuests = hits.reduce((sum, row) => sum + row.requestedGuests, 0);
    return {
      dtd,
      asOfDate: hits[0].asOfDate,
      holdDate: null,
      holdDtd: null,
      status: null,
      requestedGuests,
      namedAtHold: hits.reduce((sum, row) => sum + row.namedAtHold, 0),
      sourceMr: requestedGuests ? sourceExpectedGuests / requestedGuests : null,
      taliaMr: requestedGuests ? taliaExpectedGuests / requestedGuests : null,
      sourceExpectedGuests,
      taliaExpectedGuests,
      manual: hits.some((row) => row.manual),
      outcomeNamed,
      taliaGap: taliaExpectedGuests - outcomeNamed,
      sourceGap: sourceExpectedGuests - outcomeNamed,
      groupCount: hits.length,
    };
  }).filter(Boolean);

  return {
    groupId: null,
    sailDateFrom: built[0].sailDateFrom,
    namesFromHistory: built.some((row) => row.namesFromHistory),
    outcomeNamed: built.reduce((sum, row) => sum + row.outcomeNamed, 0),
    assumptions: built[0].assumptions || [],
    steps,
    groupCount: built.length,
  };
}

export function pickStep(series, dtd) {
  const steps = series?.steps || [];
  if (!steps.length) return null;
  const exact = steps.find((step) => step.dtd === Number(dtd));
  if (exact) return exact;
  const sorted = [...steps].sort((a, b) => a.dtd - b.dtd);
  let best = sorted[0];
  for (const step of sorted) {
    if (step.dtd <= Number(dtd)) best = step;
  }
  return best;
}
