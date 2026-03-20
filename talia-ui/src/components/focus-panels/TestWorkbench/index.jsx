import React from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { GraphQLUtils } from '../../../lib/apolloClient';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import { TestWorkbenchPanelCore } from '../../TestPage';

const TestWorkbenchPanel = ({ skipAuth = false }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || GraphQLUtils.getUserRole() || 'USER');
  const allowed = canAccessPrivilegedPanels(role);

  if (!skipAuth && !allowed) {
    return (
      <div className="talia-unavailable">
        Test Workbench requires ADMIN or SUPER_USER privileges.
      </div>
    );
  }

  return <TestWorkbenchPanelCore embedded={true} />;
};

export default TestWorkbenchPanel;
