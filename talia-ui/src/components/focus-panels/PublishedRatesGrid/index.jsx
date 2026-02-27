/**
 * Published Rates Grid Container
 * Listens to sail selection and fetches published rates history for one sailing.
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PublishedRatesGridPresenter from './PublishedRatesGridPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const PublishedRatesGridContainer = () => {
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'published_rates_changes',
    eventName: SAIL_SELECT_EVENT,
    contextMapper: (detail) => {
      const sailCode = detail?.sail_code || detail?.Sail_Code || detail?.row_data?.sail_code || (typeof detail === 'string' ? detail : null);
      return sailCode ? { sail_code: sailCode } : null;
    },
    limit: 2000
  });

  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);

  React.useEffect(() => {
    const handleRefresh = (event) => {
      if (event?.detail?.panelId === 'published-rates-grid') {
        refetch();
      }
    };
    window.addEventListener('talia:report.refresh', handleRefresh);
    return () => {
      window.removeEventListener('talia:report.refresh', handleRefresh);
    };
  }, [refetch]);

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

  if (loading) {
    return <LoadingSpinner message="Loading published rates grid..." fullScreen={false} />;
  }

  if (error) {
    return (
      <ErrorMessage
        error={error}
        title="Failed to load published rates grid"
        onRetry={refetch}
      />
    );
  }

  if (!selectedSailCode) {
    return (
      <div className="focus-panel-empty">
        <p>Select a sailing to view published rates.</p>
      </div>
    );
  }

  if (!normalizedData || normalizedData.length === 0) {
    return (
      <div className="focus-panel-empty">
        <p>No published rate history found for sail code: {selectedSailCode}</p>
        <div className="focus-panel-empty__action">
          <button onClick={refetch} className="talia-btn talia-btn--primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <PublishedRatesGridPresenter
      data={normalizedData}
      selectedSailCode={selectedSailCode}
      onRefresh={refetch}
    />
  );
};

export default PublishedRatesGridContainer;
