/**
 * Reservation Current State Container Component
 * Handles data fetching and state management
 * Follows the _TEMPLATE pattern for consistency
 */

import React from 'react';
import { useReservationsBySail } from '../../../hooks/data/useReservationsData';
import ReservationCurrentStatePresenter from './ReservationCurrentStatePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const ReservationCurrentStateContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  
  console.log('[ReservationCurrentStateContainer] Component rendering');
  
  // Use hook that listens to sail selection events
  const { data, loading, error, refetch, selectedSailCode } = useReservationsBySail({
    listenToSailEvents: true
  });

  console.log('[ReservationCurrentStateContainer] State:', { loading, error: error?.message, dataLength: data?.length, selectedSailCode });

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading reservations..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load reservations"
        onRetry={refetch}
      />
    );
  }

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: 'var(--theme-fg)'
      }}>
        <p>
          {selectedSailCode 
            ? `No reservations found for sail code: ${selectedSailCode}`
            : 'No reservation data available'}
        </p>
        <button 
          onClick={refetch}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: 'var(--theme-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Render presenter with data
  return (
    <ReservationCurrentStatePresenter 
      data={data} 
      theme={theme}
      onRefresh={refetch}
      selectedSailCode={selectedSailCode}
    />
  );
};

export default ReservationCurrentStateContainer;
