// Enhanced GraphQL Resolvers for Talia Focus Management System

import { sampleData } from './schema.js';
import { supabaseDataService } from '../services/supabase.js';

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

// Helper function to map database focus to GraphQL Focus format
const mapDbFocusToGraphQL = (dbFocus: any) => {
  if (!dbFocus) return null;
  
  // Extract components from layout_data if it exists
  const layoutData = dbFocus.layout_data || {};
  const components = layoutData.components || [];
  
  // Use first assigned role as the primary role, or default to ADMIN
  const primaryRole = dbFocus.assigned_roles && dbFocus.assigned_roles.length > 0 
    ? dbFocus.assigned_roles[0].toUpperCase() 
    : 'ADMIN';
  
  return {
    id: dbFocus.id,
    name: dbFocus.name,
    description: dbFocus.description || null,
    type: dbFocus.type ? dbFocus.type.toUpperCase() : 'USER',
    role: primaryRole,
    components: components.map((comp: any, index: number) => ({
      id: comp.id || `comp-${index}`,
      type: comp.type || 'TABLE',
      position: comp.position || { x: 0, y: 0, width: 6, height: 4 },
      settings: comp.settings || null,
      dataSource: comp.dataSource || null
    })),
    createdBy: dbFocus.created_by || '',
    createdAt: dbFocus.created_at || new Date().toISOString(),
    updatedAt: dbFocus.updated_at || dbFocus.created_at || new Date().toISOString(),
    isPublic: dbFocus.is_standard || false
  };
};

// Helper function to map GraphQL FocusInput to database format
const mapGraphQLFocusToDb = (input: any, createdBy?: string) => {
  // Extract components and store in layout_data
  const layoutData = {
    components: input.components || []
  };
  
  // Convert single role to array if needed
  const assignedRoles = input.assignedRoles || (input.role ? [input.role] : []);
  
  return {
    name: input.name,
    description: input.description || null,
    type: input.type ? input.type.toLowerCase() : 'user',
    isStandard: input.isPublic !== undefined ? input.isPublic : (input.isStandard || false),
    assignedRoles: assignedRoles.map((r: string) => r.toUpperCase()),
    isDefault: input.isDefault || false,
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdBy: createdBy,
    layoutData: layoutData
  };
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

    taliaUser: async (parent: any, args: any) => {
      const { email } = args;
      try {
        const taliaUser = await supabaseDataService.getTaliaUserByEmail(email);
        if (!taliaUser) return null;
        
        return {
          id: taliaUser.id,
          taliaUserId: taliaUser.talia_user_id,
          email: taliaUser.email,
          createdAt: taliaUser.created_at,
          updatedAt: taliaUser.updated_at,
          lastLoginAt: taliaUser.last_login_at
        };
      } catch (error) {
        console.error('Error fetching talia user:', error);
        throw new Error(`Failed to fetch talia user: ${error.message}`);
      }
    },

    // Focus Management
    focuses: async (parent: any, args: any, context: any) => {
      const { filters } = args;
      try {
        // Get focuses from Supabase
        const dbFocuses = await supabaseDataService.getFocuses(filters || {});
        
        // Map to GraphQL format
        const mappedFocuses = dbFocuses.map(mapDbFocusToGraphQL).filter(Boolean);
        
        // Apply additional filtering if needed
        let filteredFocuses = mappedFocuses;
        if (filters) {
          if (filters.role) {
            filteredFocuses = filteredFocuses.filter(focus => focus.role === filters.role);
          }
          if (filters.type) {
            filteredFocuses = filteredFocuses.filter(focus => focus.type === filters.type);
          }
          if (filters.isPublic !== undefined) {
            filteredFocuses = filteredFocuses.filter(focus => focus.isPublic === filters.isPublic);
          }
        }
        
        return filteredFocuses;
      } catch (error) {
        console.error('Error fetching focuses:', error);
        // Fallback to sample data on error
        return sampleData.focuses;
      }
    },

    focus: async (parent: any, args: any) => {
      const { id } = args;
      try {
        const dbFocus = await supabaseDataService.getFocusById(id);
        return mapDbFocusToGraphQL(dbFocus);
      } catch (error) {
        console.error('Error fetching focus:', error);
        // Fallback to sample data
        return sampleData.focuses.find(focus => focus.id === id);
      }
    },

    focusesByRole: async (parent: any, args: any) => {
      const { role } = args;
      try {
        const dbFocuses = await supabaseDataService.getFocuses({ role: role.toLowerCase() });
        return dbFocuses.map(mapDbFocusToGraphQL).filter(Boolean);
      } catch (error) {
        console.error('Error fetching focuses by role:', error);
        return sampleData.focuses.filter(f => f.role === role.toUpperCase());
      }
    },

    myFocuses: async (parent: any, args: any, context: any) => {
      try {
        // In a real app, get current user from context
        const userId = context?.user?.id || "1";
        const dbFocuses = await supabaseDataService.getFocuses({ createdBy: userId });
        return dbFocuses.map(mapDbFocusToGraphQL).filter(Boolean);
      } catch (error) {
        console.error('Error fetching my focuses:', error);
        // Fallback to sample data
        return sampleData.focuses.filter(focus => focus.createdBy === "1");
      }
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

    masterSail: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        // Get data from Supabase
        const supabaseData = await supabaseDataService.getMasterSail(filters || {});
        
        // Transform dates to strings for GraphQL
        return supabaseData.map(sail => ({
          ...sail,
          sail_date_from: sail.sail_date_from ? new Date(sail.sail_date_from).toISOString().split('T')[0] : null,
          sail_date_to: sail.sail_date_to ? new Date(sail.sail_date_to).toISOString().split('T')[0] : null,
          vacation_date: sail.vacation_date ? new Date(sail.vacation_date).toISOString().split('T')[0] : null,
          master_voyage_departure_date: sail.master_voyage_departure_date ? new Date(sail.master_voyage_departure_date).toISOString().split('T')[0] : null,
          created_at: sail.created_at ? new Date(sail.created_at).toISOString() : null
        }));
      } catch (error) {
        console.error('Error fetching master sail data:', error);
        // Return empty array on error rather than throwing
        return [];
      }
    },

    reservations: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        // Get data from Supabase
        const supabaseData = await supabaseDataService.getReservations(filters || {});
        
        // Transform dates to strings for GraphQL
        return supabaseData.map(reservation => ({
          ...reservation,
          sail_from_date: reservation.sail_from_date ? new Date(reservation.sail_from_date).toISOString().split('T')[0] : null,
          sail_to_date: reservation.sail_to_date ? new Date(reservation.sail_to_date).toISOString().split('T')[0] : null,
          created_at: reservation.created_at ? new Date(reservation.created_at).toISOString() : null
        }));
      } catch (error) {
        console.error('Error fetching reservations data:', error);
        // Return empty array on error rather than throwing
        return [];
      }
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
    createFocus: async (parent: any, args: any, context: any) => {
      const { input } = args;
      try {
        // In a real app, get current user from context
        // For now, use null if user ID is not a valid UUID
        const userId = context?.user?.id || null;
        
        // Map GraphQL input to database format
        const dbFocusData = mapGraphQLFocusToDb(input, userId);
        
        // Create focus in Supabase
        const dbFocus = await supabaseDataService.createFocus(dbFocusData);
        
        // Map back to GraphQL format
        return mapDbFocusToGraphQL(dbFocus);
      } catch (error: any) {
        console.error('Error creating focus:', error);
        throw new Error(`Failed to create focus: ${error.message}`);
      }
    },

    updateFocus: async (parent: any, args: any) => {
      const { id, input } = args;
      try {
        // Map GraphQL input to database format
        const updateData: any = {};
        
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.type !== undefined) updateData.type = input.type.toLowerCase();
        if (input.isPublic !== undefined) updateData.isStandard = input.isPublic;
        if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.assignedRoles !== undefined) {
          updateData.assignedRoles = input.assignedRoles.map((r: string) => r.toUpperCase());
        } else if (input.role !== undefined) {
          updateData.assignedRoles = [input.role.toUpperCase()];
        }
        if (input.components !== undefined) {
          updateData.layoutData = { components: input.components };
        }
        
        // Update focus in Supabase
        const dbFocus = await supabaseDataService.updateFocus(id, updateData);
        
        // Map back to GraphQL format
        return mapDbFocusToGraphQL(dbFocus);
      } catch (error) {
        console.error('Error updating focus:', error);
        throw new Error(`Failed to update focus: ${error.message}`);
      }
    },

    deleteFocus: async (parent: any, args: any) => {
      const { id } = args;
      try {
        await supabaseDataService.deleteFocus(id);
        return true;
      } catch (error) {
        console.error('Error deleting focus:', error);
        throw new Error(`Failed to delete focus: ${error.message}`);
      }
    },

    shareFocus: async (parent: any, args: any) => {
      const { id, isPublic } = args;
      try {
        // Update is_standard field to reflect public/private status
        const dbFocus = await supabaseDataService.updateFocus(id, { isStandard: isPublic });
        return mapDbFocusToGraphQL(dbFocus);
      } catch (error) {
        console.error('Error sharing focus:', error);
        throw new Error(`Failed to share focus: ${error.message}`);
      }
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
    },

    // Focus Preferences
    updateFocusPreference: async (parent: any, args: any, context: any) => {
      try {
        const { focusId, preferences } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to update focus preferences.');
        
        const updated = await supabaseDataService.updateUserFocusPreference(
          userId,
          focusId,
          {
            isFavorite: preferences.isFavorite,
            lastUsed: preferences.lastUsed,
            customLayout: preferences.customLayout
          }
        );
        
        return {
          id: updated.id,
          userId: updated.user_id,
          focusId: updated.focus_id,
          isFavorite: updated.is_favorite,
          lastUsed: updated.last_used,
          customLayout: updated.custom_layout,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        };
      } catch (error) {
        console.error('Error updating focus preference:', error);
        throw new Error(`Failed to update focus preference: ${error.message}`);
      }
    },

    toggleFavorite: async (parent: any, args: any, context: any) => {
      try {
        const { focusId } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to toggle favorite.');
        
        const updated = await supabaseDataService.toggleFavorite(userId, focusId);
        
        return {
          id: updated.id,
          userId: updated.user_id,
          focusId: updated.focus_id,
          isFavorite: updated.is_favorite,
          lastUsed: updated.last_used,
          customLayout: updated.custom_layout,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        };
      } catch (error) {
        console.error('Error toggling favorite:', error);
        throw new Error(`Failed to toggle favorite: ${error.message}`);
      }
    },

    // Focus Groups (Admin)
    createFocusGroup: async (parent: any, args: any, context: any) => {
      try {
        const { groupData } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to create focus group.');
        
        // TODO: Check if user is admin
        const group = await supabaseDataService.createFocusGroup({
          name: groupData.name,
          description: groupData.description,
          isActive: groupData.isActive !== undefined ? groupData.isActive : true,
          createdBy: userId
        });
        
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          isActive: group.is_active,
          createdBy: group.created_by,
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };
      } catch (error) {
        console.error('Error creating focus group:', error);
        throw new Error(`Failed to create focus group: ${error.message}`);
      }
    },

    updateFocusGroup: async (parent: any, args: any, context: any) => {
      try {
        const { groupId, updateData } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to update focus group.');
        
        // TODO: Check if user is admin
        const group = await supabaseDataService.updateFocusGroup(groupId, {
          name: updateData.name,
          description: updateData.description,
          isActive: updateData.isActive
        });
        
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          isActive: group.is_active,
          createdBy: group.created_by,
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };
      } catch (error) {
        console.error('Error updating focus group:', error);
        throw new Error(`Failed to update focus group: ${error.message}`);
      }
    },

    deleteFocusGroup: async (parent: any, args: any, context: any) => {
      try {
        const { groupId } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to delete focus group.');
        
        // TODO: Check if user is admin
        await supabaseDataService.deleteFocusGroup(groupId);
        return true;
      } catch (error) {
        console.error('Error deleting focus group:', error);
        throw new Error(`Failed to delete focus group: ${error.message}`);
      }
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
