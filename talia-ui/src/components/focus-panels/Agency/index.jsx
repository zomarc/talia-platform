/**
 * Agency Container — selection-driven agency directory + explorer metrics.
 * Sail → agencies with reservations; reservation → that agency.
 * Value / PPD (current vs expected) from sail-scoped reservation facts + cabin_ctg.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTableDataWithContext, buildContextFiltersKey } from '../../../hooks/data/useTableDataWithContext';
import { useGlobalCabinCategoryMode } from '../../../hooks/useGlobalCabinCategoryMode';
import {
  AGENCY_CLEAR_EVENT,
  AGENCY_SELECT_EVENT,
  CABIN_CLEAR_EVENT,
  CABIN_SELECT_EVENT,
  RESERVATION_CLEAR_EVENT,
  RESERVATION_SELECT_EVENT,
  SAIL_SELECT_EVENT,
} from '../../../lib/eventBus';
import { indexCabinCategoryGroups } from '../../../lib/cabinCategoryGroups';
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
import {
  buildAgencyExplorerMetrics,
  enrichAgenciesWithExplorerMetrics,
} from './agencyExplorerMetrics';

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
  const cabinCategoryMode = useGlobalCabinCategoryMode();
  const [reservationAgencyId, setReservationAgencyId] = useState(() => {
    const detail = readPersistedReservationDetail();
    return resolveAgencyIdFromDetail(detail);
  });
  const [reservationId, setReservationId] = useState(() => {
    const detail = readPersistedReservationDetail();
    return resolveReservationIdFromDetail(detail);
  });
  const [explorerAgencyId, setExplorerAgencyId] = useState(null);
  const sailReservationRowsRef = useRef([]);

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
    data: cabinCtgRows,
  } = useTableDataWithContext({
    tableName: 'cabin_ctg',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 500,
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
  sailReservationRowsRef.current = Array.isArray(sailReservationRows) ? sailReservationRows : [];

  const {
    data: sailMetricReservations,
    loading: metricReservationsLoading,
    error: metricReservationsError,
    loadedFiltersKey: loadedMetricFiltersKey,
  } = useTableDataWithContext({
    tableName: 'reservation',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 50000,
  });

  useEffect(() => {
    const resolveAgencyIdForReservation = (resId, detailAgencyId = null) => {
      if (detailAgencyId != null && String(detailAgencyId).trim() !== '') {
        return String(detailAgencyId).trim();
      }
      if (resId == null || resId === '') return null;
      const key = String(resId).trim();
      const match = sailReservationRowsRef.current.find(
        (row) => String(row?.res_id ?? '').trim() === key
      );
      const fromRow = match?.agency_id;
      return fromRow != null && String(fromRow).trim() !== '' ? String(fromRow).trim() : null;
    };

    const handleReservationSelect = (event) => {
      const detail = event?.detail;
      const resId = resolveReservationIdFromDetail(detail);
      setReservationId(resId);
      setReservationAgencyId(
        resolveAgencyIdForReservation(resId, resolveAgencyIdFromDetail(detail))
      );
    };

    const handleReservationClear = () => {
      setReservationAgencyId(null);
      setReservationId(null);
    };

    const handleCabinSelect = (event) => {
      const detail = event?.detail || {};
      const resId = detail.res_id ?? detail.dlgt_res_id ?? detail.row_data?.res_id ?? null;
      if (resId == null || String(resId).trim() === '') {
        setReservationId(null);
        setReservationAgencyId(null);
        return;
      }
      const normalizedResId = String(resId).trim();
      setReservationId(normalizedResId);
      setReservationAgencyId(
        resolveAgencyIdForReservation(
          normalizedResId,
          detail.agency_id ?? detail.row_data?.agency_id ?? null
        )
      );
    };

    const handleCabinClear = () => {
      setReservationAgencyId(null);
      setReservationId(null);
      setExplorerAgencyId(null);
    };

    const handleAgencySelect = (event) => {
      const id = event?.detail?.agency_id ?? event?.detail?.row_data?.agency_id;
      setExplorerAgencyId(id != null && String(id).trim() !== '' ? String(id).trim() : null);
    };

    const handleAgencyClear = () => {
      setExplorerAgencyId(null);
    };

    window.addEventListener(RESERVATION_SELECT_EVENT, handleReservationSelect);
    window.addEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);
    window.addEventListener(CABIN_SELECT_EVENT, handleCabinSelect);
    window.addEventListener(CABIN_CLEAR_EVENT, handleCabinClear);
    window.addEventListener(AGENCY_SELECT_EVENT, handleAgencySelect);
    window.addEventListener(AGENCY_CLEAR_EVENT, handleAgencyClear);

    return () => {
      window.removeEventListener(RESERVATION_SELECT_EVENT, handleReservationSelect);
      window.removeEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);
      window.removeEventListener(CABIN_SELECT_EVENT, handleCabinSelect);
      window.removeEventListener(CABIN_CLEAR_EVENT, handleCabinClear);
      window.removeEventListener(AGENCY_SELECT_EVENT, handleAgencySelect);
      window.removeEventListener(AGENCY_CLEAR_EVENT, handleAgencyClear);
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

  const cabinCtgIndex = useMemo(
    () => indexCabinCategoryGroups(cabinCtgRows || []),
    [cabinCtgRows]
  );

  const metricsPending = Boolean(
    hasSailSelection
    && expectedReservationFiltersKey
    && loadedMetricFiltersKey !== expectedReservationFiltersKey
  );

  const selectedForBreakdown = explorerAgencyId || (
    reservationAgencyId != null ? String(reservationAgencyId).trim() : null
  );

  const explorerMetrics = useMemo(() => {
    if (!hasSailSelection || metricsPending) {
      return { byAgency: new Map(), categoryBreakdown: [], cabinCategoryMode };
    }
    return buildAgencyExplorerMetrics({
      reservationRows: sailMetricReservations || [],
      cabinCtgIndex,
      cabinCategoryMode,
      selectedAgencyId: selectedForBreakdown,
    });
  }, [
    cabinCategoryMode,
    cabinCtgIndex,
    hasSailSelection,
    metricsPending,
    sailMetricReservations,
    selectedForBreakdown,
  ]);

  const explorerRows = useMemo(() => {
    const rows = enrichAgenciesWithExplorerMetrics(resolved.rows, explorerMetrics.byAgency);
    return [...rows].sort((a, b) => {
      const av = Number(a?.current_value_eur);
      const bv = Number(b?.current_value_eur);
      const aNull = !Number.isFinite(av);
      const bNull = !Number.isFinite(bv);
      if (aNull && bNull) {
        return String(a?.agency_name || '').localeCompare(String(b?.agency_name || ''));
      }
      if (aNull) return 1;
      if (bNull) return -1;
      return bv - av;
    });
  }, [explorerMetrics.byAgency, resolved.rows]);

  const selectedSailCodes = useMemo(
    () => resolveSailCodesFromDetail(sailContext),
    [sailContext]
  );
  const selectedReferenceSailCode = useMemo(
    () => resolveReferenceSailCodeFromDetail(sailContext),
    [sailContext]
  );

  const loading = agenciesLoading;
  const error = agenciesError || sailReservationsError || metricReservationsError;

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading agencies..."
      error={error}
      errorTitle="Failed to load agencies"
      empty={false}
    >
      <AgencyPresenter
        data={explorerRows}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
        selectionMode={resolved.mode}
        scopeLoading={Boolean(resolved.pendingSailScope || metricsPending || metricReservationsLoading)}
        selectedAgencyId={reservationAgencyId}
        selectedReservationId={reservationId}
        selectedSailCodes={selectedSailCodes}
        selectedReferenceSailCode={selectedReferenceSailCode}
        categoryBreakdown={explorerMetrics.categoryBreakdown}
        cabinCategoryMode={cabinCategoryMode}
        explorerAgencyId={selectedForBreakdown}
      />
    </PanelDataState>
  );
};

export default AgencyContainer;
