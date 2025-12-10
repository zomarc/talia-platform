/**
 * Server Services Configuration
 * 
 * This configuration defines all services that should be monitored in the Server Status panel.
 * Services can be added or removed here without modifying the component code.
 */

export const SERVER_SERVICES = [
  {
    id: 'graphql',
    name: 'GraphQL Server',
    icon: '🔌',
    type: 'http',
    check: {
      method: 'graphql',
      endpoint: () => {
        // Use relative path - Vite proxy handles routing to localhost:4000
        // This works both locally and when exposed via ngrok
        return '/api/graphql';
      },
      query: '{ __typename }'
    },
    display: {
      address: () => {
        // Show relative path in UI (actual backend is localhost:4000, proxied through Vite)
        return '/api/graphql';
      }
    },
    actions: [
      {
        id: 'restart',
        label: 'Restart Server',
        icon: '🔄',
        handler: 'restartGraphQL'
      }
    ],
    offlineMessage: 'Server is offline. Start with: npm start'
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: '🗄️',
    type: 'graphql',
    check: {
      method: 'graphql',
      endpoint: () => {
        // Use relative path - Vite proxy handles routing to localhost:4000
        // This works both locally and when exposed via ngrok
        return '/api/graphql';
      },
      query: `query {
        supabaseConnectionStatus {
          online
          server
          database
          lastChecked
          error
        }
      }`
    },
    display: {
      address: (status) => {
        if (status?.server) {
          return status.database 
            ? `${status.server} / ${status.database}`
            : status.server;
        }
        // Don't show localhost when accessed externally - show generic label
        const isExternal = typeof window !== 'undefined' && 
          (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');
        return isExternal ? 'Local Supabase' : 'http://127.0.0.1:54321';
      }
    },
    offlineMessage: (status) => {
      return status?.error || 'Connection failed. Please check if Supabase is running.';
    }
  },
  {
    id: 'synapse',
    name: 'Azure Synapse',
    icon: '☁️',
    type: 'graphql',
    check: {
      method: 'graphql',
      endpoint: () => {
        // Use relative path - Vite proxy handles routing to localhost:4000
        return '/api/graphql';
      },
      query: `query {
        synapseConnectionStatus {
          online
          server
          database
          lastChecked
          error
        }
      }`
    },
    display: {
      address: (status) => {
        if (status?.server) {
          return status.database 
            ? `${status.server} / ${status.database}`
            : status.server;
        }
        return 'Azure Synapse';
      }
    },
    offlineMessage: (status) => {
      return status?.error || 'Connection failed. Please check VPN connection.';
    }
  }
];

/**
 * Get service configuration by ID
 */
export const getServiceConfig = (serviceId) => {
  return SERVER_SERVICES.find(service => service.id === serviceId);
};

/**
 * Get all service IDs
 */
export const getAllServiceIds = () => {
  return SERVER_SERVICES.map(service => service.id);
};

