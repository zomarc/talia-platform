/**
 * Source MR review over the frozen SW_ETL group extract.
 * Talia MR uses the Groups Explorer model and is never copied from source.
 */

import {
  computeTaliaMaterialisation,
  isCancelledStatus,
  scoreTaliaHold,
} from '../../../talia-ui/src/components/focus-panels/GroupsExplorer/groupsMaterialisation.js';

const STATUS_LABELS = {
  QT: 'Quote',
  OF: 'Open',
  BK: 'Booked',
  CX: 'Cancelled',
  CL: 'Closed',
  SH: 'Shared',
  TM: 'Temporary',
  WL: 'Waitlist',
  CT: 'Count',
};

const STATUS_ORDER = ['QT', 'OF', 'BK', 'CL', 'CX', 'SH', 'TM', 'WL', 'CT'];

const BANDS = [
  { id: '0–24', from: 0, to: 25 },
  { id: '25–49', from: 25, to: 50 },
  { id: '50–74', from: 50, to: 75 },
  { id: '75–89', from: 75, to: 90 },
  { id: '90–100', from: 90, to: 101 },
];

export const dateKey = (value) => {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

const statusCode = (value) => String(value || '').trim().toUpperCase() || 'UNKNOWN';

const guests = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const roundGuests = (value) => Math.round(Number(value) || 0);

/**
 * @param {object} row
 * @param {{ useSourceNudge?: boolean }} [options]
 */
export const materialiseExtractGroup = (row = {}, options = {}) => {
  const status = statusCode(row.group_status);
  const requested = guests(row.n_of_guests);
  const named = guests(row.n_of_delegate_guests);
  const scored = scoreTaliaHold({
    status,
    requested,
    named,
    probability: row.probability,
    useSourceNudge: options.useSourceNudge === true,
  });
  return {
    talia_mr: scored.talia_mr,
    source_mr: scored.source_mr,
    reasons: scored.reasons,
  };
};

export { isCancelledStatus, computeTaliaMaterialisation };

export const probabilityBand = (probability) => {
  const n = Number(probability);
  if (!Number.isFinite(n)) return 'Unknown';
  const band = BANDS.find((item) => n >= item.from && n < item.to);
  return band ? band.id : '90–100';
};

const emptyBucket = () => ({
  groups: 0,
  requested: 0,
  named: 0,
  sourceExpected: 0,
  taliaExpected: 0,
});

const addGroup = (bucket, row, sourceRate, taliaRate) => {
  const requested = guests(row.n_of_guests);
  const named = guests(row.n_of_delegate_guests);
  bucket.groups += 1;
  bucket.requested += requested;
  bucket.named += named;
  bucket.sourceExpected += requested * (sourceRate || 0);
  bucket.taliaExpected += requested * (taliaRate || 0);
};

const finishBucket = (bucket) => ({
  groups: bucket.groups,
  requestedGuests: roundGuests(bucket.requested),
  namedGuests: roundGuests(bucket.named),
  sourceExpectedGuests: roundGuests(bucket.sourceExpected),
  taliaExpectedGuests: roundGuests(bucket.taliaExpected),
  realisedRate: bucket.requested > 0 ? bucket.named / bucket.requested : null,
});

const shipFor = (shipsByRecGroupId, recGroupId) => {
  if (!shipsByRecGroupId || recGroupId == null) return null;
  if (typeof shipsByRecGroupId.get === 'function') return shipsByRecGroupId.get(recGroupId) || shipsByRecGroupId.get(String(recGroupId)) || null;
  return shipsByRecGroupId[recGroupId] || shipsByRecGroupId[String(recGroupId)] || null;
};

const toCandidate = (row, ship, rates) => {
  const requested = guests(row.n_of_guests);
  const sourceRate = rates.source_mr || 0;
  const taliaRate = rates.talia_mr || 0;
  return {
    groupId: String(row.group_id),
    recGroupId: row.rec_group_id != null ? String(row.rec_group_id) : null,
    shipCode: ship?.ship_code || null,
    sailId: ship?.sail_id != null ? String(ship.sail_id) : null,
    sailDateFrom: dateKey(row.sail_date_from),
    sailDateTo: dateKey(row.sail_date_to),
    status: statusCode(row.group_status),
    requestedGuests: roundGuests(requested),
    namedGuests: roundGuests(row.n_of_delegate_guests),
    cabins: row.n_of_cabins == null ? null : roundGuests(row.n_of_cabins),
    sourceMr: rates.source_mr,
    taliaMr: rates.talia_mr,
    sourceExpectedGuests: roundGuests(requested * sourceRate),
    taliaExpectedGuests: roundGuests(requested * taliaRate),
    manual: row.is_prob_manual === true,
    reasons: rates.reasons || [],
  };
};

const inTestBand = (item, feedThrough) => {
  const feed = dateKey(feedThrough);
  const sail = dateKey(item.row.sail_date_from);
  return item.status === 'QT'
    && item.requested >= 40
    && item.requested <= 120
    && item.named === 0
    && (item.rates.source_mr || 0) >= 0.9
    && feed
    && sail
    && sail <= feed;
};

const activityDays = (activityByGroupId, groupId) => {
  if (!activityByGroupId) return 0;
  const value = typeof activityByGroupId.get === 'function'
    ? (activityByGroupId.get(groupId) ?? activityByGroupId.get(String(groupId)))
    : (activityByGroupId[groupId] ?? activityByGroupId[String(groupId)]);
  return Number(value) || 0;
};

/**
 * A controller-sized quote that had already sailed: 40–120 guests, source MR
 * still at least 90%, and nobody named. Whole-ship placeholders stay in the
 * portfolio totals. Prefer the group whose source rate was restated on the
 * most separate days, then the latest sailing.
 */
export const pickTestCandidate = (enriched, feedThrough, activityByGroupId = null) => {
  const quotes = enriched.filter((item) => inTestBand(item, feedThrough));
  quotes.sort((a, b) => (
    activityDays(activityByGroupId, b.row.group_id) - activityDays(activityByGroupId, a.row.group_id)
    || String(dateKey(b.row.sail_date_from) || '').localeCompare(String(dateKey(a.row.sail_date_from) || ''))
    || Number(b.row.group_id) - Number(a.row.group_id)
  ));
  return quotes[0] || null;
};

export const testCandidateGroupIds = (groups, feedThrough) => {
  const latest = dateKey(feedThrough) || groups.reduce((max, row) => {
    const key = dateKey(row.changed_date);
    return key && (!max || key > max) ? key : max;
  }, null);
  return groups.filter((row) => inTestBand({
    row,
    status: statusCode(row.group_status),
    requested: guests(row.n_of_guests),
    named: guests(row.n_of_delegate_guests),
    rates: { source_mr: normalizeSource(row.probability) },
  }, latest)).map((row) => Number(row.group_id));
};

const normalizeSource = (probability) => {
  const n = Number(probability);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
};

const shipCodeWanted = (shipCode) => {
  const raw = String(shipCode || '').trim();
  if (!raw || raw.toLowerCase() === 'all' || raw === '*') return null;
  return raw.toUpperCase();
};

export const buildSourceMrReview = ({
  groups = [],
  shipsByRecGroupId = null,
  extractLoadThrough = null,
  activityByGroupId = null,
  shipCode = null,
  dateFrom = null,
  dateTo = null,
} = {}) => {
  const latest = groups.reduce((max, row) => {
    const key = dateKey(row.changed_date);
    return key && (!max || key > max) ? key : max;
  }, null);

  const enrichedAll = groups.map((row) => {
    const rates = materialiseExtractGroup(row);
    return {
      row,
      status: statusCode(row.group_status),
      requested: guests(row.n_of_guests),
      named: guests(row.n_of_delegate_guests),
      rates,
      sailed: Boolean(latest && dateKey(row.sail_date_from) && dateKey(row.sail_date_from) <= latest),
    };
  });

  const shipCodes = new Set();
  let sailDateMin = null;
  let sailDateMax = null;
  enrichedAll.forEach((item) => {
    const code = shipFor(shipsByRecGroupId, item.row.rec_group_id)?.ship_code;
    if (code) shipCodes.add(String(code).trim().toUpperCase());
    const sail = dateKey(item.row.sail_date_from);
    if (!sail) return;
    if (!sailDateMin || sail < sailDateMin) sailDateMin = sail;
    if (!sailDateMax || sail > sailDateMax) sailDateMax = sail;
  });

  const wantedShip = shipCodeWanted(shipCode);
  const from = dateKey(dateFrom);
  const to = dateKey(dateTo);
  const enriched = enrichedAll.filter((item) => {
    if (wantedShip) {
      const code = String(shipFor(shipsByRecGroupId, item.row.rec_group_id)?.ship_code || '').trim().toUpperCase();
      if (code !== wantedShip) return false;
    }
    const sail = dateKey(item.row.sail_date_from);
    if (from && (!sail || sail < from)) return false;
    if (to && (!sail || sail > to)) return false;
    return true;
  });

  const statusMap = new Map();
  const bandMap = new Map();
  const monthMap = new Map();

  enriched.forEach((item) => {
    if (!statusMap.has(item.status)) {
      statusMap.set(item.status, { sailed: emptyBucket(), open: emptyBucket() });
    }
    const statusBucket = statusMap.get(item.status);
    addGroup(
      item.sailed ? statusBucket.sailed : statusBucket.open,
      item.row,
      item.rates.source_mr,
      item.rates.talia_mr
    );

    if (!item.sailed) return;
    const bandId = probabilityBand(item.row.probability);
    const bandKey = `${item.status}|${bandId}`;
    if (!bandMap.has(bandKey)) bandMap.set(bandKey, emptyBucket());
    addGroup(bandMap.get(bandKey), item.row, item.rates.source_mr, item.rates.talia_mr);

    const month = dateKey(item.row.sail_date_from)?.slice(0, 7);
    if (!month) return;
    const monthKey = `${item.status}|${month}`;
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, emptyBucket());
    addGroup(monthMap.get(monthKey), item.row, item.rates.source_mr, item.rates.talia_mr);
  });

  const statuses = [...statusMap.entries()]
    .map(([status, buckets]) => ({
      status,
      label: STATUS_LABELS[status] || status,
      ...prefixBucket('sailed', finishBucket(buckets.sailed)),
      ...prefixBucket('open', finishBucket(buckets.open)),
    }))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.sailedRequestedGuests - a.sailedRequestedGuests);

  const bands = [...bandMap.entries()]
    .map(([key, bucket]) => {
      const [status, band] = key.split('|');
      return { status, band, ...finishBucket(bucket) };
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || bandRank(a.band) - bandRank(b.band));

  const months = [...monthMap.entries()]
    .map(([key, bucket]) => {
      const [status, month] = key.split('|');
      return { status, month, ...finishBucket(bucket) };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || statusRank(a.status) - statusRank(b.status));

  const picked = pickTestCandidate(enriched, latest, activityByGroupId);
  const notable = enriched
    .filter((item) => item.status === 'QT' && item.sailed && item.requested >= 40 && item.named === 0 && (item.rates.source_mr || 0) >= 0.9)
    .sort((a, b) => (b.requested * (b.rates.source_mr || 0)) - (a.requested * (a.rates.source_mr || 0)))
    .slice(0, 5)
    .map((item) => toCandidate(item.row, shipFor(shipsByRecGroupId, item.row.rec_group_id), item.rates));

  return {
    feedThrough: latest,
    extractLoadThrough: dateKey(extractLoadThrough),
    groupCount: enriched.length,
    unfilteredGroupCount: enrichedAll.length,
    ships: [...shipCodes].sort(),
    sailDateMin,
    sailDateMax,
    statuses,
    bands,
    months,
    candidate: picked
      ? toCandidate(picked.row, shipFor(shipsByRecGroupId, picked.row.rec_group_id), picked.rates)
      : null,
    notableQuotes: notable,
  };
};

const prefixBucket = (prefix, bucket) => ({
  [`${prefix}Groups`]: bucket.groups,
  [`${prefix}RequestedGuests`]: bucket.requestedGuests,
  [`${prefix}NamedGuests`]: bucket.namedGuests,
  [`${prefix}SourceExpectedGuests`]: bucket.sourceExpectedGuests,
  [`${prefix}TaliaExpectedGuests`]: bucket.taliaExpectedGuests,
  [`${prefix}RealisedRate`]: bucket.realisedRate,
});

const statusRank = (status) => {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
};

const bandRank = (band) => {
  const index = BANDS.findIndex((item) => item.id === band);
  return index === -1 ? BANDS.length : index;
};
