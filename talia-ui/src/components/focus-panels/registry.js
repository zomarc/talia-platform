import SailingTableContainer from './SailingTable';
import MasterSailingExplorerContainer from './MasterSailingExplorer';
import ShipDayBerthContainer from './ShipDayBerth';
import ShipDayPressureContainer from './ShipDayPressure';
import SimpleTable from './SimpleTable';
import KPICards from './KPICards';
import PublishedRates from './PublishedRates';
import PublishedRatesGrid from './PublishedRatesGrid';
import OccupancyChart from './OccupancyChart';
import RevenueBreakdown from './RevenueBreakdown';
import SailingSummary from './SailingSummary';
import SailingOverview from './SailingOverview';
import ShipTrackerMap from './ShipTrackerMap';
import InventoryMemo from './InventoryMemo';
import SailingByCabinCategory from './SailingByCabinCategory';
import ExceptionList from './ExceptionList';
import ItineraryList from './ItineraryList';
import ItineraryExtract from './ItineraryExtract';
import ReservationCurrentStateContainer from './ReservationCurrentState';
import GroupBookingReviewContainer from './GroupBookingReview';
import GroupsExplorerContainer from './GroupsExplorer';
import SourceMrReviewContainer from './SourceMrReview';
import TaliaMrMethodContainer from './TaliaMrMethod';
import HistoricMrPathContainer from './HistoricMrPath';
import MrRetrospectContainer from './MrRetrospect';
import PromoExplorerContainer from './PromoExplorer';
import SailingDemandCompositionContainer from './SailingDemandComposition';
import BookingProfileContainer from './BookingProfile';
import ReservationBookingCurveContainer from './ReservationBookingCurve';
import ProfileCompareContainer from './ProfileCompare';
import ProfileAggregationsContainer from './ProfileAggregations';
import SeasonalTradingPackContainer from './SeasonalTradingPack';
import TargetProfileEditorContainer from './TargetProfileEditor';
import InventoryTargetProfileEditorContainer from './InventoryTargetProfileEditor';
import BookingTargetChartContainer from './BookingTargetChart';
import BookingCurrentDataSimple from './BookingCurrentDataSimple';
import BookingTargetDataSimple from './BookingTargetDataSimple';
import BookingCombinedDataSimple from './BookingCombinedDataSimple';
import BookingTargetProfileEditorSimple from './BookingTargetProfileEditorSimple';
import CompetitorPricingContainer from './CompetitorPricing';
import CompetitorBenchmarkContainer from './CompetitorBenchmark';
import DemandHeatmapContainer from './DemandHeatmap';
import DemandHeatmapWithSearchTrendsContainer from './DemandHeatmapWithSearchTrends';
import GoogleSearchContainer from './GoogleSearch';
import SearchTrendsContainer from './SearchTrends';
import GoogleTrendsContainer from './GoogleTrends';
import DataMatch from './DataMatch';
import BreakoutGame from './BreakoutGame';
import SpaceInvaders from './SpaceInvaders';
import PacMan from './PacMan';
import Asteroids from './Asteroids';
import Pong from './Pong';
import MoonLanderGame from './MoonLanderGame';
import BtopTerminal from './BtopTerminal';
import MasterVoyagePerformanceSummaryContainer from './MasterVoyagePerformanceSummary';
import VoyageReportContainer from './VoyageReport';
import DirectSourceRequestContainer from './DirectSourceRequest';
import DirectAvailabilityContainer from './DirectAvailability';
import AgencyContainer from './Agency';
import DistributionContainer from './Distribution';
import CapacityValidationContainer from './CapacityValidation';
import CabinDeckInventoryContainer from './CabinDeckInventory';
import ProjectSummaryContainer from './ProjectSummary';
import ComponentInteractionMapContainer from './ComponentInteractionMap';
import ContextRowMonitor from './ContextRowMonitor';
import DataManagementPanel from './DataManagement';
import RmChecklistContainer from './RmChecklist';
import EngineActivityContainer from './EngineActivity';
import DriverAnalysisContainer from './DriverAnalysis';
import ColumnTerminologyPanel from './ColumnTerminology';
import EtlTableParametersPanel from './EtlTableParameters';
import DataLineagePanel from './DataLineage';
import PortCityPanel from './PortCity';
import RequirementsLogPanel from './RequirementsLog';
import FunctionalityMatrixPanel from './FunctionalityMatrix';
import RiskRegisterPanel from './RiskRegister';
import DocumentRepositoryPanel from './DocumentRepository';
import ProjectPlanPanel from './ProjectPlan';
import TestWorkbenchPanel from './TestWorkbench';
import PlaceHolderContainer from './PlaceHolder';
import ChatbotDemoContainer from './ChatbotDemo';
import DataDebugView from '../TestPage/DataDebugView';
import DataTypesValidation from '../dev/DataTypesValidation';
import AdminDashboard from '../admin/dashboard/AdminDashboard';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  SHIP_SELECT_EVENT,
  SHIP_CLEAR_EVENT,
  GROUP_SELECT_EVENT,
  GROUP_CLEAR_EVENT,
} from '../../lib/eventBus';
import {
  VIEW_COLUMN_FILTERS,
  VIEW_CONTROLS,
  VIEW_DETAILS,
  VIEW_PROVENANCE,
  VIEW_FILTERS,
  VIEW_LEGENDS,
  VIEW_AXIS_LABELS,
  VIEW_NESTED,
  VIEW_MSE_DENSITY,
  VIEW_DENSITY,
  VIEW_CHECKLIST_DISPLAY,
  VIEW_PORT_CITY_DISPLAY,
  VIEW_REQUIREMENTS_DISPLAY,
  VIEW_MATRIX_DISPLAY,
  VIEW_LINEAGE_ORIENTATION,
  VIEW_LINEAGE_DISPLAY,
  VIEW_LINEAGE_CO_CONSUMERS,
  VIEW_LINEAGE_LOGICAL_LINKS,
  VIEW_RISK_DISPLAY,
  VIEW_GRAPH,
  VIEW_SOURCE_MR_MONTH,
  VIEW_HISTORIC_MR_PATH,
  VIEW_ASSUMPTIONS,
  VIEW_MR_MODEL,
  VIEW_MR01_PRESET,
  VIEW_MR_COMPARE,
  VIEW_SNAPSHOT,
  VIEW_TOOLTIP,
  VIEW_TOOLTIP_MSE,
  VIEW_TOTALS,
  VIEW_BAR_SPLIT,
  VIEW_ROW_SCOPE,
  VIEW_PLACEHOLDER_CAPTION,
  VIEW_WIREFRAME,
  VIEW_ADMIN_SECTION,
  VIEW_DATA_SECTION,
} from '../../lib/componentOptionsCatalog';

const publishedRatesSelect = 'talia:publishedRates.select';
const publishedRatesClear = 'talia:publishedRates.clear';
const reservationSelect = 'talia:reservation.select';
const reservationClear = 'talia:reservation.clear';
const agencySelect = 'talia:agency.select';
const agencyClear = 'talia:agency.clear';
const cabinSelect = 'talia:cabin.select';
const cabinClear = 'talia:cabin.clear';
const directSourceSelect = 'talia:directsource.select';
const sailSelectDotEvent = 'talia.sail.select';
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
  MasterSailingExplorer: {
    component: MasterSailingExplorerContainer,
    panelId: 'master-sailing-explorer',
    category: 'Tables',
    title: 'Explorer',
    description: 'Master sailings with total booked/capacity and expandable day-by-day breakdown with sub-sailing highlights',
    props: {},
    dataRequirements: 'Requires master_sail, inventory_item, sailing_hierarchy, densified ship_day_capacity (nameplate + offsale + sellable), and sail_booking_summary. reservation_current_state / agency / alloc deferred for distribution hover.',
    events: {
      emits: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT],
      respondsTo: []
    },
    supportsRefresh: true,
    supportsGroupActions: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [
        VIEW_NESTED,
        VIEW_MSE_DENSITY,
        { id: 'segments', label: 'Segments', type: 'boolean', default: false },
        VIEW_FILTERS,
        VIEW_COLUMN_FILTERS,
        VIEW_CONTROLS,
        VIEW_TOOLTIP,
        VIEW_TOOLTIP_MSE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/MasterSailingExplorer/index.jsx'
  },
  ShipDayBerth: {
    component: ShipDayBerthContainer,
    panelId: 'ship-day-berth',
    category: 'Tables',
    title: 'Ship × Day Berths',
    description: 'Physical berth capacity, occupancy, and availability per ship and calendar day (operations grain, separate from selling structure)',
    props: {},
    dataRequirements: 'Requires ship_day_capacity view, ship table, and inventory_item (canonical link). Resolves selections via inventory_item.reference_sail_code.',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, SHIP_SELECT_EVENT, SHIP_CLEAR_EVENT],
    },
    supportsRefresh: true,
    supportsGroupActions: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [VIEW_NESTED, VIEW_FILTERS, VIEW_COLUMN_FILTERS, VIEW_CONTROLS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/ShipDayBerth/index.jsx'
  },
  ShipDayPressure: {
    component: ShipDayPressureContainer,
    panelId: 'ship-day-pressure',
    category: 'Tables',
    title: 'Ship × Day Pressure',
    description: 'WIP compact grid of true sellable vs booked / expected / contracted by ship-day. Flags dead beds from short products blocking longer voyages and low-probability group holds.',
    props: {},
    dataRequirements: 'Requires ship_day_capacity, inventory_item, master_sail, sail_booking_summary, sail_by_cabin_occupancy, ship. Physical MAX on ship-day; demand exploded onto occupancy dates; blocking from cabin-category loading.',
    events: {
      emits: [SAIL_SELECT_EVENT, SHIP_SELECT_EVENT],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, SHIP_SELECT_EVENT, SHIP_CLEAR_EVENT],
    },
    supportsRefresh: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_CONTROLS, VIEW_TOOLTIP, VIEW_LEGENDS, VIEW_ROW_SCOPE, VIEW_BAR_SPLIT],
      operations: [],
    },
    filePath: 'src/components/focus-panels/ShipDayPressure/index.jsx'
  },
  SimpleTable: {
    component: SimpleTable,
    panelId: 'simple-table-test',
    category: 'Tables',
    title: 'Simple Table',
    legacy: true,
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
  Agency: {
    component: AgencyContainer,
    panelId: 'agency-directory',
    category: 'Tables',
    title: 'Agency Explorer',
    description: 'Agency directory with sail-scoped value and PPD (current vs expected), Group/FIT mix, and cabin category breakdowns via lkp.CABIN_CTG',
    props: {},
    dataRequirements: 'Requires agency (Dim_Agency), reservation (revenue), cabin_ctg (lkp.CABIN_CTG). Responds to sail and reservation selection.',
    events: {
      emits: [agencySelect, agencyClear],
      respondsTo: [SAIL_SELECT_EVENT, reservationSelect, cabinSelect, cabinClear]
    },
    supportsRefresh: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/Agency/index.jsx'
  },
  Distribution: {
    component: DistributionContainer,
    panelId: 'distribution',
    category: 'Charts',
    title: 'Distribution',
    description: 'Horizontal stacked charts of sold guests by channel (Agency/Direct/Tour Op), market group (market_roll_up), and Group/FIT for the selected sailing',
    props: {},
    dataRequirements: 'Requires reservation (+ occupancy + ship_inventory_alloc for held) + agency + market_roll_up. Channel from agency_type; market group from agency.market → new_budget_roll_up. Group/FIT follows global bookedComposition (default: FIT booked + Group confirmed + GTY held at source probability).',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    supportsRefresh: true,
    showInReports: true,
    options: {
      views: [VIEW_LEGENDS, VIEW_AXIS_LABELS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/Distribution/index.jsx'
  },
  CapacityValidation: {
    component: CapacityValidationContainer,
    panelId: 'capacity-validation',
    category: 'Debugging',
    title: 'Capacity Validation',
    description: 'Vertical source ledger of capacity, booked, and availability for one sailing — each value shows table, derivation, grain, and scope for manual reconciliation with MSE',
    props: {},
    dataRequirements: 'Requires master_sail, ship_day_capacity, cabin_availability, inventory_status_by_day, ship, reservation_current_state, ship_cabin_reserve. Linked via sail.select.',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    supportsRefresh: true,
    showInReports: true,
    minRole: 'MANAGER',
    filePath: 'src/components/focus-panels/CapacityValidation/index.jsx'
  },
  CabinDeckInventory: {
    component: CabinDeckInventoryContainer,
    panelId: 'cabin-deck-inventory',
    category: 'Inventory',
    title: 'Inventory',
    description: 'Assigned cabins by deck and category with FIT/Group ownership highlights; GTY ONLY holds shown as unassigned group bookings',
    props: {},
    dataRequirements: 'Requires ship_inventory_alloc (from stg.RES_CABIN_ALLOCATION_DETAIL), ship_cabin, ship_cabin_ctg_link, ship_cabin_reserve. No customer/PII. Owner id is res_id (FIT) or group_id (GROUP). Offsale cabins excluded from empty / GTY-fit.',
    events: {
      emits: [cabinSelect, cabinClear],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, reservationSelect, reservationClear, cabinClear]
    },
    supportsRefresh: true,
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [VIEW_DETAILS, VIEW_CONTROLS, VIEW_TOOLTIP, VIEW_LEGENDS],
      operations: [
        { id: 'allocate', label: 'Allocate', type: 'boolean', default: true, minRole: 'MANAGER' },
      ],
    },
    filePath: 'src/components/focus-panels/CabinDeckInventory/index.jsx'
  },
  ProjectSummary: {
    component: ProjectSummaryContainer,
    panelId: 'project-summary',
    category: 'Reports',
    title: 'Project Summary',
    description: 'Executive summary, architecture, project plan, and risk graphic',
    props: {},
    dataRequirements: 'Published project_summary, plus the project plan and open risks for administrators.',
    events: { emits: [], respondsTo: [] },
    supportsRefresh: true,
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [VIEW_PROVENANCE],
      operations: [],
    },
    filePath: 'src/components/focus-panels/ProjectSummary/index.jsx'
  },
  ComponentInteractionMap: {
    component: ComponentInteractionMapContainer,
    panelId: 'component-interaction-map',
    category: 'Reports',
    title: 'Component Interaction Map',
    description: 'Summary of the main panel-to-panel interactions (who emits / who responds), derived from the component registry. Highlights canonical selection linking via inventory_item.',
    props: {},
    dataRequirements: 'Reads the component registry event contracts (events.emits / events.respondsTo). No network fetch.',
    events: { emits: [], respondsTo: [] },
    supportsRefresh: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/ComponentInteractionMap/index.jsx'
  },
  KPICards: {
    component: KPICards,
    panelId: 'kpi-cards',
    category: 'Dashboards',
    title: 'KPI Cards',
    legacy: true,
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
  PublishedRatesGrid: {
    component: PublishedRatesGrid,
    panelId: 'published-rates-grid',
    category: 'Tables',
    title: 'Published Rates Grid',
    description: 'Promo-filtered cabin grid with price history for selected sailing',
    props: {},
    dataRequirements: 'GraphQL tableData on published_rates_current_state (same source as Published Rates)',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    supportsRefresh: true,
    showInReports: true,
    options: {
      views: [VIEW_LEGENDS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/PublishedRatesGrid/index.jsx'
  },
  OccupancyChart: {
    component: OccupancyChart,
    panelId: 'occupancy-chart',
    category: 'Charts',
    title: 'Occupancy Chart',
    legacy: true,
    description: 'Occupancy visualization chart',
    usesMockData: true,
    props: {},
    dataRequirements: 'Requires occupancy data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    options: {
      views: [VIEW_LEGENDS, VIEW_AXIS_LABELS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/OccupancyChart/index.jsx'
  },
  RevenueBreakdown: {
    component: RevenueBreakdown,
    panelId: 'revenue-breakdown',
    category: 'Charts',
    title: 'Revenue Breakdown',
    legacy: true,
    description: 'Revenue breakdown visualization',
    usesMockData: true,
    props: {},
    dataRequirements: 'Requires revenue data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    options: {
      views: [VIEW_LEGENDS],
      operations: [],
    },
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
  SailingOverview: {
    component: SailingOverview,
    panelId: 'sailing-overview',
    category: 'Dashboards',
    title: 'Sailing Overview',
    description: 'Quick summary panel for the selected sailing event',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Responds to talia:sail.select events and fetches published_rates_current_state for pricing',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/SailingOverview/index.jsx'
  },
  ShipTrackerMap: {
    component: ShipTrackerMap,
    panelId: 'ship-tracker-map',
    category: 'Dashboards',
    title: 'Ship Tracker Map',
    description: 'Live map of both ships with weather, occupancy, and route history',
    props: {},
    dataRequirements: 'Uses master_sail and sail_by_cabin_occupancy tables; weather from Open-Meteo API',
    dataSources: [
      'Supabase: inventory_item',
      'Supabase: master_sail',
      'Supabase: sail_by_cabin_occupancy',
      'AISStream live positions (via backend resolver)',
      'Weather providers: Open-Meteo + api.met.no fallback',
      'Port news: Google News RSS (via backend resolver)'
    ],
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/ShipTrackerMap/index.jsx'
  },
  InventoryMemo: {
    component: InventoryMemo,
    panelId: 'inventory-memo',
    category: 'Admin',
    title: 'Inventory Memo',
    description: 'Create and review memos linked to canonical inventory_item mappings',
    props: {},
    dataRequirements: 'Uses inventory_item and inventory_item_memo tables through GraphQL',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, 'talia:memo.create'] },
    showInReports: true,
    options: {
      views: [VIEW_DETAILS, VIEW_DENSITY],
      operations: [],
    },
    filePath: 'src/components/focus-panels/InventoryMemo/index.jsx'
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
    legacy: true,
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
    legacy: true,
    description: 'List of cruise itineraries',
    usesMockData: true,
    props: {},
    dataRequirements: 'Uses mock data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/ItineraryList/index.jsx'
  },
  ItineraryExtract: {
    component: ItineraryExtract,
    panelId: 'itinerary-extract',
    category: 'Lists',
    title: 'Itinerary Extract',
    description: 'Compact itinerary snapshot grouped for quick operational review',
    usesMockData: false,
    props: {},
    dataRequirements: 'Uses inventory_item as primary source with master_sail enrichment and cached public reference metadata',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    showInReports: true,
    filePath: 'src/components/focus-panels/ItineraryExtract/index.jsx'
  },
  ReservationCurrentState: {
    component: ReservationCurrentStateContainer,
    panelId: 'reservation-current-state',
    category: 'Tables',
    title: 'Reservation',
    description: 'Reservation current state table - reacts to sail selection',
    props: {
      filters: { type: 'object', required: false, description: 'Filter object with sail_code, ship, res_status, etc.' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL connection to reservations endpoint. Reacts to talia:sail.select events.',
    events: {
      emits: [reservationSelect, reservationClear],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, cabinSelect, cabinClear]
    },
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [VIEW_DETAILS, VIEW_FILTERS, VIEW_COLUMN_FILTERS, VIEW_TOTALS, VIEW_TOOLTIP],
      operations: [],
    },
    filePath: 'src/components/focus-panels/ReservationCurrentState/index.jsx'
  },
  GroupBookingReview: {
    component: GroupBookingReviewContainer,
    panelId: 'group-booking-review',
    category: 'Tables',
    title: 'Group vs Real Bookings',
    description: 'Direct GraphQL reservation review where rows without res_id are treated as pending group bookings and rows with res_id as real bookings.',
    props: {},
    dataRequirements: 'Uses direct GraphQL reservations query (trackedFetchGraphql) and sail.select context.',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    supportsRefresh: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/GroupBookingReview/index.jsx'
  },
  GroupsExplorer: {
    component: GroupsExplorerContainer,
    panelId: 'groups-explorer',
    category: 'Tables',
    title: 'Groups Explorer',
    description: 'Group Risk Management — commitment, impact, source vs Talia materialisation rate, agency context',
    props: {},
    tables: ['reservation', 'agency', 'inventory_item', 'sail_booking_summary'],
    dataRequirements: 'Requires reservation, agency, inventory_item, sail_booking_summary. Responds to sail.select; emits sail.select and group.select on row click.',
    events: {
      emits: [SAIL_SELECT_EVENT, GROUP_SELECT_EVENT],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, GROUP_CLEAR_EVENT]
    },
    supportsRefresh: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [VIEW_DENSITY, VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_COLUMN_FILTERS, VIEW_MR_MODEL, VIEW_MR01_PRESET, VIEW_PROVENANCE],
      operations: [],
    },
    filePath: 'src/components/focus-panels/GroupsExplorer/index.jsx'
  },
  SourceMrReview: {
    component: SourceMrReviewContainer,
    panelId: 'source-mr-review',
    category: 'Tables',
    title: 'Source MR effectiveness',
    description: 'Historic source materialisation against named guests, with an independent Talia MR (MR01)',
    props: {},
    tables: [
      'inventory_item',
      'master_sail',
      'sw_etl_group',
      'sw_etl_group_header',
      'sw_etl_group_ship',
      'sw_etl_extract_load',
    ],
    dataRequirements: 'Frozen SW_ETL extract: sw_etl_group, sw_etl_group_header, sw_etl_group_ship, sw_etl_extract_load; plus inventory_item and master_sail. Emits/responds to group.select; sail.select when opening a sailing.',
    events: {
      emits: [SAIL_SELECT_EVENT, GROUP_SELECT_EVENT],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, GROUP_SELECT_EVENT, GROUP_CLEAR_EVENT]
    },
    supportsRefresh: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [
        VIEW_SNAPSHOT,
        VIEW_GRAPH,
        VIEW_SOURCE_MR_MONTH,
        VIEW_DETAILS,
        VIEW_FILTERS,
        VIEW_TOOLTIP,
        VIEW_LEGENDS,
        VIEW_AXIS_LABELS,
        VIEW_MR_MODEL,
        VIEW_MR01_PRESET,
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/SourceMrReview/index.jsx'
  },
  TaliaMrMethod: {
    component: TaliaMrMethodContainer,
    panelId: 'talia-mr-method',
    category: 'Tables',
    title: 'Talia MR',
    description: 'How MR01 (Talia materialisation) is calculated, on the selected sailing or a worked example',
    props: {},
    tables: ['reservation'],
    dataRequirements: 'Live book from reservation. Listens for sail.select and group.select; worked examples are static illustrations (not a live SW_ETL fetch).',
    events: {
      emits: [GROUP_SELECT_EVENT],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, GROUP_SELECT_EVENT, GROUP_CLEAR_EVENT]
    },
    supportsRefresh: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [
        VIEW_SNAPSHOT,
        VIEW_GRAPH,
        VIEW_DETAILS,
        VIEW_FILTERS,
        VIEW_TOOLTIP,
        VIEW_LEGENDS,
        VIEW_AXIS_LABELS,
        VIEW_MR_MODEL,
        VIEW_MR01_PRESET,
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/TaliaMrMethod/index.jsx'
  },
  HistoricMrPath: {
    component: HistoricMrPathContainer,
    panelId: 'historic-mr-path',
    category: 'Tables',
    title: 'Historic MR path',
    description: 'What the source rate held before departure, and what the selected MR model would have held',
    props: {},
    tables: [
      'master_sail',
      'sw_etl_group',
      'sw_etl_group_header',
      'sw_etl_group_ship',
    ],
    dataRequirements: 'sourceMrPath / sourceMrPathDays over sw_etl_group, sw_etl_group_header, sw_etl_group_ship; master_sail resolves sail windows. Sail.select narrows ship and dates; group.select picks the path series.',
    events: {
      emits: [GROUP_SELECT_EVENT],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, GROUP_SELECT_EVENT, GROUP_CLEAR_EVENT]
    },
    supportsRefresh: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [
        VIEW_SNAPSHOT,
        VIEW_ASSUMPTIONS,
        VIEW_GRAPH,
        VIEW_HISTORIC_MR_PATH,
        VIEW_DETAILS,
        VIEW_FILTERS,
        VIEW_TOOLTIP,
        VIEW_LEGENDS,
        VIEW_AXIS_LABELS,
        VIEW_MR_MODEL,
        VIEW_MR01_PRESET,
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/HistoricMrPath/index.jsx'
  },
  MrRetrospect: {
    component: MrRetrospectContainer,
    panelId: 'mr-retrospect',
    category: 'Tables',
    title: 'MR Retrospect',
    description: 'Step days before departure and compare MR models with the named outcome',
    props: {},
    tables: [
      'master_sail',
      'sw_etl_group',
      'sw_etl_group_header',
      'sw_etl_group_ship',
    ],
    dataRequirements: 'sourceMrPath / sourceMrPathDays over sw_etl_group, sw_etl_group_header, sw_etl_group_ship; master_sail for sail windows. Sail.select sets window; group.select picks one group DTD path.',
    events: {
      emits: [GROUP_SELECT_EVENT],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, GROUP_SELECT_EVENT, GROUP_CLEAR_EVENT]
    },
    supportsRefresh: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [
        VIEW_SNAPSHOT,
        VIEW_GRAPH,
        VIEW_DETAILS,
        VIEW_FILTERS,
        VIEW_TOOLTIP,
        VIEW_LEGENDS,
        VIEW_AXIS_LABELS,
        VIEW_MR_MODEL,
        VIEW_MR01_PRESET,
        VIEW_MR_COMPARE,
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/MrRetrospect/index.jsx'
  },
  PromoExplorer: {
    component: PromoExplorerContainer,
    panelId: 'promo-explorer',
    category: 'Tables',
    title: 'Promo Explorer',
    description: 'Active and related promotions with conservative detrimental flags',
    props: {},
    dataRequirements: 'Requires published_rates_current_state. Responds to sail.select; related sails by ship.',
    events: {
      emits: [SAIL_SELECT_EVENT],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    supportsRefresh: true,
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [VIEW_DENSITY, VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_COLUMN_FILTERS, VIEW_PROVENANCE],
      operations: [],
    },
    filePath: 'src/components/focus-panels/PromoExplorer/index.jsx'
  },
  SailingDemandComposition: {
    component: SailingDemandCompositionContainer,
    panelId: 'sailing-demand-composition',
    category: 'Booking & profiles',
    title: 'Sailing Demand',
    description:
      'Booked (named) vs Estimated (contracted × probability) vs Contracted (all groups + offers), with EUR revenue — sail-scoped demo.',
    props: {},
    dataRequirements: 'Requires reservation (RES_HEADER + Fact group-OF). Responds to talia:sail.select.',
    events: {
      emits: [],
      respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT]
    },
    supportsRefresh: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/SailingDemandComposition/index.jsx'
  },
  BookingProfile: {
    component: BookingProfileContainer,
    panelId: 'booking-profile',
    category: 'Booking & profiles',
    title: 'Real booking profile (+ YoY) — legacy',
    legacy: true,
    description:
      'Legacy snapshot-based curves (reservation_changes). Prefer Reservation Profile for MSE-aligned booked cabins and original book dates.',
    props: {
      sailCode: { type: 'string', required: false, description: 'Sail code (optional if sail is selected in UI)' },
      includeComparison: { type: 'boolean', required: false, description: 'Include year-over-year comparison' },
      previousYearSailCode: { type: 'string', required: false, description: 'Previous year sail code for comparison' },
      includeBudget: { type: 'boolean', required: false, description: 'Include finance budget end-state comparison' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires GraphQL bookingProfileDimensional (+ optional YoY / budgetEndStateComparison)',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    showInReports: false,
    filePath: 'src/components/focus-panels/BookingProfile/index.jsx'
  },
  ReservationBookingCurve: {
    component: ReservationBookingCurveContainer,
    panelId: 'reservation-booking-curve',
    category: 'Booking & profiles',
    title: 'Reservation Profile',
    description:
      'Voyage Totals (Booked / Estimated / Contracted + Target) or Series (Booked by Market / Channel / Pax). Capacity is sellable cabins (nameplate minus offsale).',
    props: {
      sailCode: { type: 'string', required: false, description: 'Sail code (optional if sail is selected in UI)' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'GraphQL reservationBookingCurve (reservation + ship_day_capacity)',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    supportsRefresh: true,
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [VIEW_SNAPSHOT, VIEW_GRAPH, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS, VIEW_AXIS_LABELS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/ReservationBookingCurve/index.jsx'
  },
  ProfileCompare: {
    component: ProfileCompareContainer,
    panelId: 'profile-compare',
    category: 'Booking & profiles',
    title: 'Sailing Profile',
    description:
      'REAL booking curve vs model prior (lazy peer or manual map). Optional active target overlay and budget end-state gap.',
    props: {
      sailCode: { type: 'string', required: false, description: 'Sail code' },
      theme: { type: 'object', required: false, description: 'Theme object' }
    },
    dataRequirements: 'GraphQL profileCompare + profile_model_map',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    supportsRefresh: true,
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS, VIEW_AXIS_LABELS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/ProfileCompare/index.jsx'
  },
  ProfileAggregations: {
    component: ProfileAggregationsContainer,
    panelId: 'profile-aggregations',
    category: 'Booking & profiles',
    title: 'Profile Aggregations',
    description:
      'Read-only coverage by ship × month or DOW × duration: sails with active targets and model map modes.',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object' }
    },
    dataRequirements: 'GraphQL profileAggregations',
    events: { emits: [], respondsTo: [] },
    supportsRefresh: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/ProfileAggregations/index.jsx'
  },
  SeasonalTradingPack: {
    component: SeasonalTradingPackContainer,
    panelId: 'seasonal-trading-pack',
    category: 'Booking & profiles',
    title: 'Seasonal Trading Pack',
    description:
      'Weekly commercial pack: narrative callouts, By Dep Month Pax/Rev matrix vs budget and held groups, and trading performance. Offered (OF) and RFC deferred.',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'GraphQL seasonalTradingPack (reservation + budget + ship_inventory_alloc)',
    events: { emits: [], respondsTo: [] },
    supportsRefresh: true,
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [
        { id: 'snapshot', label: 'Snapshot', type: 'boolean', default: true },
        { id: 'details', label: 'Details', type: 'boolean', default: true },
        { id: 'filters', label: 'Filters', type: 'boolean', default: true },
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/SeasonalTradingPack/index.jsx'
  },
  InventoryTargetProfileEditor: {
    component: InventoryTargetProfileEditorContainer,
    panelId: 'inventory-target-profile-editor',
    category: 'Booking & profiles',
    title: 'Target Profile Editor',
    description:
      'Define and activate named load-factor goal curves per inventory item (voyage → market group → market → currency; optional weeks-to-sail). Manager+ to save.',
    props: {
      sailCode: { type: 'string', required: false, description: 'Sail code' },
      theme: { type: 'object', required: false, description: 'Theme object' }
    },
    dataRequirements: 'inventory_target_profile + inventory_item',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    supportsRefresh: true,
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [VIEW_SNAPSHOT, VIEW_DETAILS, VIEW_FILTERS, VIEW_LEGENDS, VIEW_AXIS_LABELS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/InventoryTargetProfileEditor/index.jsx'
  },
  TargetProfileEditor: {
    component: TargetProfileEditorContainer,
    panelId: 'target-profile-editor',
    category: 'Editors',
    title: 'Target Profile Editor',
    legacy: true,
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
    showInReports: false,
    filePath: 'src/components/focus-panels/TargetProfileEditor/index.jsx'
  },
  BookingTargetChart: {
    component: BookingTargetChartContainer,
    panelId: 'booking-target-chart',
    category: 'Booking & profiles',
    title: 'Target vs booking (configurable)',
    description:
      'Exploratory chart: REAL build curves vs imported TARGET and legacy target profiles. For persisted MODEL editing on the graph, use “Booking Target Profile Editor (Simple)”.',
    props: {
      sailCode: { type: 'string', required: false, description: 'Initial sail code' },
      targetProfileId: { type: 'string', required: false, description: 'Target profile ID from GraphQL (alternative to CSV)' },
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'CSV target data (BOOKINGTARGET_*.csv) or target profiles; GraphQL bookingProfileWithCurves',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    showInReports: true,
    options: {
      views: [VIEW_LEGENDS, VIEW_AXIS_LABELS],
      operations: [],
    },
    filePath: 'src/components/focus-panels/BookingTargetChart/index.jsx'
  },
  BookingCurrentDataSimple: {
    component: BookingCurrentDataSimple,
    panelId: 'booking-current-data-simple',
    category: 'Booking & profiles',
    title: 'REAL only (weeks-to-sail)',
    description: 'Goal ① diagnostic: single REAL curve from booking build data (isolated check).',
    props: {},
    dataRequirements: 'Requires GraphQL booking profile with build curves',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    showInReports: false,
    filePath: 'src/components/focus-panels/BookingCurrentDataSimple/index.jsx'
  },
  BookingTargetDataSimple: {
    component: BookingTargetDataSimple,
    panelId: 'booking-target-data-simple',
    category: 'Booking & profiles',
    title: 'TARGET only (imported)',
    description: 'Goal ②: business TARGET curve from Data Management import (booking_targets_supplied), read-only display.',
    props: {},
    dataRequirements: 'Requires booking_targets_supplied data imported via Data Management',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    showInReports: true,
    filePath: 'src/components/focus-panels/BookingTargetDataSimple/index.jsx'
  },
  BookingCombinedDataSimple: {
    component: BookingCombinedDataSimple,
    panelId: 'booking-combined-data-simple',
    category: 'Booking & profiles',
    title: 'Overlay: REAL + TARGET + MODEL',
    description: 'Combined overlay: REAL, imported TARGET, BUDGET, and inventory MODEL series on one chart.',
    props: {},
    dataRequirements: 'Requires booking profile, booking_targets_supplied, and optional target_profiles',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    showInReports: false,
    filePath: 'src/components/focus-panels/BookingCombinedDataSimple/index.jsx'
  },
  BookingTargetProfileEditorSimple: {
    component: BookingTargetProfileEditorSimple,
    panelId: 'booking-target-profile-editor-simple',
    category: 'Booking & profiles',
    title: 'MODEL profile editor (graph)',
    description:
      'Goal ③: Talia system owns curves (owner talia); viewers explore, Manager+ saves MODEL via upsertInventoryProfileSeries. Drag/table edit when permitted.',
    props: {},
    dataRequirements: 'Requires booking profile (REAL), supplied target optional, and target_profiles CRUD',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    showInReports: true,
    filePath: 'src/components/focus-panels/BookingTargetProfileEditorSimple/index.jsx'
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
    dataRequirements: 'Requires GraphQL connection to competitorPricing endpoint and inventory_item context mapping',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT, sailSelectDotEvent] },
    showInReports: true,
    filePath: 'src/components/focus-panels/CompetitorPricing/index.jsx'
  },
  CompetitorBenchmark: {
    component: CompetitorBenchmarkContainer,
    panelId: 'competitor-benchmark',
    category: 'Dashboards',
    title: 'Competitor Benchmark',
    description: 'RateGain DWH benchmark (vw_Competitor_Benchmarking). Separate from Competitor Pricing.',
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Requires competitor_benchmark (dwh.vw_Competitor_Benchmarking). Sail.select scopes by departure month; competitor ship_code is not Celestyal.',
    events: { emits: [], respondsTo: [SAIL_SELECT_EVENT] },
    supportsRefresh: true,
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [
        { ...VIEW_DETAILS, default: false },
        VIEW_COLUMN_FILTERS,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/CompetitorBenchmark/index.jsx'
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
    options: {
      views: [VIEW_LEGENDS],
      operations: [],
    },
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
    options: {
      views: [VIEW_LEGENDS],
      operations: [],
    },
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
    props: {},
    dataRequirements: 'Requires GraphQL connection to dataMatch endpoint',
    events: {
      emits: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT],
      respondsTo: []
    },
    supportsGroupActions: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/DataMatch/index.jsx'
  },
  BreakoutGame: {
    component: BreakoutGame,
    panelId: 'breakout-game',
    category: 'Fun',
    title: 'Breakout',
    description: 'Arcade breakout mini-game with per-user high score tracking',
    usesMockData: false,
    props: {},
    dataRequirements: 'Stores score per user via talia GraphQL config_setting',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/BreakoutGame/index.jsx'
  },
  SpaceInvaders: {
    component: SpaceInvaders,
    panelId: 'space-invaders',
    category: 'Fun',
    title: 'Space Invaders',
    description: 'Arcade space shooter with shared game score tracking',
    usesMockData: false,
    props: {},
    dataRequirements: 'Stores score per user via generic game score GraphQL service',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/SpaceInvaders/index.jsx'
  },
  PacMan: {
    component: PacMan,
    panelId: 'pac-man',
    category: 'Fun',
    title: 'Pac-Man',
    description: 'Maze arcade demo with shared game score tracking',
    usesMockData: false,
    props: {},
    dataRequirements: 'Stores score per user via generic game score GraphQL service',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/PacMan/index.jsx'
  },
  Asteroids: {
    component: Asteroids,
    panelId: 'asteroids',
    category: 'Fun',
    title: 'Asteroids',
    description: 'Space survival arcade demo with shared game score tracking',
    usesMockData: false,
    props: {},
    dataRequirements: 'Stores score per user via generic game score GraphQL service',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/Asteroids/index.jsx'
  },
  Pong: {
    component: Pong,
    panelId: 'pong',
    category: 'Fun',
    title: 'Pong',
    description: 'Arcade paddle demo with shared game score tracking',
    usesMockData: false,
    props: {},
    dataRequirements: 'Stores score per user via generic game score GraphQL service',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/Pong/index.jsx'
  },
  MoonLanderGame: {
    component: MoonLanderGame,
    panelId: 'moon-lander',
    category: 'Fun',
    title: 'Moon Lander',
    description: 'Minimal lunar landing game (gravity, thrust, pad landing) with score tracking',
    usesMockData: false,
    props: {},
    dataRequirements: 'Stores score per user via generic game score GraphQL service',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/MoonLanderGame/index.jsx'
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
    supportsGroupActions: true,
    showInReports: true,
    filePath: 'src/components/focus-panels/MasterVoyagePerformanceSummary/index.jsx'
  },
  VoyageReport: {
    component: VoyageReportContainer,
    panelId: 'voyage-report',
    category: 'Reports',
    title: 'Voyage Report',
    legacy: true,
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
    // Framework source gate — refresh only when this source is YES.
    requiredSources: ['celestyal_b2b_api_read'],
    events: {
      emits: [directSourceSelect],
      respondsTo: [SAIL_SELECT_EVENT]
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/DirectSourceRequest/index.jsx'
  },
  DirectAvailability: {
    component: DirectAvailabilityContainer,
    panelId: 'direct-availability',
    category: 'External',
    title: 'Direct Availability',
    description: 'Compact current availability for selected sailing from direct Seaware query',
    usesMockData: false,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Queries external GraphQL endpoint using sail.select context and shows only selected-sail rows',
    requiredSources: ['celestyal_b2b_api_read'],
    events: {
      emits: [cabinSelect, cabinClear],
      respondsTo: [SAIL_SELECT_EVENT]
    },
    showInReports: true,
    filePath: 'src/components/focus-panels/DirectAvailability/index.jsx'
  },
  AdminDashboard: {
    component: AdminDashboard,
    panelId: 'admin-dashboard',
    category: 'Admin',
    title: 'Admin Dashboard',
    description: 'Role and focus administration panel',
    props: {},
    dataRequirements: 'ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    options: {
      views: [VIEW_ADMIN_SECTION, VIEW_CONTROLS, VIEW_COLUMN_FILTERS],
      operations: [],
    },
    filePath: 'src/components/admin/dashboard/AdminDashboard.jsx'
  },
  DataManagementPanel: {
    component: DataManagementPanel,
    panelId: 'data-management-panel',
    category: 'Admin',
    title: 'Data Management',
    description: 'Operational data sync and table management tooling',
    props: {},
    dataRequirements: 'Requires GraphQL backend access; ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    supportsDataExport: true,
    showInReports: true,
    options: {
      views: [
        VIEW_DATA_SECTION,
        VIEW_DETAILS,
        VIEW_FILTERS,
        VIEW_CONTROLS,
        VIEW_COLUMN_FILTERS,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/DataManagement/index.jsx'
  },
  RmChecklist: {
    component: RmChecklistContainer,
    panelId: 'rm-checklist',
    category: 'Dashboards',
    title: 'RM Checklist',
    description: 'Open Findings from talia-engine RM Agents. Advise only.',
    props: {},
    dataRequirements: 'Requires rm_findings via GraphQL. Engine runtime is optional for viewing stored Findings.',
    events: { emits: [SAIL_SELECT_EVENT], respondsTo: [SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT] },
    supportsRefresh: true,
    showInReports: true,
    options: {
      views: [
        VIEW_CHECKLIST_DISPLAY,
        { ...VIEW_SNAPSHOT, default: true },
        VIEW_FILTERS,
        VIEW_COLUMN_FILTERS,
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/RmChecklist/index.jsx'
  },
  EngineActivity: {
    component: EngineActivityContainer,
    panelId: 'engine-activity',
    category: 'Dashboards',
    title: 'Engine Activity',
    description: 'talia-engine runtime health, RM Agent runs, and Python element status.',
    props: {},
    dataRequirements: 'Reads rm_engine_runs; live Online status requires talia-engine on :4100',
    events: { emits: [], respondsTo: [] },
    supportsRefresh: true,
    minRole: 'MANAGER',
    showInReports: true,
    options: {
      views: [
        { ...VIEW_SNAPSHOT, default: true },
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/EngineActivity/index.jsx'
  },
  DriverAnalysis: {
    component: DriverAnalysisContainer,
    panelId: 'driver-analysis',
    category: 'Dashboards',
    title: 'Driver Analysis',
    description: 'Historic peerset prior on the booking horizon, projected to NOW with material/revenue value.',
    props: {},
    dataRequirements: 'rm_science_evidence via GraphQL; run requires talia-engine Python element',
    events: {
      emits: [SAIL_SELECT_EVENT],
      respondsTo: [
        SAIL_SELECT_EVENT,
        SAIL_CLEAR_EVENT,
        SHIP_SELECT_EVENT,
        SHIP_CLEAR_EVENT,
      ],
    },
    supportsRefresh: true,
    minRole: 'MANAGER',
    showInReports: true,
    options: {
      views: [
        { ...VIEW_SNAPSHOT, default: true },
        { ...VIEW_DETAILS, default: false },
        VIEW_LEGENDS,
        VIEW_AXIS_LABELS,
        VIEW_TOOLTIP,
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/DriverAnalysis/index.jsx'
  },
  ColumnTerminologyPanel: {
    component: ColumnTerminologyPanel,
    panelId: 'column-terminology-panel',
    category: 'Admin',
    title: 'Column Terminology',
    description: 'Admin view of global short/long table terminology dictionary with observed field coverage.',
    props: {},
    dataRequirements: 'Derived from tabulatorColumnLabelDictionary and runtime field observations; ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    filePath: 'src/components/focus-panels/ColumnTerminology/index.jsx'
  },
  EtlTableParametersPanel: {
    component: EtlTableParametersPanel,
    panelId: 'etl-table-parameters-panel',
    category: 'Admin',
    title: 'ETL Table Parameters',
    description: 'Read-only local mirror of upstream config.ETL_Table_Parameters source→target mappings.',
    props: {},
    dataRequirements: 'Requires etl_table_parameters table via GraphQL tableData; ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    filePath: 'src/components/focus-panels/EtlTableParameters/index.jsx'
  },
  DataLineagePanel: {
    component: DataLineagePanel,
    panelId: 'data-lineage',
    category: 'Admin',
    title: 'Data Lineage',
    description: 'Original source → Talia tables → components → fields, with usage, column provenance, and source-lineage diagram (D015).',
    props: {},
    dataRequirements: 'Requires etl_table_parameters and ui_activity_events; joins registry dataRequirements and Tabulator field usage. ADMIN/SUPER_USER only',
    tables: ['etl_table_parameters', 'ui_activity_events'],
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [
        VIEW_LINEAGE_ORIENTATION,
        VIEW_LINEAGE_DISPLAY,
        VIEW_LINEAGE_CO_CONSUMERS,
        VIEW_LINEAGE_LOGICAL_LINKS,
        VIEW_LEGENDS,
        VIEW_FILTERS,
        VIEW_COLUMN_FILTERS,
        { ...VIEW_DETAILS, default: true },
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/DataLineage/index.jsx'
  },
  PortCityPanel: {
    component: PortCityPanel,
    panelId: 'port-city',
    category: 'Tables',
    title: 'Port locations',
    description: 'UN/LOCODE locations from dwh.Dim_Port_City, each labeled with the nearest port.',
    props: {},
    dataRequirements: 'Requires port_city synced from dwh.Dim_Port_City.',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    options: {
      views: [VIEW_PORT_CITY_DISPLAY, VIEW_FILTERS, VIEW_COLUMN_FILTERS, VIEW_PROVENANCE],
      operations: [],
    },
    filePath: 'src/components/focus-panels/PortCity/index.jsx'
  },
  RequirementsLogPanel: {
    component: RequirementsLogPanel,
    panelId: 'requirements-log',
    category: 'Admin',
    title: 'Requirements Log',
    description: 'Instance task board: deliverable versions, external actions, and open questions',
    props: {},
    dataRequirements: 'Requires talia_requirement_item via GraphQL; ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [
        VIEW_DENSITY,
        VIEW_REQUIREMENTS_DISPLAY,
        VIEW_FILTERS,
        VIEW_COLUMN_FILTERS,
        { ...VIEW_DETAILS, default: true },
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/RequirementsLog/index.jsx'
  },
  FunctionalityMatrixPanel: {
    component: FunctionalityMatrixPanel,
    panelId: 'functionality-matrix',
    category: 'Requirements',
    title: 'Functionality Matrix',
    description: 'Grid or list of requirements by element, with a specification for each cell',
    props: {},
    dataRequirements: 'Requires functionality_matrix_item via GraphQL. Assigns talia_requirement_item rows by link. ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [
        VIEW_MATRIX_DISPLAY,
        VIEW_AXIS_LABELS,
        VIEW_FILTERS,
        { ...VIEW_DETAILS, default: true },
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/FunctionalityMatrix/index.jsx'
  },
  RiskRegisterPanel: {
    component: RiskRegisterPanel,
    panelId: 'risk-register',
    category: 'Admin',
    title: 'Risk Register',
    description: 'Project risks with likelihood, impact, response, and links to requirements and the matrix',
    props: {},
    dataRequirements: 'Requires risk_register_item via GraphQL. Links requirements and matrix cells. ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [
        VIEW_RISK_DISPLAY,
        VIEW_AXIS_LABELS,
        VIEW_FILTERS,
        { ...VIEW_DETAILS, default: true },
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/RiskRegister/index.jsx'
  },
  DocumentRepositoryPanel: {
    component: DocumentRepositoryPanel,
    panelId: 'document-repository',
    category: 'Admin',
    title: 'Documents',
    description: 'Markdown notes and images linked to requirements, matrix cells, and risks',
    props: {},
    dataRequirements: 'Requires project_document via GraphQL. ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    supportsDataExport: true,
    options: {
      views: [
        VIEW_FILTERS,
        { ...VIEW_DETAILS, default: true },
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/DocumentRepository/index.jsx'
  },
  ProjectPlanPanel: {
    component: ProjectPlanPanel,
    panelId: 'project-plan',
    category: 'Admin',
    title: 'Project Plan',
    description: 'Phase timeline with milestone target dates and the requirements, matrix cells, risks, and documents linked to each phase',
    props: {},
    dataRequirements: 'Requires project_phase and project_milestone via GraphQL. ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    options: {
      views: [
        { ...VIEW_DETAILS, default: true },
        VIEW_PROVENANCE,
      ],
      operations: [],
    },
    filePath: 'src/components/focus-panels/ProjectPlan/index.jsx'
  },
  TestWorkbenchPanel: {
    component: TestWorkbenchPanel,
    panelId: 'test-workbench-panel',
    category: 'Debugging',
    title: 'Test Workbench',
    description: 'Component test harness with event and query monitoring',
    props: {},
    dataRequirements: 'Development testing surface; ADMIN/SUPER_USER only',
    events: { emits: [], respondsTo: [] },
    allowedRoles: ['ADMIN', 'SUPER_USER'],
    showInReports: true,
    filePath: 'src/components/focus-panels/TestWorkbench/index.jsx'
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
    allowedRoles: ['ADMIN', 'SUPER_USER'],
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
    legacy: true,
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
    legacy: true,
    description: 'Validates data types library with Tabulator',
    usesMockData: true,
    props: {
      theme: { type: 'object', required: false, description: 'Theme object for styling' }
    },
    dataRequirements: 'Uses mock test data',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/dev/DataTypesValidation.jsx'
  },
  PlaceHolder: {
    component: PlaceHolderContainer,
    panelId: 'ui-placeholder',
    category: 'UI/UX Tools',
    title: 'Place Holder',
    description: 'Wireframe canvas for workshop ideas — tables, cards, lists, bar/line charts; promote to Requirements.',
    props: {},
    dataRequirements: 'No live data. Skeleton wireframes only; promote writes talia_requirement_item (ADMIN+).',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    options: {
      views: [VIEW_WIREFRAME, VIEW_PLACEHOLDER_CAPTION, VIEW_CONTROLS, VIEW_PROVENANCE],
      operations: [],
    },
    filePath: 'src/components/focus-panels/PlaceHolder/index.jsx'
  },
  ChatbotDemo: {
    component: ChatbotDemoContainer,
    panelId: 'ui-chatbot-demo',
    category: 'UI/UX Tools',
    title: 'Chatbot (demo)',
    description: 'Simulated assistant layout. Replies are random local lines from Sun Tzu and are not connected to bookings or a model.',
    props: {},
    dataRequirements: 'No data and no external service. Demonstration of a future chat report.',
    events: { emits: [], respondsTo: [] },
    showInReports: true,
    filePath: 'src/components/focus-panels/ChatbotDemo/index.jsx'
  }
};

/**
 * Legacy Dockview panel ids remapped to the current canonical panel.
 * Saved focuses that still store the old id open the replacement panel.
 */
export const PANEL_ID_ALIASES = Object.freeze({
  'master-sailing': 'master-sailing-explorer',
});

export const resolvePanelId = (panelId) => {
  const key = String(panelId || '').trim();
  if (!key) return key;
  return PANEL_ID_ALIASES[key] || key;
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

export const canRoleAccessComponent = (metadata, role = 'USER') => {
  const normalizedRole = String(role || 'USER').toUpperCase();
  // minRole: hierarchy floor (GUEST < USER < MANAGER < ADMIN < SUPER_USER)
  if (metadata?.minRole) {
    const roleHierarchy = {
      GUEST: 0,
      USER: 1,
      MANAGER: 2,
      ADMIN: 3,
      SUPER_USER: 4,
      SUPERUSER: 4,
    };
    const userLevel = roleHierarchy[normalizedRole === 'SUPERUSER' ? 'SUPER_USER' : normalizedRole] ?? 0;
    const requiredLevel = roleHierarchy[String(metadata.minRole).toUpperCase()] ?? 0;
    if (userLevel < requiredLevel) return false;
  }
  const allowed = metadata?.allowedRoles;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return true;
  }
  const normalizedAllowed = allowed.map((entry) => String(entry || '').toUpperCase());
  if (normalizedAllowed.includes(normalizedRole)) {
    return true;
  }
  // SUPER_USER is treated as a superset of ADMIN access in panel gating.
  if (normalizedRole === 'SUPER_USER' || normalizedRole === 'SUPERUSER') {
    return normalizedAllowed.includes('ADMIN') || normalizedAllowed.includes('SUPER_USER') || normalizedAllowed.includes('SUPERUSER');
  }
  return false;
};

export const getComponentNames = () => Object.keys(componentRegistry);

export default componentRegistry;
