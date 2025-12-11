/**
 * Reservation Current State Container Component
 * Handles data fetching and state management
 * Uses useTableDataWithContext for server-side filtering based on event bus context
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import ReservationCurrentStatePresenter from './ReservationCurrentStatePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const ReservationCurrentStateContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  
  console.log('[ReservationCurrentStateContainer] Component rendering');
  
  // Use reusable hook for context-based data fetching with server-side filtering
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: 'talia:sail.select',
    contextMapper: (detail) => {
      // Extract sail_code from event detail (supports multiple formats)
      const sailCode = detail?.sail_code || detail?.Sail_Code || detail?.row_data?.sail_code || (typeof detail === 'string' ? detail : null);
      console.log('[ReservationCurrentStateContainer] Mapped context to filters:', { sail_code: sailCode });
      return sailCode ? { sail_code: sailCode } : null;
    },
    limit: 1000
  });

  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);

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
