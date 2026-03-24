/**
 * Hook for BookingTargetChart - combines target (central store/profiles) and booking data
 * Listens to sail selection, fetches booking build curves, merges with target data
 * Target data: Data Management import (booking_targets_supplied) or target profiles
 */

import { useState, useEffect, useCallback } from 'react';
import { SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, extractSailCodeFromEvent } from '../../lib/eventBus';
import bookingProfileService from '../../services/data/bookingProfileService';
import targetProfileService from '../../services/data/targetProfileService';
import { fetchBookingTargetsSuppliedGrouped } from '../../services/data/bookingTargetsSuppliedService';

const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

/**
 * @param {Object} options
 * @param {string} options.initialSailCode - Initial sail code (overrides context)
 * @param {Object} options.csvTargetData - Legacy: parsed CSV { bySailCode, sailCodes } (overrides central store)
 * @param {boolean} options.useCentralStore - Fetch from booking_targets_supplied (default true)
 * @param {boolean} options.listenToSailEvents - Listen to talia:sail.select (default true)
 * @param {string} options.targetProfileId - Use target profile (Talia target) from GraphQL
 */
export function useBookingTargetChart(options = {}) {
  const {
    initialSailCode = null,
    csvTargetData = null,
    useCentralStore = true,
    listenToSailEvents = true,
    targetProfileId = null,
  } = options;

  const [sailCode, setSailCode] = useState(initialSailCode);
  const [bookingData, setBookingData] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [centralStoreData, setCentralStoreData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sail selection from event bus
  useEffect(() => {
    if (!listenToSailEvents) return;

    const handleSelect = (e) => {
      const code = extractSailCodeFromEvent(e?.detail);
      if (code) setSailCode(code);
    };

    const handleClear = () => setSailCode(null);

    window.addEventListener(SAIL_SELECT_EVENT, handleSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleClear);

    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleClear);
    };
  }, [listenToSailEvents]);

  // Initial sail code override
  useEffect(() => {
    if (initialSailCode) setSailCode(initialSailCode);
  }, [initialSailCode]);

  // Restore persisted sail selection when available.
  useEffect(() => {
    if (initialSailCode || sailCode) return;
    const extractFromPersisted = () => {
      const persistedCandidates = ['talia:persisted:lastEvent', 'talia:test:lastEvent'];
      for (const key of persistedCandidates) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const code = extractSailCodeFromEvent(parsed?.detail);
          if (code) return code;
        } catch {
          // ignore malformed local storage entry
        }
      }
      const windowCode = extractSailCodeFromEvent(window?.lastSailSelectEvent?.detail);
      return windowCode || null;
    };
    const restoredCode = extractFromPersisted();
    if (restoredCode) setSailCode(restoredCode);
  }, [initialSailCode, sailCode]);

  // Fetch booking profile with build curves when sail selected
  const fetchBooking = useCallback(async (code) => {
    if (!code) {
      setBookingData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await bookingProfileService.fetchWithBuildCurves(code);
      setBookingData(data);
    } catch (err) {
      setError(err);
      setBookingData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooking(sailCode);
  }, [sailCode, fetchBooking]);

  // Accept dashboard global criteria updates by refreshing bound data.
  useEffect(() => {
    const handleGlobalCriteriaChange = () => {
      if (sailCode) {
        fetchBooking(sailCode);
      }
      if (useCentralStore && !csvTargetData) {
        fetchBookingTargetsSuppliedGrouped(null)
          .then((data) => setCentralStoreData(data))
          .catch((err) => console.warn('[useBookingTargetChart] Central store refresh failed:', err));
      }
    };
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);
  }, [sailCode, fetchBooking, useCentralStore, csvTargetData]);

  // Fetch target profile (Talia target) when targetProfileId is set
  useEffect(() => {
    if (!targetProfileId) {
      setTargetProfile(null);
      return;
    }
    let cancelled = false;
    targetProfileService
      .fetchById(targetProfileId)
      .then((p) => {
        if (!cancelled) setTargetProfile(p);
      })
      .catch((err) => {
        if (!cancelled) console.warn('[useBookingTargetChart] Target profile fetch failed:', err);
      });
    return () => { cancelled = true; };
  }, [targetProfileId]);

  // Fetch from central store (Data Management imported data)
  useEffect(() => {
    if (!useCentralStore || csvTargetData) {
      setCentralStoreData(null);
      return;
    }
    let cancelled = false;
    fetchBookingTargetsSuppliedGrouped(null)
      .then((data) => {
        if (!cancelled) setCentralStoreData(data);
      })
      .catch((err) => {
        if (!cancelled) console.warn('[useBookingTargetChart] Central store fetch failed:', err);
      });
    return () => { cancelled = true; };
  }, [useCentralStore, csvTargetData]);

  // Compute merged chart data: keep supplied and local profile separate
  const suppliedData = csvTargetData || centralStoreData;
  const suppliedCurves = suppliedData?.bySailCode && sailCode
    ? suppliedData.bySailCode.get(sailCode) || []
    : [];
  const localProfileCurves = targetProfile?.buildCurves?.length
    ? targetProfile.buildCurves
    : [];
  const targetCurves = localProfileCurves.length ? localProfileCurves : suppliedCurves;

  const buildCurves = bookingData?.buildCurves || [];

  const sailCodes = suppliedData?.sailCodes || [];
  const hasTargetData = targetCurves.length > 0;
  const bookingProfileDate = bookingData?.bookingDataPoints?.length
    ? bookingData.bookingDataPoints[bookingData.bookingDataPoints.length - 1]?.date || null
    : null;
  const targetDataDate = sailCode && suppliedData?.metaBySailCode
    ? suppliedData.metaBySailCode.get(sailCode)?.latestImportedAt || null
    : null;

  return {
    sailCode,
    setSailCode,
    bookingData,
    buildCurves,
    suppliedCurves,
    localProfileCurves,
    targetCurves,
    sailCodes,
    hasTargetData,
    bookingProfileDate,
    targetDataDate,
    loading,
    error,
    refetch: () => fetchBooking(sailCode),
  };
}

export default useBookingTargetChart;
