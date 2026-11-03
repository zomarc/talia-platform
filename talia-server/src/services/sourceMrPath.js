/**
 * Historic MR path.
 * Source expectation is the rate held on the last change before departure.
 * Talia MR uses the same steps as Groups Explorer.
 * Named guests are the final group count until a header version carries its own.
 */

import { materialiseExtractGroup, dateKey } from './sourceMrReview.js';

const OFFER = new Set(['QT', 'OF']);

export const HIGHLIGHT_MIN_GUESTS = 10;
export const HIGHLIGHT_MIN_RATE = 0.15;
export const MONTH_HIGHLIGHT_GUESTS = 2000;
export const HIGHLIGHT_LIMIT = 25;

const STANDING_ASSUMPTIONS = [
  'A group has sailed when its sail date is on or before the last change in the extract. Later sailings are not an outcome yet.',
  'The source rate is the rate on the last change on or before departure. Several header rows on the same day count as one day.',
  'Expected guests are requested guests times the rate. GROUP_ExpectedAddition is not a guest count and is not used.',
  'A group is highlighted when that hold was a quote or an open offer, the rate was kept on more than one day, the source expectation is at least 10 guests above the names, and the source rate is at least 15 points above Talia MR.',
];

export const PLANNING_ASSUMPTION = 'A planning value is source expected guests minus named guests, times a euro amount you type. It is not a fare from the book. Leave it blank and the report stays in guests.';

const HINDSIGHT_ASSUMPTION = 'Named guests are the final count on the group, applied to the request held before departure. The header history does not yet record how many guests were named on each earlier day, so Talia MR here is hindsight. A group that finished with names will look stronger than it did while it was still an empty quote.';

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
  namesFromHistory ? ASOF_ASSUMPTION : HINDSIGHT_ASSUMPTION,
  ...STANDING_ASSUMPTIONS,
]);

const normaliseHold = (row = {}) => ({
  groupId: String(row.group_id ?? ''),
  shipCode: shipCode(row.ship_code),
  sailDateFrom: dateKey(row.sail_date_from),
  sailDateTo: dateKey(row.sail_date_to),
  finalNamed: round(row.final_named),
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

const scoreHold = (hold, namesFromHistory) => {
  const named = namesFromHistory && hold.holdNamed != null ? hold.holdNamed : hold.finalNamed;
  const rates = materialiseExtractGroup({
    group_status: hold.status,
    n_of_guests: hold.requested,
    n_of_delegate_guests: named,
    probability: hold.probability,
  });
  const sourceExpected = round(hold.requested * (rates.source_mr || 0));
  const taliaExpected = round(hold.requested * (rates.talia_mr || 0));
  const rateGap = (rates.source_mr ?? 0) - (rates.talia_mr || 0);
  const highlighted = OFFER.has(hold.status)
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
    changeDays: hold.changeDays,
    holdDate: hold.holdDate,
    requestedGuests: hold.requested,
    namedGuests: named,
    sourceMr: rates.source_mr,
    taliaMr: rates.talia_mr,
    sourceExpectedGuests: sourceExpected,
    taliaExpectedGuests: taliaExpected,
    manual: hold.manual,
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
 * @param {{ holds?: object[], shipCode?: string|null, dateFrom?: string|null, dateTo?: string|null }} input
 */
export const buildSourceMrPath = ({
  holds = [],
  shipCode: shipCodeArg = null,
  dateFrom = null,
  dateTo = null,
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
  const scored = filtered.map((row) => scoreHold(row, namesFromHistory));
  const months = new Map();
  scored.forEach((row) => {
    const month = row.sailDateFrom ? row.sailDateFrom.slice(0, 7) : null;
    if (!month) return;
    const bucket = months.get(month) || emptyMonth(month);
    bucket.groups += 1;
    bucket.requested += row.requestedGuests;
    bucket.named += row.namedGuests;
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

  const highlights = scored
    .filter((row) => row.highlighted)
    .sort((a, b) => (b.sourceExpectedGuests - b.namedGuests) - (a.sourceExpectedGuests - a.namedGuests))
    .slice(0, HIGHLIGHT_LIMIT);

  const totals = scored.reduce((sum, row) => {
    sum.source += row.sourceExpectedGuests;
    sum.talia += row.taliaExpectedGuests;
    sum.named += row.namedGuests;
    return sum;
  }, { source: 0, talia: 0, named: 0 });

  return {
    namesFromHistory,
    assumptions: pathAssumptions(namesFromHistory),
    sailedGroupCount: scored.length,
    unfilteredSailedCount: all.length,
    ships,
    sailDateMin: sailDates[0] || null,
    sailDateMax: sailDates[sailDates.length - 1] || null,
    sourceExpectedGuests: totals.source,
    taliaExpectedGuests: totals.talia,
    namedGuests: totals.named,
    months: monthRows,
    highlights,
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
 */
export const buildSourceMrPathDays = ({
  groupId = null,
  sailDate = null,
  finalNamed = 0,
  days = [],
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
    const named = namesFromHistory && day.named != null ? round(day.named) : ending;
    const rates = materialiseExtractGroup({
      group_status: day.status,
      n_of_guests: day.requested,
      n_of_delegate_guests: named,
      probability: day.probability,
    });
    return {
      changedDate: day.changedDate,
      status: day.status,
      requestedGuests: day.requested,
      namedGuests: named,
      sourceMr: rates.source_mr,
      taliaMr: rates.talia_mr,
      sourceExpectedGuests: round(day.requested * (rates.source_mr || 0)),
      taliaExpectedGuests: round(day.requested * (rates.talia_mr || 0)),
      manual: day.manual,
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
