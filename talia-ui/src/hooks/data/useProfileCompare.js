/**
 * Hook: ProfileCompare (REAL vs model + target + budget).
 * Always keeps the current-sail REAL curve even if model/map queries fail.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import profileCompareService from '../../services/data/profileCompareService';
import bookingProfileService from '../../services/data/bookingProfileService';
import inventoryProfileSeriesService from '../../services/data/inventoryProfileSeriesService';
import { REPORT_REFRESH_EVENT } from '../../components/dockview/eventConstants';
import usePanelRefreshGate from '../usePanelRefreshGate';
import useReportPanelLoading from '../useReportPanelLoading';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const totalsFromCurve = (curve) => {
  if (Array.isArray(curve?.totals) && curve.totals.length) return curve.totals;
  const series = Array.isArray(curve?.series) ? curve.series : [];
  if (!series.length) return [];
  const weekMap = new Map();
  series.forEach((s) => {
    (s.points || []).forEach((p) => {
      if (p?.weeksUntilSailing == null) return;
      const w = Number(p.weeksUntilSailing);
      const cur = weekMap.get(w) || {
        weekLabel: p.weekLabel,
        weeksUntilSailing: w,
        bookings: 0,
        guests: 0,
      };
      cur.bookings += Number(p.bookings) || 0;
      cur.guests += Number(p.guests) || 0;
      weekMap.set(w, cur);
    });
  });
  return [...weekMap.values()].sort((a, b) => b.weeksUntilSailing - a.weeksUntilSailing);
};

/**
 * Dense LF% series for overlays. If cabin LF is missing, fall back to booking
 * build shape scaled to 100 so history curves remain visible for model pick.
 */
const seriesFromReservationCurve = (curve) => {
  if (!curve) return [];
  const totals = totalsFromCurve(curve);
  let endLf =
    curve.loadFactorPct != null
      ? Number(curve.loadFactorPct)
      : curve.totalCabins > 0 && curve.bookedCabins != null
        ? round2((Number(curve.bookedCabins) / Number(curve.totalCabins)) * 100)
        : null;
  const lastBookings = totals.length ? Number(totals[totals.length - 1].bookings) || 0 : 0;
  if (endLf == null && lastBookings > 0) endLf = 100;

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
    return {
      weekLabel: p.weekLabel,
      weeksUntilSailing: Number(p.weeksUntilSailing),
      bookings,
      guests: Number(p.guests) || 0,
      lfPct:
        endLf != null && lastBookings > 0
          ? round2(endLf * (bookings / lastBookings))
          : endLf != null
            ? 0
            : null,
    };
  });
};

/** Linear interpolate sparse LF points onto a dense weeks axis (high → low). */
export const interpolateLfOntoWeeks = (points = [], weeks = []) => {
  const sorted = [...(points || [])]
    .filter((p) => p?.lfPct != null && p?.weeksUntilSailing != null)
    .sort((a, b) => Number(b.weeksUntilSailing) - Number(a.weeksUntilSailing));
  if (!sorted.length || !weeks?.length) return weeks.map(() => null);

  return weeks.map((week) => {
    const w = Number(week);
    const exact = sorted.find((p) => Number(p.weeksUntilSailing) === w);
    if (exact) return round2(exact.lfPct);
    let earlier = null;
    let later = null;
    sorted.forEach((p) => {
      const pw = Number(p.weeksUntilSailing);
      if (pw > w && (!earlier || pw < Number(earlier.weeksUntilSailing))) earlier = p;
      if (pw < w && (!later || pw > Number(later.weeksUntilSailing))) later = p;
    });
    if (earlier && later) {
      const span = Number(earlier.weeksUntilSailing) - Number(later.weeksUntilSailing);
      const t = span === 0 ? 0 : (Number(earlier.weeksUntilSailing) - w) / span;
      return round2(Number(earlier.lfPct) + t * (Number(later.lfPct) - Number(earlier.lfPct)));
    }
    return round2((earlier || later).lfPct);
  });
};

const fallbackFromReservation = (curve, sailCode) => {
  if (!curve) return null;
  const series = seriesFromReservationCurve(curve);
  return {
    sailCode: curve.sailCode || sailCode,
    referenceSailCode: curve.referenceSailCode || sailCode,
    inventoryItemId: null,
    shipCode: curve.shipCode,
    shipName: curve.shipName,
    sailDate: curve.sailDate,
    matchMode: 'lazy',
    peerSource: null,
    modelSailCode: null,
    modelMap: null,
    real: {
      sailCode: curve.sailCode,
      referenceSailCode: curve.referenceSailCode,
      sailDate: curve.sailDate,
      shipCode: curve.shipCode,
      shipName: curve.shipName,
      bookedCabins: curve.bookedCabins,
      totalCabins: curve.totalCabins,
      loadFactorPct: curve.loadFactorPct,
      reservationBookings: curve.reservationBookings,
      reservationGuests: curve.reservationGuests,
      daysUntilSailing: curve.daysUntilSailing,
      series,
    },
    model: null,
    activeTarget: null,
    targetSeries: [],
    targetSource: null,
    budget: null,
    candidates: [],
  };
};

const hasRealSeries = (payload) =>
  Boolean(payload?.real?.series?.length) || payload?.real?.loadFactorPct != null;

const PICK_LIMIT = 5;

const overlayFromCurve = (curve, meta = {}) => ({
  sailCode: curve?.sailCode || meta.sailCode,
  sailDate: curve?.sailDate || meta.sailDate,
  shipCode: curve?.shipCode || meta.shipCode,
  isMain: Boolean(meta.isMain),
  dayDiff: meta.dayDiff ?? null,
  loadFactorPct: curve?.loadFactorPct ?? null,
  bookedCabins: curve?.bookedCabins ?? null,
  totalCabins: curve?.totalCabins ?? null,
  series: seriesFromReservationCurve(curve),
});

const messageFromError = (err) => {
  if (!err) return 'Unknown error';
  const gql = err.graphQLErrors?.[0]?.message;
  if (gql && !String(gql).startsWith('Unexpected error value')) return gql;
  if (typeof err.message === 'string' && !err.message.startsWith('Unexpected error value')) {
    return err.message;
  }
  return err.message || String(err);
};

export const useProfileCompare = (sailCode, options = {}) => {
  const {
    panelInstanceId = null,
    panelComponentId = null,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [overlays, setOverlays] = useState([]);
  const fetchDataRef = useRef(null);
  const { shouldSkipRefresh, onResume } = usePanelRefreshGate(panelInstanceId, panelComponentId);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading || busy);

  const fetchData = useCallback(async () => {
    if (shouldSkipRefresh()) return;
    if (!sailCode) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);

    const curvePromise = bookingProfileService
      .fetchReservationCurve(sailCode, {
        marketBreakdown: 'market_group',
        seriesMode: 'market',
        includeCompetitor: false,
      })
      .catch((err) => {
        console.warn('[useProfileCompare] reservation curve fallback failed:', err.message);
        return null;
      });

    try {
      const [result, curve] = await Promise.all([
        profileCompareService.fetchCompare(sailCode).catch((err) => {
          console.warn('[useProfileCompare] compare query failed:', err.message);
          return null;
        }),
        curvePromise,
      ]);

      const realFromCurve = fallbackFromReservation(curve, sailCode);
      let next = result;
      const curveSeries = realFromCurve?.real?.series || [];
      const compareSeries = next?.real?.series || [];
      const compareLfCount = compareSeries.filter((p) => p?.lfPct != null).length;

      if (!next && realFromCurve) {
        next = realFromCurve;
      } else if (next && curveSeries.length && (compareLfCount < 2 || curveSeries.length > compareSeries.length)) {
        next = {
          ...next,
          real: {
            ...(next.real || {}),
            ...realFromCurve.real,
            series: curveSeries,
          },
          sailCode: next.sailCode || realFromCurve.sailCode,
          shipCode: next.shipCode || realFromCurve.shipCode,
          shipName: next.shipName || realFromCurve.shipName,
          sailDate: next.sailDate || realFromCurve.sailDate,
        };
      } else if (!hasRealSeries(next) && realFromCurve) {
        next = {
          ...realFromCurve,
          ...next,
          real: realFromCurve.real,
          inventoryItemId: next?.inventoryItemId || null,
          matchMode: next?.matchMode || 'lazy',
          modelSailCode: next?.modelSailCode || null,
          model: next?.model || null,
          candidates: next?.candidates || [],
        };
      }

      if (next && !next.candidates?.length) {
        const extra = await profileCompareService.fetchModelCandidates(sailCode);
        if (extra.length) next = { ...next, candidates: extra };
      }

      if (!next) {
        throw new Error('No sailing profile returned');
      }
      setData(next);
      setOverlays([]);
      setPicking(false);
    } catch (err) {
      console.error('[useProfileCompare]', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sailCode, shouldSkipRefresh]);

  fetchDataRef.current = fetchData;

  useEffect(() => {
    const unsubscribe = onResume(() => { fetchDataRef.current?.(); });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [onResume]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onRefresh = (e) => {
      const detail = e?.detail || {};
      if (detail.panelInstanceId && panelInstanceId && detail.panelInstanceId !== panelInstanceId) {
        return;
      }
      fetchData();
    };
    window.addEventListener(REPORT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REPORT_REFRESH_EVENT, onRefresh);
  }, [fetchData, panelInstanceId]);

  const applyLocalModel = (overlay) => {
    if (!overlay?.sailCode) return;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        matchMode: 'manual',
        peerSource: 'manual_map',
        modelSailCode: overlay.sailCode,
        model: {
          sailCode: overlay.sailCode,
          sailDate: overlay.sailDate,
          shipCode: overlay.shipCode,
          bookedCabins: overlay.bookedCabins,
          totalCabins: overlay.totalCabins,
          loadFactorPct: overlay.loadFactorPct,
          series: overlay.series || [],
        },
      };
    });
    setPicking(false);
  };

  const beginPick = async () => {
    if (!sailCode) return;
    setPicking(true);
    setError(null);
    const byCode = new Map();
    (data?.candidates || []).forEach((c) => {
      if (c?.sailCode && c.sailCode !== sailCode) byCode.set(c.sailCode, c);
    });
    if (data?.modelSailCode && data.modelSailCode !== sailCode && !byCode.has(data.modelSailCode)) {
      byCode.set(data.modelSailCode, {
        sailCode: data.modelSailCode,
        sailDate: data.model?.sailDate,
        shipCode: data.model?.shipCode || data.shipCode,
        isMain: true,
        dayDiff: 0,
      });
    }
    const list = [...byCode.values()]
      .sort((a, b) => (a.dayDiff ?? 999) - (b.dayDiff ?? 999))
      .slice(0, PICK_LIMIT);
    if (!list.length) {
      setOverlays([]);
      return;
    }
    setBusy(true);
    try {
      const next = await Promise.all(
        list.map(async (meta) => {
          try {
            const curve = await bookingProfileService.fetchReservationCurve(meta.sailCode, {
              marketBreakdown: 'market_group',
              seriesMode: 'market',
              includeCompetitor: false,
            });
            return overlayFromCurve(curve, meta);
          } catch (err) {
            console.warn('[useProfileCompare] candidate curve skipped:', meta.sailCode, err.message);
            return null;
          }
        })
      );
      setOverlays(
        next.filter(
          (o) => o?.sailCode && (o.series || []).some((p) => p?.lfPct != null)
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelPick = () => {
    setPicking(false);
  };

  const setManualModel = async (modelSailCode) => {
    const code = String(modelSailCode || '').trim();
    if (!code) return;
    setError(null);
    let overlay = overlays.find((o) => o.sailCode === code);
    if (!overlay) {
      try {
        const curve = await bookingProfileService.fetchReservationCurve(code, {
          marketBreakdown: 'market_group',
          seriesMode: 'market',
          includeCompetitor: false,
        });
        overlay = overlayFromCurve(curve, { sailCode: code });
      } catch {
        overlay = { sailCode: code, series: [] };
      }
    }
    applyLocalModel(overlay);
    setBusy(true);
    try {
      let itemId = data?.inventoryItemId;
      if (!itemId) {
        const item = await inventoryProfileSeriesService.ensureInventoryItemForSail({
          sailCode,
          referenceSailCode: data?.referenceSailCode || sailCode,
          shipCode: data?.shipCode,
          shipName: data?.shipName,
        });
        itemId = item?.id;
      }
      if (!itemId) throw new Error('Could not resolve inventory item for model map');
      await profileCompareService.upsertModelMap({
        inventoryItemId: String(itemId),
        matchMode: 'manual',
        modelSailCode: code,
      });
      await fetchData();
    } catch (err) {
      setError(new Error(messageFromError(err)));
    } finally {
      setBusy(false);
    }
  };

  const resetToLazy = async () => {
    setPicking(false);
    setError(null);
    if (!data?.inventoryItemId) {
      await fetchData();
      return;
    }
    setBusy(true);
    try {
      await profileCompareService.clearModelMap(data.inventoryItemId);
      await fetchData();
    } catch (err) {
      setError(new Error(messageFromError(err)));
    } finally {
      setBusy(false);
    }
  };

  return {
    data,
    loading,
    error,
    busy,
    picking,
    overlays,
    refetch: fetchData,
    beginPick,
    cancelPick,
    setManualModel,
    resetToLazy,
  };
};

export default useProfileCompare;
