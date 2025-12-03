/**
 * Competitor Pricing Container Component
 * Displays competitor pricing data with scatter plots and detailed table
 */

import React from 'react';
import { useCompetitorPricing } from '../../../hooks/data/useCompetitorPricing';
import CompetitorPricingPresenter from './CompetitorPricingPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const CompetitorPricingContainer = ({ theme }) => {
  // Default filters - can be made configurable later
  const [filters, setFilters] = React.useState({
    currency: 'EUR',
    duration: null,
    destination: null, // Start with null to show all destinations, user can filter
    cabinType: 'ALL',
    departureMonth: null,
    isLatest: true,
    cruiseLine: null,
    market: null
  });

  const { data, loading, error, refetch } = useCompetitorPricing(filters);

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading competitor pricing data..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load competitor pricing data"
        onRetry={refetch}
      />
    );
  }

  // Render competitor pricing with data
  return (
    <CompetitorPricingPresenter 
      data={data || []}
      filters={filters}
      onFiltersChange={setFilters}
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default CompetitorPricingContainer;

