import { apolloClient } from '../lib/apolloClient';
import { gql } from '@apollo/client';
import { normalizeRole } from '../utils/roleUtils';

// GraphQL Queries and Mutations (to be defined in the schema)
const GET_FOCUSES_BY_ROLE_QUERY = gql`
  query GetFocusesByRole($role: String!) {
    focusesByRole(role: $role) {
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
      layoutData
      createdBy
      createdAt
      updatedAt
      isPublic
    }
  }
`;

const CREATE_FOCUS_MUTATION = gql`
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
      layoutData
      createdBy
      createdAt
      updatedAt
      isPublic
    }
  }
`;

const UPDATE_FOCUS_MUTATION = gql`
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
      layoutData
      createdBy
      createdAt
      updatedAt
      isPublic
    }
  }
`;

const DELETE_FOCUS_MUTATION = gql`
  mutation DeleteFocus($id: ID!) {
    deleteFocus(id: $id)
  }
`;

const GET_FOCUS_GROUPS_QUERY = gql`
  query GetFocusGroups($isActive: Boolean) {
    focusGroups(isActive: $isActive) {
      id
      name
      description
      isActive
      createdBy
      createdAt
      updatedAt
    }
  }
`;

const CREATE_FOCUS_GROUP_MUTATION = gql`
  mutation CreateFocusGroup($groupData: FocusGroupInput!) {
    createFocusGroup(groupData: $groupData) {
      id
      name
      description
      isActive
      createdBy
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_FOCUS_GROUP_MUTATION = gql`
  mutation UpdateFocusGroup($groupId: ID!, $updateData: FocusGroupInput!) {
    updateFocusGroup(groupId: $groupId, updateData: $updateData) {
      id
      name
      description
      isActive
      createdBy
      createdAt
      updatedAt
    }
  }
`;

const DELETE_FOCUS_GROUP_MUTATION = gql`
  mutation DeleteFocusGroup($groupId: ID!) {
    deleteFocusGroup(groupId: $groupId)
  }
`;

const GET_USER_PREFERENCES_QUERY = gql`
  query GetMyFocusPreferences {
    myFocusPreferences {
      id
      userId
      focusId
      isFavorite
      lastUsed
      customLayout
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_PREFERENCE_MUTATION = gql`
  mutation UpdateFocusPreference($focusId: ID!, $preferences: FocusPreferenceInput!) {
    updateFocusPreference(focusId: $focusId, preferences: $preferences) {
      id
      userId
      focusId
      isFavorite
      lastUsed
      customLayout
      createdAt
      updatedAt
    }
  }
`;


class GraphQLFocusService {
  async getFocusesForRole(userRole) {
    try {
      // Normalize role - GraphQL resolver expects uppercase
      const normalizedRole = normalizeRole(userRole || 'USER');
      console.log(`🔍 Getting focuses for role from GraphQL: ${normalizedRole}`);
      
      const { data, error } = await apolloClient.query({
        query: GET_FOCUSES_BY_ROLE_QUERY,
        variables: { role: normalizedRole },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });

      console.log('📊 GraphQL response:', { 
        hasData: !!data, 
        hasError: !!error, 
        dataKeys: data ? Object.keys(data) : [],
        focusesCount: data?.focusesByRole?.length || 0
      });

      if (error) {
        console.error('❌ GraphQL query error:', error);
        throw error;
      }

      if (!data || !data.focusesByRole) {
        console.warn('⚠️ No focusesByRole in response. Response keys:', data ? Object.keys(data) : 'null');
        return [];
      }

      // Map GraphQL Focus format to expected format
      const mappedFocuses = (data.focusesByRole || []).map(focus => ({
        ...focus,
        isStandard: focus.isPublic || false,
        assignedRoles: focus.role ? [focus.role] : [],
        layoutData: focus.layoutData || {
          components: focus.components || []
        }
      }));

      console.log(`✅ Found ${mappedFocuses.length} focuses for role ${normalizedRole}`);
      return mappedFocuses;
    } catch (error) {
      console.error('❌ Error getting focuses from GraphQL:', error);
      throw error;
    }
  }


  async createFocus(focusData) {
    try {
      console.log(`🆕 Creating focus via GraphQL: ${focusData.name}`, focusData);
      
      // Normalize type and role to uppercase enums
      const normalizedType = (focusData.type || 'USER').toUpperCase();
      const normalizedRole = (focusData.role || focusData.assignedRoles?.[0] || 'USER').toUpperCase();
      
      // Map components to FocusComponentInput format
      // Note: FocusComponentInput doesn't have an 'id' field - it's generated by the server
      const rawComponents = focusData.components || focusData.layoutData?.components || [];
      const components = rawComponents.map((comp, index) => ({
        // Don't include 'id' - it's not in FocusComponentInput schema
        type: (comp.type || 'TABLE').toUpperCase(),
        position: comp.position || { x: 0, y: 0, width: 6, height: 4 },
        settings: comp.settings || null,
        dataSource: comp.dataSource || null
      }));
      
      // Map focusData to FocusInput format expected by GraphQL schema
      const input = {
        name: focusData.name,
        description: focusData.description || null,
        type: normalizedType,
        role: normalizedRole,
        components: components,
        isPublic: focusData.isPublic ?? focusData.isStandard ?? false
      };
      
      console.log(`📤 Sending createFocus mutation with input:`, input);
      
      const { data, errors } = await apolloClient.mutate({
        mutation: CREATE_FOCUS_MUTATION,
        variables: { input },
        errorPolicy: 'all'
      });

      if (errors && errors.length > 0) {
        console.error('❌ GraphQL mutation errors:', errors);
        throw new Error(`GraphQL mutation failed: ${errors.map(e => e.message).join(', ')}`);
      }

      if (!data || !data.createFocus) {
        console.error('❌ No data returned from mutation. Response:', { data, errors });
        throw new Error('No data returned from GraphQL mutation');
      }

      console.log(`✅ Created focus with ID: ${data.createFocus.id}`);
      return data.createFocus;
    } catch (error) {
      console.error('❌ Error creating focus via GraphQL:', error);
      throw error;
    }
  }

  async updateFocus(focusId, updateData) {
    try {
      console.log(`📝 Updating focus via GraphQL: ${focusId}`, updateData);
      
      // First, get the current focus to merge with updates
      const currentFocuses = await this.getFocusesForRole('ADMIN'); // Get all focuses to find current one
      const currentFocus = currentFocuses.find(f => f.id === focusId);
      
      if (!currentFocus) {
        throw new Error(`Focus with ID ${focusId} not found`);
      }
      
      // Extract components from layoutData if provided
      let componentsToSave = [];
      if (updateData.layoutData) {
        // If layoutData has components, use those
        if (updateData.layoutData.components && Array.isArray(updateData.layoutData.components)) {
          componentsToSave = updateData.layoutData.components;
        }
        // If layoutData has dockviewLayout, extract components from it
        else if (updateData.layoutData.dockviewLayout) {
          const dockviewLayout = updateData.layoutData.dockviewLayout;
          if (dockviewLayout.panels) {
            componentsToSave = Object.entries(dockviewLayout.panels).map(([panelId, panel]) => ({
              id: panelId,
              type: panel.params?.component || panel.params?.type || 'TABLE',
              position: panel.params?.position || { x: 0, y: 0, width: 6, height: 4 },
              settings: panel.params?.settings || null,
              dataSource: panel.params?.dataSource || null
            }));
          }
        }
      }
      
      // Merge updateData with current focus data
      const mergedData = {
        name: updateData.name ?? currentFocus.name,
        description: updateData.description ?? currentFocus.description,
        type: updateData.type ?? currentFocus.type,
        role: updateData.role || updateData.assignedRoles?.[0] || currentFocus.role,
        assignedRoles: updateData.assignedRoles ?? currentFocus.assignedRoles,
        components: componentsToSave.length > 0 
          ? componentsToSave 
          : (updateData.components || currentFocus.layoutData?.components || currentFocus.components || []),
        isPublic: updateData.isPublic ?? updateData.isStandard ?? currentFocus.isPublic ?? currentFocus.isStandard,
        isDefault: updateData.isDefault ?? currentFocus.isDefault,
        isActive: updateData.isActive ?? currentFocus.isActive
      };
      
      console.log(`📦 Merged data for update:`, {
        name: mergedData.name,
        componentsCount: mergedData.components.length,
        components: mergedData.components
      });
      
      // Preserve dockviewLayout - new one takes precedence over existing
      let dockviewLayoutToPreserve = null;
      if (updateData.layoutData?.dockviewLayout) {
        // New dockviewLayout provided - use it
        dockviewLayoutToPreserve = updateData.layoutData.dockviewLayout;
        console.log(`📦 New dockviewLayout provided:`, {
          hasPanels: !!dockviewLayoutToPreserve.panels,
          panelCount: dockviewLayoutToPreserve.panels ? Object.keys(dockviewLayoutToPreserve.panels).length : 0,
          hasGrid: !!dockviewLayoutToPreserve.grid
        });
      } else if (currentFocus.layoutData?.dockviewLayout) {
        // No new dockviewLayout, preserve existing
        dockviewLayoutToPreserve = currentFocus.layoutData.dockviewLayout;
        console.log(`📦 Preserving existing dockviewLayout`);
      }
      
      // Ensure we have at least one component to store dockviewLayout in settings if needed
      let componentsToSend = mergedData.components;
      if (componentsToSend.length === 0 && dockviewLayoutToPreserve) {
        // Create a dummy component to store dockviewLayout if no components exist
        // Note: Don't include 'id' - it's not in FocusComponentInput schema
        componentsToSend = [{
          type: 'TABLE',
          position: { x: 0, y: 0, width: 6, height: 4 },
          settings: { _dockviewLayout: dockviewLayoutToPreserve },
          dataSource: null
        }];
      }
      
      // Map to FocusInput format expected by GraphQL schema
      const input = {
        name: mergedData.name,
        description: mergedData.description,
        type: mergedData.type?.toUpperCase() || 'USER',
        role: mergedData.role?.toUpperCase() || 'USER',
        components: componentsToSend.map((comp, index) => {
          // Store dockviewLayout in the first component's settings if we have it
          const settings = comp.settings || {};
          if (dockviewLayoutToPreserve && index === 0) {
            settings._dockviewLayout = dockviewLayoutToPreserve;
          }
          return {
            // Don't include 'id' - it's not in FocusComponentInput schema
            type: (comp.type || 'TABLE').toUpperCase(),
            position: comp.position || { x: 0, y: 0, width: 6, height: 4 },
            settings: Object.keys(settings).length > 0 ? settings : null,
            dataSource: comp.dataSource || null
          };
        }),
        isPublic: mergedData.isPublic || false
      };
      
      console.log(`📤 Sending updateFocus mutation with input:`, {
        name: input.name,
        componentsCount: input.components.length,
        hasDockviewLayout: !!dockviewLayoutToPreserve
      });
      
      const { data, errors } = await apolloClient.mutate({
        mutation: UPDATE_FOCUS_MUTATION,
        variables: { id: focusId, input },
        errorPolicy: 'all'
      });
      
      if (errors && errors.length > 0) {
        console.error('❌ GraphQL mutation errors:', errors);
        throw new Error(`GraphQL mutation failed: ${errors.map(e => e.message).join(', ')}`);
      }
      
      if (!data || !data.updateFocus) {
        throw new Error('No data returned from GraphQL mutation');
      }
      
      console.log(`✅ Updated focus: ${focusId}`);
      return data.updateFocus;
    } catch (error) {
      console.error('❌ Error updating focus via GraphQL:', error);
      throw error;
    }
  }

  async deleteFocus(focusId) {
    try {
      console.log(`🗑️ Deleting focus via GraphQL: ${focusId}`);
      const { data, errors } = await apolloClient.mutate({
        mutation: DELETE_FOCUS_MUTATION,
        variables: { id: focusId },
        errorPolicy: 'all'
      });
      
      if (errors && errors.length > 0) {
        console.error('❌ GraphQL mutation errors:', errors);
        throw new Error(`GraphQL mutation failed: ${errors.map(e => e.message).join(', ')}`);
      }
      
      console.log(`✅ Deleted focus: ${focusId}`);
      return data?.deleteFocus || true;
    } catch (error) {
      console.error('❌ Error deleting focus via GraphQL:', error);
      return false;
    }
  }

  // Focus Groups
  async getFocusGroups(isActive = null) {
    try {
      const result = await apolloClient.query({
        query: GET_FOCUS_GROUPS_QUERY,
        variables: { isActive },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });

      const { data, error } = result || {};

      if (error) {
        console.warn('⚠️ GraphQL error getting focus groups:', error);
        return [];
      }

      // Check if data exists before accessing properties
      if (!data) {
        console.log('ℹ️ No data returned from GraphQL for focus groups, returning empty array');
        return [];
      }

      if (!data.focusGroups) {
        console.log('ℹ️ No focus groups found, returning empty array');
        return [];
      }

      return data.focusGroups || [];
    } catch (error) {
      console.error('❌ Error getting focus groups:', error);
      return [];
    }
  }

  async createFocusGroup(groupData) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: CREATE_FOCUS_GROUP_MUTATION,
        variables: { groupData },
      });
      return data.createFocusGroup;
    } catch (error) {
      console.error('Error creating focus group:', error);
      throw error;
    }
  }

  async updateFocusGroup(groupId, updateData) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_FOCUS_GROUP_MUTATION,
        variables: { groupId, updateData },
      });
      return data.updateFocusGroup;
    } catch (error) {
      console.error('Error updating focus group:', error);
      throw error;
    }
  }

  // User Preferences
  async getUserPreferences() {
    try {
      const { data } = await apolloClient.query({
        query: GET_USER_PREFERENCES_QUERY,
        fetchPolicy: 'network-only',
      });
      return data.myFocusPreferences || [];
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return [];
    }
  }

  async updatePreference(focusId, preferences) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_PREFERENCE_MUTATION,
        variables: { focusId, preferences },
      });
      return data.updateFocusPreference;
    } catch (error) {
      console.error('Error updating preference:', error);
      throw error;
    }
  }
}

const graphQLFocusService = new GraphQLFocusService();
export default graphQLFocusService;
