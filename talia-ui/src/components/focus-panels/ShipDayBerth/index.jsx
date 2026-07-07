import React, { useEffect, useMemo, useState } from 'react';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  SHIP_SELECT_EVENT,
  SHIP_CLEAR_EVENT,
} from '../../../lib/eventBus';
import {
  buildInventoryReferenceIndex,
  resolveSelectionScope,
} from '../../../lib/inventoryReference';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PanelDataState from '../../shared/PanelDataState';
import ShipDayBerthPresenter from './ShipDayBerthPresenter';
import { buildShipDayBerthBundle } from './shipDayBerthTransform';

const INVENTORY_FILTERS = { is_operational: true };
const DOT_SAIL_SELECT_EVENT = 'talia.sail.select';

const ShipDayBerthContainer = ({ panelInstanceId, panelComponentId }) => {
  const [selectedScope, setSelectedScope] = useState(null);

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

  // Prime the shared canonical index so emitters can translate selections.
  useEffect(() => {
    if (inventoryRows && inventoryRows.length > 0) {
      setInventoryItems(inventoryRows);
    }
  }, [inventoryRows]);

  // Respond to selections: prefer the emitter's canonical scope, fall back to local resolve.
  useEffect(() => {
    const handleSelect = (event) => {
      const scope = event?.detail?.canonical_scope
        || resolveSelectionScope(event?.detail, inventoryIndex);
      setSelectedScope(scope);
    };
    const handleClear = () => setSelectedScope(null);

    const selectEvents = [SAIL_SELECT_EVENT, SHIP_SELECT_EVENT, DOT_SAIL_SELECT_EVENT];
    const clearEvents = [SAIL_CLEAR_EVENT, SHIP_CLEAR_EVENT];
    selectEvents.forEach((name) => window.addEventListener(name, handleSelect));
    clearEvents.forEach((name) => window.addEventListener(name, handleClear));

    // Re-resolve any persisted selection once inventory is available.
    const persisted = window.lastSailSelectEvent || window.lastShipSelectEvent || null;
    if (persisted?.detail) {
      const scope = resolveSelectionScope(persisted.detail, inventoryIndex);
      if (scope) setSelectedScope(scope);
    }

    return () => {
      selectEvents.forEach((name) => window.removeEventListener(name, handleSelect));
      clearEvents.forEach((name) => window.removeEventListener(name, handleClear));
    };
  }, [inventoryIndex]);

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
