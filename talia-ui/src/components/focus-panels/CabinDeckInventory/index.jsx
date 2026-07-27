/**
 * Cabin Deck Inventory — sail-scoped cabin grid by deck/category with ownership status.
 * Prefers sail_date_from from the sail.select payload; falls back to master_sail.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTableDataWithContext, buildContextFiltersKey } from '../../../hooks/data/useTableDataWithContext';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import PanelDataState from '../../shared/PanelDataState';
import {
  mapSailCodesToReservationFilters,
  resolveReferenceSailCodeFromDetail,
  resolveSailCodesFromDetail,
} from '../Agency/agencyDirectoryContext';
import CabinDeckInventoryPresenter from './CabinDeckInventoryPresenter';
import { buildCabinDeckInventoryBundle } from './cabinDeckInventoryTransform';

const ALLOC_LIMIT = 20000;
const CABIN_LIMIT = 20000;
const OCCUPANCY_LIMIT = 50000;
const RESERVATION_LIMIT = 50000;

const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const mapSailToShipFilters = (detail) => {
  const shipCode = detail?.canonical_scope?.ship_code
    || detail?.ship_code
    || null;
  if (!shipCode) return null;
  return { ship_code: String(shipCode).trim() };
};

const resolveSailDateFromDetail = (detail) => (
  toDateKey(
    detail?.row_data?.sail_date_from
    || detail?.row_data?.master_voyage_departure_date
    || detail?.sail_date_from
    || detail?.canonical_scope?.sail_date_from
    || null
  )
);

const detectTruncation = (rows, limit, source) => {
  const count = Array.isArray(rows) ? rows.length : 0;
  if (!limit || count <= 0 || count < limit) return null;
  return {
    hit: true,
    source,
    row_count: count,
    limit,
    message: `${source}: GraphQL row limit reached (${count.toLocaleString()} / ${limit.toLocaleString()}). Counts may be incomplete.`,
  };
};

const CabinDeckInventoryContainer = ({ panelInstanceId, panelComponentId }) => {
  const {
    data: masterSailRows,
    loading: masterLoading,
    error: masterError,
    context: sailContext,
  } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const reference = resolveReferenceSailCodeFromDetail(detail)
        || resolveSailCodesFromDetail(detail)[0]
        || null;
      return reference ? { sail_code: reference } : null;
    },
    fetchWithoutContext: false,
    limit: 20,
  });

  const sailCodes = useMemo(
    () => resolveSailCodesFromDetail(sailContext),
    [sailContext]
  );
  const referenceSailCode = useMemo(
    () => resolveReferenceSailCodeFromDetail(sailContext),
    [sailContext]
  );
  const shipCode = sailContext?.canonical_scope?.ship_code
    || sailContext?.ship_code
    || null;
  const shipName = sailContext?.canonical_scope?.ship_name
    || sailContext?.ship_name
    || null;

  const sailDateFrom = useMemo(() => {
    const fromEvent = resolveSailDateFromDetail(sailContext);
    if (fromEvent) return fromEvent;
    const rows = masterSailRows || [];
    const match = referenceSailCode
      ? rows.find((row) => String(row?.sail_code || '').trim() === String(referenceSailCode).trim())
      : rows[0];
    return toDateKey(match?.sail_date_from || rows[0]?.sail_date_from || null);
  }, [masterSailRows, referenceSailCode, sailContext]);

  const hasSailSelection = Boolean(sailContext) && Boolean(shipCode);
  const allocReady = hasSailSelection && Boolean(sailDateFrom);

  const mapAllocFilters = useMemo(() => (
    (detail) => {
      const ship = detail?.canonical_scope?.ship_code || detail?.ship_code || null;
      const date = sailDateFrom || resolveSailDateFromDetail(detail);
      if (!ship || !date) return null;
      return {
        ship_code: String(ship).trim(),
        sail_date_from: date,
      };
    }
  ), [sailDateFrom]);

  const {
    data: allocationRows,
    loading: allocLoading,
    error: allocError,
    loadedFiltersKey: allocLoadedKey,
    refetch: refetchAlloc,
  } = useTableDataWithContext({
    tableName: 'ship_inventory_alloc',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapAllocFilters,
    fetchWithoutContext: false,
    enabled: allocReady,
    limit: ALLOC_LIMIT,
  });

  const {
    data: shipCabinRows,
    loading: cabinLoading,
    error: cabinError,
  } = useTableDataWithContext({
    tableName: 'ship_cabin',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailToShipFilters,
    fetchWithoutContext: false,
    limit: CABIN_LIMIT,
  });

  const {
    data: cabinCategoryLinkRows,
    loading: linkLoading,
    error: linkError,
  } = useTableDataWithContext({
    tableName: 'ship_cabin_ctg_link',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailToShipFilters,
    fetchWithoutContext: false,
    limit: CABIN_LIMIT,
  });

  const {
    data: occupancyRows,
    loading: occupancyLoading,
    error: occupancyError,
  } = useTableDataWithContext({
    tableName: 'sail_by_cabin_occupancy',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const reference = resolveReferenceSailCodeFromDetail(detail)
        || resolveSailCodesFromDetail(detail)[0]
        || null;
      return reference ? { sail_code: reference } : null;
    },
    fetchWithoutContext: false,
    limit: OCCUPANCY_LIMIT,
  });

  const {
    data: reservationRows,
    loading: reservationsLoading,
    error: reservationsError,
  } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail)),
    fetchWithoutContext: false,
    limit: RESERVATION_LIMIT,
  });

  const expectedAllocKey = useMemo(
    () => (allocReady
      ? buildContextFiltersKey(sailContext, mapAllocFilters)
      : null),
    [allocReady, mapAllocFilters, sailContext]
  );
  const allocScopePending = allocReady
    && expectedAllocKey
    && allocLoadedKey !== expectedAllocKey;

  // When sail_date_from arrives after sail.select, the alloc hook may have missed the event.
  const lastNudgedKeyRef = useRef(null);
  const [allocFetchAttempts, setAllocFetchAttempts] = useState(0);
  useEffect(() => {
    if (!allocReady || !expectedAllocKey) {
      lastNudgedKeyRef.current = null;
      setAllocFetchAttempts(0);
      return undefined;
    }
    if (allocLoadedKey === expectedAllocKey) {
      lastNudgedKeyRef.current = expectedAllocKey;
      setAllocFetchAttempts(0);
      return undefined;
    }
    if (allocLoading) return undefined;

    if (lastNudgedKeyRef.current !== expectedAllocKey) {
      lastNudgedKeyRef.current = expectedAllocKey;
      setAllocFetchAttempts(1);
      refetchAlloc?.();
      return undefined;
    }

    if (allocFetchAttempts < 2) {
      setAllocFetchAttempts((n) => n + 1);
      refetchAlloc?.();
    }
    return undefined;
  }, [
    allocReady,
    allocLoadedKey,
    expectedAllocKey,
    allocLoading,
    allocFetchAttempts,
    refetchAlloc,
  ]);

  const allocScopeStuck = Boolean(
    allocScopePending
    && !allocLoading
    && lastNudgedKeyRef.current === expectedAllocKey
    && allocFetchAttempts >= 2
  );

  const truncations = useMemo(() => ([
    detectTruncation(allocationRows, ALLOC_LIMIT, 'ship_inventory_alloc'),
    detectTruncation(shipCabinRows, CABIN_LIMIT, 'ship_cabin'),
    detectTruncation(cabinCategoryLinkRows, CABIN_LIMIT, 'ship_cabin_ctg_link'),
    detectTruncation(occupancyRows, OCCUPANCY_LIMIT, 'sail_by_cabin_occupancy'),
    detectTruncation(reservationRows, RESERVATION_LIMIT, 'reservation_current_state'),
  ].filter(Boolean)), [
    allocationRows,
    cabinCategoryLinkRows,
    occupancyRows,
    reservationRows,
    shipCabinRows,
  ]);

  // Empties-first: render cabin shell while alloc catches up. Never paint stale alloc for another sail.
  const scopedAllocationRows = allocScopePending ? [] : (allocationRows || []);

  const bundle = useMemo(() => {
    if (!hasSailSelection || !shipCode) return null;
    if (!sailDateFrom && (masterLoading || !(masterSailRows?.length))) return null;
    if (cabinLoading && !(shipCabinRows?.length)) return null;
    if (!(shipCabinRows?.length) && !(scopedAllocationRows?.length) && (cabinLoading || allocLoading || allocScopePending)) {
      return null;
    }
    return buildCabinDeckInventoryBundle({
      allocationRows: scopedAllocationRows,
      shipCabinRows: shipCabinRows || [],
      cabinCategoryLinkRows: cabinCategoryLinkRows || [],
      occupancyRows: occupancyRows || [],
      reservationRows: reservationRows || [],
      shipCode,
      sailCode: referenceSailCode,
      sailDateFrom,
      truncations,
    });
  }, [
    allocLoading,
    allocScopePending,
    cabinCategoryLinkRows,
    cabinLoading,
    hasSailSelection,
    masterLoading,
    masterSailRows,
    occupancyRows,
    referenceSailCode,
    reservationRows,
    sailDateFrom,
    scopedAllocationRows,
    shipCabinRows,
    shipCode,
    truncations,
  ]);

  const coreLoading = hasSailSelection && !bundle && (
    (!sailDateFrom && masterLoading)
    || (!sailDateFrom && !masterError)
    || cabinLoading
    || linkLoading
    || ((allocLoading || allocScopePending) && !(shipCabinRows?.length) && !allocScopeStuck)
  );
  const hardError = allocError || cabinError || linkError || masterError
    || (allocScopeStuck
      ? new Error('Cabin allocations did not load for this sailing. Try refresh or re-select the sail.')
      : null);
  const softErrors = [occupancyError, reservationsError].filter(Boolean);

  return (
    <PanelDataState
      loading={false}
      error={hardError}
      errorTitle="Failed to load cabin deck inventory"
      empty={false}
    >
      <CabinDeckInventoryPresenter
        bundle={bundle}
        hasSailSelection={hasSailSelection}
        scopeLoading={Boolean(coreLoading)}
        selectedSailCodes={sailCodes}
        selectedReferenceSailCode={referenceSailCode}
        shipCode={shipCode}
        shipName={shipName}
        sailDateFrom={sailDateFrom}
        truncations={truncations}
        softErrors={softErrors}
        reconciliationLoading={Boolean(occupancyLoading || reservationsLoading)}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default CabinDeckInventoryContainer;
