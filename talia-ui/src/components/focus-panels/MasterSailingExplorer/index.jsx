import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { useGlobalBookedComposition } from '../../../hooks/useGlobalBookedComposition';
import { useGlobalMarketDimension } from '../../../hooks/useGlobalMarketDimension';
import {
  allocScopeKey,
  indexAllocRowsByShipDate,
} from '../../../lib/bookedComposition';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import profileCompareService from '../../../services/data/profileCompareService';
import PanelDataState from '../../shared/PanelDataState';
import { indexDistributionBundlesBySailCode } from '../Distribution/distributionTransform';
import MasterSailingExplorerPresenter from './MasterSailingExplorerPresenter';
import { buildMasterSailingExplorerBundle } from './masterSailingExplorerTransform';

const MASTER_SAIL_FILTERS = { is_main: 1 };
const INVENTORY_FILTERS = { is_operational: true };

const SHIP_DAY_CAPACITY_COLUMNS = [
  'ship_code',
  'sail_code',
  'date',
  'berth_capacity',
  'berths_occupied',
  'berths_available',
  'total_cabins',
  'occupied_cabins',
  'available_cabins',
  'nameplate_cabins',
  'nameplate_berths',
  'offsale_cabins',
  'offsale_berths',
  'sellable_cabins',
  'sellable_berths',
];

const BOOKING_SUMMARY_COLUMNS = [
  'sail_code',
  'guest_count',
  'booked_guests',
  'contracted_guests',
  'estimated_guests',
  'guaranteed_cabins',
];

const RESERVATION_DISTRIBUTION_COLUMNS = [
  'sail_code',
  'agency_id',
  'group_id',
  'guest_count',
  'pax_type',
];

const AGENCY_COLUMNS = [
  'agency_id',
  'agency_type',
  'market',
];

const MARKET_ROLL_UP_COLUMNS = [
  'agency_market',
  'new_budget_roll_up',
  'active_record_flag',
];

const ALLOC_COLUMNS = [
  'ship_code',
  'sail_date_from',
  'allocation_owner_type',
  'inventory_request_type',
  'occupancy',
  'probability',
];

const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const MasterSailingExplorerContainer = ({ panelInstanceId, panelComponentId }) => {
  const marketDimension = useGlobalMarketDimension();
  const bookedComposition = useGlobalBookedComposition();
  const [distributionEnabled, setDistributionEnabled] = useState(false);

  const enableDistribution = useCallback(() => {
    setDistributionEnabled(true);
  }, []);

  useEffect(() => {
    const onSailSelect = () => setDistributionEnabled(true);
    window.addEventListener(SAIL_SELECT_EVENT, onSailSelect);
    return () => window.removeEventListener(SAIL_SELECT_EVENT, onSailSelect);
  }, []);

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
    data: bookingSummaryRows,
    loading: bookingSummaryLoading,
    error: bookingSummaryError,
    refetch: refetchBookingSummary,
  } = useTableDataWithContext({
    tableName: 'sail_booking_summary',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    columns: BOOKING_SUMMARY_COLUMNS,
    limit: 5000,
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
    tableName: 'ship_day_capacity',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    columns: SHIP_DAY_CAPACITY_COLUMNS,
    limit: 60000,
  });

  // Distribution / hover payload — deferred until hover or sail.select.
  const {
    data: reservationCurrentStateRows,
    loading: reservationLoading,
    refetch: refetchReservations,
  } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    columns: RESERVATION_DISTRIBUTION_COLUMNS,
    limit: 150000,
    enabled: distributionEnabled,
  });

  const {
    data: agencies,
    loading: agenciesLoading,
    refetch: refetchAgencies,
  } = useTableDataWithContext({
    tableName: 'agency',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    columns: AGENCY_COLUMNS,
    limit: 50000,
    enabled: distributionEnabled,
  });

  const {
    data: marketRollUpRows,
    loading: marketRollUpLoading,
    refetch: refetchMarketRollUp,
  } = useTableDataWithContext({
    tableName: 'market_roll_up',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    columns: MARKET_ROLL_UP_COLUMNS,
    limit: 5000,
    enabled: distributionEnabled,
  });

  const {
    data: allocationRows,
    loading: allocLoading,
    refetch: refetchAlloc,
  } = useTableDataWithContext({
    tableName: 'ship_inventory_alloc',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    columns: ALLOC_COLUMNS,
    limit: 150000,
    enabled: distributionEnabled,
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
      bookingSummaryRows,
      hierarchyRows: filteredHierarchyRows,
      shipDayBerthRows,
    }),
    [
      masterSailRows,
      inventoryRows,
      bookingSummaryRows,
      filteredHierarchyRows,
      shipDayBerthRows,
    ]
  );

  const distributionBySailCode = useMemo(() => {
    if (!distributionEnabled) return new Map();
    const masters = explorerBundle?.masters || [];
    if (!masters.length || !(agencies || []).length) return new Map();
    if (!(reservationCurrentStateRows || []).length) return new Map();

    const sailCodeList = [];
    const capacityBySail = new Map();
    const filterSailCodesBySail = new Map();
    const masterScopeBySail = new Map();
    const allocByScope = indexAllocRowsByShipDate(allocationRows || []);

    masters.forEach((master) => {
      const masterCode = String(master?.sail_code || '').trim();
      if (!masterCode) return;
      sailCodeList.push(masterCode);
      capacityBySail.set(masterCode, master?.total_capacity ?? null);
      const segmentCodes = (master?.segment_codes || [])
        .map((code) => String(code || '').trim())
        .filter(Boolean);
      filterSailCodesBySail.set(masterCode, [masterCode, ...segmentCodes]);
      const scopeKey = allocScopeKey(master?.ship_code, toDateKey(master?.sail_date_from));
      if (scopeKey) {
        masterScopeBySail.set(masterCode, { scopeKey });
      }
    });

    return indexDistributionBundlesBySailCode({
      reservations: reservationCurrentStateRows || [],
      agencies: agencies || [],
      marketRollUp: marketRollUpRows || [],
      sailCodeList,
      capacityBySail,
      filterSailCodesBySail,
      marketDimension,
      bookedComposition,
      allocRowsByScope: allocByScope,
      masterScopeBySail,
    });
  }, [
    agencies,
    allocationRows,
    bookedComposition,
    distributionEnabled,
    explorerBundle?.masters,
    marketDimension,
    marketRollUpRows,
    reservationCurrentStateRows,
  ]);

  const loading = masterLoading
    || inventoryLoading
    || bookingSummaryLoading
    || hierarchyLoading
    || shipDayLoading;
  const error = masterError
    || inventoryError
    || bookingSummaryError
    || hierarchyError
    || shipDayError;

  const [reviewBySail, setReviewBySail] = useState(() => new Map());

  useEffect(() => {
    const masters = explorerBundle?.masters || [];
    if (!masters.length) {
      setReviewBySail(new Map());
      return undefined;
    }
    let cancelled = false;
    const sailCodes = masters
      .map((m) => String(m?.sail_code || '').trim())
      .filter(Boolean)
      .slice(0, 120);
    const actualLfPctBySail = {};
    masters.forEach((m) => {
      const code = String(m?.sail_code || '').trim();
      if (!code || m?.actual_booked_pct == null) return;
      actualLfPctBySail[code] = Number(m.actual_booked_pct);
    });

    (async () => {
      try {
        // Pass actuals via query isn't supported server-side yet — client merges gap using local LF.
        const statuses = await profileCompareService.fetchReviewStatuses(sailCodes);
        if (cancelled) return;
        const map = new Map();
        statuses.forEach((s) => {
          const code = String(s.sailCode || '').trim();
          if (!code) return;
          const actual = actualLfPctBySail[code] ?? s.actualLfPct;
          const target = s.targetLfPct;
          let status = s.status;
          let gapPp = s.gapPp;
          if (actual != null && target != null) {
            gapPp = Math.round((actual - target) * 100) / 100;
            if (gapPp < -3) status = 'behind';
            else if (gapPp > 3) status = 'ahead';
            else status = 'on';
          }
          map.set(code, {
            ...s,
            actualLfPct: actual,
            gapPp,
            status,
          });
          if (s.referenceSailCode) map.set(String(s.referenceSailCode), map.get(code));
        });
        setReviewBySail(map);
      } catch (err) {
        console.warn('[MSE] profile review statuses:', err?.message || err);
        if (!cancelled) setReviewBySail(new Map());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [explorerBundle?.masters]);

  const mastersWithReview = useMemo(() => {
    const masters = explorerBundle?.masters || [];
    if (!reviewBySail.size) return masters;
    return masters.map((m) => {
      const code = String(m?.sail_code || '').trim();
      const review = reviewBySail.get(code);
      if (!review) return m;
      return {
        ...m,
        target_review_status: review.status,
        target_lf_pct: review.targetLfPct,
        target_gap_pp: review.gapPp,
        target_profile_name: review.activeTargetName,
      };
    });
  }, [explorerBundle?.masters, reviewBySail]);

  const handleRefresh = () => {
    refetchMasterSail();
    refetchInventory();
    refetchBookingSummary();
    refetchHierarchy();
    refetchShipDay();
    if (distributionEnabled) {
      refetchReservations();
      refetchAgencies();
      refetchMarketRollUp();
      refetchAlloc();
    }
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
        masters={mastersWithReview}
        dayDetailsByMaster={explorerBundle.dayDetailsByMaster}
        distributionBySailCode={distributionBySailCode}
        distributionLoading={
          distributionEnabled
          && (reservationLoading || agenciesLoading || marketRollUpLoading || allocLoading)
        }
        onDistributionIntent={enableDistribution}
        marketDimension={marketDimension}
        bookedComposition={bookedComposition}
        onRefresh={handleRefresh}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default MasterSailingExplorerContainer;
