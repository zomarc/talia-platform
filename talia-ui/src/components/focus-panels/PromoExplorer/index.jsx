/**
 * Promo Explorer — sail-scoped promo risk / activity container.
 */

import React, { useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import { emitSailSelect, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import PanelDataState from '../../shared/PanelDataState';
import {
  mapSailCodesToReservationFilters,
  resolveReferenceSailCodeFromDetail,
  resolveSailCodesFromDetail,
} from '../Agency/agencyDirectoryContext';
import PromoExplorerPresenter from './PromoExplorerPresenter';
import {
  buildPromoExplorerRows,
  buildPromoExplorerSnapshot,
} from './promoExplorerTransform';

const mapSailContextToFilters = (detail) => (
  mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail))
);

const PromoExplorerContainer = ({ panelInstanceId, panelComponentId }) => {
  const [selectedPromoKey, setSelectedPromoKey] = useState(null);

  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'published_rates_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailContextToFilters,
    fetchWithoutContext: false,
    limit: 5000,
  });

  const shipCode = String(
    context?.canonical_scope?.ship_code
    || context?.ship_code
    || context?.row_data?.ship_code
    || ''
  ).trim();

  const {
    data: relatedRates,
    loading: relatedLoading,
  } = useTableDataWithContext({
    tableName: 'published_rates_current_state',
    panelInstanceId,
    panelComponentId,
    filters: shipCode ? { ship_code: shipCode } : null,
    fetchWithoutContext: Boolean(shipCode),
    enabled: Boolean(shipCode),
    limit: 8000,
  });

  const selectedSailCode = resolveReferenceSailCodeFromDetail(context)
    || resolveSailCodesFromDetail(context)[0]
    || null;

  const rateUniverse = useMemo(() => {
    const primary = Array.isArray(data) ? data : [];
    const related = Array.isArray(relatedRates) ? relatedRates : [];
    if (!related.length) return primary;
    const seen = new Set();
    const merged = [];
    [...primary, ...related].forEach((row) => {
      const key = [
        row.sail_code,
        row.promo_name,
        row.cabin_category,
        row.rate_type,
        row.fare_per_person,
      ].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(row);
    });
    return merged;
  }, [data, relatedRates]);

  const rows = useMemo(
    () => buildPromoExplorerRows(rateUniverse, { selectedSailCode }),
    [rateUniverse, selectedSailCode]
  );
  const snapshot = useMemo(() => buildPromoExplorerSnapshot(rows), [rows]);

  useReportPanelLoading(
    panelInstanceId,
    panelComponentId,
    loading || relatedLoading
  );

  const handleSelectPromo = (row) => {
    setSelectedPromoKey(row?.promo_key || null);
  };

  const handleSelectRelatedSail = (sailCode) => {
    const code = String(sailCode || '').trim();
    if (!code) return;
    emitSailSelect({
      sail_code: code,
      reference_sail_code: code,
      selection_origin: 'promo-explorer',
      row_data: { sail_code: code },
    });
  };

  return (
    <PanelDataState
      loading={Boolean(selectedSailCode) && loading && rows.length === 0}
      loadingMessage="Loading promos…"
      error={error}
      errorTitle="Failed to load promos"
      empty={!selectedSailCode || (!loading && rows.length === 0)}
      emptyMessage={
        selectedSailCode
          ? `No promos found for ${selectedSailCode}`
          : 'Select a sailing to review promotions.'
      }
      onRetry={selectedSailCode ? refetch : null}
    >
      <PromoExplorerPresenter
        rows={rows}
        snapshot={snapshot}
        selectedSailCode={selectedSailCode}
        selectedPromoKey={selectedPromoKey}
        onSelectPromo={handleSelectPromo}
        onSelectRelatedSail={handleSelectRelatedSail}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'promo-explorer'}
      />
    </PanelDataState>
  );
};

export default PromoExplorerContainer;
