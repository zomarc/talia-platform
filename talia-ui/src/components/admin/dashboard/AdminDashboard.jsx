/**
 * Admin Dashboard Component
 * Shows system administration tools including user mappings and Talia users
 */

import React, { useState } from 'react';
import UserMappingTable from '../users/UserMappingTable';
import TaliaUserTable from '../users/TaliaUserTable';
import AdminAccessManager from './AdminAccessManager';
import AdminThemesPanel from './AdminThemesPanel';
import AdminLogsPanel from '../logs/AdminLogsPanel';
import { useTaliaFocusManagement } from '../../../hooks/useTaliaFocusManagement';
import '../admin.css';

const AdminDashboard = ({ skipAuth = false }) => {
  const { taliaUser, isAdmin } = useTaliaFocusManagement();
  const [activeTab, setActiveTab] = useState('access');

  if (!skipAuth && !isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-access-denied">
          <h2>Access Denied</h2>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="talia-report admin-dashboard-panel" role="region" aria-label="Admin dashboard">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Admin Dashboard</h2>
          <p className="talia-report__subtitle">Focus access, users, mappings, themes, and logs</p>
        </div>
        <div className="talia-report__header-right admin-dashboard-panel__identity">
          <span>{taliaUser?.email || 'Unknown user'}</span>
        </div>
      </header>

      <div className="admin-tabs admin-dashboard-panel__tabs">
        <button className={`admin-tab ${activeTab === 'access' ? 'admin-tab-active' : ''}`} onClick={() => setActiveTab('access')}>
          Focus Access
        </button>
        <button className={`admin-tab ${activeTab === 'users' ? 'admin-tab-active' : ''}`} onClick={() => setActiveTab('users')}>
          Talia Users
        </button>
        <button className={`admin-tab ${activeTab === 'mapping' ? 'admin-tab-active' : ''}`} onClick={() => setActiveTab('mapping')}>
          User Mappings
        </button>
        <button className={`admin-tab ${activeTab === 'themes' ? 'admin-tab-active' : ''}`} onClick={() => setActiveTab('themes')}>
          Themes
        </button>
        <button className={`admin-tab ${activeTab === 'logs' ? 'admin-tab-active' : ''}`} onClick={() => setActiveTab('logs')}>
          Logs
        </button>
      </div>

      <main className="talia-report__content admin-dashboard-panel__content">
        {activeTab === 'access' && <AdminAccessManager />}
        {activeTab === 'users' && <TaliaUserTable />}
        {activeTab === 'mapping' && <UserMappingTable />}
        {activeTab === 'themes' && <AdminThemesPanel />}
        {activeTab === 'logs' && <AdminLogsPanel />}
      </main>
    </div>
  );
};

export default AdminDashboard;
