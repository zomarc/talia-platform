import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import PanelDataState from '../../shared/PanelDataState';
import MasterSailingPresenter from './MasterSailingPresenter';
import { buildMasterSailingRows } from './masterSailingTransform';

const INVENTORY_FILTERS = { is_operational: true };

const MasterSailingContainer = ({ panelInstanceId, panelComponentId }) => {
  const [segmentsVisible, setSegmentsVisible] = useState(true);
  const {
    data: masterSailRows,
    loading: masterLoading,
    error: masterError,
    refetch: refetchMasterSail,
  } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 500,
  });

  const {
    data: inventoryRows,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
  } = useTableDataWithContext({
    tableName: 'inventory_item',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    filters: INVENTORY_FILTERS,
    limit: 2000,
  });

  const {
    data: reservationCurrentStateRows,
    loading: reservationLoading,
    error: reservationError,
    refetch: refetchReservations,
  } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 150000,
  });

  useEffect(() => {
    if (inventoryRows && inventoryRows.length > 0) {
      setInventoryItems(inventoryRows);
    }
  }, [inventoryRows]);

  const mergedRows = useMemo(
    () => buildMasterSailingRows(
      masterSailRows,
      inventoryRows,
      reservationCurrentStateRows,
      { showSegments: segmentsVisible }
    ),
    [masterSailRows, inventoryRows, reservationCurrentStateRows, segmentsVisible]
  );

  const loading = masterLoading || inventoryLoading || reservationLoading;
  const error = masterError || inventoryError || reservationError;
  const handleRefresh = () => {
    refetchMasterSail();
    refetchInventory();
    refetchReservations();
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading master sailing data..."
      error={error}
      errorTitle="Failed to load Master Sailing data"
      empty={!mergedRows || mergedRows.length === 0}
      emptyMessage="No master sailing data available"
      onRetry={handleRefresh}
    >
      <MasterSailingPresenter
        data={mergedRows}
        onRefresh={handleRefresh}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
        segmentsVisible={segmentsVisible}
        onSegmentsVisibleChange={setSegmentsVisible}
      />
    </PanelDataState>
  );
};

export default MasterSailingContainer;

