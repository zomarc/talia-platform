import React, { useEffect, useMemo } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import PanelDataState from '../../shared/PanelDataState';
import MasterSailingPresenter from './MasterSailingPresenter';
import { buildMasterSailingRows } from './masterSailingTransform';

const MASTER_SAIL_FILTERS = { is_main: 1 };
const INVENTORY_FILTERS = { is_operational: true };

const MasterSailingContainer = ({ panelInstanceId, panelComponentId }) => {
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
    filters: MASTER_SAIL_FILTERS,
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
    () => buildMasterSailingRows(masterSailRows, inventoryRows, reservationCurrentStateRows),
    [masterSailRows, inventoryRows, reservationCurrentStateRows]
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
      />
    </PanelDataState>
  );
};

export default MasterSailingContainer;

