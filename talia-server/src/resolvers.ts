// Enhanced GraphQL Resolvers for Talia Focus Management System

import { sampleData } from './schema.js';
import { supabaseDataService } from './lib/supabase.js';

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

    ships: async () => {
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getShips();
        if (supabaseData && supabaseData.length > 0) {
          // Transform Supabase data to match GraphQL schema
          return supabaseData.map(ship => ({
            Ship_Id: ship.ship_id,
            Ship_Code: ship.ship_code,
            Ship_Name: ship.ship_name,
            Ship_Pax_Capacity: ship.ship_pax_capacity,
            Ship_Length: ship.ship_length,
            Ship_Tonnage: ship.ship_tonnage
          }));
        }
        
        // Fallback to sample data
        return [
          { Ship_Id: 1, Ship_Code: "DIS", Ship_Name: "Celestyal Discovery", Ship_Pax_Capacity: "950", Ship_Length: "180m", Ship_Tonnage: "45000" },
          { Ship_Id: 2, Ship_Code: "JRN", Ship_Name: "Celestyal Journey", Ship_Pax_Capacity: "980", Ship_Length: "185m", Ship_Tonnage: "47000" }
        ];
      } catch (error) {
        console.error('Error fetching ships data:', error);
        // Fallback to sample data
        return [
          { Ship_Id: 1, Ship_Code: "DIS", Ship_Name: "Celestyal Discovery", Ship_Pax_Capacity: "950", Ship_Length: "180m", Ship_Tonnage: "45000" },
          { Ship_Id: 2, Ship_Code: "JRN", Ship_Name: "Celestyal Journey", Ship_Pax_Capacity: "980", Ship_Length: "185m", Ship_Tonnage: "47000" }
        ];
      }
    },

    cabinAvailability: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getCabinAvailability(filters);
        if (supabaseData && supabaseData.length > 0) {
          // Transform Supabase data to match GraphQL schema
          return supabaseData.map(cabin => ({
            Snapshot_Date: cabin.snapshot_date,
            Sail_Code: cabin.sail_code,
            Package_Name: cabin.package_name,
            Sail_Days: cabin.sail_days,
            Cabin_Category: cabin.cabin_category,
            Available_Cabins: cabin.available_cabins,
            Total_Cabins: cabin.total_cabins,
            Available_Absolute: cabin.available_absolute,
            Available_Weighted: cabin.available_weighted,
            Availability_Result: cabin.availability_result,
            Nested_Cabins: cabin.nested_cabins
          }));
        }
        
        // Fallback to sample data
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
      } catch (error) {
        console.error('Error fetching cabin availability data:', error);
        // Fallback to sample data
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
      }
    },

    kpis: async (parent: any, args: any) => {
      const { userRole } = args;
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getKPIs(userRole);
        if (supabaseData && supabaseData.length > 0) {
          return supabaseData;
        }
        
        // Fallback to sample data
        return filterDataByRole(sampleData.kpis, userRole);
      } catch (error) {
        console.error('Error fetching KPIs data:', error);
        // Fallback to sample data
        return filterDataByRole(sampleData.kpis, userRole);
      }
    },

    exceptions: async (parent: any, args: any) => {
      const { userRole } = args;
      
      // Only managers and admins can see exceptions
      if (!hasPermission(userRole, 'MANAGER')) {
        return [];
      }
      
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getExceptions(userRole);
        if (supabaseData && supabaseData.length > 0) {
          return supabaseData;
        }
        
        // Fallback to sample data
        return filterDataByRole(sampleData.exceptions, userRole);
      } catch (error) {
        console.error('Error fetching exceptions data:', error);
        // Fallback to sample data
        return filterDataByRole(sampleData.exceptions, userRole);
      }
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
