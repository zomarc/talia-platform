/**
 * Data Match Container Component
 * Shows data completeness overview - which tables have data for which sails
 */

import React, { useState } from 'react';
import { useDataMatch } from '../../../hooks/data/useDataMatch';
import DataMatchPresenter from './DataMatchPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const DataMatchContainer = ({ panelInstanceId, panelComponentId }) => {
  const [filters, setFilters] = useState({
    ship_code: null,
    sail_code: null,
    date_from: null,
    date_to: null
  });

  const { data, loading, error, refetch } = useDataMatch(filters, {
    panelInstanceId,
    panelComponentId
  });

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading data match information..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load data match information"
        onRetry={refetch}
      />
    );
  }

  // Handle empty data
  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="focus-panel-empty">
        <p>No data match information available</p>
        <div className="focus-panel-empty__action">
          <button className="talia-btn talia-btn--primary" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  // Render presenter with data
  return (
    <DataMatchPresenter 
      data={data}
      filters={filters}
      onFiltersChange={setFilters}
      onRefresh={refetch}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default DataMatchContainer;

