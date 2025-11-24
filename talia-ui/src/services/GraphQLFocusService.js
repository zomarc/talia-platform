import { apolloClient } from '../lib/apolloClient';
import { gql } from '@apollo/client';

// GraphQL Queries and Mutations (to be defined in the schema)
const GET_FOCUSES_BY_ROLE_QUERY = gql`
  query GetFocusesByRole($role: String!) {
    focusesByRole(role: $role) {
      id
      name
      description
      type
      isStandard
      assignedRoles
      isDefault
      isActive
      layoutData
      createdAt
      updatedAt
    }
  }
`;

const CREATE_FOCUS_MUTATION = gql`
  mutation CreateFocus($focusData: FocusInput!) {
    createFocus(focusData: $focusData) {
      id
    }
  }
`;

const UPDATE_FOCUS_MUTATION = gql`
  mutation UpdateFocus($focusId: ID!, $updateData: FocusInput!) {
    updateFocus(focusId: $focusId, updateData: $updateData) {
      id
    }
  }
`;

const DELETE_FOCUS_MUTATION = gql`
  mutation DeleteFocus($focusId: ID!) {
    deleteFocus(focusId: $focusId)
  }
`;


class GraphQLFocusService {
  async getFocusesForRole(userRole) {
    try {
      console.log(`🔍 Getting focuses for role from GraphQL: ${userRole}`);
      const { data } = await apolloClient.query({
        query: GET_FOCUSES_BY_ROLE_QUERY,
        variables: { role: userRole },
        fetchPolicy: 'network-only', // Always fetch from the network
      });

      console.log(`✅ Found ${data.focusesByRole.length} focuses for role ${userRole}`);
      return data.focusesByRole;
    } catch (error) {
      console.error('❌ Error getting focuses from GraphQL:', error);
      return [];
    }
  }

  async createFocus(focusData) {
    try {
      console.log(`🆕 Creating focus via GraphQL: ${focusData.name}`);
      const { data } = await apolloClient.mutate({
        mutation: CREATE_FOCUS_MUTATION,
        variables: { focusData },
      });
      console.log(`✅ Created focus with ID: ${data.createFocus.id}`);
      return data.createFocus;
    } catch (error) {
      console.error('❌ Error creating focus via GraphQL:', error);
      return null;
    }
  }

  async updateFocus(focusId, updateData) {
    try {
      console.log(`📝 Updating focus via GraphQL: ${focusId}`);
      await apolloClient.mutate({
        mutation: UPDATE_FOCUS_MUTATION,
        variables: { focusId, updateData },
      });
      console.log(`✅ Updated focus: ${focusId}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating focus via GraphQL:', error);
      return false;
    }
  }

  async deleteFocus(focusId) {
    try {
      console.log(`🗑️ Deleting focus via GraphQL: ${focusId}`);
      await apolloClient.mutate({
        mutation: DELETE_FOCUS_MUTATION,
        variables: { focusId },
      });
      console.log(`✅ Deleted focus: ${focusId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting focus via GraphQL:', error);
      return false;
    }
  }
}

const graphQLFocusService = new GraphQLFocusService();
export default graphQLFocusService;
