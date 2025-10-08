// Enhanced GraphQL Resolvers for Talia Focus Management System

import { sampleData } from './schema.js';

// Helper function to check user permissions
const hasPermission = (userRole: string, requiredRole: string): boolean => {
  const roleHierarchy = {
    'GUEST': 0,
    'USER': 1,
    'MANAGER': 2,
    'ADMIN': 3
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Helper function to filter data based on user role
const filterDataByRole = (data: any[], userRole: string, roleField?: string) => {
  if (!userRole) return data;
  
  // For now, return all data. In production, implement role-based filtering
  return data;
};

export const resolvers = {
  Query: {
    // User Management
    me: () => {
      // In a real app, this would get the current user from the context
      return sampleData.users[0]; // Return admin user for demo
    },
    
    users: () => {
      return sampleData.users;
    },

    // Focus Management
    focuses: (parent: any, args: any) => {
      const { filters } = args;
      let focuses = sampleData.focuses;

      if (filters) {
        if (filters.role) {
          focuses = focuses.filter(focus => focus.role === filters.role);
        }
        if (filters.type) {
          focuses = focuses.filter(focus => focus.type === filters.type);
        }
        if (filters.isPublic !== undefined) {
          focuses = focuses.filter(focus => focus.isPublic === filters.isPublic);
        }
      }

      return focuses;
    },

    focus: (parent: any, args: any) => {
      const { id } = args;
      return sampleData.focuses.find(focus => focus.id === id);
    },

    myFocuses: () => {
      // In a real app, filter by current user
      return sampleData.focuses.filter(focus => focus.createdBy === "1");
    },

    // Data Queries with Role-based Filtering
    sailings: (parent: any, args: any) => {
      const { filters, userRole } = args;
      let sailings = filterDataByRole(sampleData.sailings, userRole);

      if (filters) {
        if (filters.ship) {
          sailings = sailings.filter(sailing => sailing.ship === filters.ship);
        }
        if (filters.sailing) {
          sailings = sailings.filter(sailing => 
            sailing.sailing.toLowerCase().includes(filters.sailing.toLowerCase())
          );
        }
        if (filters.status) {
          sailings = sailings.filter(sailing => sailing.status === filters.status);
        }
        if (filters.dateFrom) {
          sailings = sailings.filter(sailing => sailing.depart >= filters.dateFrom);
        }
        if (filters.dateTo) {
          sailings = sailings.filter(sailing => sailing.depart <= filters.dateTo);
        }
        if (filters.bookedMin) {
          sailings = sailings.filter(sailing => sailing.booked >= filters.bookedMin);
        }
        if (filters.bookedMax) {
          sailings = sailings.filter(sailing => sailing.booked <= filters.bookedMax);
        }
      }

      return sailings;
    },

    ships: () => {
      // This would load from the JSON file in a real implementation
      return [
        { Ship_Id: 1, Ship_Code: "DIS", Ship_Name: "Celestyal Discovery", Ship_Pax_Capacity: "950", Ship_Length: "180m", Ship_Tonnage: "45000" },
        { Ship_Id: 2, Ship_Code: "JRN", Ship_Name: "Celestyal Journey", Ship_Pax_Capacity: "980", Ship_Length: "185m", Ship_Tonnage: "47000" }
      ];
    },

    cabinAvailability: (parent: any, args: any) => {
      const { filters } = args;
      // In a real implementation, this would load from JSON and apply filters
      return [
        {
          Snapshot_Date: "2025-01-01",
          Package_Name: "7N Islands",
          Sail_Days: 7,
          Cabin_Category: "Interior",
          Available_Cabins: 120,
          Total_Cabins: 150,
          Available_Absolute: 120,
          Available_Weighted: 115.5,
          Availability_Result: "Good",
          Nested_Cabins: 0
        }
      ];
    },

    kpis: (parent: any, args: any) => {
      const { userRole } = args;
      return filterDataByRole(sampleData.kpis, userRole);
    },

    exceptions: (parent: any, args: any) => {
      const { userRole } = args;
      
      // Only managers and admins can see exceptions
      if (!hasPermission(userRole, 'MANAGER')) {
        return [];
      }
      
      return filterDataByRole(sampleData.exceptions, userRole);
    },

    // Legacy queries (for backward compatibility)
    books: () => {
      return [
        { title: 'The Awakening', author: 'Kate Chopin' },
        { title: 'City of Glass', author: 'Paul Auster' },
        { title: 'The Art of War', author: 'Sun Tzu' },
      ];
    }
  },

  Mutation: {
    // Focus Management
    createFocus: (parent: any, args: any) => {
      const { input } = args;
      const newFocus = {
        id: (sampleData.focuses.length + 1).toString(),
        ...input,
        createdBy: "1", // In real app, get from context
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: input.isPublic || false
      };
      
      sampleData.focuses.push(newFocus);
      return newFocus;
    },

    updateFocus: (parent: any, args: any) => {
      const { id, input } = args;
      const focusIndex = sampleData.focuses.findIndex(focus => focus.id === id);
      
      if (focusIndex === -1) {
        throw new Error(`Focus with id ${id} not found`);
      }
      
      const updatedFocus = {
        ...sampleData.focuses[focusIndex],
        ...input,
        updatedAt: new Date().toISOString()
      };
      
      sampleData.focuses[focusIndex] = updatedFocus;
      return updatedFocus;
    },

    deleteFocus: (parent: any, args: any) => {
      const { id } = args;
      const focusIndex = sampleData.focuses.findIndex(focus => focus.id === id);
      
      if (focusIndex === -1) {
        throw new Error(`Focus with id ${id} not found`);
      }
      
      sampleData.focuses.splice(focusIndex, 1);
      return true;
    },

    shareFocus: (parent: any, args: any) => {
      const { id, isPublic } = args;
      const focusIndex = sampleData.focuses.findIndex(focus => focus.id === id);
      
      if (focusIndex === -1) {
        throw new Error(`Focus with id ${id} not found`);
      }
      
      sampleData.focuses[focusIndex].isPublic = isPublic;
      sampleData.focuses[focusIndex].updatedAt = new Date().toISOString();
      
      return sampleData.focuses[focusIndex];
    },

    // User Management
    updateUserPreferences: (parent: any, args: any) => {
      const { input } = args;
      const userIndex = 0; // In real app, get current user index
      
      sampleData.users[userIndex].preferences = {
        ...sampleData.users[userIndex].preferences,
        ...input
      };
      sampleData.users[userIndex].updatedAt = new Date().toISOString();
      
      return sampleData.users[userIndex];
    }
  },

  // Custom scalar for JSON
  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => {
      switch (ast.kind) {
        case 'StringValue':
        case 'BooleanValue':
          return ast.value;
        case 'IntValue':
        case 'FloatValue':
          return parseFloat(ast.value);
        case 'ObjectValue':
          return ast.fields.reduce((obj: any, field: any) => {
            obj[field.name.value] = field.value.value;
            return obj;
          }, {});
        case 'ListValue':
          return ast.values.map((value: any) => value.value);
        default:
          return null;
      }
    }
  }
};
