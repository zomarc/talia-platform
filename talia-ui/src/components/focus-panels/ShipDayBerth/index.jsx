import React, { useEffect, useMemo, useState } from 'react';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  SHIP_SELECT_EVENT,
  SHIP_CLEAR_EVENT,
} from '../../../lib/eventBus';
import {
  buildInventoryReferenceIndex,
} from '../../../lib/inventoryReference';
import {
  getInventoryIndex,
  onInventoryIndexChange,
  setInventoryItems,
} from '../../../services/data/inventoryReferenceService';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PanelDataState from '../../shared/PanelDataState';
import ShipDayBerthPresenter from './ShipDayBerthPresenter';
import { buildShipDayBerthBundle, resolveListenerScope } from './shipDayBerthTransform';

const INVENTORY_FILTERS = { is_operational: true };
const DOT_SAIL_SELECT_EVENT = 'talia.sail.select';

const ShipDayBerthContainer = ({ panelInstanceId, panelComponentId }) => {
  const [selectedScope, setSelectedScope] = useState(null);
  const [sharedIndexEpoch, setSharedIndexEpoch] = useState(0);

  const {
    data: shipDayBerthRows,
    loading: berthLoading,
    error: berthError,
    refetch: refetchBerths,
  } = useTableDataWithContext({
    tableName: 'ship_day_berth_status',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 60000,
  });

  const {
    data: shipRows,
    loading: shipLoading,
    error: shipError,
    refetch: refetchShips,
  } = useTableDataWithContext({
    tableName: 'ship',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 100,
  });

  // Canonical linking layer: resolve any selection to a scope via inventory_item.
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
    limit: 5000,
  });

  const inventoryIndex = useMemo(
    () => buildInventoryReferenceIndex(inventoryRows),
    [inventoryRows]
  );

  const effectiveInventoryIndex = useMemo(() => {
    const local = inventoryIndex;
    const shared = getInventoryIndex();
    const localSize = local?.byReference?.size || 0;
    const sharedSize = shared?.byReference?.size || 0;
    return localSize >= sharedSize ? local : shared;
  }, [inventoryIndex, sharedIndexEpoch]);

  // Prime the shared canonical index so emitters can translate selections.
  useEffect(() => {
    if (inventoryRows && inventoryRows.length > 0) {
      setInventoryItems(inventoryRows);
    }
  }, [inventoryRows]);

  // Re-resolve when another panel primes the shared inventory index.
  useEffect(() => onInventoryIndexChange(() => {
    setSharedIndexEpoch((epoch) => epoch + 1);
  }), []);

  // Respond to selections via the merged canonical scope contract.
  useEffect(() => {
    const applySelection = (detail) => {
      const scope = resolveListenerScope(detail, effectiveInventoryIndex);
      setSelectedScope(scope);
    };

    const handleSelect = (event) => {
      applySelection(event?.detail);
    };
    const handleClear = () => setSelectedScope(null);

    const selectEvents = [SAIL_SELECT_EVENT, SHIP_SELECT_EVENT, DOT_SAIL_SELECT_EVENT];
    const clearEvents = [SAIL_CLEAR_EVENT, SHIP_CLEAR_EVENT];
    selectEvents.forEach((name) => window.addEventListener(name, handleSelect));
    clearEvents.forEach((name) => window.addEventListener(name, handleClear));

    // Re-resolve any persisted selection once inventory is available.
    const persisted = window.lastSailSelectEvent || window.lastShipSelectEvent || null;
    if (persisted?.detail) {
      applySelection(persisted.detail);
    }

    return () => {
      selectEvents.forEach((name) => window.removeEventListener(name, handleSelect));
      clearEvents.forEach((name) => window.removeEventListener(name, handleClear));
    };
  }, [effectiveInventoryIndex]);

  const bundle = useMemo(
    () => buildShipDayBerthBundle({ shipDayBerthRows, shipRows }),
    [shipDayBerthRows, shipRows]
  );

  const loading = berthLoading || shipLoading || inventoryLoading;
  const error = berthError || shipError || inventoryError;

  const handleRefresh = () => {
    refetchBerths();
    refetchShips();
    refetchInventory();
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading ship × day berths..."
      error={error}
      errorTitle="Failed to load Ship × Day Berths"
      empty={!bundle?.dayRows || bundle.dayRows.length === 0}
      emptyMessage="No physical berth data available"
      onRetry={handleRefresh}
    >
      <ShipDayBerthPresenter
        dayRows={bundle.dayRows}
        summaries={bundle.summaries}
        selectedScope={selectedScope}
        onClearSelection={() => setSelectedScope(null)}
        onRefresh={handleRefresh}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default ShipDayBerthContainer;
