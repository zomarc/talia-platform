/**
 * Map Celestyal / Entra OIDC claims → Talia role.
 * First-login seed only — callers must not overwrite an existing talia_users.role.
 */

export const TALIA_ROLES = Object.freeze([
  'GUEST',
  'USER',
  'MANAGER',
  'ADMIN',
  'SUPER_USER',
]);

const normalizeRole = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SUPERUSER') return 'SUPER_USER';
  if (TALIA_ROLES.includes(raw)) return raw;
  return null;
};

/**
 * Parse VITE_OIDC_ROLE_MAP JSON: { "group-id-or-name": "MANAGER", "talia_role_claim_value": "ADMIN" }
 * @param {string|object|null|undefined} raw
 */
export function parseOidcRoleMap(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...raw };
  }
  const text = String(raw || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // ignore invalid JSON
  }
  return {};
}

/**
 * Collect group ids / names and explicit role claim from a Supabase user / identity payload.
 * @param {object} supabaseUser
 */
export function extractOidcRoleHints(supabaseUser = {}) {
  const meta = {
    ...(supabaseUser.app_metadata || {}),
    ...(supabaseUser.user_metadata || {}),
  };
  const identities = Array.isArray(supabaseUser.identities) ? supabaseUser.identities : [];
  const identityData = identities.reduce((acc, identity) => ({
    ...acc,
    ...(identity?.identity_data || {}),
  }), {});

  const groups = [];
  const pushGroup = (value) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(pushGroup);
      return;
    }
    groups.push(String(value).trim());
  };

  pushGroup(meta.groups);
  pushGroup(meta.group);
  pushGroup(meta.roles);
  pushGroup(identityData.groups);
  pushGroup(identityData.group);

  const explicit = meta.talia_role
    || meta.taliaRole
    || identityData.talia_role
    || identityData.taliaRole
    || null;

  const oidcSub = String(
    meta.sub
    || identityData.sub
    || identities.find((row) => row?.provider === 'azure')?.id
    || identities[0]?.id
    || ''
  ).trim() || null;

  return {
    oidcSub,
    groups,
    explicitRole: explicit,
  };
}

/**
 * Resolve initial Talia role from OIDC hints + optional map.
 * @param {object} [supabaseUser]
 * @param {string|object|null} [roleMapRaw] defaults to import.meta.env.VITE_OIDC_ROLE_MAP in browser
 */
export function resolveOidcSeedRole(supabaseUser = {}, roleMapRaw = undefined) {
  const mapSource = roleMapRaw !== undefined
    ? roleMapRaw
    : (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_OIDC_ROLE_MAP : undefined);
  const roleMap = parseOidcRoleMap(mapSource);
  const { groups, explicitRole } = extractOidcRoleHints(supabaseUser);

  const fromExplicit = normalizeRole(explicitRole);
  if (fromExplicit) return fromExplicit;

  const mappedExplicit = normalizeRole(roleMap[String(explicitRole || '')]);
  if (mappedExplicit) return mappedExplicit;

  for (const group of groups) {
    const fromGroup = normalizeRole(roleMap[group]);
    if (fromGroup) return fromGroup;
  }

  return 'USER';
}
