import type { InstantRules } from '@instantdb/react';

const rules: InstantRules = {
  // Users can view their own profile and other active users
  users: {
    allow: {
      view: 'auth.id != null && (auth.id == data.id || data.isActive == true)',
      create: 'auth.id != null',
      update: 'auth.id == data.id || (auth.id != null && data.role == "admin")',
      delete: 'auth.id == data.id || (auth.id != null && data.role == "admin")'
    }
  },
  
  // Roles are viewable by all authenticated users
  roles: {
    allow: {
      view: 'auth.id != null',
      create: 'auth.id != null && data.role == "admin"',
      update: 'auth.id != null && data.role == "admin"',
      delete: 'auth.id != null && data.role == "admin"'
    }
  },
  
  // Users can manage their own layouts
  layouts: {
    allow: {
      view: 'auth.id != null && (auth.id == data.userId || data.isShared == true)',
      create: 'auth.id != null && auth.id == data.userId',
      update: 'auth.id != null && auth.id == data.userId',
      delete: 'auth.id != null && auth.id == data.userId'
    }
  },
  
  // Sessions are private to each user
  sessions: {
    allow: {
      view: 'auth.id != null && auth.id == data.userId',
      create: 'auth.id != null && auth.id == data.userId',
      update: 'auth.id != null && auth.id == data.userId',
      delete: 'auth.id != null && auth.id == data.userId'
    }
  }
};

export default rules;
