/**
 * Booking Profile Container Component
 * Displays booking trends and metrics for a specific sailing
 */

import React, { useEffect, useState } from 'react';
import { SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, extractSailCodeFromEvent } from '../../../lib/eventBus';
import { useBookingProfile, useBookingProfileWithCurves } from '../../../hooks/data/useBookingProfile';
import BookingProfilePresenter from './BookingProfilePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const BookingProfileContainer = (props) => {
  const {
    sailCode: sailProp,
    includeComparison: includeComparisonProp = false,
    previousYearSailCode: previousYearProp = null,
    includeBuildCurves = false,
    theme,
    params = {},
  } = props;

  const includeComparison = params.includeComparison ?? includeComparisonProp;
  const previousYearSailCode = params.previousYearSailCode ?? previousYearProp;
  const sailFromParams = params.sailCode ?? sailProp ?? null;

  const [sailCode, setSailCode] = useState(sailFromParams);

  useEffect(() => {
    if (sailFromParams) setSailCode(sailFromParams);
  }, [sailFromParams]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (sailFromParams || sailCode) return;
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
          // ignore
        }
      }
      return extractSailCodeFromEvent(window?.lastSailSelectEvent?.detail) || null;
    };
    const restored = extractFromPersisted();
    if (restored) setSailCode(restored);
  }, [sailFromParams, sailCode]);

  // Use build curves hook if requested, otherwise use standard hook
  const standardHook = useBookingProfile(sailCode, {
    includeComparison,
    previousYearSailCode
  });
  
  const curvesHook = useBookingProfileWithCurves(sailCode, {
    includeComparison,
    previousYearSailCode
  });
  
  // Select which hook to use based on includeBuildCurves flag
  const { data, loading, error, refetch } = includeBuildCurves ? curvesHook : standardHook;

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading booking profile..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load booking profile"
        onRetry={refetch}
      />
    );
  }

  // Handle no sail code
  if (!sailCode) {
    return (
      <div className="focus-panel-empty">
        <p>Please select a sailing to view booking profile</p>
      </div>
    );
  }

  // Handle empty data
  if (!data) {
    return (
      <div className="focus-panel-empty">
        <p>No booking data available for {sailCode}</p>
        <div className="focus-panel-empty__action">
          <button className="talia-btn talia-btn--primary" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  // Render booking profile with data
  return (
    <BookingProfilePresenter 
      data={data}
      sailCode={sailCode}
      theme={theme}
      onRefresh={refetch}
      includeBuildCurves={includeBuildCurves}
      includeComparison={includeComparison}
    />
  );
};

export default BookingProfileContainer;


