/**
 * Component Registry for Test Page
 * Maps component names to their imports and provides metadata
 */

import SailingTableContainer from '../focus-panels/SailingTable';
import SimpleTable from '../focus-panels/SimpleTable';
import KPICards from '../focus-panels/KPICards';
import PublishedRates from '../focus-panels/PublishedRates';
import OccupancyChart from '../focus-panels/OccupancyChart';
import RevenueBreakdown from '../focus-panels/RevenueBreakdown';
import SailingSummary from '../focus-panels/SailingSummary';
import SailingByCabinCategory from '../focus-panels/SailingByCabinCategory';
import ExceptionList from '../focus-panels/ExceptionList';
import ItineraryList from '../focus-panels/ItineraryList';
import ReservationCurrentStateContainer from '../focus-panels/ReservationCurrentState';
import BookingProfileContainer from '../focus-panels/BookingProfile';
import TargetProfileEditorContainer from '../focus-panels/TargetProfileEditor';
import CompetitorPricingContainer from '../focus-panels/CompetitorPricing';
import DemandHeatmapContainer from '../focus-panels/DemandHeatmap';
import GoogleSearchContainer from '../focus-panels/GoogleSearch';
import SearchTrendsContainer from '../focus-panels/SearchTrends';

/**
 * Component registry with metadata
 */
export const componentRegistry = {
  SailingTable: {
    component: SailingTableContainer,
    category: 'Tables',
    description: 'Interactive sailing data table with filtering and sorting',
    props: {
      filters: { type: 'object', required: false, description: 'Filter object with sail_code, ship_name, limit' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to masterSail endpoint',
    filePath: 'src/components/focus-panels/SailingTable/index.jsx'
  },
  SimpleTable: {
    component: SimpleTable,
    category: 'Tables',
    description: 'Simple table component for displaying tabular data',
    props: {
      data: { type: 'array', required: true, description: 'Array of data objects' },
      columns: { type: 'array', required: false, description: 'Column definitions' }
    },
    dataRequirements: 'Requires data prop',
    filePath: 'src/components/focus-panels/SimpleTable.jsx'
  },
  KPICards: {
    component: KPICards,
    category: 'Dashboards',
    description: 'Key Performance Indicator cards displaying metrics',
    props: {},
    dataRequirements: 'Uses mock data',
    filePath: 'src/components/focus-panels/KPICards.jsx'
  },
  PublishedRates: {
    component: PublishedRates,
    category: 'Tables',
    description: 'Published rates table with Tabulator integration',
    props: {},
    dataRequirements: 'Loads data from local JSON or API',
    filePath: 'src/components/focus-panels/PublishedRates/index.jsx'
  },
  OccupancyChart: {
    component: OccupancyChart,
    category: 'Charts',
    description: 'Occupancy visualization chart',
    props: {},
    dataRequirements: 'Requires occupancy data',
    filePath: 'src/components/focus-panels/OccupancyChart.jsx'
  },
  RevenueBreakdown: {
    component: RevenueBreakdown,
    category: 'Charts',
    description: 'Revenue breakdown visualization',
    props: {},
    dataRequirements: 'Requires revenue data',
    filePath: 'src/components/focus-panels/RevenueBreakdown.jsx'
  },
  SailingSummary: {
    component: SailingSummary,
    category: 'Dashboards',
    description: 'Sailing summary dashboard with key metrics',
    props: {},
    dataRequirements: 'Requires sailing data',
    filePath: 'src/components/focus-panels/SailingSummary.jsx'
  },
  SailingByCabinCategory: {
    component: SailingByCabinCategory,
    category: 'Charts',
    description: 'Sailing data grouped by cabin category',
    props: {},
    dataRequirements: 'Requires cabin and sailing data',
    filePath: 'src/components/focus-panels/SailingByCabinCategory.jsx'
  },
  ExceptionList: {
    component: ExceptionList,
    category: 'Lists',
    description: 'List of exceptions and alerts',
    props: {},
    dataRequirements: 'Uses mock data',
    filePath: 'src/components/focus-panels/ExceptionList.jsx'
  },
  ItineraryList: {
    component: ItineraryList,
    category: 'Lists',
    description: 'List of cruise itineraries',
    props: {},
    dataRequirements: 'Uses mock data',
    filePath: 'src/components/focus-panels/ItineraryList.jsx'
  },
  ReservationCurrentState: {
    component: ReservationCurrentStateContainer,
    category: 'Tables',
    description: 'Reservation current state table - reacts to sail selection from SailingTable',
    props: {
      filters: { type: 'object', required: false, description: 'Filter object with sail_code, ship, res_status, etc.' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to reservations endpoint. Reacts to talia:sail.select events.',
    filePath: 'src/components/focus-panels/ReservationCurrentState/index.jsx'
  },
  BookingProfile: {
    component: BookingProfileContainer,
    category: 'Dashboards',
    description: 'Booking profile showing booking trends, metrics, year-over-year comparison, and build curves for a sailing',
    props: {
      sailCode: { type: 'string', required: true, description: 'Sail code (e.g., "CJ07250901")' },
      includeComparison: { type: 'boolean', required: false, description: 'Include year-over-year comparison' },
      previousYearSailCode: { type: 'string', required: false, description: 'Previous year sail code for comparison' },
      includeBuildCurves: { type: 'boolean', required: false, description: 'Include incremental build curves (W-12, W-10, W-8, W-6, W-4, W-2, Sail)' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to bookingProfile and bookingProfileWithCurves endpoints',
    filePath: 'src/components/focus-panels/BookingProfile/index.jsx'
  },
  TargetProfileEditor: {
    component: TargetProfileEditorContainer,
    category: 'Editors',
    description: 'Create and edit target booking profiles with build curves based on historic data',
    props: {
      targetProfileId: { type: 'string', required: false, description: 'Target profile ID for editing (omit for new profile)' },
      sailCode: { type: 'string', required: false, description: 'Sail code to associate with target profile' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' },
      onSave: { type: 'function', required: false, description: 'Callback when profile is saved' },
      onCancel: { type: 'function', required: false, description: 'Callback when editing is cancelled' }
    },
    dataRequirements: 'Requires GraphQL connection to targetProfiles endpoints (create, update, delete)',
    filePath: 'src/components/focus-panels/TargetProfileEditor/index.jsx'
  },
  CompetitorPricing: {
    component: CompetitorPricingContainer,
    category: 'Dashboards',
    description: 'Competitor pricing analysis with scatter plots by cabin type and detailed pricing table',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to competitorPricing endpoint',
    filePath: 'src/components/focus-panels/CompetitorPricing/index.jsx'
  },
  DemandHeatmap: {
    component: DemandHeatmapContainer,
    category: 'Dashboards',
    description: 'Viewing demand heatmap showing demand across itineraries by departure month',
    usesMockData: true, // This component uses mock data from demand_heatmap_data table
    props: {
      filters: { 
        type: 'object', 
        required: false, 
        description: 'Filter object with dateFrom, dateTo, region, geogAreaCode' 
      },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses aggregated demand_heatmap_data table (supports mock data for testing)',
    filePath: 'src/components/focus-panels/DemandHeatmap/index.jsx'
  },
  GoogleSearch: {
    component: GoogleSearchContainer,
    category: 'Search',
    description: 'Google search integration - search the web using Google Custom Search API (public data)',
    usesMockData: false,
    props: {
      initialQuery: { 
        type: 'string', 
        required: false, 
        description: 'Initial search query (optional)' 
      },
      searchOptions: { 
        type: 'object', 
        required: false, 
        description: 'Search options (num, start, dateRestrict)' 
      },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables. Uses Google Custom Search JSON API for public web search.',
    filePath: 'src/components/focus-panels/GoogleSearch/index.jsx'
  },
  SearchTrends: {
    component: SearchTrendsContainer,
    category: 'Dashboards',
    description: 'Search trends visualization - shows what people are searching for over time with clean, informative UI',
    usesMockData: false,
    props: {
      filters: { 
        type: 'object', 
        required: false, 
        description: 'Filter options (queries, dateFrom, dateTo)' 
      },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires google_search_trends table. Shows historical search data tracked over time. Use Google Search component to track searches.',
    filePath: 'src/components/focus-panels/SearchTrends/index.jsx'
  }
};

/**
 * Get component by name
 */
export const getComponent = (name) => {
  return componentRegistry[name]?.component || null;
};

/**
 * Get component metadata
 */
export const getComponentMetadata = (name) => {
  return componentRegistry[name] || null;
};

/**
 * Get all components grouped by category
 */
export const getComponentsByCategory = () => {
  const categories = {};
  Object.entries(componentRegistry).forEach(([name, metadata]) => {
    const category = metadata.category || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({ name, ...metadata });
  });
  return categories;
};

/**
 * Get all component names
 */
export const getComponentNames = () => {
  return Object.keys(componentRegistry);
};

export default componentRegistry;

