import React, { Suspense, lazy, useState } from 'react';
import AdminDashboard from '../dashboard/AdminDashboard.jsx';
import ErrorBoundary from '../../ErrorBoundary.jsx';
import '../admin.css';

const DataManagementUnavailable = () => (
  <div className="admin-lite__unavailable">
    Data Management is currently unavailable.
  </div>
);

const DataManagementPage = lazy(() =>
  import('../data-management/DataManagementPage.jsx').catch(() => ({
    default: DataManagementUnavailable
  }))
);

const AdminLite = () => {
  const [activeTab, setActiveTab] = useState('admin');

  return (
    <div className="admin-lite">
      <div className="admin-lite__header">
        <div className="admin-lite__title">Admin Lite (Local)</div>
        <div className="admin-lite__subtitle">
          Minimal local admin access — no auth, dev only.
        </div>
        <div className="admin-lite__tabs">
          <button
            onClick={() => setActiveTab('admin')}
            className="admin-lite__tab"
            data-active={activeTab === 'admin'}
          >
            Admin
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className="admin-lite__tab"
            data-active={activeTab === 'data'}
          >
            Data Management
          </button>
        </div>
      </div>

      <div className="admin-lite__content">
        {activeTab === 'admin' ? (
          <div className="admin-lite__panel">
            <AdminDashboard skipAuth />
          </div>
        ) : (
          <ErrorBoundary fallback={<DataManagementUnavailable />}>
            <Suspense fallback={<DataManagementUnavailable />}>
              <DataManagementPage />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default AdminLite;
