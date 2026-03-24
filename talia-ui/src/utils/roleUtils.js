/**
 * Role utility functions for normalizing and checking user roles
 */

/**
 * Normalize role to uppercase for consistency
 * @param {string} role - Role string (can be lowercase or uppercase)
 * @returns {string} - Normalized uppercase role
 */
export const normalizeRole = (role) => {
  if (!role) return 'USER';
  return role.toUpperCase();
};

/**
 * Check if user is admin (handles both 'admin' and 'ADMIN')
 * @param {string} role - User role
 * @returns {boolean} - True if admin
 */
export const isAdmin = (role) => {
  return normalizeRole(role) === 'ADMIN';
};

/**
 * Check if user is super user (supports naming variants)
 * @param {string} role - User role
 * @returns {boolean} - True if super user
 */
export const isSuperUser = (role) => {
  const normalized = normalizeRole(role);
  return normalized === 'SUPER_USER' || normalized === 'SUPERUSER';
};

/**
 * Header capability gate for advanced controls
 * @param {string} role - User role
 * @returns {boolean} - True if role can use advanced header controls
 */
export const canUseAdvancedHeader = (role) => {
  return isAdmin(role) || isSuperUser(role);
};

/**
 * Gate for privileged internal panels (Test/Data Management).
 * Centralized so all entry points share identical role behavior.
 * @param {string} role - User role
 * @returns {boolean} - True if role may access privileged panels
 */
export const canAccessPrivilegedPanels = (role) => {
  return isAdmin(role) || isSuperUser(role);
};

/**
 * Check if user has required role or higher
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean} - True if user has required role or higher
 */
export const hasRole = (userRole, requiredRole) => {
  const roleHierarchy = {
    'GUEST': 0,
    'USER': 1,
    'MANAGER': 2,
    'ADMIN': 3
  };
  
  const userLevel = roleHierarchy[normalizeRole(userRole)] || 0;
  const requiredLevel = roleHierarchy[normalizeRole(requiredRole)] || 0;
  
  return userLevel >= requiredLevel;
};

/**
 * Mutate Talia-owned intelligence (REAL/TARGET/BUDGET/MODEL curves, target_profiles).
 * Mirrors server `canEditTaliaIntel`: Manager+ or Super User variants.
 * @param {string} [role]
 * @returns {boolean}
 */
export const canEditTaliaIntel = (role) => {
  const r = normalizeRole(role);
  if (r === 'SUPER_USER' || r === 'SUPERUSER') return true;
  return hasRole(role, 'MANAGER');
};

