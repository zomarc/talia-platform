/**
 * Groups Explorer — GRM container (data + selection).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  emitGroupSelect,
  emitSailSelect,
  extractGroupIdFromEvent,
  GROUP_CLEAR_EVENT,
  GROUP_SELECT_EVENT,
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
  const { useSourceNudge } = useReportShellOptions(panelComponentId, panelInstanceId);

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
    const onGroupSelect = (event) => {
      const groupId = extractGroupIdFromEvent(event?.detail);
      if (!groupId) return;
      const fromBus = event?.detail?.row_data?.group_key;
      setSelectedGroupKey(fromBus || groupId);
    };
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    window.addEventListener(GROUP_CLEAR_EVENT, onClear);
    window.addEventListener(GROUP_SELECT_EVENT, onGroupSelect);
    return () => {
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
      window.removeEventListener(GROUP_CLEAR_EVENT, onClear);
      window.removeEventListener(GROUP_SELECT_EVENT, onGroupSelect);
    };
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
      useSourceNudge,
    }),
    [reservationRows, agenciesById, sellableRemainingPct, useSourceNudge]
  );

  const snapshot = useMemo(() => buildGroupsExplorerSnapshot(rows), [rows]);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading && !rows.length);

  const handleSelectGroup = (row) => {
    if (!row) return;
    setSelectedGroupKey(row.group_key);
    const sailCode = String(row.sail_code || selectedSailCode || '').trim();
    const groupId = String(row.group_id || row.group_key || '').trim();
    const sailDateFrom = row.sail_date_from ? String(row.sail_date_from).slice(0, 10) : null;
    // Group focus first so consumers see lastGroupSelectEvent before sail-scope side effects.
    if (groupId) {
      emitGroupSelect({
        group_id: groupId,
        sail_code: sailCode || null,
        reference_sail_code: sailCode || null,
        ship_code: row.ship_code || null,
        agency_id: row.agency_id ?? null,
        sail_date_from: sailDateFrom,
        selection_origin: 'groups-explorer',
        row_data: {
          sail_code: sailCode || null,
          ship_code: row.ship_code || null,
          group_id: groupId,
          agency_id: row.agency_id,
          group_key: row.group_key,
          sail_date_from: sailDateFrom,
          source_mr: row.source_mr,
          talia_mr: row.talia_mr,
        },
      });
    }
    // Re-broadcasting the same sail refreshes this table and jumps scroll; only
    // emit when the sailing actually changes.
    if (!sailCode || sailCode === selectedSailCode) return;
    emitSailSelect({
      sail_code: sailCode,
      reference_sail_code: sailCode,
      ship_code: row.ship_code || null,
      selection_origin: 'groups-explorer',
      row_data: {
        sail_code: sailCode,
        ship_code: row.ship_code || null,
        group_id: groupId || null,
        agency_id: row.agency_id,
        sail_date_from: sailDateFrom,
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
