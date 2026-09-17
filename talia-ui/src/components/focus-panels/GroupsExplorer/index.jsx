/**
 * Groups Explorer — GRM container (data + selection).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import {
  emitSailSelect,
  SAIL_CLEAR_EVENT,
  SAIL_SELECT_EVENT,
} from '../../../lib/eventBus';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import PanelDataState from '../../shared/PanelDataState';
import {
  mapSailCodesToReservationFilters,
  resolveReferenceSailCodeFromDetail,
  resolveSailCodesFromDetail,
} from '../Agency/agencyDirectoryContext';
import GroupsExplorerPresenter from './GroupsExplorerPresenter';
import {
  buildGroupsExplorerRows,
  buildGroupsExplorerSnapshot,
  indexAgenciesById,
} from './groupsExplorerTransform';

const RESERVATION_COLUMNS = [
  'res_id',
  'sail_code',
  'ship',
  'sail_from_date',
  'agency_id',
  'group_id',
  'guest_count',
  'pax_type',
  'res_status',
  'source_origin',
  'res_probability',
  'group_probability',
  'gross_ticket_revenue_eur',
  'net_ticket_revenue_eur',
  'gross_ticket_revenue',
  'net_ticket_revenue',
];

const mapSailContextToFilters = (detail) => (
  mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail))
);

const GroupsExplorerContainer = ({ panelInstanceId, panelComponentId }) => {
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);

  const {
    data: agencies,
  } = useTableDataWithContext({
    tableName: 'agency',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 50000,
    columns: ['agency_id', 'agency_name', 'agency_type', 'market'],
  });

  const {
    data: inventoryRows,
  } = useTableDataWithContext({
    tableName: 'inventory_item',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 20000,
  });

  useEffect(() => {
    if (inventoryRows?.length) setInventoryItems(inventoryRows);
  }, [inventoryRows]);

  const {
    data: reservationRows,
    loading,
    error,
    refetch,
    context,
  } = useTableDataWithContext({
    tableName: 'reservation',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToFilters,
    fetchWithoutContext: false,
    limit: 50000,
    columns: RESERVATION_COLUMNS,
  });

  const {
    data: capacityRows,
  } = useTableDataWithContext({
    tableName: 'sail_booking_summary',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToFilters,
    fetchWithoutContext: false,
    limit: 500,
  });

  const selectedSailCode = String(
    resolveReferenceSailCodeFromDetail(context)
    || resolveSailCodesFromDetail(context)[0]
    || ''
  ).trim();

  useEffect(() => {
    const onClear = () => setSelectedGroupKey(null);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
  }, []);

  const agenciesById = useMemo(() => indexAgenciesById(agencies), [agencies]);

  const sellableRemainingPct = useMemo(() => {
    // Without physical capacity in this panel, treat as unknown (no distress flag).
    void capacityRows;
    return null;
  }, [capacityRows]);

  const rows = useMemo(
    () => buildGroupsExplorerRows(reservationRows || [], {
      agenciesById,
      sellableRemainingPct,
    }),
    [reservationRows, agenciesById, sellableRemainingPct]
  );

  const snapshot = useMemo(() => buildGroupsExplorerSnapshot(rows), [rows]);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading && !rows.length);

  const handleSelectGroup = (row) => {
    if (!row) return;
    setSelectedGroupKey(row.group_key);
    const sailCode = String(row.sail_code || selectedSailCode || '').trim();
    if (!sailCode) return;
    emitSailSelect({
      sail_code: sailCode,
      reference_sail_code: sailCode,
      ship_code: row.ship_code || null,
      selection_origin: 'groups-explorer',
      row_data: {
        sail_code: sailCode,
        ship_code: row.ship_code || null,
        group_id: row.group_id,
        agency_id: row.agency_id,
      },
    });
  };

  return (
    <PanelDataState
      loading={Boolean(selectedSailCode) && loading && rows.length === 0}
      loadingMessage="Loading groups…"
      error={error}
      errorTitle="Failed to load groups"
      empty={!selectedSailCode || (!loading && rows.length === 0)}
      emptyMessage={
        selectedSailCode
          ? `No group commitments found for ${selectedSailCode}`
          : 'Select a sailing to review group risk.'
      }
      onRetry={selectedSailCode ? refetch : null}
    >
      <GroupsExplorerPresenter
        rows={rows}
        snapshot={snapshot}
        selectedSailCode={selectedSailCode || null}
        selectedGroupKey={selectedGroupKey}
        onSelectGroup={handleSelectGroup}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'groups-explorer'}
      />
    </PanelDataState>
  );
};

export default GroupsExplorerContainer;
