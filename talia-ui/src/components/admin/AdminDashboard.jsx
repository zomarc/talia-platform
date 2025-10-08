/**
 * Admin Dashboard Component
 * Shows system administration tools including user mappings and Talia users
 */

import React, { useState } from 'react';
import UserMappingTable from './UserMappingTable';
import TaliaUserTable from './TaliaUserTable';
import FocusManager from '../focus-management/FocusManager';
import { useTaliaFocusManagement } from '../../hooks/useTaliaFocusManagement';

const AdminDashboard = () => {
  const { taliaUser, isAdmin } = useTaliaFocusManagement();
  const [activeTab, setActiveTab] = useState('mapping');

  if (!isAdmin) {
    return (
      <div style={styles.container}>
        <div style={styles.accessDenied}>
          <h2>Access Denied</h2>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Talia Administration</h1>
        <div style={styles.userInfo}>
          Logged in as: <strong>{taliaUser?.email}</strong> (Talia User ID: <strong>{taliaUser?.taliaUserId}</strong>)
        </div>
      </div>

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'mapping' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('mapping')}
        >
          User Mappings
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'users' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('users')}
        >
          Talia Users
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'focus' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('focus')}
        >
          Focus Management
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'mapping' && <UserMappingTable />}
        {activeTab === 'users' && <TaliaUserTable />}
        {activeTab === 'focus' && <FocusManager />}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #2E86AB'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2E86AB',
    marginBottom: '8px'
  },
  userInfo: {
    fontSize: '14px',
    color: '#6C757D'
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid #dee2e6'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#6C757D',
    transition: 'all 0.3s ease'
  },
  activeTab: {
    color: '#2E86AB',
    borderBottomColor: '#2E86AB'
  },
  content: {
    marginTop: '20px'
  },
  accessDenied: {
    padding: '60px 20px',
    textAlign: 'center',
    backgroundColor: '#f8d7da',
    borderRadius: '8px',
    border: '1px solid #f5c6cb',
    color: '#721c24'
  }
};

export default AdminDashboard;
