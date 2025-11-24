/**
 * Template Container Component
 * Handles data fetching and state management
 * 
 * TO USE THIS TEMPLATE:
 * 1. Copy this folder and rename it to your component name
 * 2. Replace "Template" with your component name throughout
 * 3. Update the GraphQL query in useQuery
 * 4. Update the presenter props to match your data structure
 */

import React from 'react';
import { useQuery } from '@apollo/client';
import TemplatePresenter from './TemplatePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

// TODO: Replace with your GraphQL query
const GET_TEMPLATE_DATA = `
  query GetTemplateData {
    # Add your query here
  }
`;

const TemplateContainer = ({ filters = {}, theme }) => {
  const { data, loading, error, refetch } = useQuery(GET_TEMPLATE_DATA, {
    variables: filters,
    fetchPolicy: 'cache-and-network'
  });

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading data..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load data"
        onRetry={refetch}
      />
    );
  }

  // Handle empty data
  const tableData = data?.yourQueryField || [];
  if (!tableData || tableData.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No data available</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  // Render presenter with data
  return (
    <TemplatePresenter 
      data={tableData} 
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default TemplateContainer;

