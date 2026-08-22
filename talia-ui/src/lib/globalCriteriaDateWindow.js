/**
 * Combine StatusBar DATE range ∩ departure MONTH into an effective occupancy window.
 * Pure helpers — used by panels (SXD) and unit tests.
 */

import {
  ALL_DEPARTURE_MONTH_KEY,
  formatDepartureMonthLabel,
  normalizeGlobalDepartureMonth,
  resolveDepartureMonthBounds,
} from './globalDepartureMonth.js';

const normalizeDate = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const maxDate = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  return a >= b ? a : b;
};

const minDate = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  return a <= b ? a : b;
};

/**
 * Resolve StatusBar DATE ∩ MONTH into an occupancy window.
 * Month bounds apply when a departure month is selected; open DATE keeps month calendar.
 * Falls back only when both DATE and MONTH are open-ended.
 *
 * @returns {{ from: string|null, to: string|null, source: string, departureMonth: string }}
 */
export const resolveEffectiveCriteriaDateWindow = ({
  dateFrom = null,
  dateTo = null,
  departureMonth = ALL_DEPARTURE_MONTH_KEY,
  fallback = null,
} = {}) => {
  const monthKey = normalizeGlobalDepartureMonth(departureMonth);
  const monthBounds = resolveDepartureMonthBounds(monthKey);
  const rangeFrom = normalizeDate(dateFrom) || null;
  const rangeTo = normalizeDate(dateTo) || null;

  let from = rangeFrom;
  let to = rangeTo;
  let source = 'date';

  if (monthBounds) {
    from = maxDate(rangeFrom, monthBounds.dateFrom);
    to = minDate(rangeTo, monthBounds.dateTo);
    // Open DATE + selected MONTH → use the month calendar.
    if (!rangeFrom && !rangeTo) {
      from = monthBounds.dateFrom;
      to = monthBounds.dateTo;
    }
    source = rangeFrom || rangeTo ? 'date+month' : 'month';
  }

  if (!from && !to && fallback?.from) {
    return {
      from: fallback.from,
      to: fallback.to || null,
      source: 'fallback',
      departureMonth: monthKey,
    };
  }

  return { from, to, source, departureMonth: monthKey };
};

/** Human-readable StatusBar criteria chip for panel filters. */
export const formatCriteriaDateSummary = ({
  dateFrom = null,
  dateTo = null,
  departureMonth = ALL_DEPARTURE_MONTH_KEY,
  source = null,
} = {}) => {
  const monthKey = normalizeGlobalDepartureMonth(departureMonth);
  const monthLabel = monthKey === ALL_DEPARTURE_MONTH_KEY
    ? 'All months'
    : formatDepartureMonthLabel(monthKey, monthKey);
  const from = normalizeDate(dateFrom);
  const to = normalizeDate(dateTo);
  const rangePart = from || to
    ? `${from || '…'} → ${to || '…'}`
    : 'All dates';
  if (source === 'fallback') return `Default window ${rangePart}`;
  if (monthKey === ALL_DEPARTURE_MONTH_KEY) return `DATE ${rangePart}`;
  return `MONTH ${monthLabel} · ${rangePart}`;
};

/**
 * Local From/To further narrow the global window (never widen past global bounds).
 */
export const applyLocalDateNarrow = (globalWindow, localOverride = {}) => {
  const globalFrom = normalizeDate(globalWindow?.from) || null;
  const globalTo = normalizeDate(globalWindow?.to) || null;
  const localFrom = normalizeDate(localOverride?.from) || null;
  const localTo = normalizeDate(localOverride?.to) || null;
  const followingGlobal = !localFrom && !localTo;
  let from = localFrom || globalFrom;
  let to = localTo || globalTo;
  if (globalFrom && from && from < globalFrom) from = globalFrom;
  if (globalTo && to && to > globalTo) to = globalTo;
  if (from && to && from > to) {
    from = globalFrom;
    to = globalTo;
  }
  return { from, to, followingGlobal };
};
