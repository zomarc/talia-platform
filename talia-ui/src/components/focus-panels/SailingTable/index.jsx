/**
 * Sailing Table Container Component
 * Uses useTableDataWithContext for consistent data fetching pattern
 * Shows all master_sail data, emits events when rows are selected
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import SailingTablePresenter from './SailingTablePresenter';
import PanelDataState from '../../shared/PanelDataState';
const SailingTableContainer = () => {
  // Use reusable hook for context-based data fetching
  // Note: SailingTable shows all data (no filtering), but emits events when rows are selected
  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null, // Don't filter - show all sail data
    contextMapper: () => null, // No filtering
    limit: 1000
  });

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading sailing data..."
      error={error}
      errorTitle="Failed to load sailing data"
      empty={!data || data.length === 0}
      emptyMessage="No sailing data available"
      onRetry={refetch}
    >
      <SailingTablePresenter data={data} onRefresh={refetch} />
    </PanelDataState>
  );
};

export default SailingTableContainer;

