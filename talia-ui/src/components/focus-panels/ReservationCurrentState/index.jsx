/**
 * Reservation Current State Container Component
 * Handles data fetching and state management
 * Uses useTableDataWithContext for server-side filtering based on event bus context
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import ReservationCurrentStatePresenter from './ReservationCurrentStatePresenter';
import PanelDataState from '../../shared/PanelDataState';
import { useTheme } from '../../../contexts/ThemeContext';
import { extractSailCodeFromEvent, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const ReservationCurrentStateContainer = ({ panelInstanceId, panelComponentId }) => {
  const { theme } = useTheme();
  
  console.log('[ReservationCurrentStateContainer] Component rendering');
  
  // Use reusable hook for context-based data fetching with server-side filtering
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const sailCode = extractSailCodeFromEvent(detail);
      console.log('[ReservationCurrentStateContainer] Mapped context to filters:', { sail_code: sailCode });
      return sailCode ? { sail_code: sailCode } : null;
    },
    fetchWithoutContext: false,
    limit: 1000
  });

  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);

  console.log('[ReservationCurrentStateContainer] State:', { loading, error: error?.message, dataLength: data?.length, selectedSailCode });

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading reservations..."
      error={error}
      errorTitle="Failed to load reservations"
      empty={!data || data.length === 0}
      emptyMessage={
        selectedSailCode
          ? `No reservations found for sail code: ${selectedSailCode}`
          : 'No reservation data available'
      }
      onRetry={refetch}
    >
      <ReservationCurrentStatePresenter
        data={data}
        theme={theme}
        onRefresh={refetch}
        selectedSailCode={selectedSailCode}
      />
    </PanelDataState>
  );
};

export default ReservationCurrentStateContainer;
