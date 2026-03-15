/**
 * Template Container Component
 * Handles data fetching and state management
 * 
 * STANDARD PATTERN: Use useTableDataWithContext for server-side filtering based on event bus context
 * 
 * TO USE THIS TEMPLATE:
 * 1. Copy this folder and rename it to your component name
 * 2. Replace "Template" with your component name throughout
 * 3. Update tableName to match your database table
 * 4. Update eventName if listening to different events (default: 'talia:sail.select')
 * 5. Update contextMapper to extract the correct filter fields from event detail
 * 6. Update the presenter props to match your data structure
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import TemplatePresenter from './TemplatePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { extractSailCodeFromEvent } from '../../../lib/eventBus';
const TemplateContainer = ({ panelInstanceId, panelComponentId }) => {
  console.log('[TemplateContainer] Component rendering');
  
  // Use reusable hook for context-based data fetching with server-side filtering
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'your_table_name', // TODO: Replace with your table name
    eventName: 'talia:sail.select', // TODO: Update if listening to different events
    contextMapper: (detail) => {
      // TODO: Extract filter fields from event detail
      // Example: Extract sail_code for filtering
      const sailCode = extractSailCodeFromEvent(detail);
      console.log('[TemplateContainer] Mapped context to filters:', { sail_code: sailCode });
      return sailCode ? { sail_code: sailCode } : null;
      // TODO: Add other filter fields as needed (e.g., ship_code, cabin_category, etc.)
    },
    limit: 1000 // TODO: Adjust limit as needed
  });

  // Extract context values for display
  const selectedSailCode = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);
  // TODO: Extract other context values as needed

  console.log('[TemplateContainer] State:', { loading, error: error?.message, dataLength: data?.length, selectedSailCode });

  // Transform data if needed (e.g., uppercase field names, computed fields)
  // TODO: Remove if not needed, or customize for your data structure
  const transformedData = data || [];

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
  if (!transformedData || transformedData.length === 0) {
    return (
      <div className="focus-panel-empty">
        <p>
          {selectedSailCode 
            ? `No data found for selected context`
            : 'No data available'}
        </p>
        <div className="focus-panel-empty__action">
          <button 
            className="talia-btn talia-btn--primary"
            onClick={refetch}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render presenter with data
  return (
    <TemplatePresenter 
      data={transformedData} 
      onRefresh={refetch}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
      // TODO: Pass additional props as needed
    />
  );
};

export default TemplateContainer;
