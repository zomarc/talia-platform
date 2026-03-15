/**
 * Published Rates Container Component
 * Handles data fetching and state management
 * Uses useTableDataWithContext for server-side filtering based on event bus context
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PublishedRatesPresenter from './PublishedRatesPresenter';
import PanelDataState from '../../shared/PanelDataState';
import { extractSailCodeFromEvent, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const PublishedRatesContainer = () => {
  // Use reusable hook for context-based data fetching with server-side filtering
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'published_rates_current_state',
    eventName: SAIL_SELECT_EVENT,
    contextMapper: (detail) => {
      const sailCode = extractSailCodeFromEvent(detail);
      return sailCode ? { sail_code: sailCode } : null;
    },
    limit: 1000
  });

  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);

  React.useEffect(() => {
    const handleRefresh = (event) => {
      if (event?.detail?.panelId === 'published-rates') {
        refetch();
      }
    };
    window.addEventListener('talia:report.refresh', handleRefresh);
    return () => {
      window.removeEventListener('talia:report.refresh', handleRefresh);
    };
  }, [refetch]);

  // Transform data to match expected format (uppercase field names) if needed
  const transformedData = data && data.length > 0 ? data.map(row => ({
    SNAPSHOT_DATE: row.snapshot_date,
    SAIL_CODE: row.sail_code,
    SHIP_CODE: row.ship_code,
    PACKAGE_NAME: row.package_name,
    REGION: row.region,
    RATE_TYPE: row.rate_type,
    SAIL_DAYS: row.sail_days,
    DEPARTURE_DATE: row.departure_date,
    CABIN_CATEGORY: row.cabin_category,
    PROMO_NAME: row.promo_name,
    PROMO_TYPE: row.promo_type,
    CURRENCY_CODE: row.currency_code,
    FARE_PER_PERSON: row.fare_per_person,
    PORT_TAXES_SERVICES: row.port_taxes_services,
    EXTRA_ADULT: row.extra_adult,
    EXTRA_CHILD: row.extra_child,
    DISCOUNT: row.discount,
    // Keep original fields too for compatibility
    ...row
  })) : [];

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading published rates..."
      error={error}
      errorTitle="Failed to load published rates"
      empty={!transformedData || transformedData.length === 0}
      emptyMessage={
        selectedSailCode
          ? `No published rates found for sail code: ${selectedSailCode}`
          : 'No published rates data available'
      }
      onRetry={refetch}
    >
      <PublishedRatesPresenter 
        data={transformedData} 
        selectedSailCode={selectedSailCode}
      />
    </PanelDataState>
  );
};

export default PublishedRatesContainer;
