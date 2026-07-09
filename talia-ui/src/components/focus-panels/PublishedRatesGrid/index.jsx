/**
 * Published Rates Grid Container
 * Listens to sail selection and loads published rate lines (current warehouse snapshot per rate_key).
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PublishedRatesGridPresenter from './PublishedRatesGridPresenter';
import PanelDataState from '../../shared/PanelDataState';
import { extractSailCodeFromEvent, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const PublishedRatesGridContainer = ({ panelInstanceId, panelComponentId }) => {
  // Use current_state (same as Published Rates). published_rates_changes is sparse (audit log only).
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'published_rates_current_state',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const sailCode = extractSailCodeFromEvent(detail);
      return sailCode ? { sail_code: sailCode } : null;
    },
    fetchWithoutContext: false,
    limit: 2000
  });

  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);

  const normalizedData = React.useMemo(() => {
    if (!selectedSailCode) return [];
    return (data || [])
      .filter((row) => {
        const rowSail = row.sail_code || row.SAIL_CODE || null;
        return rowSail === selectedSailCode;
      })
      .map((row) => {
        const promoName = row.promo_name || row.PROMO_NAME || '';
        const promoNormalized = promoName && String(promoName).trim()
          ? String(promoName).trim()
          : 'No Promo';
        return {
          SNAPSHOT_DATE: row.snapshot_date || row.SNAPSHOT_DATE,
          SAIL_CODE: row.sail_code || row.SAIL_CODE,
          SHIP_CODE: row.ship_code || row.SHIP_CODE,
          PACKAGE_NAME: row.package_name || row.PACKAGE_NAME,
          REGION: row.region || row.REGION,
          RATE_TYPE: row.rate_type || row.RATE_TYPE,
          SAIL_DAYS: row.sail_days || row.SAIL_DAYS,
          DEPARTURE_DATE: row.departure_date || row.DEPARTURE_DATE,
          CABIN_CATEGORY: row.cabin_category || row.CABIN_CATEGORY,
          PROMO_NAME: promoName,
          PROMO_NAME_NORMALIZED: promoNormalized,
          PROMO_TYPE: row.promo_type || row.PROMO_TYPE,
          CURRENCY_CODE: row.currency_code || row.CURRENCY_CODE,
          FARE_PER_PERSON: row.fare_per_person ?? row.FARE_PER_PERSON,
          PORT_TAXES_SERVICES: row.port_taxes_services ?? row.PORT_TAXES_SERVICES,
          EXTRA_ADULT: row.extra_adult ?? row.EXTRA_ADULT,
          EXTRA_CHILD: row.extra_child ?? row.EXTRA_CHILD,
          DISCOUNT: row.discount ?? row.DISCOUNT,
          ...row
        };
      });
  }, [data, selectedSailCode]);

  // Tab header shows refresh; only block panel content before first selection.
  const isInitialLoad = loading && !selectedSailCode;

  return (
    <PanelDataState
      loading={isInitialLoad}
      loadingMessage="Loading published rates grid..."
      error={error}
      errorTitle="Failed to load published rates grid"
      empty={selectedSailCode && !loading && (!normalizedData || normalizedData.length === 0)}
      emptyMessage={
        selectedSailCode
          ? `No published rate history found for sail code: ${selectedSailCode}`
          : 'Select a sailing to view published rates.'
      }
      onRetry={selectedSailCode ? refetch : null}
    >
      <PublishedRatesGridPresenter data={normalizedData} selectedSailCode={selectedSailCode} />
    </PanelDataState>
  );
};

export default PublishedRatesGridContainer;
