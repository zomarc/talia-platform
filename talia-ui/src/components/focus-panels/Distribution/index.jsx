/**
 * Distribution Container — sail-scoped guest mix by channel and market.
 */

import React, { useMemo } from 'react';
import { useTableDataWithContext, buildContextFiltersKey } from '../../../hooks/data/useTableDataWithContext';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';
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

const DistributionContainer = ({ panelInstanceId, panelComponentId }) => {
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

  const {
    data: reservationRows,
    loading: reservationsLoading,
    error: reservationsError,
    context: sailContext,
    loadedFiltersKey,
  } = useTableDataWithContext({
    tableName: 'reservation_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToReservationFilters,
    fetchWithoutContext: false,
    limit: 50000,
  });

  const sailCodes = useMemo(
    () => resolveSailCodesFromDetail(sailContext),
    [sailContext]
  );
  const referenceSailCode = useMemo(
    () => resolveReferenceSailCodeFromDetail(sailContext),
    [sailContext]
  );
  const hasSailSelection = Boolean(sailContext) && sailCodes.length > 0;
  const expectedFiltersKey = useMemo(
    () => (hasSailSelection
      ? buildContextFiltersKey(sailContext, mapSailContextToReservationFilters)
      : null),
    [hasSailSelection, sailContext]
  );
  const scopePending = hasSailSelection
    && expectedFiltersKey
    && loadedFiltersKey !== expectedFiltersKey;

  const bundle = useMemo(
    () => buildDistributionBundle({
      reservations: hasSailSelection && !scopePending ? (reservationRows || []) : [],
      agencies: agencies || [],
      marketRollUp: marketRollUpRows || [],
    }),
    [agencies, hasSailSelection, marketRollUpRows, reservationRows, scopePending]
  );

  const loading = agenciesLoading
    || marketRollUpLoading
    || (hasSailSelection && (reservationsLoading || scopePending));
  const error = agenciesError || marketRollUpError || reservationsError;

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
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default DistributionContainer;
