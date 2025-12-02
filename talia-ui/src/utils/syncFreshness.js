/**
 * Sync Freshness Utilities
 * 
 * Provides functions to calculate and visualize sync freshness
 * Uses a 7-day scale: Green (fresh) → Yellow → Orange → Red (stale)
 */

/**
 * Calculate days since last sync
 * @param {string|Date} lastSyncDate - ISO date string or Date object
 * @returns {number} Days since last sync (0 = today, 7+ = stale)
 */
export function getDaysSinceSync(lastSyncDate) {
  if (!lastSyncDate) return null;
  
  const lastSync = new Date(lastSyncDate);
  const now = new Date();
  const diffMs = now - lastSync;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return Math.max(0, Math.floor(diffDays));
}

/**
 * Get sync freshness status
 * @param {string|Date} lastSyncDate - ISO date string or Date object
 * @returns {Object} { days: number, status: 'fresh'|'recent'|'moderate'|'stale'|'very-stale', color: string }
 */
export function getSyncFreshness(lastSyncDate) {
  const days = getDaysSinceSync(lastSyncDate);
  
  if (days === null) {
    return {
      days: null,
      status: 'unknown',
      color: '#888888', // Gray for unknown
      label: 'Never synced'
    };
  }
  
  if (days === 0) {
    return {
      days: 0,
      status: 'fresh',
      color: '#4CAF50', // Green
      label: 'Synced today'
    };
  } else if (days <= 1) {
    return {
      days,
      status: 'fresh',
      color: '#66BB6A', // Light green
      label: `Synced ${days} day ago`
    };
  } else if (days <= 3) {
    return {
      days,
      status: 'recent',
      color: '#FFC107', // Yellow
      label: `Synced ${days} days ago`
    };
  } else if (days <= 5) {
    return {
      days,
      status: 'moderate',
      color: '#FF9800', // Orange
      label: `Synced ${days} days ago`
    };
  } else if (days <= 7) {
    return {
      days,
      status: 'stale',
      color: '#F44336', // Red
      label: `Synced ${days} days ago`
    };
  } else {
    return {
      days,
      status: 'very-stale',
      color: '#D32F2F', // Dark red
      label: `Synced ${days}+ days ago`
    };
  }
}

/**
 * Get color gradient for sync freshness (smooth transition)
 * @param {string|Date} lastSyncDate - ISO date string or Date object
 * @returns {string} Hex color code
 */
export function getSyncFreshnessColor(lastSyncDate) {
  const freshness = getSyncFreshness(lastSyncDate);
  return freshness.color;
}

