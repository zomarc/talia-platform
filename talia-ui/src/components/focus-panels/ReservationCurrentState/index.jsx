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
import { extractSailCodeFromEvent, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const ReservationCurrentStateContainer = () => {
  const { theme } = useTheme();
  
  console.log('[ReservationCurrentStateContainer] Component rendering');
  
  // Use reusable hook for context-based data fetching with server-side filtering
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: SAIL_SELECT_EVENT,
    contextMapper: (detail) => {
      const sailCode = extractSailCodeFromEvent(detail);
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
      <div className="focus-panel-empty">
        <p>
          {selectedSailCode 
            ? `No reservations found for sail code: ${selectedSailCode}`
            : 'No reservation data available'}
        </p>
        <div className="focus-panel-empty__action">
          <button 
            onClick={refetch}
            className="talia-btn talia-btn--primary"
          >
            Retry
          </button>
        </div>
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
