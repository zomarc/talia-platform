/**
 * GraphQL client for nested load-factor inventory target profiles.
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';
import { trackedApolloQuery, trackedApolloMutate } from './trackedGraphql';

const NODE_FIELDS = `
  id
  profileId
  dimensionLevel
  dimensionKey
  parentNodeId
  weekLabel
  weeksUntilSailing
  lfPct
  pointOrder
  metadata
`;

const PROFILE_FIELDS = `
  id
  inventoryItemId
  name
  perspective
  description
  metric
  profileScope
  ownerKey
  lastEditedBy
  isActive
  isLibrary
  createdAt
  updatedAt
  nodes { ${NODE_FIELDS} }
`;

const LIST_PROFILES = gql`
  query InventoryTargetProfiles($inventoryItemId: ID!) {
    inventoryTargetProfiles(inventoryItemId: $inventoryItemId) {
      ${PROFILE_FIELDS}
    }
  }
`;

const LIST_LIBRARY = gql`
  query InventoryTargetProfileLibrary {
    inventoryTargetProfileLibrary {
      ${PROFILE_FIELDS}
    }
  }
`;

const UPSERT_PROFILE = gql`
  mutation UpsertInventoryTargetProfile($input: UpsertInventoryTargetProfileInput!) {
    upsertInventoryTargetProfile(input: $input) {
      ${PROFILE_FIELDS}
    }
  }
`;

const DELETE_PROFILE = gql`
  mutation DeleteInventoryTargetProfile($id: ID!) {
    deleteInventoryTargetProfile(id: $id)
  }
`;

const SET_ACTIVE = gql`
  mutation SetActiveInventoryTargetProfile($id: ID!) {
    setActiveInventoryTargetProfile(id: $id) {
      ${PROFILE_FIELDS}
    }
  }
`;

class InventoryTargetProfileService {
  async list(inventoryItemId) {
    if (!inventoryItemId) return [];
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: LIST_PROFILES,
      variables: { inventoryItemId: String(inventoryItemId) },
      component: 'Target Profile Editor',
      purpose: 'List nested LF target profiles',
      tableName: 'inventory_target_profile',
      options: { fetchPolicy: 'network-only' },
    });
    return data?.inventoryTargetProfiles || [];
  }

  async listLibrary() {
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: LIST_LIBRARY,
      component: 'Target Profile Editor',
      purpose: 'List reusable generic target profiles',
      tableName: 'inventory_target_profile',
      options: { fetchPolicy: 'network-only' },
    });
    return data?.inventoryTargetProfileLibrary || [];
  }

  async upsert(input) {
    const { data } = await trackedApolloMutate({
      client: apolloClient,
      mutation: UPSERT_PROFILE,
      variables: { input },
      component: 'Target Profile Editor',
      purpose: 'Upsert nested LF target profile',
      tableName: 'inventory_target_profile',
    });
    return data?.upsertInventoryTargetProfile;
  }

  async delete(id) {
    const { data } = await trackedApolloMutate({
      client: apolloClient,
      mutation: DELETE_PROFILE,
      variables: { id: String(id) },
      component: 'Target Profile Editor',
      purpose: 'Delete nested LF target profile',
      tableName: 'inventory_target_profile',
    });
    return data?.deleteInventoryTargetProfile;
  }

  async setActive(id) {
    const { data } = await trackedApolloMutate({
      client: apolloClient,
      mutation: SET_ACTIVE,
      variables: { id: String(id) },
      component: 'Target Profile Editor',
      purpose: 'Activate target profile',
      tableName: 'inventory_target_profile',
    });
    return data?.setActiveInventoryTargetProfile;
  }
}

const inventoryTargetProfileService = new InventoryTargetProfileService();
export default inventoryTargetProfileService;
