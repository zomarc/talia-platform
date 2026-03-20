import React from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { GraphQLUtils } from '../../../lib/apolloClient';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import { DataManagementPanelCore } from '../../admin/data-management/DataManagementPage';

const DataManagementPanel = ({ skipAuth = false }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || GraphQLUtils.getUserRole() || 'USER');
  const allowed = canAccessPrivilegedPanels(role);

  if (!skipAuth && !allowed) {
    return (
      <div className="talia-unavailable">
        Data Management requires ADMIN or SUPER_USER privileges.
      </div>
    );
  }

  return <DataManagementPanelCore embedded={true} />;
};

export default DataManagementPanel;
