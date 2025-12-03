/**
 * Booking Profile Container Component
 * Displays booking trends and metrics for a specific sailing
 */

import React from 'react';
import { useBookingProfile, useBookingProfileWithCurves } from '../../../hooks/data/useBookingProfile';
import BookingProfilePresenter from './BookingProfilePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const BookingProfileContainer = ({ sailCode, includeComparison = false, previousYearSailCode = null, includeBuildCurves = false, theme }) => {
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
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Please select a sailing to view booking profile</p>
      </div>
    );
  }

  // Handle empty data
  if (!data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No booking data available for {sailCode}</p>
        <button onClick={refetch}>Retry</button>
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
    />
  );
};

export default BookingProfileContainer;


