/**
 * Agency Container — selection-driven agency directory.
 * Sail → agencies with reservations on that sail; reservation → that agency.
 * Dim_Agency is cached in memory; Tabulator only receives the filtered subset.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext, buildContextFiltersKey } from '../../../hooks/data/useTableDataWithContext';
import {
  RESERVATION_CLEAR_EVENT,
  RESERVATION_SELECT_EVENT,
  SAIL_SELECT_EVENT,
} from '../../../lib/eventBus';
import AgencyPresenter from './AgencyPresenter';
import PanelDataState from '../../shared/PanelDataState';
import {
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
    const handleReservationSelect = (event) => {
      const detail = event?.detail;
      setReservationAgencyId(resolveAgencyIdFromDetail(detail));
      setReservationId(resolveReservationIdFromDetail(detail));
    };

    const handleReservationClear = () => {
      setReservationAgencyId(null);
      setReservationId(null);
    };

    window.addEventListener(RESERVATION_SELECT_EVENT, handleReservationSelect);
    window.addEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);

    return () => {
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

  const selectedSailCodes = useMemo(
    () => resolveSailCodesFromDetail(sailContext),
    [sailContext]
  );
  const selectedReferenceSailCode = useMemo(
    () => resolveReferenceSailCodeFromDetail(sailContext),
    [sailContext]
  );

  // Block only on the agency dimension load — keep presenter mounted for sail/reservation scopes.
  const loading = agenciesLoading;
  const error = agenciesError || sailReservationsError;

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading agencies..."
      error={error}
      errorTitle="Failed to load agencies"
      empty={false}
    >
      <AgencyPresenter
        data={resolved.rows}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
        selectionMode={resolved.mode}
        scopeLoading={Boolean(resolved.pendingSailScope)}
        selectedAgencyId={reservationAgencyId}
        selectedReservationId={reservationId}
        selectedSailCodes={selectedSailCodes}
        selectedReferenceSailCode={selectedReferenceSailCode}
      />
    </PanelDataState>
  );
};

export default AgencyContainer;
