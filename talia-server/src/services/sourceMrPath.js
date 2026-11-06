/**
 * Historic MR path.
 * Source expectation is the rate held on the last change before departure.
 * Talia MR uses the same steps as Groups Explorer.
 * Named guests are as-of: header count when present; BK with missing named uses
 * requested as booked evidence; QT/OF missing named stays 0. Never finalNamed.
 */

import { dateKey, isCancelledStatus } from './sourceMrReview.js';
import { scoreTaliaHold } from '../../../talia-ui/src/components/focus-panels/GroupsExplorer/groupsMaterialisation.js';

const OFFER = new Set(['QT', 'OF']);

export const HIGHLIGHT_MIN_GUESTS = 10;
export const HIGHLIGHT_MIN_RATE = 0.15;
export const MONTH_HIGHLIGHT_GUESTS = 2000;
export const HIGHLIGHT_LIMIT = 25;

const STANDING_ASSUMPTIONS = [
  'A group has sailed when its sail date is on or before the last change in the extract. Later sailings are not an outcome yet.',
  'The source rate is the rate on the last change on or before departure. Several header rows on the same day count as one day.',
  'Expected guests are requested guests times the rate. GROUP_ExpectedAddition is not a guest count and is not used.',
  'A cancelled hold contributes 0 forward expected guests. Groups whose current status is cancelled are excluded from sailing and window totals, but remain visible on a single-group path.',
  'Source rate nudge is on by default (15% of the gap when the gap is at least 5 points). Turn off Views → Use source rate nudge to ignore source.',
  'A group is highlighted when that hold was a quote or an open offer, the rate was kept on more than one day, the source expectation is at least 10 guests above the names, and the source rate is at least 15 points above Talia MR.',
];

export const PLANNING_ASSUMPTION = 'A planning value is source expected guests minus named guests, times a euro amount you type. It is not a fare from the book. Leave it blank and the report stays in guests.';

const MISSING_NAMED_ASSUMPTION = 'When a header version has no named count: booked (BK) holds use the requested size as booked evidence; quotes and open offers stay at 0 named. Talia MR does not use the final named outcome as prior knowledge — that count is only for judging the path.';

const ASOF_ASSUMPTION = 'Named guests are the count stored on the header version used for that day. Talia MR is the rate the method would have produced from the names known then.';

const numberOrNull = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const round = (value) => Math.round(Number(value) || 0);

const statusCode = (value) => String(value || '').trim().toUpperCase() || 'UNKNOWN';

const shipCode = (value) => {
  const text = String(value || '').trim().toUpperCase();
  return text || null;
};

export const pathAssumptions = (namesFromHistory) => ([
  namesFromHistory ? ASOF_ASSUMPTION : MISSING_NAMED_ASSUMPTION,
  ...STANDING_ASSUMPTIONS,
]);

const normaliseHold = (row = {}) => ({
  groupId: String(row.group_id ?? ''),
  shipCode: shipCode(row.ship_code),
  sailDateFrom: dateKey(row.sail_date_from),
  sailDateTo: dateKey(row.sail_date_to),
  finalNamed: round(row.final_named),
  currentStatus: statusCode(row.current_status || row.hold_status),
  changeDays: round(row.change_days),
  holdDate: dateKey(row.hold_date),
  status: statusCode(row.hold_status),
  requested: round(row.hold_requested),
  probability: numberOrNull(row.hold_probability),
  manual: row.hold_manual === true,
  holdNamed: numberOrNull(row.hold_named) == null ? null : round(row.hold_named),
});

const wantedShip = (shipCodeArg) => {
  const text = shipCode(shipCodeArg);
  if (!text || text === 'ALL' || text === '*') return null;
  return text;
};

const inWindow = (sailDate, dateFrom, dateTo) => {
  if (!sailDate) return !dateFrom && !dateTo;
  if (dateFrom && sailDate < dateFrom) return false;
  if (dateTo && sailDate > dateTo) return false;
  return true;
};

/**
 * As-of named via scoreTaliaHold / resolveAsOfNamed — never finalNamed.
 * Cancelled → expected 0.
 * @param {object} hold
 * @param {{ useSourceNudge?: boolean }} [options]
 */
const scoreHold = (hold, options = {}) => {
  const rates = scoreTaliaHold({
    status: hold.status,
    requested: hold.requested,
    named: hold.holdNamed,
    probability: hold.probability,
    useSourceNudge: options.useSourceNudge !== false,
  });
  const named = rates.namedGuests ?? 0;
  const sourceExpected = rates.sourceExpectedGuests;
  const taliaExpected = rates.taliaExpectedGuests;
  const rateGap = (rates.source_mr ?? 0) - (rates.talia_mr || 0);
  const highlighted = !rates.cancelled
    && OFFER.has(hold.status)
    && hold.changeDays > 1
    && (sourceExpected - named) >= HIGHLIGHT_MIN_GUESTS
    && sourceExpected > taliaExpected
    && rateGap >= HIGHLIGHT_MIN_RATE;
  return {
    groupId: hold.groupId,
    shipCode: hold.shipCode,
    sailDateFrom: hold.sailDateFrom,
    sailDateTo: hold.sailDateTo,
    status: hold.status,
    currentStatus: hold.currentStatus,
    changeDays: hold.changeDays,
    holdDate: hold.holdDate,
    requestedGuests: hold.requested,
    namedGuests: named,
    finalNamedGuests: hold.finalNamed,
    sourceMr: rates.source_mr,
    taliaMr: rates.talia_mr,
    sourceExpectedGuests: sourceExpected,
    taliaExpectedGuests: taliaExpected,
    manual: hold.manual,
    cancelled: rates.cancelled || isCancelledStatus(hold.currentStatus),
    highlighted,
  };
};

const emptyMonth = (month) => ({
  month,
  groups: 0,
  highlightedGroups: 0,
  requested: 0,
  named: 0,
  sourceExpected: 0,
  taliaExpected: 0,
  qualifyingGap: 0,
});

/**
 * @param {{
 *   holds?: object[],
 *   shipCode?: string|null,
 *   dateFrom?: string|null,
 *   dateTo?: string|null,
 *   useSourceNudge?: boolean,
 * }} input
 */
export const buildSourceMrPath = ({
  holds = [],
  shipCode: shipCodeArg = null,
  dateFrom = null,
  dateTo = null,
  useSourceNudge = true,
} = {}) => {
  const all = (holds || []).map(normaliseHold).filter((row) => row.groupId);
  const namesFromHistory = all.some((row) => row.holdNamed != null);
  const from = dateKey(dateFrom);
  const to = dateKey(dateTo);
  const ship = wantedShip(shipCodeArg);
  const ships = [...new Set(all.map((row) => row.shipCode).filter(Boolean))].sort();
  const sailDates = all.map((row) => row.sailDateFrom).filter(Boolean).sort();
  const filtered = all.filter((row) => (
    (!ship || row.shipCode === ship) && inWindow(row.sailDateFrom, from, to)
  ));
  const scoredAll = filtered.map((row) => scoreHold(row, { useSourceNudge }));
  // Forward aggregates omit currently cancelled groups; they stay in `groups` for visibility.
  const scored = scoredAll.filter((row) => !isCancelledStatus(row.currentStatus));
  const cancelledVisible = scoredAll.filter((row) => isCancelledStatus(row.currentStatus));
  const months = new Map();
  scored.forEach((row) => {
    const month = row.sailDateFrom ? row.sailDateFrom.slice(0, 7) : null;
    if (!month) return;
    const bucket = months.get(month) || emptyMonth(month);
    bucket.groups += 1;
    bucket.requested += row.requestedGuests;
    bucket.named += row.finalNamedGuests;
    bucket.sourceExpected += row.sourceExpectedGuests;
    bucket.taliaExpected += row.taliaExpectedGuests;
    if (row.highlighted) {
      bucket.highlightedGroups += 1;
      bucket.qualifyingGap += row.sourceExpectedGuests - row.namedGuests;
    }
    months.set(month, bucket);
  });

  const monthRows = [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      month: bucket.month,
      groups: bucket.groups,
      highlightedGroups: bucket.highlightedGroups,
      requestedGuests: round(bucket.requested),
      namedGuests: round(bucket.named),
      sourceExpectedGuests: round(bucket.sourceExpected),
      taliaExpectedGuests: round(bucket.taliaExpected),
      qualifyingGap: round(bucket.qualifyingGap),
      highlighted: bucket.qualifyingGap >= MONTH_HIGHLIGHT_GUESTS,
    }));

  const byGap = (a, b) => (b.sourceExpectedGuests - b.namedGuests) - (a.sourceExpectedGuests - a.namedGuests);
  const highlights = scored
    .filter((row) => row.highlighted)
    .sort(byGap)
    .slice(0, HIGHLIGHT_LIMIT);
  const groups = [...scoredAll]
    .sort(byGap)
    .slice(0, 500);

  const totals = scored.reduce((sum, row) => {
    sum.source += row.sourceExpectedGuests;
    sum.talia += row.taliaExpectedGuests;
    sum.named += row.finalNamedGuests;
    return sum;
  }, { source: 0, talia: 0, named: 0 });

  return {
    namesFromHistory,
    assumptions: pathAssumptions(namesFromHistory),
    sailedGroupCount: scored.length,
    cancelledGroupCount: cancelledVisible.length,
    unfilteredSailedCount: all.length,
    ships,
    sailDateMin: sailDates[0] || null,
    sailDateMax: sailDates[sailDates.length - 1] || null,
    sourceExpectedGuests: totals.source,
    taliaExpectedGuests: totals.talia,
    namedGuests: totals.named,
    months: monthRows,
    highlights,
    groups,
  };
};

const normaliseDay = (row = {}) => ({
  changedDate: dateKey(row.changed_on || row.changedDate),
  status: statusCode(row.group_status || row.status),
  requested: round(row.n_of_guests ?? row.requestedGuests),
  probability: numberOrNull(row.probability),
  manual: row.is_prob_manual === true || row.manual === true,
  named: numberOrNull(row.named_guests ?? row.namedGuests),
});

/**
 * One group's change days. Days after departure are left out of the hold path.
 * @param {{
 *   groupId?: string|number|null,
 *   sailDate?: string|null,
 *   finalNamed?: number,
 *   days?: object[],
 *   useSourceNudge?: boolean,
 * }} input
 */
export const buildSourceMrPathDays = ({
  groupId = null,
  sailDate = null,
  finalNamed = 0,
  days = [],
  useSourceNudge = true,
} = {}) => {
  const sail = dateKey(sailDate);
  const collapsed = new Map();
  (days || []).forEach((row) => {
    const day = normaliseDay(row);
    if (!day.changedDate) return;
    if (sail && day.changedDate > sail) return;
    collapsed.set(day.changedDate, day);
  });
  const list = [...collapsed.values()].sort((a, b) => a.changedDate.localeCompare(b.changedDate));
  const namesFromHistory = list.some((day) => day.named != null);
  const ending = round(finalNamed);
  const scored = list.map((day) => {
    const rates = scoreTaliaHold({
      status: day.status,
      requested: day.requested,
      named: day.named,
      probability: day.probability,
      useSourceNudge: useSourceNudge !== false,
    });
    return {
      changedDate: day.changedDate,
      status: day.status,
      requestedGuests: day.requested,
      namedGuests: rates.namedGuests ?? 0,
      sourceMr: rates.source_mr,
      taliaMr: rates.talia_mr,
      sourceExpectedGuests: rates.sourceExpectedGuests,
      taliaExpectedGuests: rates.taliaExpectedGuests,
      manual: day.manual,
      cancelled: rates.cancelled,
    };
  });
  return {
    groupId: groupId == null ? null : String(groupId),
    namesFromHistory,
    sailDateFrom: sail,
    namedGuests: ending,
    days: scored,
    assumptions: pathAssumptions(namesFromHistory),
  };
};

export { rescorePathDays, rescorePathPayload } from '../../../talia-ui/src/lib/mrPathRescore.js';
