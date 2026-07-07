import React, { useEffect, useMemo } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import PanelDataState from '../../shared/PanelDataState';
import MasterSailingExplorerPresenter from './MasterSailingExplorerPresenter';
import { buildMasterSailingExplorerBundle } from './masterSailingExplorerTransform';

const MASTER_SAIL_FILTERS = { is_main: 1 };
const INVENTORY_FILTERS = { is_operational: true };

const MasterSailingExplorerContainer = ({ panelInstanceId, panelComponentId }) => {
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

  const {
    data: hierarchyRows,
    loading: hierarchyLoading,
    error: hierarchyError,
    refetch: refetchHierarchy,
  } = useTableDataWithContext({
    tableName: 'sailing_hierarchy',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    filters: { is_operational: true },
    limit: 5000,
  });

  const {
    data: shipDayBerthRows,
    loading: shipDayLoading,
    error: shipDayError,
    refetch: refetchShipDay,
  } = useTableDataWithContext({
    tableName: 'ship_day_berth_status',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 60000,
  });

  useEffect(() => {
    if (inventoryRows && inventoryRows.length > 0) {
      setInventoryItems(inventoryRows);
    }
  }, [inventoryRows]);

  const filteredHierarchyRows = useMemo(
    () => (hierarchyRows || []).filter(
      (row) => row?.master_sail_code && row?.segment_sail_code
    ),
    [hierarchyRows]
  );

  const explorerBundle = useMemo(
    () => buildMasterSailingExplorerBundle({
      masterSailRows,
      inventoryItems: inventoryRows,
      reservationRows: reservationCurrentStateRows,
      hierarchyRows: filteredHierarchyRows,
      shipDayBerthRows,
    }),
    [
      masterSailRows,
      inventoryRows,
      reservationCurrentStateRows,
      filteredHierarchyRows,
      shipDayBerthRows,
    ]
  );

  const loading = masterLoading
    || inventoryLoading
    || reservationLoading
    || hierarchyLoading
    || shipDayLoading;
  const error = masterError
    || inventoryError
    || reservationError
    || hierarchyError
    || shipDayError;

  const handleRefresh = () => {
    refetchMasterSail();
    refetchInventory();
    refetchReservations();
    refetchHierarchy();
    refetchShipDay();
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading master sailing explorer..."
      error={error}
      errorTitle="Failed to load Master Sailing Explorer"
      empty={!explorerBundle?.masters || explorerBundle.masters.length === 0}
      emptyMessage="No master sailing data available"
      onRetry={handleRefresh}
    >
      <MasterSailingExplorerPresenter
        masters={explorerBundle.masters}
        dayDetailsByMaster={explorerBundle.dayDetailsByMaster}
        onRefresh={handleRefresh}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default MasterSailingExplorerContainer;
