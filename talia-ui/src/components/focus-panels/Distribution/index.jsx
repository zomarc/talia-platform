/**
 * Distribution Container — sail-scoped guest mix aligned with reservation profile.
 * Selection arrives only via talia:sail.select on the message bus.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTableDataWithContext, buildContextFiltersKey } from '../../../hooks/data/useTableDataWithContext';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { useGlobalBookedComposition } from '../../../hooks/useGlobalBookedComposition';
import { useGlobalCommercialTargets } from '../../../hooks/useGlobalCommercialTargets';
import { useGlobalMarketDimension } from '../../../hooks/useGlobalMarketDimension';
import {
  COMMERCIAL_VOYAGE_COLUMNS,
  buildCommercialDistribution,
} from '../../../lib/commercialBookTargets';
import PanelDataState from '../../shared/PanelDataState';
import {
  mapSailCodesToReservationFilters,
  resolveReferenceSailCodeFromDetail,
  resolveSailCodesFromDetail,
} from '../Agency/agencyDirectoryContext';
import DistributionPresenter from './DistributionPresenter';
import { buildDistributionBundle } from './distributionTransform';

const mapSailContextToReservationFilters = (detail) => (
  mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail))
);

const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
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

const DistributionContainer = ({ panelInstanceId, panelComponentId }) => {
  const marketDimension = useGlobalMarketDimension();
  const bookedComposition = useGlobalBookedComposition();
  const commercialEnabled = useGlobalCommercialTargets();

  const {
    data: agencies,
    loading: agenciesLoading,
    error: agenciesError,
  } = useTableDataWithContext({
    tableName: 'agency',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 50000,
  });

  const {
    data: marketRollUpRows,
    loading: marketRollUpLoading,
    error: marketRollUpError,
  } = useTableDataWithContext({
    tableName: 'market_roll_up',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 5000,
  });

  // Same fact table as Reservation booking curve (not snapshot current_state).
  const {
    data: reservationRows,
    loading: reservationsLoading,
    error: reservationsError,
    context: sailContext,
    loadedFiltersKey,
  } = useTableDataWithContext({
    tableName: 'reservation',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 50000,
  });

  const {
    data: occupancyRows,
    loading: occupancyLoading,
    error: occupancyError,
  } = useTableDataWithContext({
    tableName: 'ship_day_capacity',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 20000,
  });

  const {
    data: masterSailRows,
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
  const sailDateFrom = useMemo(() => {
    const fromEvent = resolveSailDateFromDetail(sailContext);
    if (fromEvent) return fromEvent;
    const rows = masterSailRows || [];
    const match = referenceSailCode
      ? rows.find((row) => String(row?.sail_code || '').trim() === String(referenceSailCode).trim())
      : rows[0];
    return toDateKey(match?.sail_date_from || rows[0]?.sail_date_from || null);
  }, [masterSailRows, referenceSailCode, sailContext]);

  const hasSailSelection = Boolean(sailContext) && sailCodes.length > 0;
  const allocReady = hasSailSelection && Boolean(shipCode) && Boolean(sailDateFrom);

  // Prefer ship/date from the sail.select payload; fall back to master_sail date only.
  // Stay subscribed on the bus (no enabled toggle) — mapper null ⇒ hook waits, no unfiltered fetch.
  const mapAllocFilters = useMemo(() => (
    (detail) => {
      const ship = detail?.canonical_scope?.ship_code
        || detail?.ship_code
        || detail?.row_data?.ship_code
        || null;
      const date = resolveSailDateFromDetail(detail) || sailDateFrom;
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
    limit: 20000,
  });

  const expectedFiltersKey = useMemo(
    () => (hasSailSelection
      ? buildContextFiltersKey(sailContext, mapSailContextToReservationFilters)
      : null),
    [hasSailSelection, sailContext]
  );
  const scopePending = hasSailSelection
    && expectedFiltersKey
    && loadedFiltersKey !== expectedFiltersKey;

  const expectedAllocKey = useMemo(
    () => (allocReady
      ? buildContextFiltersKey(sailContext, mapAllocFilters)
      : null),
    [allocReady, mapAllocFilters, sailContext]
  );
  const allocScopePending = allocReady
    && expectedAllocKey
    && allocLoadedKey !== expectedAllocKey;

  // When sail_date_from arrives via master_sail after sail.select, nudge one refetch.
  const lastNudgedAllocKeyRef = useRef(null);
  const [allocFetchAttempts, setAllocFetchAttempts] = useState(0);
  useEffect(() => {
    if (!allocReady || !expectedAllocKey) {
      lastNudgedAllocKeyRef.current = null;
      setAllocFetchAttempts(0);
      return undefined;
    }
    if (allocLoadedKey === expectedAllocKey) {
      lastNudgedAllocKeyRef.current = expectedAllocKey;
      setAllocFetchAttempts(0);
      return undefined;
    }
    if (allocLoading) return undefined;

    if (lastNudgedAllocKeyRef.current !== expectedAllocKey) {
      lastNudgedAllocKeyRef.current = expectedAllocKey;
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
    && lastNudgedAllocKeyRef.current === expectedAllocKey
    && allocFetchAttempts >= 2
  );

  const scopedAllocationRows = (allocScopePending && !allocScopeStuck) ? [] : (allocationRows || []);

  const bundle = useMemo(
    () => buildDistributionBundle({
      reservations: hasSailSelection && !scopePending ? (reservationRows || []) : [],
      agencies: agencies || [],
      marketRollUp: marketRollUpRows || [],
      occupancyRows: hasSailSelection ? (occupancyRows || []) : [],
      allocRows: hasSailSelection && allocReady ? scopedAllocationRows : [],
      sailCodes,
      referenceSailCode,
      marketDimension,
      bookedComposition,
    }),
    [
      agencies,
      scopedAllocationRows,
      allocReady,
      bookedComposition,
      hasSailSelection,
      marketDimension,
      marketRollUpRows,
      occupancyRows,
      referenceSailCode,
      reservationRows,
      sailCodes,
      scopePending,
    ]
  );

  const {
    data: commercialVoyageRows,
    error: commercialError,
  } = useTableDataWithContext({
    tableName: 'commercial_book_target_voyage',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const code = resolveReferenceSailCodeFromDetail(detail)
        || resolveSailCodesFromDetail(detail)[0]
        || null;
      if (!code) return null;
      return {
        query_column: 'master_voyage',
        query_operator: 'eq',
        query_value: code,
      };
    },
    fetchWithoutContext: false,
    enabled: commercialEnabled,
    limit: 20000,
    columns: COMMERCIAL_VOYAGE_COLUMNS,
  });

  const commercialCompare = useMemo(() => {
    if (!commercialEnabled || !hasSailSelection) return null;
    return buildCommercialDistribution(commercialVoyageRows, { marketDimension });
  }, [commercialEnabled, commercialVoyageRows, hasSailSelection, marketDimension]);

  const loading = agenciesLoading
    || marketRollUpLoading
    || (hasSailSelection && (
      reservationsLoading
      || occupancyLoading
      || scopePending
      || (allocReady && (allocLoading || (allocScopePending && !allocScopeStuck)))
    ));
  const error = agenciesError
    || marketRollUpError
    || reservationsError
    || occupancyError
    || allocError;

  return (
    <PanelDataState
      loading={agenciesLoading || marketRollUpLoading}
      loadingMessage="Loading agency and market roll-up..."
      error={error}
      errorTitle="Failed to load distribution data"
      empty={false}
    >
      <DistributionPresenter
        bundle={bundle}
        hasSailSelection={hasSailSelection}
        scopeLoading={Boolean(loading && hasSailSelection)}
        selectedSailCodes={sailCodes}
        selectedReferenceSailCode={referenceSailCode}
        marketDimension={marketDimension}
        commercialCompare={commercialCompare}
        commercialError={commercialEnabled ? commercialError : null}
        bookedComposition={bookedComposition}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default DistributionContainer;
