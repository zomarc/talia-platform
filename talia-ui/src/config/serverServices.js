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
    type: 'supabase',
    check: {
      method: 'supabase',
      table: 'sync_metadata',
      select: 'sync_type',
      limit: 1
    },
    display: {
      address: 'http://127.0.0.1:54323'
    },
    offlineMessage: 'Server is offline. Start with: supabase start'
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

