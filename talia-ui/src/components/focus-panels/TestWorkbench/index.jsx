import React, { Suspense } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { GraphQLUtils } from '../../../lib/apolloClient';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';

const TestPage = React.lazy(() => import('../../TestPage'));

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

  return (
    <Suspense fallback={<div className="talia-unavailable">Loading Test Workbench...</div>}>
      <TestPage embedded={true} />
    </Suspense>
  );
};

export default TestWorkbenchPanel;
