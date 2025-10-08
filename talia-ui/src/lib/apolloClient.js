// Apollo Client configuration for Talia UI
// Enhanced to work with the new GraphQL schema and focus management

import { ApolloClient, InMemoryCache, createHttpLink, gql } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// Determine the GraphQL endpoint based on environment
const getGraphQLEndpoint = () => {
  if (import.meta.env.PROD) {
    // Production: Use Netlify function endpoint
    return '/api/graphql';
  } else {
    // Development: Use local GraphQL server
    return 'http://localhost:4000/graphql';
  }
};

// HTTP link to GraphQL endpoint
const httpLink = createHttpLink({
  uri: getGraphQLEndpoint(),
});

// Auth link to add user context to requests
const authLink = setContext((_, { headers }) => {
  // Get user information from localStorage or context
  const userRole = localStorage.getItem('userRole') || 'GUEST';
  const userId = localStorage.getItem('userId') || 'anonymous';
  const userEmail = localStorage.getItem('userEmail') || 'guest@celestyal.com';

  return {
    headers: {
      ...headers,
      'x-user-role': userRole,
      'x-user-id': userId,
      'x-user-email': userEmail,
      'content-type': 'application/json',
    }
  };
});

// Create Apollo Client with enhanced configuration
export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      // Cache policies for better performance
      Focus: {
        fields: {
          components: {
            merge: false, // Replace components array instead of merging
          }
        }
      },
      User: {
        fields: {
          preferences: {
            merge: true, // Merge user preferences
          }
        }
      },
      Query: {
        fields: {
          sailings: {
            merge: false, // Replace sailings array
            keyArgs: ['filters', 'userRole'], // Cache by filters and user role
          },
          focuses: {
            merge: false, // Replace focuses array
            keyArgs: ['filters'], // Cache by filters
          },
          kpis: {
            merge: false, // Replace KPIs array
            keyArgs: ['userRole'], // Cache by user role
          },
          exceptions: {
            merge: false, // Replace exceptions array
            keyArgs: ['userRole'], // Cache by user role
          }
        }
      }
    }
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all', // Show partial data even if there are errors
    },
    query: {
      errorPolicy: 'all',
    },
  },
  // Enable GraphQL Playground in development
  connectToDevTools: !import.meta.env.PROD,
});

// Enhanced GraphQL Queries for Focus Management
export const FOCUS_QUERIES = {
  // Get all focuses with optional filtering
  GET_FOCUSES: gql`
    query GetFocuses($filters: FocusFilters) {
      focuses(filters: $filters) {
        id
        name
        description
        type
        role
        components {
          id
          type
          position {
            x
            y
            width
            height
          }
          settings
          dataSource
        }
        createdBy
        createdAt
        updatedAt
        isPublic
      }
    }
  `,

  // Get a specific focus by ID
  GET_FOCUS: gql`
    query GetFocus($id: ID!) {
      focus(id: $id) {
        id
        name
        description
        type
        role
        components {
          id
          type
          position {
            x
            y
            width
            height
          }
          settings
          dataSource
        }
        createdBy
        createdAt
        updatedAt
        isPublic
      }
    }
  `,

  // Get user's personal focuses
  GET_MY_FOCUSES: gql`
    query GetMyFocuses {
      myFocuses {
        id
        name
        description
        type
        role
        components {
          id
          type
          position {
            x
            y
            width
            height
          }
          settings
          dataSource
        }
        createdBy
        createdAt
        updatedAt
        isPublic
      }
    }
  `,

  // Get current user information
  GET_ME: gql`
    query GetMe {
      me {
        id
        email
        role
        name
        preferences {
          theme
          fontSize
          fontFamily
          spacingMode
          defaultFocus
        }
        createdAt
        updatedAt
      }
    }
  `
};

// Enhanced GraphQL Queries for Data
export const DATA_QUERIES = {
  // Get sailings with advanced filtering
  GET_SAILINGS: gql`
    query GetSailings($filters: SailingFilters, $userRole: UserRole) {
      sailings(filters: $filters, userRole: $userRole) {
        id
        ship
        sailing
        depart
        booked
        available
        projected
        status
      }
    }
  `,

  // Get ships data
  GET_SHIPS: gql`
    query GetShips {
      ships {
        Ship_Id
        Ship_Code
        Ship_Name
        Ship_Pax_Capacity
        Ship_Length
        Ship_Tonnage
      }
    }
  `,

  // Get cabin availability data
  GET_CABIN_AVAILABILITY: gql`
    query GetCabinAvailability($filters: DateFilters) {
      cabinAvailability(filters: $filters) {
        Snapshot_Date
        Package_Name
        Sail_Days
        Cabin_Category
        Available_Cabins
        Total_Cabins
        Available_Absolute
        Available_Weighted
        Availability_Result
        Nested_Cabins
      }
    }
  `,

  // Get KPIs with role-based filtering
  GET_KPIS: gql`
    query GetKPIs($userRole: UserRole) {
      kpis(userRole: $userRole) {
        id
        title
        value
        target
        unit
        trend
        change
        period
      }
    }
  `,

  // Get exceptions with role-based filtering
  GET_EXCEPTIONS: gql`
    query GetExceptions($userRole: UserRole) {
      exceptions(userRole: $userRole) {
        id
        type
        severity
        message
        sailing
        ship
        createdAt
        resolved
      }
    }
  `
};

// GraphQL Mutations
export const FOCUS_MUTATIONS = {
  // Create a new focus
  CREATE_FOCUS: gql`
    mutation CreateFocus($input: FocusInput!) {
      createFocus(input: $input) {
        id
        name
        description
        type
        role
        components {
          id
          type
          position {
            x
            y
            width
            height
          }
          settings
          dataSource
        }
        createdBy
        createdAt
        updatedAt
        isPublic
      }
    }
  `,

  // Update an existing focus
  UPDATE_FOCUS: gql`
    mutation UpdateFocus($id: ID!, $input: FocusInput!) {
      updateFocus(id: $id, input: $input) {
        id
        name
        description
        type
        role
        components {
          id
          type
          position {
            x
            y
            width
            height
          }
          settings
          dataSource
        }
        createdBy
        createdAt
        updatedAt
        isPublic
      }
    }
  `,

  // Delete a focus
  DELETE_FOCUS: gql`
    mutation DeleteFocus($id: ID!) {
      deleteFocus(id: $id)
    }
  `,

  // Share/unshare a focus
  SHARE_FOCUS: gql`
    mutation ShareFocus($id: ID!, $isPublic: Boolean!) {
      shareFocus(id: $id, isPublic: $isPublic) {
        id
        isPublic
        updatedAt
      }
    }
  `,

  // Update user preferences
  UPDATE_USER_PREFERENCES: gql`
    mutation UpdateUserPreferences($input: UserPreferencesInput!) {
      updateUserPreferences(input: $input) {
        id
        preferences {
          theme
          fontSize
          fontFamily
          spacingMode
          defaultFocus
        }
        updatedAt
      }
    }
  `
};

// Utility functions for working with GraphQL data
export const GraphQLUtils = {
  // Extract user role from Apollo Client cache
  getUserRole: () => {
    try {
      const userRole = localStorage.getItem('userRole');
      return userRole || 'GUEST';
    } catch (error) {
      console.warn('Failed to get user role:', error);
      return 'GUEST';
    }
  },

  // Set user context for GraphQL requests
  setUserContext: (user) => {
    try {
      localStorage.setItem('userRole', user.role || 'GUEST');
      localStorage.setItem('userId', user.id || 'anonymous');
      localStorage.setItem('userEmail', user.email || 'guest@celestyal.com');
    } catch (error) {
      console.warn('Failed to set user context:', error);
    }
  },

  // Clear user context
  clearUserContext: () => {
    try {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
    } catch (error) {
      console.warn('Failed to clear user context:', error);
    }
  },

  // Build filters object for queries
  buildFilters: (baseFilters = {}) => {
    return {
      ...baseFilters,
      userRole: GraphQLUtils.getUserRole()
    };
  }
};

export default apolloClient;
