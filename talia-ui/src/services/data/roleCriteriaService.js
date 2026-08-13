/**
 * Role criteria + effective global criteria (role baseline ∪ user deltas ∪ admin override).
 */

import { trackedFetchGraphql } from './trackedGraphql';
import { GraphQLUtils } from '../../lib/apolloClient';
import { getCurrentUserId } from './userProfileState';

const ROLE_CRITERIA_QUERY = `
  query RoleCriteria($role: String!) {
    roleCriteria(role: $role)
  }
`;

const ROLE_COMPONENT_OPS_QUERY = `
  query RoleComponentOps($role: String!) {
    roleComponentOps(role: $role)
  }
`;

const EFFECTIVE_CRITERIA_QUERY = `
  query EffectiveGlobalCriteria($userId: String, $role: String) {
    effectiveGlobalCriteria(userId: $userId, role: $role)
  }
`;

const SAVE_ROLE_CRITERIA_MUTATION = `
  mutation SaveRoleCriteria($role: String!, $criteria: JSON!) {
    saveRoleCriteria(role: $role, criteria: $criteria)
  }
`;

const SAVE_ROLE_COMPONENT_OPS_MUTATION = `
  mutation SaveRoleComponentOps($role: String!, $ops: JSON!) {
    saveRoleComponentOps(role: $role, ops: $ops)
  }
`;

const SAVE_USER_CRITERIA_OVERRIDE_MUTATION = `
  mutation SaveUserCriteriaOverride($userId: String!, $criteria: JSON!, $locked: Boolean) {
    saveUserCriteriaOverride(userId: $userId, criteria: $criteria, locked: $locked)
  }
`;

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

export const mergeEffectiveCriteriaLocal = (roleCriteria, userState) => {
  const role = asObject(roleCriteria);
  const state = asObject(userState);
  const override = asObject(state.adminCriteriaOverride);
  if (Object.keys(override).length > 0) {
    return { ...role, ...override };
  }
  return { ...role, ...asObject(state.globalCriteria) };
};

export const loadRoleCriteria = async (role, { component = 'Role Criteria' } = {}) => {
  const targetRole = String(role || GraphQLUtils.getUserRole?.() || 'USER').toUpperCase();
  try {
    const data = await trackedFetchGraphql({
      query: ROLE_CRITERIA_QUERY,
      variables: { role: targetRole },
      component,
      purpose: `Load role criteria for ${targetRole}`,
      tableName: 'config_setting',
    });
    return asObject(data?.roleCriteria);
  } catch (error) {
    console.warn('[roleCriteria] load skipped:', error?.message || error);
    return {};
  }
};

export const loadRoleComponentOps = async (role, { component = 'Role Ops' } = {}) => {
  const targetRole = String(role || GraphQLUtils.getUserRole?.() || 'USER').toUpperCase();
  try {
    const data = await trackedFetchGraphql({
      query: ROLE_COMPONENT_OPS_QUERY,
      variables: { role: targetRole },
      component,
      purpose: `Load role component ops for ${targetRole}`,
      tableName: 'config_setting',
    });
    return asObject(data?.roleComponentOps);
  } catch (error) {
    console.warn('[roleComponentOps] load skipped:', error?.message || error);
    return {};
  }
};

export const loadEffectiveGlobalCriteria = async ({
  userId,
  role,
  component = 'StatusBar',
} = {}) => {
  const targetUserId = userId || getCurrentUserId();
  const targetRole = String(role || GraphQLUtils.getUserRole?.() || 'USER').toUpperCase();
  try {
    const data = await trackedFetchGraphql({
      query: EFFECTIVE_CRITERIA_QUERY,
      variables: { userId: targetUserId, role: targetRole },
      component,
      purpose: `Load effective criteria for ${targetUserId}/${targetRole}`,
      tableName: 'config_setting',
    });
    return asObject(data?.effectiveGlobalCriteria);
  } catch (error) {
    console.warn('[effectiveGlobalCriteria] load skipped:', error?.message || error);
    return {};
  }
};

export const saveRoleCriteria = async (role, criteria, { component = 'Admin Role Criteria' } = {}) => {
  const targetRole = String(role || 'USER').toUpperCase();
  const data = await trackedFetchGraphql({
    query: SAVE_ROLE_CRITERIA_MUTATION,
    variables: { role: targetRole, criteria: asObject(criteria) },
    component,
    purpose: `Save role criteria for ${targetRole}`,
    tableName: 'config_setting',
  });
  return asObject(data?.saveRoleCriteria);
};

export const saveRoleComponentOps = async (role, ops, { component = 'Admin Role Ops' } = {}) => {
  const targetRole = String(role || 'USER').toUpperCase();
  const data = await trackedFetchGraphql({
    query: SAVE_ROLE_COMPONENT_OPS_MUTATION,
    variables: { role: targetRole, ops: asObject(ops) },
    component,
    purpose: `Save role component ops for ${targetRole}`,
    tableName: 'config_setting',
  });
  return asObject(data?.saveRoleComponentOps);
};

export const saveUserCriteriaOverride = async (
  userId,
  criteria,
  { locked = false, component = 'Admin Criteria Override' } = {}
) => {
  const data = await trackedFetchGraphql({
    query: SAVE_USER_CRITERIA_OVERRIDE_MUTATION,
    variables: {
      userId: String(userId),
      criteria: asObject(criteria),
      locked: locked === true,
    },
    component,
    purpose: `Save admin criteria override for ${userId}`,
    tableName: 'config_setting',
  });
  return asObject(data?.saveUserCriteriaOverride);
};
