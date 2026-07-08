/**
 * Booking Target Chart Container
 * Profiles target data (central store / target profiles) with booking and time data
 * Target data loaded via Data Management; configurable chart for sail/group selection
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useBookingTargetChart } from '../../../hooks/data/useBookingTargetChart';
import targetProfileService from '../../../services/data/targetProfileService';
import BookingTargetChartPresenter from './BookingTargetChartPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const BookingTargetChartContainer = ({
  sailCode: initialSailCode,
  targetProfileId,
  theme,
  panelInstanceId,
  panelComponentId,
}) => {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(targetProfileId || null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    targetProfileService.fetchAll({ isActive: true })
      .then((rows) => {
        if (!cancelled) setProfiles(rows || []);
      })
      .catch((err) => {
        if (!cancelled) setProfileError(err?.message || 'Failed to load profiles');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (targetProfileId) setSelectedProfileId(targetProfileId);
  }, [targetProfileId]);

  const {
    sailCode,
    setSailCode,
    sailCodes,
    bookingData,
    buildCurves,
    suppliedCurves,
    localProfileCurves,
    hasTargetData,
    bookingProfileDate,
    targetDataDate,
    loading,
    error,
    refetch,
  } = useBookingTargetChart({
    initialSailCode: initialSailCode || undefined,
    useCentralStore: true,
    listenToSailEvents: true,
    targetProfileId: selectedProfileId || undefined,
  });

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  const handleSaveProfile = async ({ profileName, curves }) => {
    if (!profileName || !curves?.length) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const payload = {
        name: profileName,
        description: `Local profile for ${sailCode || 'manual'} (edited in Booking Target Chart)`,
        sailCode: sailCode || null,
        shipCode: bookingData?.shipCode || null,
        buildCurves: curves.map((c) => ({
          weekLabel: c.weekLabel,
          weeksUntilSailing: c.weeksUntilSailing ?? 0,
          targetBookings: Number(c.targetBookings || 0),
          targetGuests: Number(c.targetGuests || 0),
        })),
        basedOnHistoric: [],
      };

      let saved;
      if (selectedProfileId && selectedProfile?.name === profileName) {
        saved = await targetProfileService.update(selectedProfileId, payload);
      } else {
        saved = await targetProfileService.create(payload);
      }

      const refreshed = await targetProfileService.fetchAll({ isActive: true });
      setProfiles(refreshed || []);
      if (saved?.id) setSelectedProfileId(saved.id);
    } catch (err) {
      setProfileError(err?.message || 'Failed to save local profile');
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading && !bookingData && sailCode) {
    return <LoadingSpinner message="Loading booking profile…" fullScreen={false} />;
  }

  if (error && !bookingData) {
    return (
      <ErrorMessage
        error={error}
        title="Failed to load booking data"
        onRetry={refetch}
      />
    );
  }

  return (
    <BookingTargetChartPresenter
      sailCode={sailCode}
      setSailCode={setSailCode}
      sailCodes={sailCodes}
      bookingData={bookingData}
      buildCurves={buildCurves}
      suppliedCurves={suppliedCurves}
      localProfileCurves={localProfileCurves}
      hasTargetData={hasTargetData}
      bookingProfileDate={bookingProfileDate}
      targetDataDate={targetDataDate}
      loading={loading}
      error={error}
      onRefresh={refetch}
      profiles={profiles}
      selectedProfileId={selectedProfileId}
      onSelectProfile={setSelectedProfileId}
      onSaveProfile={handleSaveProfile}
      profileSaving={profileSaving}
      profileError={profileError}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default BookingTargetChartContainer;
