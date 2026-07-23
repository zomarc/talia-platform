/**
 * Agency Container — dwh.Dim_Agency dimension table
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTableDataWithContext, buildContextFiltersKey } from '../../../hooks/data/useTableDataWithContext';
import {
  RESERVATION_CLEAR_EVENT,
  RESERVATION_SELECT_EVENT,
  SAIL_SELECT_EVENT,
  emitReservationClear,
  emitSailClear,
} from '../../../lib/eventBus';
import AgencyPresenter from './AgencyPresenter';
import PanelDataState from '../../shared/PanelDataState';
import {
  AGENCY_SELECTION_MODES,
  mapSailCodesToReservationFilters,
  resolveAgencyDirectoryData,
  resolveAgencyIdFromDetail,
  resolveReferenceSailCodeFromDetail,
  resolveReservationIdFromDetail,
  resolveSailCodesFromDetail,
} from './agencyDirectoryContext';

const readPersistedReservationDetail = () => {
  try {
    const persisted = localStorage.getItem('talia:persisted:lastEvent');
    if (!persisted) return null;
    const event = JSON.parse(persisted);
    if (event?.name !== RESERVATION_SELECT_EVENT || !event.detail) return null;
    return event.detail;
  } catch {
    return null;
  }
};

const mapSailContextToReservationFilters = (detail) => (
  mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail))
);

const AgencyContainer = ({ panelInstanceId, panelComponentId }) => {
  const reservationClearTimerRef = useRef(null);
  const [reservationAgencyId, setReservationAgencyId] = useState(() => {
    const detail = readPersistedReservationDetail();
    return resolveAgencyIdFromDetail(detail);
  });
  const [reservationId, setReservationId] = useState(() => {
    const detail = readPersistedReservationDetail();
    return resolveReservationIdFromDetail(detail);
  });

  const {
    data: agencies,
    loading: agenciesLoading,
    error: agenciesError,
    refetch: refetchAgencies,
  } = useTableDataWithContext({
    tableName: 'agency',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 50000,
  });

  const {
    data: sailReservationRows,
    loading: sailReservationsLoading,
    error: sailReservationsError,
    refetch: refetchSailReservations,
    context: sailContext,
    loadedFiltersKey: loadedReservationFiltersKey,
  } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 50000,
  });

  useEffect(() => {
    const clearReservationLink = () => {
      setReservationAgencyId(null);
      setReservationId(null);
    };

    const handleReservationSelect = (event) => {
      // Coalesce Tabulator deselect→select in the same turn so Agency does not
      // briefly drop into sail-scope loading and remount/thrash.
      if (reservationClearTimerRef.current != null) {
        window.clearTimeout(reservationClearTimerRef.current);
        reservationClearTimerRef.current = null;
      }
      const detail = event?.detail;
      setReservationAgencyId(resolveAgencyIdFromDetail(detail));
      setReservationId(resolveReservationIdFromDetail(detail));
    };

    const handleReservationClear = () => {
      if (reservationClearTimerRef.current != null) {
        window.clearTimeout(reservationClearTimerRef.current);
      }
      reservationClearTimerRef.current = window.setTimeout(() => {
        reservationClearTimerRef.current = null;
        clearReservationLink();
      }, 0);
    };

    window.addEventListener(RESERVATION_SELECT_EVENT, handleReservationSelect);
    window.addEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);

    return () => {
      if (reservationClearTimerRef.current != null) {
        window.clearTimeout(reservationClearTimerRef.current);
        reservationClearTimerRef.current = null;
      }
      window.removeEventListener(RESERVATION_SELECT_EVENT, handleReservationSelect);
      window.removeEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);
    };
  }, []);

  const hasSailSelection = Boolean(sailContext);
  const expectedReservationFiltersKey = useMemo(
    () => (hasSailSelection
      ? buildContextFiltersKey(sailContext, mapSailContextToReservationFilters)
      : null),
    [hasSailSelection, sailContext]
  );

  const resolved = useMemo(
    () => resolveAgencyDirectoryData({
      agencies,
      reservationAgencyId,
      sailReservationRows,
      hasSailSelection,
      expectedReservationFiltersKey,
      loadedReservationFiltersKey,
      sailReservationsLoading,
    }),
    [
      agencies,
      expectedReservationFiltersKey,
      hasSailSelection,
      loadedReservationFiltersKey,
      reservationAgencyId,
      sailReservationRows,
      sailReservationsLoading,
    ]
  );

  // Keep last ready sail/reservation rows while a new sail scope is fetching —
  // avoids empty→loading remount thrash (page freeze).
  const [displaySnapshot, setDisplaySnapshot] = useState(() => ({
    mode: AGENCY_SELECTION_MODES.ALL,
    rows: [],
  }));

  useEffect(() => {
    if (resolved.pendingSailScope) return;
    setDisplaySnapshot({
      mode: resolved.mode,
      rows: resolved.rows,
    });
  }, [resolved]);

  const mode = resolved.pendingSailScope ? displaySnapshot.mode : resolved.mode;
  const data = resolved.pendingSailScope ? displaySnapshot.rows : resolved.rows;
  const scopeLoading = Boolean(resolved.pendingSailScope);

  // Only block the panel on the agency dimension load — never unmount while
  // sail reservation scope is catching up.
  const loading = agenciesLoading;
  const error = agenciesError || sailReservationsError;

  const refetch = () => {
    refetchAgencies();
    if (hasSailSelection) refetchSailReservations();
  };

  const selectedSailCodes = useMemo(
    () => resolveSailCodesFromDetail(sailContext),
    [sailContext]
  );
  const selectedReferenceSailCode = useMemo(
    () => resolveReferenceSailCodeFromDetail(sailContext),
    [sailContext]
  );

  const handleClearReservationLink = () => {
    emitReservationClear({ timestamp: new Date().toISOString() });
  };

  const handleClearSailLink = () => {
    emitSailClear({ timestamp: new Date().toISOString() });
  };

  const emptyMessage = (() => {
    if (mode === AGENCY_SELECTION_MODES.RESERVATION) {
      return reservationAgencyId
        ? `No agency found for ID ${reservationAgencyId}${reservationId ? ` (reservation ${reservationId})` : ''}`
        : 'No agency linked to the selected reservation.';
    }
    if (mode === AGENCY_SELECTION_MODES.SAIL || hasSailSelection) {
      const sailLabel = selectedReferenceSailCode || selectedSailCodes[0] || 'selected sailing';
      return `No agencies with reservations found for ${sailLabel}.`;
    }
    return 'No agency data available. Sync dwh.Dim_Agency from Data Management.';
  })();

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading agencies..."
      error={error}
      errorTitle="Failed to load agencies"
      empty={!loading && !scopeLoading && (!data || data.length === 0)}
      emptyMessage={emptyMessage}
      onRetry={refetch}
    >
      <AgencyPresenter
        data={data}
        totalAgencyCount={agencies?.length || 0}
        onRefresh={refetch}
        onClearReservationLink={handleClearReservationLink}
        onClearSailLink={handleClearSailLink}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
        selectionMode={mode}
        scopeLoading={scopeLoading}
        selectedAgencyId={reservationAgencyId}
        selectedReservationId={reservationId}
        selectedSailCodes={selectedSailCodes}
        selectedReferenceSailCode={selectedReferenceSailCode}
      />
    </PanelDataState>
  );
};

export default AgencyContainer;
