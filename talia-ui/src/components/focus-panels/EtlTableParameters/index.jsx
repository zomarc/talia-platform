/**
 * ETL Table Parameters — local mirror of config.ETL_Table_Parameters.
 * Read-only admin view of upstream source→target ETL mappings.
 */

import React from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PanelDataState from '../../shared/PanelDataState';
import EtlTableParametersPresenter from './EtlTableParametersPresenter';

const EtlTableParametersContainer = ({ panelInstanceId, panelComponentId }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const allowed = canAccessPrivilegedPanels(role);

  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'etl_table_parameters',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 5000,
  });

  if (!allowed) {
    return (
      <div className="focus-panel-empty">
        <p>Admin or Super User access required to view ETL table parameters.</p>
      </div>
    );
  }

  const rows = Array.isArray(data) ? data : [];

  // Keep the presenter mounted once rows exist so refresh does not tear down Tabulator.
  return (
    <PanelDataState
      loading={loading && rows.length === 0}
      loadingMessage="Loading ETL table parameters..."
      error={error && rows.length === 0 ? error : null}
      errorTitle="Failed to load ETL table parameters"
      empty={!loading && !error && rows.length === 0}
      emptyMessage="No ETL table parameters synced yet. Sync etl_table_parameters from Data Management."
      onRetry={refetch}
    >
      <EtlTableParametersPresenter
        data={rows}
        onRefresh={refetch}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default EtlTableParametersContainer;
