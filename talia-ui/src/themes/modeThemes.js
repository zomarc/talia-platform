/**
 * Theme configurations for different application modes
 */

export const modeThemes = {
  app: {
    name: 'Default',
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      sidebar: '#f7f3ee',
      sidebarBorder: '#e8dfd0',
      sidebarHeader: '#f5efe6',
      accent: '#b08d57',
      accentHover: 'rgba(176, 141, 87, 0.6)',
      accentLight: 'rgba(176, 141, 87, 0.3)',
      textSecondary: '#6b6b6b',
      textMuted: '#999',
      border: '#e8dfd0',
      hover: '#fff7ea',
      selected: '#fdeacc'
    }
  },
  test: {
    name: 'Dark Glass',
    colors: {
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      foreground: '#e0e0e0',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarBorder: 'rgba(255, 255, 255, 0.1)',
      sidebarHeader: 'rgba(255, 255, 255, 0.08)',
      accent: '#64ffda',
      accentHover: 'rgba(100, 255, 218, 0.6)',
      accentLight: 'rgba(100, 255, 218, 0.3)',
      glass: 'rgba(255, 255, 255, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.2)',
      glassHover: 'rgba(255, 255, 255, 0.15)',
      textSecondary: 'rgba(224, 224, 224, 0.7)',
      textMuted: 'rgba(224, 224, 224, 0.5)',
      border: 'rgba(255, 255, 255, 0.2)',
      hover: 'rgba(255, 255, 255, 0.1)',
      selected: 'rgba(100, 255, 218, 0.2)'
    }
  },
  data: {
    name: 'Dark Glass',
    colors: {
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      foreground: '#e0e0e0',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarBorder: 'rgba(255, 255, 255, 0.1)',
      sidebarHeader: 'rgba(255, 255, 255, 0.08)',
      accent: '#64ffda',
      accentHover: 'rgba(100, 255, 218, 0.6)',
      accentLight: 'rgba(100, 255, 218, 0.3)',
      glass: 'rgba(255, 255, 255, 0.1)',
      glassBorder: 'rgba(255, 255, 255, 0.2)',
      glassHover: 'rgba(255, 255, 255, 0.15)',
      textSecondary: 'rgba(224, 224, 224, 0.7)',
      textMuted: 'rgba(224, 224, 224, 0.5)',
      border: 'rgba(255, 255, 255, 0.2)',
      hover: 'rgba(255, 255, 255, 0.1)',
      selected: 'rgba(100, 255, 218, 0.2)'
    }
  }
};

/**
 * Get theme for a specific mode
 */
export const getThemeForMode = (mode) => {
  return modeThemes[mode] || modeThemes.app;
};

export default modeThemes;



