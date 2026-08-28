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

/** In-flight load promises keyed by userId (single-flight). */
const inflightByUserId = new Map();
/** Last successful profile payload keyed by userId. */
const cacheByUserId = new Map();

export const getCurrentUserId = () => {
  try {
    const tid = GraphQLUtils.getTaliaUserId?.();
    if (tid) return tid;
    return localStorage.getItem('devUserId') || 'dev-user-1';
  } catch {
    return 'dev-user-1';
  }
};

const writeWindowSnapshot = (profile) => {
  if (typeof window === 'undefined') return;
  const next = profile && typeof profile === 'object' ? profile : {};
  window.__taliaUserProfileState = {
    ...(window.__taliaUserProfileState || {}),
    ...next,
    componentOptions: {
      ...(window.__taliaUserProfileState?.componentOptions || {}),
      ...(next.componentOptions || {}),
    },
  };
};

/**
 * Sync read of the last known profile (memory cache or window snapshot).
 * Used to seed Options chrome before async hydrate finishes.
 * @returns {object|null} profile object, or null when never loaded
 */
export const getCachedUserProfileState = (userId) => {
  const targetUserId = userId || getCurrentUserId();
  if (cacheByUserId.has(targetUserId)) {
    return cacheByUserId.get(targetUserId) || {};
  }
  if (typeof window !== 'undefined' && window.__taliaUserProfileStateReady === true) {
    return window.__taliaUserProfileState || {};
  }
  return null;
};

/** True when we have already loaded a profile for this user. */
export const hasCachedUserProfileState = (userId) => getCachedUserProfileState(userId) != null;

/**
 * Component Options entry from cache (views / operations).
 * @returns {{ views: object, operations: object }|null} null when profile not loaded yet
 */
export const getCachedComponentOptionsEntry = (componentId, userId) => {
  const key = String(componentId || '');
  if (!key) return null;
  const profile = getCachedUserProfileState(userId);
  if (profile == null) return null;
  const entry = profile.componentOptions?.[key];
  if (entry && typeof entry === 'object') {
    return {
      views: entry.views && typeof entry.views === 'object' ? entry.views : {},
      operations: entry.operations && typeof entry.operations === 'object' ? entry.operations : {},
    };
  }
  return { views: {}, operations: {} };
};

const setCachedProfile = (userId, profile) => {
  const safe = profile && typeof profile === 'object' ? profile : {};
  cacheByUserId.set(userId, safe);
  writeWindowSnapshot(safe);
  if (typeof window !== 'undefined') {
    window.__taliaUserProfileStateReady = true;
  }
  return safe;
};

export const loadUserProfileState = async ({ userId, component = 'User Profile', force = false } = {}) => {
  const targetUserId = userId || getCurrentUserId();

  if (!force && cacheByUserId.has(targetUserId)) {
    const cached = cacheByUserId.get(targetUserId) || {};
    writeWindowSnapshot(cached);
    return cached;
  }

  if (!force && inflightByUserId.has(targetUserId)) {
    return inflightByUserId.get(targetUserId);
  }

  const pending = (async () => {
    try {
      const data = await trackedFetchGraphql({
        query: USER_PROFILE_STATE_QUERY,
        variables: { userId: targetUserId },
        component,
        purpose: `Load user profile state for ${targetUserId}`,
        tableName: 'config_setting',
      });
      return setCachedProfile(targetUserId, data?.userProfileState || {});
    } catch (e) {
      // Older GraphQL stacks (e.g. MVP not yet redeployed) omit userProfileState; treat as empty profile.
      console.warn('[userProfileState] load skipped (GraphQL unavailable or schema mismatch):', e?.message || e);
      return setCachedProfile(targetUserId, {});
    } finally {
      inflightByUserId.delete(targetUserId);
    }
  })();

  inflightByUserId.set(targetUserId, pending);
  return pending;
};

export const saveUserProfileState = async ({ patch, userId, component = 'User Profile' } = {}) => {
  const targetUserId = userId || getCurrentUserId();
  const safePatch = patch && typeof patch === 'object' ? patch : {};
  const data = await trackedFetchGraphql({
    query: SAVE_USER_PROFILE_STATE_MUTATION,
    variables: { patch: safePatch, userId: targetUserId },
    component,
    purpose: `Save user profile state for ${targetUserId}`,
    tableName: 'config_setting',
  });
  const saved = data?.saveUserProfileState || {};
  const prev = cacheByUserId.get(targetUserId) || getCachedUserProfileState(targetUserId) || {};
  const merged = {
    ...prev,
    ...saved,
    componentOptions: {
      ...(prev.componentOptions || {}),
      ...(saved.componentOptions || {}),
      ...(safePatch.componentOptions || {}),
    },
  };
  return setCachedProfile(targetUserId, merged);
};
