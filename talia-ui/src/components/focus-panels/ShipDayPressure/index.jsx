/**
 * Ship × Day Pressure container — physical ship-day capacity + sail demand exploded onto occupancy days.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { useGlobalCabinCategoryMode } from '../../../hooks/useGlobalCabinCategoryMode';
import { useGlobalDateWindow } from '../../../hooks/useGlobalDateWindow';
import { useGlobalDemandUnit } from '../../../hooks/useGlobalDemandUnit';
import {
  setGlobalShipCode,
  useGlobalShipFilter,
} from '../../../hooks/useGlobalShipFilter';
import { indexCabinCategoryGroups } from '../../../lib/cabinCategoryGroups';
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
import PanelDataState from '../../shared/PanelDataState';
import { resolveListenerScope } from '../ShipDayBerth/shipDayBerthTransform';
import ShipDayPressurePresenter from './ShipDayPressurePresenter';
import {
  PRESSURE_GRAINS,
  buildPressureCells,
  buildPressureGrid,
  buildSailWindows,
  defaultDateWindow,
  expandDateWindowForSailImpact,
} from './shipDayPressureTransform';

const INVENTORY_FILTERS = { is_operational: true };
const DOT_SAIL_SELECT_EVENT = 'talia.sail.select';

const CAPACITY_COLUMNS = [
  'ship_code',
  'sail_code',
  'date',
  'berth_capacity',
  'berths_occupied',
  'total_cabins',
  'occupied_cabins',
  'nameplate_cabins',
  'nameplate_berths',
  'offsale_cabins',
  'offsale_berths',
  'sellable_cabins',
  'sellable_berths',
  'occupied_berths',
];

const BOOKING_SUMMARY_COLUMNS = [
  'sail_code',
  'guest_count',
  'booked_guests',
  'booked_fit_guests',
  'booked_group_guests',
  'contracted_guests',
  'estimated_guests',
];

const MASTER_SAIL_COLUMNS = [
  'sail_code',
  'ship_code',
  'ship_name',
  'sail_date_from',
  'sail_date_to',
  'sail_days',
  'is_main',
];

const INVENTORY_COLUMNS = [
  'sail_code',
  'ship_code',
  'ship_name',
  'reference_sail_code',
  'sailing_role',
  'is_operational',
];

const OCCUPANCY_COLUMNS = [
  'ship_code',
  'ship_name',
  'sail_code',
  'sail_itinerary_date',
  'cabin_category',
  'total_cabins',
  'occupied_cabins',
  'remaining_cabins',
];

const ShipDayPressureContainer = ({ panelInstanceId, panelComponentId }) => {
  const demandUnit = useGlobalDemandUnit();
  const shipFilter = useGlobalShipFilter();
  const globalDates = useGlobalDateWindow();
  const globalCabinCategoryMode = useGlobalCabinCategoryMode();
  /** null = follow StatusBar Cat; Real/Group = local override */
  const [cabinCategoryModeOverride, setCabinCategoryModeOverride] = useState(null);
  const cabinCategoryMode = cabinCategoryModeOverride ?? globalCabinCategoryMode;
  const fallbackWindow = defaultDateWindow();
  /** null fields = follow global criteria; set when the panel From/To inputs are edited */
  const [dateOverride, setDateOverride] = useState({ from: null, to: null });
  const [grain, setGrain] = useState(PRESSURE_GRAINS.SHIP);
  const [selectedScope, setSelectedScope] = useState(null);
  const [sharedIndexEpoch, setSharedIndexEpoch] = useState(0);

  const baseFrom = dateOverride.from || globalDates.dateFrom || fallbackWindow.from;
  const baseTo = dateOverride.to || globalDates.dateTo || fallbackWindow.to;

  const {
    data: capacityRows,
    loading: capacityLoading,
    error: capacityError,
    refetch: refetchCapacity,
  } = useTableDataWithContext({
    tableName: 'ship_day_capacity',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    columns: CAPACITY_COLUMNS,
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
    columns: INVENTORY_COLUMNS,
    limit: 5000,
  });

  const {
    data: masterSailRows,
    loading: masterLoading,
    error: masterError,
    refetch: refetchMaster,
  } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    columns: MASTER_SAIL_COLUMNS,
    limit: 8000,
  });

  const selectedReference = selectedScope?.reference_sail_code
    || selectedScope?.canonical_scope?.reference_sail_code
    || selectedScope?.sail_code
    || null;
  const selectedShipCode = selectedScope?.ship_code
    || selectedScope?.canonical_scope?.ship_code
    || null;

  const sailWindows = useMemo(
    () => buildSailWindows(inventoryRows, masterSailRows),
    [inventoryRows, masterSailRows]
  );

  const expandedWindow = useMemo(() => expandDateWindowForSailImpact({
    dateFrom: baseFrom,
    dateTo: baseTo,
    windows: sailWindows,
    referenceSailCode: selectedReference,
    shipCode: selectedShipCode,
  }), [baseFrom, baseTo, sailWindows, selectedReference, selectedShipCode]);

  const dateFrom = expandedWindow.from || baseFrom;
  const dateTo = expandedWindow.to || baseTo;
  const impactFrom = expandedWindow.impactFrom || null;
  const impactTo = expandedWindow.impactTo || null;

  const occupancyFilters = useMemo(() => (
    dateFrom
      ? { query_column: 'sail_itinerary_date', query_value: dateFrom, query_operator: 'gte' }
      : null
  ), [dateFrom]);

  const handleDateFromChange = (value) => {
    setDateOverride((prev) => ({ ...prev, from: value || null }));
  };
  const handleDateToChange = (value) => {
    setDateOverride((prev) => ({ ...prev, to: value || null }));
  };

  const {
    data: bookingSummaryRows,
    loading: bookingLoading,
    error: bookingError,
    refetch: refetchBooking,
  } = useTableDataWithContext({
    tableName: 'sail_booking_summary',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    columns: BOOKING_SUMMARY_COLUMNS,
    limit: 8000,
  });

  const {
    data: occupancyRows,
    loading: occupancyLoading,
    error: occupancyError,
    refetch: refetchOccupancy,
  } = useTableDataWithContext({
    tableName: 'sail_by_cabin_occupancy',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    columns: OCCUPANCY_COLUMNS,
    filters: occupancyFilters,
    limit: 80000,
  });

  const {
    data: cabinCtgRows,
    loading: cabinCtgLoading,
    error: cabinCtgError,
    refetch: refetchCabinCtg,
  } = useTableDataWithContext({
    tableName: 'cabin_ctg',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    fetchWithoutContext: true,
    limit: 500,
  });

  const cabinCtgIndex = useMemo(
    () => indexCabinCategoryGroups(cabinCtgRows || []),
    [cabinCtgRows]
  );

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

  useEffect(() => {
    if (inventoryRows?.length) setInventoryItems(inventoryRows);
  }, [inventoryRows]);

  useEffect(() => onInventoryIndexChange(() => {
    setSharedIndexEpoch((epoch) => epoch + 1);
  }), []);

  useEffect(() => {
    const applySelection = (detail) => {
      setSelectedScope(resolveListenerScope(detail, effectiveInventoryIndex));
    };
    const handleSelect = (event) => applySelection(event?.detail);
    const handleClear = () => setSelectedScope(null);
    const selectEvents = [SAIL_SELECT_EVENT, SHIP_SELECT_EVENT, DOT_SAIL_SELECT_EVENT];
    const clearEvents = [SAIL_CLEAR_EVENT, SHIP_CLEAR_EVENT];
    selectEvents.forEach((name) => window.addEventListener(name, handleSelect));
    clearEvents.forEach((name) => window.addEventListener(name, handleClear));
    const persisted = window.lastSailSelectEvent || window.lastShipSelectEvent || null;
    if (persisted?.detail) applySelection(persisted.detail);
    return () => {
      selectEvents.forEach((name) => window.removeEventListener(name, handleSelect));
      clearEvents.forEach((name) => window.removeEventListener(name, handleClear));
    };
  }, [effectiveInventoryIndex]);

  const { cells, windows, categoryDays } = useMemo(
    () => buildPressureCells({
      capacityRows,
      shipRows,
      inventoryRows,
      masterSailRows,
      bookingSummaryRows,
      occupancyRows,
      cabinCtgIndex,
      cabinCategoryMode,
      dateFrom,
      dateTo,
    }),
    [
      capacityRows,
      shipRows,
      inventoryRows,
      masterSailRows,
      bookingSummaryRows,
      occupancyRows,
      cabinCtgIndex,
      cabinCategoryMode,
      dateFrom,
      dateTo,
    ]
  );

  const bundle = useMemo(() => {
    const grid = buildPressureGrid({
      cells,
      windows,
      categoryDays,
      grain,
      dateFrom,
      dateTo,
      shipFilter,
      impactFrom,
      impactTo,
    });
    return {
      window: { from: dateFrom, to: dateTo },
      cells,
      ...grid,
      meta: {
        wip: true,
        cabinGrain: grain === PRESSURE_GRAINS.CABIN,
        cabinCategoryMode,
        cabinCategoryModeOverride: cabinCategoryModeOverride != null,
        selectedVoyage: expandedWindow.voyage
          ? {
            reference_sail_code: expandedWindow.voyage.reference_sail_code,
            date_from: expandedWindow.voyage.date_from,
            date_to: expandedWindow.voyage.date_to,
          }
          : null,
        impactFrom,
        impactTo,
      },
    };
  }, [
    cells,
    windows,
    categoryDays,
    grain,
    dateFrom,
    dateTo,
    shipFilter,
    cabinCategoryMode,
    cabinCategoryModeOverride,
    impactFrom,
    impactTo,
    expandedWindow.voyage,
  ]);

  const shipOptions = useMemo(() => {
    const byCode = new Map();
    (shipRows || []).forEach((row) => {
      const code = String(row?.ship_code || '').trim();
      if (!code) return;
      byCode.set(code, String(row?.ship_name || code).trim());
    });
    (cells || []).forEach((cell) => {
      const code = String(cell?.ship_code || '').trim();
      if (!code) return;
      if (!byCode.has(code)) byCode.set(code, String(cell?.ship_name || code).trim());
    });
    return [...byCode.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shipRows, cells]);

  const loading = capacityLoading || shipLoading || inventoryLoading || masterLoading || bookingLoading
    || occupancyLoading || cabinCtgLoading;
  const error = capacityError || shipError || inventoryError || masterError || bookingError || cabinCtgError
    || (grain === PRESSURE_GRAINS.CABIN ? occupancyError : null);

  const handleRefresh = () => {
    refetchCapacity();
    refetchShips();
    refetchInventory();
    refetchMaster();
    refetchBooking();
    refetchOccupancy();
    refetchCabinCtg();
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading ship × day pressure..."
      error={error}
      errorTitle="Failed to load Ship × Day Pressure"
      empty={!bundle?.columns || bundle.columns.length === 0 || !bundle?.rows || bundle.rows.length === 0}
      emptyMessage={grain === PRESSURE_GRAINS.CABIN
        ? 'No cabin occupancy in this date window'
        : 'No ship-day capacity in this date window'}
      onRetry={handleRefresh}
    >
      <ShipDayPressurePresenter
        bundle={bundle}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={handleDateFromChange}
        onDateToChange={handleDateToChange}
        grain={grain}
        onGrainChange={setGrain}
        shipFilter={shipFilter}
        onShipFilterChange={setGlobalShipCode}
        shipOptions={shipOptions}
        cabinCategoryMode={cabinCategoryMode}
        cabinCategoryModeOverride={cabinCategoryModeOverride}
        onCabinCategoryModeChange={setCabinCategoryModeOverride}
        globalCabinCategoryMode={globalCabinCategoryMode}
        demandUnit={demandUnit}
        selectedScope={selectedScope}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default ShipDayPressureContainer;
