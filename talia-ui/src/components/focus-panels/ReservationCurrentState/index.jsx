/**
 * Reservation Current State Container Component
 * Handles data fetching and state management
 * Uses useTableDataWithContext for server-side filtering based on event bus context
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import ReservationCurrentStatePresenter from './ReservationCurrentStatePresenter';
import PanelDataState from '../../shared/PanelDataState';
import { useTheme } from '../../../contexts/ThemeContext';
import { CABIN_CLEAR_EVENT, CABIN_SELECT_EVENT, extractSailCodeFromEvent, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { filterByReservationStatus, isCancelledStatus } from './reservationCurrentStateTransform';

const ReservationCurrentStateContainer = ({ panelInstanceId, panelComponentId }) => {
  const { theme } = useTheme();
  const [selectedCabinCategory, setSelectedCabinCategory] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  
  console.log('[ReservationCurrentStateContainer] Component rendering');
  
  // Use reusable hook for context-based data fetching with server-side filtering
  const {
    data: currentStateRows,
    loading: currentStateLoading,
    error: currentStateError,
    refetch: refetchCurrentState,
    context
  } = useTableDataWithContext({
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
    limit: 5000
  });

  const {
    data: reservationRows,
    loading: reservationLoading,
    error: reservationError,
    refetch: refetchReservations
  } = useTableDataWithContext({
    tableName: 'reservation',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const sailCode = extractSailCodeFromEvent(detail);
      return sailCode ? { sail_code: sailCode } : null;
    },
    fetchWithoutContext: false,
    limit: 5000
  });

  const {
    data: reservationHistoryRows,
    loading: reservationHistoryLoading,
    error: reservationHistoryError,
    refetch: refetchReservationHistory,
    context: reservationHistoryContext
  } = useTableDataWithContext({
    tableName: 'reservation_changes',
    eventName: 'talia:reservation.select',
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const resId = detail?.res_id;
      if (resId == null) return null;
      return {
        query_column: 'res_id',
        query_value: String(resId),
        query_operator: 'eq'
      };
    },
    fetchWithoutContext: false,
    limit: 3000
  });

  const {
    data: sailReservationChangeRows,
    loading: sailReservationChangeLoading,
    error: sailReservationChangeError,
    refetch: refetchSailReservationChanges,
  } = useTableDataWithContext({
    tableName: 'reservation_changes',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const sailCode = extractSailCodeFromEvent(detail);
      return sailCode ? { sail_code: sailCode } : null;
    },
    fetchWithoutContext: false,
    limit: 20000
  });

  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);
  useEffect(() => {
    const onCabinSelect = (event) => {
      const cabinCategory = event?.detail?.cabin_category || event?.detail?.row_data?.cabinCategoryCode || null;
      setSelectedCabinCategory(cabinCategory ? String(cabinCategory) : null);
    };
    const onCabinClear = () => {
      setSelectedCabinCategory(null);
    };
    window.addEventListener(CABIN_SELECT_EVENT, onCabinSelect);
    window.addEventListener(CABIN_CLEAR_EVENT, onCabinClear);
    return () => {
      window.removeEventListener(CABIN_SELECT_EVENT, onCabinSelect);
      window.removeEventListener(CABIN_CLEAR_EVENT, onCabinClear);
    };
  }, []);

  const data = useMemo(() => {
    const currentRows = Array.isArray(currentStateRows) ? currentStateRows : [];
    const reservations = Array.isArray(reservationRows) ? reservationRows : [];
    const reservationByResId = new Map(
      reservations
        .filter((row) => row?.res_id != null)
        .map((row) => [String(row.res_id), row])
    );

    const historyCountByResId = (Array.isArray(sailReservationChangeRows) ? sailReservationChangeRows : [])
      .reduce((acc, row) => {
        if (row?.res_id == null) return acc;
        const key = String(row.res_id);
        acc.set(key, (acc.get(key) || 0) + 1);
        return acc;
      }, new Map());

    // Add a baseline booking event when booking date exists.
    reservations.forEach((row) => {
      if (row?.res_id == null) return;
      const key = String(row.res_id);
      if (row?.created_at) {
        historyCountByResId.set(key, (historyCountByResId.get(key) || 0) + 1);
      } else if (isCancelledStatus(row?.res_status) && !historyCountByResId.get(key)) {
        // Keep cancelled bookings discoverable even when change logs are sparse.
        historyCountByResId.set(key, 1);
      }
    });

    const mergedRows = currentRows.map((currentRow) => {
      const key = currentRow?.res_id != null ? String(currentRow.res_id) : null;
      const reservation = key ? reservationByResId.get(key) : null;
      return {
        ...(reservation || {}),
        ...(currentRow || {}),
        // Keep guest_count from current_state when available (latest snapshot state).
        guest_count: currentRow?.guest_count ?? reservation?.guest_count ?? null,
        history_count: key ? (historyCountByResId.get(key) || 0) : 0,
      };
    });

    // Include reservation rows even if current_state has no entry yet.
    const currentIds = new Set(
      currentRows
        .filter((row) => row?.res_id != null)
        .map((row) => String(row.res_id))
    );
    const reservationOnlyRows = reservations.map((row) => {
      const key = row?.res_id != null ? String(row.res_id) : null;
      return {
        ...row,
        history_count: key ? (historyCountByResId.get(key) || 0) : 0,
      };
    }).filter((row) => {
      if (row?.res_id == null) return false;
      return !currentIds.has(String(row.res_id));
    });

    const allRows = [...mergedRows, ...reservationOnlyRows];
    const statusFilteredRows = filterByReservationStatus(allRows, statusFilter);
    if (!selectedCabinCategory) return statusFilteredRows;
    const normalized = String(selectedCabinCategory).toLowerCase();
    return statusFilteredRows.filter((row) => String(row?.cabin_category || '').toLowerCase() === normalized);
  }, [currentStateRows, reservationRows, sailReservationChangeRows, selectedCabinCategory, statusFilter]);

  const loading = currentStateLoading || reservationLoading || sailReservationChangeLoading;
  const error = currentStateError || reservationError || reservationHistoryError || sailReservationChangeError;

  const selectedReservationId = reservationHistoryContext?.res_id ?? null;
  const selectedReservationRecord = useMemo(() => {
    if (selectedReservationId == null) return null;
    const key = String(selectedReservationId);
    const currentRows = Array.isArray(currentStateRows) ? currentStateRows : [];
    const reservations = Array.isArray(reservationRows) ? reservationRows : [];
    const currentMatch = currentRows.find((row) => String(row?.res_id) === key) || null;
    const reservationMatch = reservations.find((row) => String(row?.res_id) === key) || null;
    return {
      ...(reservationMatch || {}),
      ...(currentMatch || {})
    };
  }, [currentStateRows, reservationRows, selectedReservationId]);

  const reservationHistory = useMemo(() => {
    const rows = Array.isArray(reservationHistoryRows) ? reservationHistoryRows : [];
    const sortedRows = rows
      .slice()
      .sort((a, b) => {
        const aTs = new Date(a?.snapshot_date || 0).getTime();
        const bTs = new Date(b?.snapshot_date || 0).getTime();
        return bTs - aTs;
      });
    const bookingDate = selectedReservationRecord?.created_at || null;
    const mappedRows = sortedRows.map((row) => ({
      ...row,
      booking_date: bookingDate,
      change_date: row?.snapshot_date || row?.created_at || null,
      change_kind: 'history_change'
    }));

    if (selectedReservationRecord?.created_at) {
      mappedRows.push({
        id: `booking-${selectedReservationId}`,
        booking_date: selectedReservationRecord.created_at,
        change_date: selectedReservationRecord.created_at,
        change_kind: 'booking_created',
        sail_code: selectedReservationRecord?.sail_code || null,
        agency_id: selectedReservationRecord?.agency_id || null,
        group_id: selectedReservationRecord?.group_id || null,
        guest_count: selectedReservationRecord?.guest_count ?? null,
        guest_count_delta: null,
        sail_code_changed: false,
        agency_id_changed: false,
        group_id_changed: false
      });
    } else if (mappedRows.length === 0 && isCancelledStatus(selectedReservationRecord?.res_status)) {
      mappedRows.push({
        id: `cancelled-${selectedReservationId}`,
        booking_date: null,
        change_date: selectedReservationRecord?.updated_at || null,
        change_kind: 'cancellation_state',
        sail_code: selectedReservationRecord?.sail_code || null,
        agency_id: selectedReservationRecord?.agency_id || null,
        group_id: selectedReservationRecord?.group_id || null,
        guest_count: selectedReservationRecord?.guest_count ?? null,
        guest_count_delta: null,
        sail_code_changed: false,
        agency_id_changed: false,
        group_id_changed: false
      });
    }

    return mappedRows.sort((a, b) => {
      const aTs = new Date(a?.change_date || 0).getTime();
      const bTs = new Date(b?.change_date || 0).getTime();
      return bTs - aTs;
    });
  }, [reservationHistoryRows, selectedReservationId, selectedReservationRecord]);

  console.log('[ReservationCurrentStateContainer] State:', { loading, error: error?.message, dataLength: data?.length, selectedSailCode });

  const handleRefresh = () => {
    refetchCurrentState();
    refetchReservations();
    if (selectedReservationId != null) {
      refetchReservationHistory();
    }
    refetchSailReservationChanges();
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading reservations..."
      error={error}
      errorTitle="Failed to load reservations"
      empty={!data || data.length === 0}
      emptyMessage={
        selectedSailCode
          ? (selectedCabinCategory
            ? `No ${statusFilter === 'all' ? '' : `${statusFilter} `}reservations found for sail ${selectedSailCode} and cabin ${selectedCabinCategory}`
            : `No ${statusFilter === 'all' ? '' : `${statusFilter} `}reservations found for sail code: ${selectedSailCode}`)
          : `No ${statusFilter === 'all' ? '' : `${statusFilter} `}reservation data available`
      }
      onRetry={handleRefresh}
    >
      <ReservationCurrentStatePresenter
        data={data}
        theme={theme}
        onRefresh={handleRefresh}
        selectedSailCode={selectedSailCode}
        reservationHistory={reservationHistory}
        selectedReservationId={selectedReservationId}
        selectedReservationRecord={selectedReservationRecord}
        historyLoading={reservationHistoryLoading}
        selectedCabinCategory={selectedCabinCategory}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default ReservationCurrentStateContainer;
