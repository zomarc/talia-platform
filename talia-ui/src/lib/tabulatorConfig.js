/**
 * Shared Tabulator Configuration
 * Centralized configuration for all Tabulator table instances
 */

// CDN URLs for Tabulator
export const TABULATOR_CONFIG = {
  css: 'https://unpkg.com/tabulator-tables@5.6.1/dist/css/tabulator_midnight.min.css',
  js: 'https://unpkg.com/tabulator-tables@5.6.1/dist/js/tabulator.min.js'
};

/**
 * Load Tabulator CSS from CDN
 * @param {string} url - CSS URL
 * @returns {Promise} Resolves when CSS is loaded
 */
export const loadTabulatorCss = (url = TABULATOR_CONFIG.css) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${url}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load Tabulator CSS: ${url}`));
    document.head.appendChild(link);
  });
};

/**
 * Load Tabulator JS from CDN
 * @param {string} url - JS URL
 * @returns {Promise<Tabulator>} Resolves with Tabulator constructor
 */
export const loadTabulatorJs = (url = TABULATOR_CONFIG.js) => {
  return new Promise((resolve, reject) => {
    if (window.Tabulator || window.TabulatorFull) {
      resolve(window.Tabulator || window.TabulatorFull);
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve(window.Tabulator || window.TabulatorFull);
    script.onerror = () => reject(new Error(`Failed to load Tabulator JS: ${url}`));
    document.head.appendChild(script);
  });
};

/**
 * Initialize Tabulator (loads both CSS and JS)
 * Uses Tabulator's default styling - no custom CSS overrides
 * @returns {Promise<Tabulator>} Resolves with Tabulator constructor
 */
export const initTabulator = async () => {
  await loadTabulatorCss();
  const Tabulator = await loadTabulatorJs();
  return Tabulator;
};

/**
 * Get theme-aware Tabulator options
 * Merges default options with theme-specific settings
 * @param {Object} options - Additional options to merge
 * @param {Object} themeContext - Theme context from useTheme hook (optional)
 * @returns {Object} Tabulator configuration object
 */
export const getTabulatorOptions = (options = {}, themeContext = null) => {
  const baseOptions = {
    ...DEFAULT_TABULATOR_OPTIONS,
    ...options
  };

  // Apply theme-aware settings if theme context is provided
  if (themeContext) {
    const { fontSize, spacingMode } = themeContext;
    
    // Override with theme-aware values
    if (fontSize !== undefined) {
      baseOptions.fontSize = fontSize;
      baseOptions.headerHeight = spacingMode === 'compact' 
        ? Math.max(28, fontSize + 6) 
        : Math.max(35, fontSize + 12);
      baseOptions.rowHeight = spacingMode === 'compact' 
        ? Math.max(24, fontSize + 4) 
        : Math.max(32, fontSize + 8);
    }
  }

  return baseOptions;
};

/**
 * Default Tabulator options for consistent styling
 */
export const DEFAULT_TABULATOR_OPTIONS = {
  layout: 'fitColumns',
  reactiveData: false,
  height: '100%',
  selectable: 1,
  headerFilterLiveFilter: true,
  headerFilterLiveFilterDelay: 300,
  fontSize: 12,
  headerHeight: 35,
  rowHeight: 32,
  theme: 'midnight'
};

/**
 * Common Tabulator column types
 */
export const COMMON_COLUMN_TYPES = {
  // Input filter column
  input: (config = {}) => ({
    headerFilter: 'input',
    headerFilterPlaceholder: config.placeholder || 'Filter...',
    ...config
  }),

  // Dropdown filter column
  dropdown: (config = {}) => ({
    headerFilter: 'list',
    headerFilterParams: {
      values: config.values || {},
      clearable: config.clearable !== false
    },
    ...config
  }),

  // Number filter column
  number: (config = {}) => ({
    headerFilter: 'input',
    headerFilterPlaceholder: config.placeholder || 'Enter number...',
    headerFilterFunc: config.operator || '>=',
    headerFilterParams: {
      type: 'number'
    },
    hozAlign: 'center',
    ...config
  }),

  // Date filter column
  date: (config = {}) => ({
    headerFilter: 'input',
    headerFilterPlaceholder: config.placeholder || 'YYYY-MM-DD',
    formatter: (cell) => {
      const value = cell.getValue();
      if (!value) return '';
      const date = new Date(value);
      return date.toLocaleDateString(config.locale || 'en-US');
    },
    ...config
  }),

  // Boolean/Yes-No column
  boolean: (config = {}) => ({
    hozAlign: 'center',
    formatter: (cell) => {
      const value = cell.getValue();
      return value === 'Y' || value === true ? 'Yes' : 'No';
    },
    ...config
  })
};

