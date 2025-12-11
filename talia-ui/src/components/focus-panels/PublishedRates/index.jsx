/**
 * Published Rates Container Component
 * Handles data fetching and state management
 * Uses useTableDataWithContext for server-side filtering based on event bus context
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PublishedRatesPresenter from './PublishedRatesPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const PublishedRatesContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  
  console.log('[PublishedRatesContainer] Component rendering');
  
  // Use reusable hook for context-based data fetching with server-side filtering
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'published_rates_current_state',
    eventName: 'talia:sail.select',
    contextMapper: (detail) => {
      // Extract sail_code from event detail (supports multiple formats)
      const sailCode = detail?.sail_code || detail?.Sail_Code || detail?.row_data?.sail_code || (typeof detail === 'string' ? detail : null);
      console.log('[PublishedRatesContainer] Mapped context to filters:', { sail_code: sailCode });
      return sailCode ? { sail_code: sailCode } : null;
    },
    limit: 1000
  });

  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);

  console.log('[PublishedRatesContainer] State:', { loading, error: error?.message, dataLength: data?.length, selectedSailCode });

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

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading published rates..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load published rates"
        onRetry={refetch}
      />
    );
  }

  // Handle empty data
  if (!transformedData || transformedData.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: 'var(--theme-fg)'
      }}>
        <p>
          {selectedSailCode 
            ? `No published rates found for sail code: ${selectedSailCode}`
            : 'No published rates data available'}
        </p>
        <button 
          onClick={refetch}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: 'var(--theme-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Render presenter with data
  return (
    <PublishedRatesPresenter 
      data={transformedData} 
      theme={theme}
      onRefresh={refetch}
      selectedSailCode={selectedSailCode}
    />
  );
};

export default PublishedRatesContainer;
