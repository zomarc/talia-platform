import SailingTableContainer from './SailingTable';
import SimpleTable from './SimpleTable';
import KPICards from './KPICards';
import PublishedRates from './PublishedRates';
import OccupancyChart from './OccupancyChart';
import RevenueBreakdown from './RevenueBreakdown';
import SailingSummary from './SailingSummary';
import SailingByCabinCategory from './SailingByCabinCategory';
import ExceptionList from './ExceptionList';
import ItineraryList from './ItineraryList';
import ReservationCurrentStateContainer from './ReservationCurrentState';
import BookingProfileContainer from './BookingProfile';
import TargetProfileEditorContainer from './TargetProfileEditor';
import CompetitorPricingContainer from './CompetitorPricing';
import DemandHeatmapContainer from './DemandHeatmap';
import DemandHeatmapWithSearchTrendsContainer from './DemandHeatmapWithSearchTrends';
import GoogleSearchContainer from './GoogleSearch';
import SearchTrendsContainer from './SearchTrends';
import GoogleTrendsContainer from './GoogleTrends';
import DataMatch from './DataMatch';
import BtopTerminal from './BtopTerminal';
import MasterVoyagePerformanceSummaryContainer from './MasterVoyagePerformanceSummary';
import VoyageReportContainer from './VoyageReport';
import DirectSourceRequestContainer from './DirectSourceRequest';
import ContextRowMonitor from './ContextRowMonitor';
import DataDebugView from '../TestPage/DataDebugView';
import DataTypesValidation from '../dev/DataTypesValidation';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../lib/eventBus';

const publishedRatesSelect = 'talia:publishedRates.select';
const publishedRatesClear = 'talia:publishedRates.clear';
const reservationSelect = 'talia:reservation.select';
const reservationClear = 'talia:reservation.clear';
const directSourceSelect = 'talia:directsource.select';
const voyageReportSelect = 'talia:voyagereport.select';
const masterVoyageSelect = 'talia:mastervoyage.select';

/**
 * Shared component registry with metadata and event contracts
 */
export const componentRegistry = {
  SailingTable: {
    component: SailingTableContainer,
    panelId: 'sailing-table',
    category: 'Tables',
    title: 'Sailing Table',
    description: 'Interactive sailing data table with filtering and sorting',
    props: {
      filters: { type: 'object', required: false, description: 'Filter object with sail_code, ship_name, limit' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to masterSail endpoint',
    events: {
      emits: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT],
      respondsTo: []
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/SailingTable/index.jsx'
  },
  SimpleTable: {
    component: SimpleTable,
    panelId: 'simple-table-test',
    category: 'Tables',
    title: 'Simple Table',
    description: 'Simple table component for displaying tabular data',
    props: {},
    dataRequirements: 'Requires GraphQL connection to master_sail table. Emits talia:sail.select events.',
    events: {
      emits: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT],
      respondsTo: []
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/SimpleTable/index.jsx'
  },
  KPICards: {
    component: KPICards,
    panelId: 'kpi-cards',
    category: 'Dashboards',
    title: 'KPI Cards',
    description: 'Key Performance Indicator cards displaying metrics',
    usesMockData: true,
    props: {},
    dataRequirements: 'Uses mock data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/KPICards/index.jsx'
  },
  PublishedRates: {
    component: PublishedRates,
    panelId: 'published-rates',
    category: 'Tables',
    title: 'Published Rates',
    description: 'Published rates table with Tabulator integration',
    props: {},
    dataRequirements: 'Loads data from local JSON or API',
    events: {
      emits: [publishedRatesSelect, publishedRatesClear],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    supportsRefresh: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/PublishedRates/index.jsx'
  },
  OccupancyChart: {
    component: OccupancyChart,
    panelId: 'occupancy-chart',
    category: 'Charts',
    title: 'Occupancy Chart',
    description: 'Occupancy visualization chart',
    usesMockData: true,
    props: {},
    dataRequirements: 'Requires occupancy data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/OccupancyChart/index.jsx'
  },
  RevenueBreakdown: {
    component: RevenueBreakdown,
    panelId: 'revenue-breakdown',
    category: 'Charts',
    title: 'Revenue Breakdown',
    description: 'Revenue breakdown visualization',
    usesMockData: true,
    props: {},
    dataRequirements: 'Requires revenue data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/RevenueBreakdown/index.jsx'
  },
  SailingSummary: {
    component: SailingSummary,
    panelId: 'sailing-summary',
    category: 'Dashboards',
    title: 'Sailing Summary',
    description: 'Sailing summary dashboard with key metrics - aggregates cabin occupancy data at sail level',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to sail_by_cabin_occupancy table. Uses useTableDataWithContext hook.',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/SailingSummary/index.jsx'
  },
  SailingByCabinCategory: {
    component: SailingByCabinCategory,
    panelId: 'sailing-cabin-category',
    category: 'Tables',
    title: 'Sailing by Cabin Category',
    description: 'Sailing data grouped by cabin category - filters based on sail selection events',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to sail_by_cabin_occupancy table. Reacts to talia:sail.select events.',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/SailingByCabinCategory/index.jsx'
  },
  ExceptionList: {
    component: ExceptionList,
    panelId: 'exception-list',
    category: 'Lists',
    title: 'Exception List',
    description: 'List of exceptions and alerts',
    usesMockData: true,
    props: {},
    dataRequirements: 'Uses mock data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/ExceptionList/index.jsx'
  },
  ItineraryList: {
    component: ItineraryList,
    panelId: 'itinerary-list',
    category: 'Lists',
    title: 'Itinerary List',
    description: 'List of cruise itineraries',
    usesMockData: true,
    props: {},
    dataRequirements: 'Uses mock data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/ItineraryList/index.jsx'
  },
  ReservationCurrentState: {
    component: ReservationCurrentStateContainer,
    panelId: 'reservation-current-state',
    category: 'Tables',
    title: 'Reservation Current State',
    description: 'Reservation current state table - reacts to sail selection',
    props: {
      filters: { type: 'object', required: false, description: 'Filter object with sail_code, ship, res_status, etc.' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to reservations endpoint. Reacts to talia:sail.select events.',
    events: {
      emits: [reservationSelect, reservationClear],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/ReservationCurrentState/index.jsx'
  },
  BookingProfile: {
    component: BookingProfileContainer,
    panelId: 'booking-profile',
    category: 'Dashboards',
    title: 'Booking Profile',
    description: 'Booking profile showing trends, metrics, and build curves for a sailing',
    props: {
      sailCode: { type: 'string', required: true, description: 'Sail code (e.g., \"CJ07250901\")' },
      includeComparison: { type: 'boolean', required: false, description: 'Include year-over-year comparison' },
      previousYearSailCode: { type: 'string', required: false, description: 'Previous year sail code for comparison' },
      includeBuildCurves: { type: 'boolean', required: false, description: 'Include incremental build curves' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to bookingProfile endpoints',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/BookingProfile/index.jsx'
  },
  TargetProfileEditor: {
    component: TargetProfileEditorContainer,
    panelId: 'target-profile-editor',
    category: 'Editors',
    title: 'Target Profile Editor',
    description: 'Create and edit target booking profiles with build curves',
    props: {
      targetProfileId: { type: 'string', required: false, description: 'Target profile ID for editing' },
      sailCode: { type: 'string', required: false, description: 'Sail code to associate with target profile' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' },
      onSave: { type: 'function', required: false, description: 'Callback when profile is saved' },
      onCancel: { type: 'function', required: false, description: 'Callback when editing is cancelled' }
    },
    dataRequirements: 'Requires GraphQL connection to targetProfiles endpoints',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/TargetProfileEditor/index.jsx'
  },
  CompetitorPricing: {
    component: CompetitorPricingContainer,
    panelId: 'competitor-pricing',
    category: 'Dashboards',
    title: 'Competitor Pricing',
    description: 'Competitor pricing analysis with scatter plots and table',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to competitorPricing endpoint',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/CompetitorPricing/index.jsx'
  },
  DemandHeatmap: {
    component: DemandHeatmapContainer,
    panelId: 'demand-heatmap',
    category: 'Dashboards',
    title: 'Demand Heatmap',
    description: 'Viewing demand heatmap across itineraries by departure month',
    usesMockData: true,
    props: {
      filters: { type: 'object', required: false, description: 'Filter object with dateFrom, dateTo, region, geogAreaCode' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses aggregated demand_heatmap_data table',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/DemandHeatmap/index.jsx'
  },
  DemandHeatmapWithSearchTrends: {
    component: DemandHeatmapWithSearchTrendsContainer,
    panelId: 'demand-heatmap-with-trends',
    category: 'Dashboards',
    title: 'Demand Heatmap + Trends',
    description: 'Demand heatmap with search trends overlay',
    usesMockData: true,
    props: {
      filters: { type: 'object', required: false, description: 'Filter object with dateFrom, dateTo, region, geogAreaCode' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses aggregated demand_heatmap_data table',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/DemandHeatmapWithSearchTrends/index.jsx'
  },
  GoogleSearch: {
    component: GoogleSearchContainer,
    panelId: 'google-search',
    category: 'Search',
    title: 'Google Search',
    description: 'Google search integration using Custom Search API',
    usesMockData: false,
    props: {
      initialQuery: { type: 'string', required: false, description: 'Initial search query (optional)' },
      searchOptions: { type: 'object', required: false, description: 'Search options (num, start, dateRestrict)' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/GoogleSearch/index.jsx'
  },
  SearchTrends: {
    component: SearchTrendsContainer,
    panelId: 'search-trends',
    category: 'Dashboards',
    title: 'Search Trends',
    description: 'Search trends visualization over time',
    usesMockData: false,
    props: {
      filters: { type: 'object', required: false, description: 'Filter options (queries, dateFrom, dateTo)' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires google_search_trends table',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/SearchTrends/index.jsx'
  },
  GoogleTrends: {
    component: GoogleTrendsContainer,
    panelId: 'google-trends',
    category: 'Dashboards',
    title: 'Google Trends',
    description: 'Google Trends historical search interest',
    usesMockData: false,
    props: {
      filters: { type: 'object', required: false, description: 'Filter options (queries, startDate, endDate, region, granularity)' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses google_trends_data table and Google Trends API',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/GoogleTrends/index.jsx'
  },
  DataMatch: {
    component: DataMatch,
    panelId: 'data-match',
    category: 'Debugging',
    title: 'Data Match',
    description: 'Data completeness overview across tables',
    usesMockData: false,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to dataMatch endpoint',
    events: {
      emits: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT],
      respondsTo: []
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/DataMatch/index.jsx'
  },
  MasterVoyagePerformanceSummary: {
    component: MasterVoyagePerformanceSummaryContainer,
    panelId: 'master-voyage-performance-summary',
    category: 'Dashboards',
    title: 'Master Voyage Performance Summary',
    description: 'Comprehensive voyage performance summary',
    usesMockData: true,
    props: {
      filters: { type: 'object', required: false, description: 'Filter object (optional)' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses master_sail table data',
    events: {
      emits: [masterVoyageSelect],
      respondsTo: []
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/MasterVoyagePerformanceSummary/index.jsx'
  },
  VoyageReport: {
    component: VoyageReportContainer,
    panelId: 'voyage-report',
    category: 'Reports',
    title: 'Voyage Report',
    description: 'Standardized report using shared dataTypes library',
    usesMockData: true,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses master_sail table data',
    events: {
      emits: [voyageReportSelect],
      respondsTo: []
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/VoyageReport/index.jsx'
  },
  DirectSourceRequest: {
    component: DirectSourceRequestContainer,
    panelId: 'direct-source-request',
    category: 'External',
    title: 'Direct Source Request',
    description: 'Queries external GraphQL endpoints for voyage availability',
    usesMockData: false,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Queries external GraphQL endpoint at https://thaliatest.b2b.celestyal.com:3000/graphql',
    events: {
      emits: [directSourceSelect],
      respondsTo: [SAIL_SELECT_EVENT]
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/DirectSourceRequest/index.jsx'
  },
  BtopTerminal: {
    component: BtopTerminal,
    panelId: 'btop-terminal',
    category: 'System',
    title: 'System Monitor (btop)',
    description: 'Btop system monitor via SSE',
    usesMockData: false,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' },
      mode: { type: 'string', required: false, description: 'Mode for theme (data, test, app)' }
    },
    dataRequirements: 'Requires SSE connection to /api/btop/stream endpoint',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/BtopTerminal/index.jsx'
  },
  ContextRowMonitor: {
    component: ContextRowMonitor,
    panelId: 'context-row-monitor',
    category: 'Admin',
    title: 'Context Row Monitor',
    description: 'Monitors and displays live context row events',
    props: {},
    dataRequirements: 'Admin-only context monitor',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, publishedRatesSelect, publishedRatesClear, reservationSelect, reservationClear]
    },
    showInReports: false,
    filePath: 'src/components/focus-panels/ContextRowMonitor/index.jsx'
  },
  DataDebugView: {
    component: DataDebugView,
    panelId: 'data-debug-view',
    category: 'Debugging',
    title: 'Data Debug View',
    description: 'Comprehensive data debugging view for development',
    usesMockData: false,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to dataDebugInfo endpoint',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/TestPage/DataDebugView.jsx'
  },
  DataTypesValidation: {
    component: DataTypesValidation,
    panelId: 'data-types-validation',
    category: 'Debugging',
    title: 'Data Types Validation',
    description: 'Validates data types library with Tabulator',
    usesMockData: true,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses mock test data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/dev/DataTypesValidation.jsx'
  }
};

export const getComponent = (name) => componentRegistry[name]?.component || null;

export const getComponentMetadata = (name) => componentRegistry[name] || null;

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

export const getComponentNames = () => Object.keys(componentRegistry);

export default componentRegistry;
