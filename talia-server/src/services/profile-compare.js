/**
 * ProfileCompare composite: REAL (reservation curve) vs model prior + optional
 * active target overlay + budget end-state.
 */

import { getReservationBookingCurve } from './reservation-booking-curve.js';
import { getBudgetEndStateComparison } from './booking-profile-dimensional.js';
import { listInventoryTargetProfiles } from './inventory-target-profile.js';
import {
  resolveModelPeer,
  listModelCandidates,
} from './profile-model-map.js';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Densify reservation curve totals into an LF% series scaled to end-state LF.
 */
function totalsFromCurve(curve) {
  if (Array.isArray(curve?.totals) && curve.totals.length) return curve.totals;
  const series = Array.isArray(curve?.series) ? curve.series : [];
  if (!series.length) return [];
  const weekMap = new Map();
  series.forEach((s) => {
    (s.points || []).forEach((p) => {
      if (p?.weeksUntilSailing == null) return;
      const w = Number(p.weeksUntilSailing);
      const cur = weekMap.get(w) || { weekLabel: p.weekLabel, weeksUntilSailing: w, bookings: 0, guests: 0 };
      cur.bookings += Number(p.bookings) || 0;
      cur.guests += Number(p.guests) || 0;
      weekMap.set(w, cur);
    });
  });
  return [...weekMap.values()].sort((a, b) => b.weeksUntilSailing - a.weeksUntilSailing);
}

export function densifyLfSeriesFromCurve(curve) {
  if (!curve) return [];
  const totals = totalsFromCurve(curve);
  const endLf =
    curve.loadFactorPct != null
      ? Number(curve.loadFactorPct)
      : curve.totalCabins > 0 && curve.bookedCabins != null
        ? round2((Number(curve.bookedCabins) / Number(curve.totalCabins)) * 100)
        : null;
  const lastBookings = totals.length ? Number(totals[totals.length - 1].bookings) || 0 : 0;

  if (!totals.length) {
    if (endLf == null) return [];
    return [
      {
        weekLabel: 'Sail',
        weeksUntilSailing: 0,
        bookings: Number(curve.reservationBookings) || 0,
        guests: Number(curve.reservationGuests) || 0,
        lfPct: round2(endLf),
      },
    ];
  }

  return totals.map((p) => {
    const bookings = Number(p.bookings) || 0;
    let lfPct = null;
    if (endLf != null && lastBookings > 0) {
      lfPct = round2(endLf * (bookings / lastBookings));
    } else if (endLf != null && lastBookings === 0) {
      lfPct = 0;
    }
    return {
      weekLabel: p.weekLabel,
      weeksUntilSailing: p.weeksUntilSailing,
      bookings,
      guests: Number(p.guests) || 0,
      lfPct,
    };
  });
}

/**
 * Linear-interpolate sparse LF waypoints onto a dense weeks-to-sail axis
 * (high → low weeks, matching REAL/model series).
 */
export function interpolateLfOntoWeeks(points = [], weeks = []) {
  const sorted = [...(points || [])]
    .filter((p) => p?.lfPct != null && p?.weeksUntilSailing != null)
    .sort((a, b) => Number(b.weeksUntilSailing) - Number(a.weeksUntilSailing));
  if (!sorted.length || !weeks?.length) return [];

  return weeks.map((week) => {
    const w = Number(week);
    const exact = sorted.find((p) => Number(p.weeksUntilSailing) === w);
    let lfPct;
    if (exact) {
      lfPct = round2(exact.lfPct);
    } else {
      let earlier = null; // higher weeks-to-sail
      let later = null; // lower weeks-to-sail
      sorted.forEach((p) => {
        const pw = Number(p.weeksUntilSailing);
        if (pw > w && (!earlier || pw < Number(earlier.weeksUntilSailing))) earlier = p;
        if (pw < w && (!later || pw > Number(later.weeksUntilSailing))) later = p;
      });
      if (earlier && later) {
        const span = Number(earlier.weeksUntilSailing) - Number(later.weeksUntilSailing);
        const t = span === 0 ? 0 : (Number(earlier.weeksUntilSailing) - w) / span;
        lfPct = round2(Number(earlier.lfPct) + t * (Number(later.lfPct) - Number(earlier.lfPct)));
      } else {
        lfPct = round2((earlier || later).lfPct);
      }
    }
    return {
      weekLabel: w === 0 ? 'Sail' : `W-${w}`,
      weeksUntilSailing: w,
      bookings: null,
      guests: null,
      lfPct,
    };
  });
}

function weekAxisFromSeries(...seriesList) {
  const weeks = new Set();
  seriesList.forEach((series) => {
    (series || []).forEach((p) => {
      if (p?.weeksUntilSailing != null) weeks.add(Number(p.weeksUntilSailing));
    });
  });
  return [...weeks].sort((a, b) => b - a);
}

/**
 * Voyage-level target nodes with weeks → LF series (sorted high→low weeks).
 */
export function densifyTargetSeries(profile) {
  if (!profile) return [];
  const nodes = (profile.nodes || []).filter(
    (n) =>
      n.dimensionLevel === 'voyage' &&
      n.weeksUntilSailing != null &&
      Number.isFinite(Number(n.weeksUntilSailing))
  );
  if (!nodes.length) {
    const voyage = (profile.nodes || []).find((n) => n.dimensionLevel === 'voyage');
    if (!voyage) return [];
    return [
      {
        weekLabel: 'Goal',
        weeksUntilSailing: 0,
        bookings: null,
        guests: null,
        lfPct: round2(voyage.lfPct),
      },
    ];
  }
  return [...nodes]
    .sort((a, b) => Number(b.weeksUntilSailing) - Number(a.weeksUntilSailing))
    .map((n) => ({
      weekLabel: n.weekLabel || (n.weeksUntilSailing === 0 ? 'Sail' : `W-${n.weeksUntilSailing}`),
      weeksUntilSailing: Number(n.weeksUntilSailing),
      bookings: null,
      guests: null,
      lfPct: round2(n.lfPct),
    }));
}

function asInt(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.round(Number(n));
}

function summarizeCurve(curve, series) {
  if (!curve) return null;
  return {
    sailCode: curve.sailCode,
    referenceSailCode: curve.referenceSailCode,
    sailDate: curve.sailDate,
    shipCode: curve.shipCode,
    shipName: curve.shipName,
    bookedCabins: asInt(curve.bookedCabins),
    totalCabins: asInt(curve.totalCabins),
    loadFactorPct: curve.loadFactorPct != null ? Number(curve.loadFactorPct) : null,
    reservationBookings: asInt(curve.reservationBookings),
    reservationGuests: asInt(curve.reservationGuests),
    daysUntilSailing: asInt(curve.daysUntilSailing),
    series,
  };
}

export async function getProfileCompare(client, sailCode, options = {}) {
  const includeBudget = options.includeBudget !== false;
  const includeTarget = options.includeTarget !== false;
  const includeCandidates = options.includeCandidates !== false;

  // REAL first — never fail the panel if peer/map/target lookups miss.
  let realCurve = null;
  try {
    realCurve = await getReservationBookingCurve(client, sailCode, {
      marketBreakdown: 'market_group',
      seriesMode: 'market',
      includeCompetitor: false,
    });
  } catch (err) {
    console.warn('[profile-compare] REAL curve failed:', err.message);
  }

  let peer = {
    inventoryItemId: null,
    sailCode,
    referenceSailCode: realCurve?.referenceSailCode || sailCode,
    shipCode: realCurve?.shipCode || null,
    shipName: realCurve?.shipName || null,
    sailDate: realCurve?.sailDate || null,
    modelSailCode: null,
    matchMode: 'lazy',
    peerSource: null,
    map: null,
  };
  try {
    peer = { ...peer, ...(await resolveModelPeer(client, sailCode)) };
  } catch (err) {
    console.warn('[profile-compare] peer resolve skipped:', err.message);
  }

  const [modelCurve, candidates] = await Promise.all([
    peer.modelSailCode
      ? getReservationBookingCurve(client, peer.modelSailCode, {
          marketBreakdown: 'market_group',
          seriesMode: 'market',
          includeCompetitor: false,
        }).catch((err) => {
          console.warn('[profile-compare] model curve failed:', err.message);
          return null;
        })
      : Promise.resolve(null),
    includeCandidates
      ? listModelCandidates(client, sailCode, {
          shipCode: realCurve?.shipCode || peer.shipCode,
          sailDate: realCurve?.sailDate || peer.sailDate,
        }).catch((err) => {
          console.warn('[profile-compare] candidates skipped:', err.message);
          return [];
        })
      : Promise.resolve([]),
  ]);

  const realSeries = densifyLfSeriesFromCurve(realCurve);
  const modelSeries = densifyLfSeriesFromCurve(modelCurve);

  const axisWeeks = weekAxisFromSeries(realSeries, modelSeries);

  let activeTarget = null;
  let targetSeries = [];
  let targetSource = null;
  if (includeTarget) {
    if (peer.inventoryItemId) {
      try {
        const profiles = await listInventoryTargetProfiles(client, peer.inventoryItemId);
        activeTarget = profiles.find((p) => p.isActive) || profiles[0] || null;
      } catch (err) {
        console.warn('[profile-compare] target list skipped:', err.message);
      }
    }
    const rawTarget = densifyTargetSeries(activeTarget);
    if (rawTarget.length) {
      targetSeries = interpolateLfOntoWeeks(rawTarget, axisWeeks.length ? axisWeeks : rawTarget.map((p) => p.weeksUntilSailing));
      targetSource = activeTarget?.isActive ? 'active' : 'saved';
    } else if (modelSeries.some((p) => p.lfPct != null)) {
      targetSeries = interpolateLfOntoWeeks(modelSeries, axisWeeks);
      targetSource = 'suggested';
    }
  }

  let budget = null;
  if (includeBudget) {
    try {
      budget = await getBudgetEndStateComparison(client, sailCode, {
        breakdown: 'market_group',
      });
    } catch (err) {
      console.warn('[profile-compare] budget failed:', err.message);
    }
  }

  return {
    sailCode: realCurve?.sailCode || peer.sailCode,
    referenceSailCode: realCurve?.referenceSailCode || peer.referenceSailCode,
    inventoryItemId: peer.inventoryItemId != null ? String(peer.inventoryItemId) : null,
    shipCode: realCurve?.shipCode || peer.shipCode,
    shipName: realCurve?.shipName || peer.shipName,
    sailDate: realCurve?.sailDate || peer.sailDate,
    matchMode: peer.matchMode === 'manual' ? 'manual' : 'lazy',
    peerSource: peer.peerSource,
    modelSailCode: peer.modelSailCode,
    modelMap: peer.map,
    real: summarizeCurve(realCurve, realSeries),
    model: summarizeCurve(modelCurve, modelSeries),
    activeTarget,
    targetSeries,
    targetSource,
    budget,
    candidates,
  };
}
