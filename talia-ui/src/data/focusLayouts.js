// Focus-specific layout definitions
export const FOCUS_LAYOUTS = {
  performance: {
    name: 'Performance Dashboard',
    description: 'Monitor real-time revenue performance',
    panels: [
      { id: 'sailings-table', component: 'table', title: 'Sailings' },
      { id: 'kpi-cards', component: 'kpi-cards', title: 'Key Performance Indicators' },
      { id: 'occupancy-chart', component: 'occupancy-chart', title: 'Weekly Occupancy & Revenue' },
      { id: 'revenue-breakdown', component: 'revenue-breakdown', title: 'Revenue Breakdown' },
      { id: 'exception-list', component: 'exception-list', title: 'Active Exceptions' }
    ]
  },
  
  exception: {
    name: 'Exception Management',
    description: 'Monitor and manage exceptions',
    panels: [
      { id: 'exception-list', component: 'exception-list', title: 'Active Exceptions' },
      { id: 'exception-chart', component: 'chart', title: 'Exception Trends' },
      { id: 'exception-details', component: 'panel', title: 'Exception Details' }
    ],
    layout: {
      type: 'horizontal',
      structure: [
        { id: 'exception-list', position: { x: 0, y: 0, width: 4, height: 12 } },
        { id: 'exception-chart', position: { x: 4, y: 0, width: 4, height: 6 } },
        { id: 'exception-details', position: { x: 8, y: 0, width: 4, height: 12 } }
      ]
    }
  },
  
  itinerary: {
    name: 'Itinerary Management',
    description: 'Manage cruise itineraries and schedules',
    panels: [
      { id: 'itinerary-list', component: 'itinerary-list', title: 'Itinerary List' },
      { id: 'itinerary-map', component: 'chart', title: 'Route Map' },
      { id: 'schedule-timeline', component: 'table', title: 'Schedule Timeline' }
    ],
    layout: {
      type: 'vertical',
      structure: [
        { id: 'itinerary-list', position: { x: 0, y: 0, width: 12, height: 4 } },
        { id: 'itinerary-map', position: { x: 0, y: 4, width: 6, height: 4 } },
        { id: 'schedule-timeline', position: { x: 6, y: 4, width: 6, height: 4 } }
      ]
    }
  },
  
  group: {
    name: 'Group Management',
    description: 'Manage group bookings and reservations',
    panels: [
      { id: 'group-list', component: 'table', title: 'Group List' },
      { id: 'group-details', component: 'panel', title: 'Group Details' },
      { id: 'group-chart', component: 'chart', title: 'Group Analytics' }
    ],
    layout: {
      type: 'grid',
      structure: [
        { id: 'group-list', position: { x: 0, y: 0, width: 6, height: 6 } },
        { id: 'group-details', position: { x: 6, y: 0, width: 6, height: 6 } },
        { id: 'group-chart', position: { x: 0, y: 6, width: 12, height: 6 } }
      ]
    }
  },
  
  promotion: {
    name: 'Promotion Management',
    description: 'Manage promotional campaigns and offers',
    panels: [
      { id: 'promotion-list', component: 'table', title: 'Active Promotions' },
      { id: 'promotion-performance', component: 'chart', title: 'Promotion Performance' },
      { id: 'promotion-calendar', component: 'panel', title: 'Promotion Calendar' }
    ],
    layout: {
      type: 'horizontal',
      structure: [
        { id: 'promotion-list', position: { x: 0, y: 0, width: 4, height: 12 } },
        { id: 'promotion-performance', position: { x: 4, y: 0, width: 4, height: 6 } },
        { id: 'promotion-calendar', position: { x: 8, y: 0, width: 4, height: 12 } }
      ]
    }
  },
  
  inventory: {
    name: 'Inventory Management',
    description: 'Manage cabin inventory and availability',
    panels: [
      { id: 'inventory-grid', component: 'table', title: 'Cabin Inventory' },
      { id: 'availability-chart', component: 'chart', title: 'Availability Chart' },
      { id: 'inventory-alerts', component: 'panel', title: 'Inventory Alerts' }
    ],
    layout: {
      type: 'grid',
      structure: [
        { id: 'inventory-grid', position: { x: 0, y: 0, width: 8, height: 8 } },
        { id: 'availability-chart', position: { x: 8, y: 0, width: 4, height: 4 } },
        { id: 'inventory-alerts', position: { x: 8, y: 4, width: 4, height: 4 } }
      ]
    }
  },
  
  setup: {
    name: 'Talia Set-up',
    description: 'System configuration and administration',
    panels: [
      { id: 'user-management', component: 'table', title: 'User Management' },
      { id: 'role-management', component: 'panel', title: 'Role Management' },
      { id: 'system-settings', component: 'panel', title: 'System Settings' },
      { id: 'layout-templates', component: 'panel', title: 'Layout Templates' }
    ],
    layout: {
      type: 'grid',
      structure: [
        { id: 'user-management', position: { x: 0, y: 0, width: 6, height: 6 } },
        { id: 'role-management', position: { x: 6, y: 0, width: 6, height: 6 } },
        { id: 'system-settings', position: { x: 0, y: 6, width: 6, height: 6 } },
        { id: 'layout-templates', position: { x: 6, y: 6, width: 6, height: 6 } }
      ]
    }
  }
};

// Helper function to get focus layout
export const getFocusLayout = (focusId) => {
  return FOCUS_LAYOUTS[focusId] || FOCUS_LAYOUTS.performance;
};

// Helper function to get all available focuses for a role
export const getAvailableFocuses = (userRole) => {
  const allFocuses = Object.keys(FOCUS_LAYOUTS);
  
  if (userRole === 'admin' || userRole === 'designer') {
    return allFocuses; // All focuses available
  }
  
  // For analyst and viewer, exclude setup
  return allFocuses.filter(focusId => focusId !== 'setup');
};
