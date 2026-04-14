import { trackedFetchGraphql } from './trackedGraphql';
import { GraphQLUtils } from '../../lib/apolloClient';

const USER_PROFILE_STATE_QUERY = `
  query UserProfileState($userId: String) {
    userProfileState(userId: $userId)
  }
`;

const SAVE_USER_PROFILE_STATE_MUTATION = `
  mutation SaveUserProfileState($patch: JSON!, $userId: String) {
    saveUserProfileState(patch: $patch, userId: $userId)
  }
`;

export const getCurrentUserId = () => {
  try {
    const tid = GraphQLUtils.getTaliaUserId?.();
    if (tid) return tid;
    return localStorage.getItem('devUserId') || 'dev-user-1';
  } catch {
    return 'dev-user-1';
  }
};

export const loadUserProfileState = async ({ userId, component = 'User Profile' } = {}) => {
  const targetUserId = userId || getCurrentUserId();
  try {
    const data = await trackedFetchGraphql({
      query: USER_PROFILE_STATE_QUERY,
      variables: { userId: targetUserId },
      component,
      purpose: `Load user profile state for ${targetUserId}`,
      tableName: 'config_setting',
    });
    return data?.userProfileState || {};
  } catch (e) {
    // Older GraphQL stacks (e.g. MVP not yet redeployed) omit userProfileState; treat as empty profile.
    console.warn('[userProfileState] load skipped (GraphQL unavailable or schema mismatch):', e?.message || e);
    return {};
  }
};

export const saveUserProfileState = async ({ patch, userId, component = 'User Profile' }) => {
  const targetUserId = userId || getCurrentUserId();
  const safePatch = patch && typeof patch === 'object' ? patch : {};
  const data = await trackedFetchGraphql({
    query: SAVE_USER_PROFILE_STATE_MUTATION,
    variables: { patch: safePatch, userId: targetUserId },
    component,
    purpose: `Save user profile state for ${targetUserId}`,
    tableName: 'config_setting',
  });
  return data?.saveUserProfileState || {};
};

