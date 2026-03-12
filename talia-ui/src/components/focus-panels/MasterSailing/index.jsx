import React, { useMemo } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PanelDataState from '../../shared/PanelDataState';
import MasterSailingPresenter from './MasterSailingPresenter';
import { buildMasterSailingRows } from './masterSailingTransform';

const MasterSailingContainer = ({ panelInstanceId, panelComponentId }) => {
  const {
    data: masterSailRows,
    loading: masterLoading,
    error: masterError,
    refetch: refetchMasterSail,
  } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    contextMapper: () => null,
    limit: 2000,
  });

  const {
    data: inventoryRows,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
  } = useTableDataWithContext({
    tableName: 'inventory_item',
    eventName: null,
    contextMapper: () => null,
    limit: 4000,
  });

  const mergedRows = useMemo(
    () => buildMasterSailingRows(masterSailRows, inventoryRows),
    [masterSailRows, inventoryRows]
  );

  const loading = masterLoading || inventoryLoading;
  const error = masterError || inventoryError;
  const handleRefresh = () => {
    refetchMasterSail();
    refetchInventory();
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
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default MasterSailingContainer;

