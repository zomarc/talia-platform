/**
 * Data Match Container Component
 * Shows data completeness overview - which tables have data for which sails
 */

import React, { useState } from 'react';
import { useDataMatch } from '../../../hooks/data/useDataMatch';
import DataMatchPresenter from './DataMatchPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const DataMatchContainer = ({ theme: themeProp }) => {
  const [filters, setFilters] = useState({
    ship_code: null,
    sail_code: null,
    date_from: null,
    date_to: null
  });

  const { data, loading, error, refetch } = useDataMatch(filters);

  // Use theme prop if provided, otherwise use default
  const theme = themeProp || { colors: { foreground: '#ffffff', background: '#1a1a1a' } };

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
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: theme?.colors?.foreground || '#ffffff'
      }}>
        <p>No data match information available</p>
        <button 
          onClick={refetch}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: theme?.colors?.accent || '#b08d57',
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
    <DataMatchPresenter 
      data={data}
      filters={filters}
      onFiltersChange={setFilters}
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default DataMatchContainer;

