/**
 * Admin Dashboard Component
 * Shows system administration tools including user mappings and Talia users
 */

import React from 'react';
import UserMappingTable from '../users/UserMappingTable';
import TaliaUserTable from '../users/TaliaUserTable';
import AdminAccessManager from './AdminAccessManager';
import AdminThemesPanel from './AdminThemesPanel';
import AdminRoleCriteriaPanel from './AdminRoleCriteriaPanel';
import AdminLogsPanel from '../logs/AdminLogsPanel';
import { useTaliaFocusManagement } from '../../../hooks/useTaliaFocusManagement';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { VIEW_ADMIN_SECTION } from '../../../lib/componentOptionsCatalog';
import '../admin.css';

const ADMIN_SECTIONS = VIEW_ADMIN_SECTION.choices;

const AdminDashboard = ({
  skipAuth = false,
  panelInstanceId = null,
  panelComponentId = 'admin-dashboard',
}) => {
  const { taliaUser, isAdmin } = useTaliaFocusManagement();
  const { viewsState, setView, reportShellClassName } = useReportShellOptions(
    panelComponentId,
    panelInstanceId
  );
  const storedSection = viewsState?.section;
  const activeTab = ADMIN_SECTIONS.includes(storedSection) ? storedSection : VIEW_ADMIN_SECTION.default;
  const selectSection = (section) => setView('section', section);

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
    <div className={`talia-report admin-dashboard-panel ${reportShellClassName}`.trim()} role="region" aria-label="Admin dashboard">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Admin Dashboard</h2>
          <p className="talia-report__subtitle">
            Focus access, users, mappings, themes, and logs
            {taliaUser?.email ? ` · Signed in as ${taliaUser.email}` : ''}
          </p>
        </div>
      </header>

      <div className="talia-report__controls admin-tabs admin-dashboard-panel__tabs" aria-label="Admin dashboard sections">
        <button className={`admin-tab ${activeTab === 'access' ? 'admin-tab-active' : ''}`} onClick={() => selectSection('access')}>
          Focus Access
        </button>
        <button className={`admin-tab ${activeTab === 'users' ? 'admin-tab-active' : ''}`} onClick={() => selectSection('users')}>
          Talia Users
        </button>
        <button className={`admin-tab ${activeTab === 'mapping' ? 'admin-tab-active' : ''}`} onClick={() => selectSection('mapping')}>
          User Mappings
        </button>
        <button className={`admin-tab ${activeTab === 'themes' ? 'admin-tab-active' : ''}`} onClick={() => selectSection('themes')}>
          Themes
        </button>
        <button className={`admin-tab ${activeTab === 'role-criteria' ? 'admin-tab-active' : ''}`} onClick={() => selectSection('role-criteria')}>
          Role Criteria
        </button>
        <button className={`admin-tab ${activeTab === 'logs' ? 'admin-tab-active' : ''}`} onClick={() => selectSection('logs')}>
          Logs
        </button>
      </div>

      <main className="talia-report__content admin-dashboard-panel__content">
        {activeTab === 'access' && (
          <AdminAccessManager
            panelInstanceId={panelInstanceId}
            panelComponentId={panelComponentId}
          />
        )}
        {activeTab === 'users' && <TaliaUserTable />}
        {activeTab === 'mapping' && <UserMappingTable />}
        {activeTab === 'themes' && <AdminThemesPanel />}
        {activeTab === 'role-criteria' && <AdminRoleCriteriaPanel />}
        {activeTab === 'logs' && <AdminLogsPanel />}
      </main>
    </div>
  );
};

export default AdminDashboard;
