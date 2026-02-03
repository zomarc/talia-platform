import React from 'react';
import SimpleTablePresenter from './SimpleTablePresenter';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const SimpleTable = () => {
  const { data, loading, error } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    contextMapper: () => null,
    limit: 1000
  });

  if (loading) {
    return <LoadingSpinner message="Loading master sail data..." />;
  }

  if (error) {
    return <ErrorMessage error={error} title="Error loading master sail data" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="talia-empty" role="status">
        <span className="talia-empty__icon" aria-hidden="true">📋</span>
        <h3 className="talia-empty__title">No data available</h3>
        <p className="talia-empty__message">No master sail data found.</p>
      </div>
    );
  }

  return <SimpleTablePresenter data={data} />;
};

export default SimpleTable;
