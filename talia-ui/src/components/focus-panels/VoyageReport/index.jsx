/**
 * Voyage Report Container
 * 
 * LIGHTWEIGHT CONTAINER TEMPLATE
 * 
 * Responsibilities:
 * - Data fetching (via useTableDataWithContext)
 * - Data transformation
 * - Loading/error state rendering
 * - Pass clean data to presenter
 * 
 * Uses CSS classes from components.css for states.
 */

import React, { useMemo } from 'react';
import VoyageReportPresenter from './VoyageReportPresenter';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { transformVoyageData } from '../MasterVoyagePerformanceSummary/utils/dataTransformation';

const VoyageReportContainer = () => {
  // Fetch data
  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    contextMapper: () => null,
    limit: 1000
  });

  // Transform data
  const transformedData = useMemo(() => {
    if (!data?.length) return [];
    return transformVoyageData(data);
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="talia-loading" role="status" aria-live="polite">
        <div className="talia-loading__spinner" aria-hidden="true" />
        <span className="talia-loading__text">Loading voyage data...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="talia-error" role="alert">
        <span className="talia-error__icon" aria-hidden="true">⚠️</span>
        <h3 className="talia-error__title">Error Loading Data</h3>
        <p className="talia-error__message">{error.message}</p>
        <button className="talia-btn" onClick={refetch}>
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (!transformedData.length) {
    return (
      <div className="talia-empty" role="status">
        <span className="talia-empty__icon" aria-hidden="true">📊</span>
        <h3 className="talia-empty__title">No Data Available</h3>
        <p className="talia-empty__message">
          No voyage data found. Try adjusting your filters or check back later.
        </p>
        <button className="talia-btn" onClick={refetch}>
          Refresh
        </button>
      </div>
    );
  }

  // Render presenter
  return (
    <VoyageReportPresenter
      data={transformedData}
      onRefresh={refetch}
    />
  );
};

export default VoyageReportContainer;
