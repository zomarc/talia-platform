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
 * Inject global Tabulator custom CSS after theme CSS loads
 * This ensures proper cascade order: midnight theme -> our custom styles
 */
const injectGlobalTabulatorCss = () => {
  // Check if already injected
  if (document.getElementById('talia-tabulator-global-css')) {
    return;
  }

  // Create style element with global CSS
  const style = document.createElement('style');
  style.id = 'talia-tabulator-global-css';
  style.textContent = `
    /* 
     * Global Tabulator Styling - matches Data Management screen exactly
     * 
     * STEP 1: Make table container transparent
     * The Data Management screen uses a glass container (rgba(255, 255, 255, 0.08))
     * with backdrop blur. The table itself must be transparent to show this through.
     */
    .tabulator {
      background: transparent !important;
    }

    .tabulator-tableHolder {
      background: transparent !important;
    }

    /* 
     * STEP 2: Style table header to match Data Mode
     * Data Mode header uses: background rgba(255, 255, 255, 0.08) with backdrop blur(10px)
     * This matches the table header row style in Data Management screen (theme.colors.glass)
     */
    .tabulator-header {
      background: var(--theme-glass, rgba(255, 255, 255, 0.08)) !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      color: var(--theme-text-secondary, rgba(232, 232, 240, 0.75)) !important;
      border-bottom: 1px solid var(--theme-glass-border, rgba(255, 255, 255, 0.15)) !important;
    }

    .tabulator-header .tabulator-col {
      padding: 6px 8px !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      color: var(--theme-text-secondary, rgba(232, 232, 240, 0.75)) !important;
      background: transparent !important;
    }

    .tabulator-header .tabulator-col-content {
      font-size: 10px !important;
      color: var(--theme-text-secondary, rgba(232, 232, 240, 0.75)) !important;
    }

    /* 
     * STEP 3: Style table body - transparent background
     * The table body must be transparent so the glass container shows through
     */
    .tabulator-table {
      background: transparent !important;
    }

    /* 
     * STEP 4: Cell styling - matches Data Mode exactly
     * Font: 10px monospace, padding 6px 8px, foreground color
     */
    .tabulator-cell {
      font-size: 10px !important;
      font-family: monospace !important;
      padding: 6px 8px !important;
      color: var(--theme-fg, #e8e8f0) !important;
      background: transparent !important;
    }

    /* 
     * STEP 5: Row backgrounds - match Data Mode alternating colors exactly
     * Even rows: transparent (matches Data Mode table-row-even)
     * Odd rows: rgba(0, 0, 0, 0.2) (matches Data Mode table-row-odd)
     * These use CSS variables from theme system for consistency
     */
    .tabulator-row {
      border-bottom: 1px solid var(--theme-glass-border, rgba(255, 255, 255, 0.15)) !important;
      transition: background-color 0.15s ease !important;
      background: transparent !important;
    }

    /* Even rows: transparent (same as Data Mode) */
    .tabulator-row:nth-child(even) {
      background-color: var(--theme-table-row-even, transparent) !important;
    }

    /* Odd rows: rgba(0, 0, 0, 0.2) (same as Data Mode) */
    .tabulator-row:nth-child(odd) {
      background-color: var(--theme-table-row-odd, rgba(0, 0, 0, 0.2)) !important;
    }

    /* 
     * STEP 6: Hover and selected states - match Data Mode exactly
     * Hover: rgba(66, 133, 244, 0.5) (blue tint)
     * Selected: rgba(66, 133, 244, 0.25) (lighter blue)
     * Selected hover: rgba(66, 133, 244, 0.6) (darker blue)
     */
    .tabulator-row:hover {
      background-color: var(--theme-table-row-hover, rgba(66, 133, 244, 0.5)) !important;
    }

    .tabulator-row.tabulator-selected {
      background-color: var(--theme-table-row-selected, rgba(66, 133, 244, 0.25)) !important;
    }

    .tabulator-row.tabulator-selected:hover {
      background-color: var(--theme-table-row-selected-hover, rgba(66, 133, 244, 0.6)) !important;
    }
  `;
  
  // Insert after Tabulator's CSS if it exists
  const tabulatorLink = document.querySelector('link[href*="tabulator"]');
  if (tabulatorLink && tabulatorLink.nextSibling) {
    tabulatorLink.parentNode.insertBefore(style, tabulatorLink.nextSibling);
  } else {
    document.head.appendChild(style);
  }
};

/**
 * Initialize Tabulator (loads both CSS and JS)
 * Loads midnight theme CSS, then injects our global custom CSS
 * @returns {Promise<Tabulator>} Resolves with Tabulator constructor
 */
export const initTabulator = async () => {
  await loadTabulatorCss();
  // Inject global custom CSS after theme CSS loads
  injectGlobalTabulatorCss();
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

