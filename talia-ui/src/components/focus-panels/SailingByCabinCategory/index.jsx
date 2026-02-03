import React, { useEffect } from 'react';
import SailingByCabinCategoryPresenter from './SailingByCabinCategoryPresenter';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import queryTracker from '../../../services/data/queryTracker';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const SailingByCabinCategory = () => {
  const { data, loading, error, context } = useTableDataWithContext({
    tableName: 'sail_by_cabin_occupancy',
    eventName: SAIL_SELECT_EVENT,
    contextMapper: (detail) => {
      const sailCode = detail?.sail_code || detail?.Sail_Code || (typeof detail === 'string' ? detail : null);
      return sailCode ? { sail_code: sailCode } : null;
    },
    limit: 1000
  });

  useEffect(() => {
    if (data && data.length > 0 && !loading) {
      const query = `
        query GetTableData($tableName: String!, $limit: Int, $filters: TableDataFilters) {
          tableData(tableName: $tableName, limit: $limit, filters: $filters)
        }
      `;
      const filters = context
        ? { sail_code: context.sail_code || context.row_data?.sail_code || (typeof context === 'string' ? context : null) }
        : {};
      const trackQuery = queryTracker.trackQuery({
        query,
        variables: { tableName: 'sail_by_cabin_occupancy', limit: 1000, filters },
        component: 'SailingByCabinCategory',
        purpose: 'Fetch cabin occupancy data'
      });
      trackQuery({ data });
    }
  }, [data, context, loading]);

  if (loading) {
    return <LoadingSpinner message="Loading cabin occupancy data..." />;
  }

  if (error) {
    return <ErrorMessage error={error} title="Error loading cabin occupancy data" />;
  }

  if (!data || data.length === 0) {
    const emptyMessage = context
      ? 'No cabin occupancy data found for the selected sail.'
      : 'Select a sail to view cabin occupancy data.';
    return (
      <div className="talia-empty" role="status">
        <span className="talia-empty__icon" aria-hidden="true">🚢</span>
        <h3 className="talia-empty__title">No data available</h3>
        <p className="talia-empty__message">{emptyMessage}</p>
      </div>
    );
  }

  return <SailingByCabinCategoryPresenter data={data} context={context} />;
};

export default SailingByCabinCategory;
