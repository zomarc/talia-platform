/**
 * Admin Dashboard Component
 * Shows system administration tools including user mappings and Talia users
 */

import React, { useState } from 'react';
import UserMappingTable from '../users/UserMappingTable';
import TaliaUserTable from '../users/TaliaUserTable';
import FocusManager from '../../focus-management/FocusManager';
import { useTaliaFocusManagement } from '../../../hooks/useTaliaFocusManagement';
import '../admin.css';

const AdminDashboard = ({ skipAuth = false }) => {
  const { taliaUser, isAdmin } = useTaliaFocusManagement();
  const [activeTab, setActiveTab] = useState('mapping');

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
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Talia Administration</h1>
        <div className="admin-page-subtitle">
          Logged in as: <strong>{taliaUser?.email}</strong> (Talia User ID: <strong>{taliaUser?.taliaUserId}</strong>)
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'mapping' ? 'admin-tab-active' : ''}`}
          onClick={() => setActiveTab('mapping')}
        >
          User Mappings
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'admin-tab-active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Talia Users
        </button>
        <button
          className={`admin-tab ${activeTab === 'focus' ? 'admin-tab-active' : ''}`}
          onClick={() => setActiveTab('focus')}
        >
          Focus Management
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'mapping' && <UserMappingTable />}
        {activeTab === 'users' && <TaliaUserTable />}
        {activeTab === 'focus' && <FocusManager />}
      </div>
    </div>
  );
};

export default AdminDashboard;
