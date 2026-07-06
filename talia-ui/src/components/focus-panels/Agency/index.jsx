/**
 * Agency Container — dwh.Dim_Agency dimension table
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import AgencyPresenter from './AgencyPresenter';
import PanelDataState from '../../shared/PanelDataState';

const reservationSelect = 'talia:reservation.select';

const AgencyContainer = ({ panelInstanceId, panelComponentId }) => {
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'agency',
    eventName: reservationSelect,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => {
      const agencyId = detail?.row_data?.agency_id ?? detail?.agency_id;
      if (agencyId === undefined || agencyId === null || agencyId === '') {
        return null;
      }
      return {
        query_column: 'agency_id',
        query_value: String(agencyId),
        query_operator: 'eq'
      };
    },
    fetchWithoutContext: true,
    limit: 50000
  });

  const selectedAgencyId = context?.query_value || context?.row_data?.agency_id || null;

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading agencies..."
      error={error}
      errorTitle="Failed to load agencies"
      empty={!data || data.length === 0}
      emptyMessage={
        selectedAgencyId
          ? `No agency found for ID ${selectedAgencyId}`
          : 'No agency data available. Sync dwh.Dim_Agency from Data Management.'
      }
      onRetry={refetch}
    >
      <AgencyPresenter
        data={data}
        onRefresh={refetch}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default AgencyContainer;
