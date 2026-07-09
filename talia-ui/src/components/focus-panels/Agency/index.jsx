/**
 * Agency Container — dwh.Dim_Agency dimension table
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT } from '../../../lib/eventBus';
import AgencyPresenter from './AgencyPresenter';
import PanelDataState from '../../shared/PanelDataState';
import {
  AGENCY_SELECTION_MODES,
  buildSailScopeKeyFromDetail,
  mapSailCodesToReservationFilters,
  resolveAgencyDirectoryData,
  resolveAgencyIdFromDetail,
  resolveReferenceSailCodeFromDetail,
  resolveReservationIdFromDetail,
  resolveSailCodesFromDetail,
} from './agencyDirectoryContext';

const RESERVATION_SELECT = 'talia:reservation.select';
const RESERVATION_CLEAR = 'talia:reservation.clear';

const readPersistedReservationDetail = () => {
  try {
    const persisted = localStorage.getItem('talia:persisted:lastEvent');
    if (!persisted) return null;
    const event = JSON.parse(persisted);
    if (event?.name !== RESERVATION_SELECT || !event.detail) return null;
    return event.detail;
  } catch {
    return null;
  }
};

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
  } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail)),
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

    window.addEventListener(RESERVATION_SELECT, handleReservationSelect);
    window.addEventListener(RESERVATION_CLEAR, handleReservationClear);

    return () => {
      window.removeEventListener(RESERVATION_SELECT, handleReservationSelect);
      window.removeEventListener(RESERVATION_CLEAR, handleReservationClear);
    };
  }, []);

  const hasSailSelection = Boolean(sailContext);
  const sailScopeKey = useMemo(
    () => (hasSailSelection ? buildSailScopeKeyFromDetail(sailContext) : null),
    [hasSailSelection, sailContext]
  );
  const [sailRowsScopeKey, setSailRowsScopeKey] = useState(null);

  useEffect(() => {
    if (!hasSailSelection) {
      setSailRowsScopeKey(null);
      return;
    }
    if (sailReservationsLoading) return;
    setSailRowsScopeKey(sailScopeKey);
  }, [hasSailSelection, sailReservationsLoading, sailScopeKey]);

  const { mode, rows: data, pendingSailScope } = useMemo(
    () => resolveAgencyDirectoryData({
      agencies,
      reservationAgencyId,
      sailReservationRows,
      hasSailSelection,
      sailScopeKey,
      sailRowsScopeKey,
    }),
    [agencies, hasSailSelection, reservationAgencyId, sailReservationRows, sailRowsScopeKey, sailScopeKey]
  );

  const loading = agenciesLoading
    || (!reservationAgencyId && hasSailSelection && (sailReservationsLoading || pendingSailScope));
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
    window.dispatchEvent(new CustomEvent(RESERVATION_CLEAR, {
      detail: { timestamp: new Date().toISOString() },
    }));
  };

  const handleClearSailLink = () => {
    window.dispatchEvent(new CustomEvent(SAIL_CLEAR_EVENT, {
      detail: { timestamp: new Date().toISOString() },
    }));
  };

  const emptyMessage = (() => {
    if (mode === AGENCY_SELECTION_MODES.RESERVATION) {
      return reservationAgencyId
        ? `No agency found for ID ${reservationAgencyId}${reservationId ? ` (reservation ${reservationId})` : ''}`
        : 'No agency linked to the selected reservation.';
    }
    if (mode === AGENCY_SELECTION_MODES.SAIL) {
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
      empty={!data || data.length === 0}
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
        selectedAgencyId={reservationAgencyId}
        selectedReservationId={reservationId}
        selectedSailCodes={selectedSailCodes}
        selectedReferenceSailCode={selectedReferenceSailCode}
      />
    </PanelDataState>
  );
};

export default AgencyContainer;
