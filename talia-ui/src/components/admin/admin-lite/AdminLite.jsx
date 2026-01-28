import React, { Suspense, lazy, useState } from 'react';
import AdminDashboard from '../dashboard/AdminDashboard.jsx';
import ErrorBoundary from '../../ErrorBoundary.jsx';

const DataManagementUnavailable = () => (
  <div style={{ padding: '16px', fontSize: '12px', color: '#c7c7d1' }}>
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
    <div style={{ minHeight: '100vh', background: '#0f0f23', color: '#e7e7ef' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Admin Lite (Local)</div>
        <div style={{ fontSize: '12px', color: '#9ea0b5' }}>
          Minimal local admin access — no auth, dev only.
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => setActiveTab('admin')}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: activeTab === 'admin' ? '#b08d57' : 'transparent',
              color: activeTab === 'admin' ? '#0f0f23' : '#e7e7ef',
              cursor: 'pointer'
            }}
          >
            Admin
          </button>
          <button
            onClick={() => setActiveTab('data')}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: activeTab === 'data' ? '#b08d57' : 'transparent',
              color: activeTab === 'data' ? '#0f0f23' : '#e7e7ef',
              cursor: 'pointer'
            }}
          >
            Data Management
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {activeTab === 'admin' ? (
          <div style={{ background: '#ffffff', color: '#0f0f23', borderRadius: '8px' }}>
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
