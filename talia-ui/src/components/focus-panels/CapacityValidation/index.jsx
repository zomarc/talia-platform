/**
 * Capacity Validation Container — multi-source capacity check for selected voyage.
 */

import React, { useMemo } from 'react';
import { useTableDataWithContext, buildContextFiltersKey } from '../../../hooks/data/useTableDataWithContext';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import PanelDataState from '../../shared/PanelDataState';
import {
  mapSailCodesToReservationFilters,
  resolveReferenceSailCodeFromDetail,
  resolveSailCodesFromDetail,
} from '../Agency/agencyDirectoryContext';
import CapacityValidationPresenter from './CapacityValidationPresenter';
import { buildCapacityValidationRow } from './capacityValidationTransform';

const mapSailContextToReservationFilters = (detail) => (
  mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail))
);

const CapacityValidationContainer = ({ panelInstanceId, panelComponentId }) => {
  const {
    data: reservationRows,
    loading: reservationsLoading,
    error: reservationsError,
    context: sailContext,
    loadedFiltersKey,
  } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 50000,
  });

  const {
    data: berthRows,
    loading: berthLoading,
    error: berthError,
  } = useTableDataWithContext({
    tableName: 'ship_day_berth_status',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 20000,
  });

  const {
    data: cabinRows,
    loading: cabinLoading,
    error: cabinError,
  } = useTableDataWithContext({
    tableName: 'cabin_availability',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 20000,
  });

  const {
    data: inventoryDayRows,
    loading: inventoryLoading,
    error: inventoryError,
  } = useTableDataWithContext({
    tableName: 'inventory_status_by_day',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 20000,
  });

  const {
    data: ships,
    loading: shipsLoading,
    error: shipsError,
  } = useTableDataWithContext({
    tableName: 'ship',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 50,
  });

  const {
    data: masterSailRows,
    loading: masterLoading,
    error: masterError,
  } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const reference = resolveReferenceSailCodeFromDetail(detail)
        || resolveSailCodesFromDetail(detail)[0]
        || null;
      return reference ? { sail_code: reference } : null;
    },
    fetchWithoutContext: false,
    limit: 20,
  });

  const sailCodes = useMemo(
    () => resolveSailCodesFromDetail(sailContext),
    [sailContext]
  );
  const referenceSailCode = useMemo(
    () => resolveReferenceSailCodeFromDetail(sailContext),
    [sailContext]
  );
  const shipCode = sailContext?.canonical_scope?.ship_code
    || sailContext?.ship_code
    || null;
  const shipName = sailContext?.canonical_scope?.ship_name
    || sailContext?.ship_name
    || null;

  const hasSailSelection = Boolean(sailContext) && sailCodes.length > 0;
  const expectedFiltersKey = useMemo(
    () => (hasSailSelection
      ? buildContextFiltersKey(sailContext, mapSailContextToReservationFilters)
      : null),
    [hasSailSelection, sailContext]
  );
  const scopePending = hasSailSelection
    && expectedFiltersKey
    && loadedFiltersKey !== expectedFiltersKey;

  const masterSailRow = useMemo(() => {
    const rows = masterSailRows || [];
    if (!rows.length) return null;
    if (referenceSailCode) {
      return rows.find((row) => String(row?.sail_code || '').trim() === String(referenceSailCode).trim())
        || rows[0];
    }
    return rows[0];
  }, [masterSailRows, referenceSailCode]);

  const row = useMemo(() => {
    if (!hasSailSelection || scopePending) return null;
    return buildCapacityValidationRow({
      referenceSailCode,
      sailCodes,
      shipCode,
      shipName,
      masterSailRow,
      berthRows: berthRows || [],
      cabinRows: cabinRows || [],
      inventoryDayRows: inventoryDayRows || [],
      ships: ships || [],
      reservationRows: reservationRows || [],
    });
  }, [
    berthRows,
    cabinRows,
    hasSailSelection,
    inventoryDayRows,
    masterSailRow,
    referenceSailCode,
    reservationRows,
    sailCodes,
    scopePending,
    shipCode,
    shipName,
    ships,
  ]);

  const loading = shipsLoading
    || masterLoading
    || (hasSailSelection && (
      reservationsLoading
      || berthLoading
      || cabinLoading
      || inventoryLoading
      || scopePending
    ));
  const error = reservationsError
    || berthError
    || cabinError
    || inventoryError
    || shipsError
    || masterError;

  return (
    <PanelDataState
      loading={shipsLoading}
      loadingMessage="Loading capacity sources..."
      error={error}
      errorTitle="Failed to load capacity validation"
      empty={false}
    >
      <CapacityValidationPresenter
        row={row}
        hasSailSelection={hasSailSelection}
        scopeLoading={Boolean(loading && hasSailSelection)}
        selectedSailCodes={sailCodes}
        selectedReferenceSailCode={referenceSailCode}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default CapacityValidationContainer;
