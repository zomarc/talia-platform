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

