// Enhanced GraphQL Schema for Talia Focus Management System

export const typeDefs = `#graphql
  # User and Authentication Types
  type User {
    id: ID!
    email: String!
    role: UserRole!
    name: String
    preferences: UserPreferences
    createdAt: String!
    updatedAt: String!
  }

  type TaliaUser {
    id: ID!
    taliaUserId: Int!
    email: String!
    createdAt: String!
    updatedAt: String!
    lastLoginAt: String
  }

  type FocusPreference {
    id: ID!
    userId: ID!
    focusId: ID!
    isFavorite: Boolean!
    lastUsed: String
    customLayout: JSON
    createdAt: String!
    updatedAt: String!
  }

  type FocusGroup {
    id: ID!
    name: String!
    description: String
    isActive: Boolean!
    createdBy: ID
    createdAt: String!
    updatedAt: String!
  }

  enum UserRole {
    ADMIN
    MANAGER
    USER
    GUEST
  }

  type UserPreferences {
    theme: String
    fontSize: Int
    fontFamily: String
    spacingMode: String
    defaultFocus: String
    selectedSailCode: String
  }

  # Focus Management Types
  type Focus {
    id: ID!
    name: String!
    description: String
    type: FocusType!
    role: UserRole!
    components: [FocusComponent!]!
    layoutData: JSON
    createdBy: ID!
    createdAt: String!
    updatedAt: String!
    isPublic: Boolean!
  }

  enum FocusType {
    STANDARD
    USER
    TEMPLATE
    SHARED
  }

  type FocusComponent {
    id: ID!
    type: ComponentType!
    position: ComponentPosition!
    settings: JSON
    dataSource: String
  }

  enum ComponentType {
    CHART
    TABLE
    KPI
    GRAPHQL_PANEL
  }

  type ComponentPosition {
    x: Int!
    y: Int!
    width: Int!
    height: Int!
  }

  # Data Types (Enhanced)
  type Ship {
    Ship_Id: Int!
    Ship_Code: String!
    Ship_Name: String!
    Ship_Pax_Capacity: String!
    Ship_Length: String!
    Ship_Tonnage: String!
  }

  type CabinAvailability {
    Snapshot_Date: String!
    Package_Name: String!
    Sail_Days: Float!
    Cabin_Category: String!
    Available_Cabins: Float!
    Total_Cabins: Float!
    Available_Absolute: Float!
    Available_Weighted: Float!
    Availability_Result: String!
    Nested_Cabins: Float
  }

  type Sailing {
    id: ID!
    ship: String!
    sailing: String!
    depart: String!
    booked: Int!
    available: Int!
    projected: Int!
    status: String!
  }

  type MasterSail {
    id: Int
    sail_id: Float
    ship_code: String
    ship_name: String
    sail_date_from: String
    port_from: String
    sail_date_to: String
    port_to: String
    package_id: Float
    package_type: String
    sail_code: String
    package_name: String
    sail_days: Int
    geog_area_code: String
    vacation_date: String
    season_code: String
    is_fake: String
    is_active: String
    is_package_active: String
    master_voyage_departure_date: String
    master_voyage1: String
    master_voyage1_length: Int
    master_voyage1_sail_days: Int
    master_voyage2: String
    master_voyage2_length: Int
    master_voyage2_sail_days: Int
    is_main: Int
    is_primary: Int
    created_at: String
  }

  type KPI {
    id: ID!
    title: String!
    value: Float!
    target: Float
    unit: String!
    trend: TrendDirection!
    change: Float
    period: String!
  }

  enum TrendDirection {
    UP
    DOWN
    STABLE
  }

  type Exception {
    id: ID!
    type: String!
    severity: ExceptionSeverity!
    message: String!
    sailing: String!
    ship: String!
    createdAt: String!
    resolved: Boolean!
  }

  enum ExceptionSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  # Filter Types
  input SailingFilters {
    ship: String
    sailing: String
    status: String
    dateFrom: String
    dateTo: String
    bookedMin: Int
    bookedMax: Int
  }

  input DateFilters {
    from: String!
    to: String!
  }

  input FocusFilters {
    role: UserRole
    type: FocusType
    isPublic: Boolean
    createdBy: ID
  }

  input MasterSailFilters {
    sail_code: String
    ship_name: String
    ship_code: String
    package_name: String
    package_type: String
    geog_area_code: String
    is_active: String
    sail_date_from: String
    sail_date_to: String
    limit: Int
  }

  type Reservation {
    id: Int
    res_id: Float
    res_status: String
    source_code: String
    res_probability: Float
    pax_type: String
    pax_status: String
    ship: String
    sail_code: String
    sail_duration: Int
    sail_from_date: String
    sail_to_date: String
    agency_id: Float
    sec_agency_id: Float
    agency_channel: String
    agency_country_code: String
    agency_market: String
    cabin_type: String
    cabin_category: String
    ticket_type: String
    promo_code: Int
    currency: String
    currency_rate: Float
    guest_count: Float
    foc_guest_count: Float
    gross_published_fare: Float
    gross_selling_fare: Float
    net_selling_fare: Float
    cruise_fare_comm: Float
    published_discount: Float
    promotional_discounts: Float
    total_discounts: Float
    gross_ticket_revenue: Float
    net_ticket_revenue: Float
    net_invoice_revenue: Float
    gross_ticket_revenue_eur: Float
    net_ticket_revenue_eur: Float
    net_invoice_revenue_eur: Float
    total_discounts_eur: Float
    created_at: String
  }

  # Booking Profile Types
  type BookingDataPoint {
    date: String!
    bookings: Int!
    guests: Int!
    newBookings: Int!
    cancellations: Int!
    netBookings: Int!
  }

  type BookingProfile {
    sailCode: String!
    sailDate: String!
    shipName: String!
    shipCode: String!
    currentBookings: Int!
    currentGuests: Int!
    bookingDataPoints: [BookingDataPoint!]!
    bookingVelocity: Float!
    cancellationRate: Float!
    daysUntilSailing: Int
  }

  type ComparisonMetrics {
    bookingsDifference: Int!
    bookingsPercentageChange: Float!
    guestsDifference: Int!
    guestsPercentageChange: Float!
    velocityDifference: Float!
    velocityPercentageChange: Float!
  }

  type YearOverYearComparison {
    currentYear: BookingProfile!
    previousYear: BookingProfile
    comparison: ComparisonMetrics
  }

  # Build Curve Types
  type BuildCurvePoint {
    weekLabel: String!      # "W-12", "W-10", "W-8", "W-6", "W-4", "W-2", "Sail"
    weeksUntilSailing: Int!
    bookings: Int!
    guests: Int!
    percentageOfTarget: Float
    actualVsTarget: Float
  }

  type BookingProfileWithCurves {
    sailCode: String!
    sailDate: String!
    shipName: String!
    shipCode: String!
    currentBookings: Int!
    currentGuests: Int!
    bookingDataPoints: [BookingDataPoint!]!
    bookingVelocity: Float!
    cancellationRate: Float!
    daysUntilSailing: Int
    buildCurves: [BuildCurvePoint!]!  # Incremental build curves at week intervals
  }

  # Target Profile Types
  type TargetProfile {
    id: ID!
    name: String!
    description: String
    sailCode: String
    shipCode: String
    packageType: String
    seasonCode: String
    geogAreaCode: String
    buildCurves: [BuildCurvePoint!]!
    basedOnHistoric: [String!]!
    createdBy: ID
    createdAt: String!
    updatedAt: String!
    isActive: Boolean!
  }

  input BuildCurvePointInput {
    weekLabel: String!
    weeksUntilSailing: Int!
    targetBookings: Int!
    targetGuests: Int!
  }

  input TargetProfileInput {
    name: String!
    description: String
    sailCode: String
    shipCode: String
    packageType: String
    seasonCode: String
    geogAreaCode: String
    buildCurves: [BuildCurvePointInput!]!
    basedOnHistoric: [String!]
  }

  input TargetProfileFilters {
    sailCode: String
    shipCode: String
    packageType: String
    seasonCode: String
    isActive: Boolean
  }

  # Competitor Pricing Types
  type CompetitorPricingData {
    id: ID!
    cruiseLine: String!
    currency: String!
    shipCode: String
    shipName: String!
    cabinType: String!
    departureDate: String!
    departurePort: String
    destination: String!
    market: String
    duration: Float!
    pppd: Float!
    totalRatePP: Float!
    snapshotDate: String!
    availableOffer: String
    itineraryCode: String
  }

  input CompetitorPricingFilters {
    currency: String
    duration: Float
    destination: String
    cabinType: String  # "ALL", "INSIDE", "OUTSIDE", "BALCONY", "SUITE"
    departureMonth: Int  # 1-12
    isLatest: Boolean
    cruiseLine: String
    market: String
  }

  input ReservationFilters {
    sail_code: String
    ship: String
    res_status: String
    agency_id: Float
    cabin_category: String
    sail_from_date_from: String
    sail_from_date_to: String
    limit: Int
  }

  type DemandHeatmapData {
    id: Int
    sail_code: String
    region: String
    itinerary: String
    departure_month: String
    departure_date: String
    guest_count: Float
    reservation_count: Int
    geog_area_code: String
    ship_code: String
    ship_name: String
    is_mock_data: Boolean
    data_source: String
    created_at: String
    updated_at: String
  }

  type DemandHeatmapResult {
    data: [DemandHeatmapRow!]!
    months: [String!]!
    containsMockData: Boolean!
  }

  type DemandHeatmapRow {
    region: String!
    itinerary: String!
    geog_area_code: String
    months: [DemandHeatmapMonthValue!]!
  }

  type DemandHeatmapMonthValue {
    month: String!
    guest_count: Float!
  }

  input DemandHeatmapFilters {
    region: String
    itinerary: String
    departure_month_from: String
    departure_month_to: String
    geog_area_code: String
    limit: Int
  }

  # Google Search Types
  type GoogleSearchResult {
    query: String!
    totalResults: Int!
    searchTime: Float!
    items: [GoogleSearchItem!]!
    spelling: String
    metadata: GoogleSearchMetadata!
  }

  type GoogleSearchItem {
    title: String!
    link: String!
    snippet: String!
    displayLink: String!
    formattedUrl: String!
    htmlTitle: String!
    htmlSnippet: String!
    pagemap: JSON
  }

  type GoogleSearchMetadata {
    apiType: String!
    timestamp: String!
  }

  input GoogleSearchFilters {
    query: String!
    num: Int
    start: Int
    dateRestrict: String
    trackTrend: Boolean
  }

  enum GoogleService {
    ANALYTICS
    ADS
    SEARCH_CONSOLE
  }

  type GoogleOAuthResponse {
    authorizationUrl: String!
    state: String!
  }

  type TrackSearchResult {
    success: Boolean!
    trendId: Int
    message: String!
  }

  type BackfillResult {
    query: String!
    dataPointsStored: Int!
    dateRange: DateRange!
  }

  # Google Search Trends Types
  type GoogleSearchTrend {
    id: Int!
    query: String!
    totalResults: Int!
    searchTime: Float
    searchDate: String!
    searchTimestamp: String!
    notes: String
    createdBy: String
    createdAt: String!
    updatedAt: String!
  }

  type SearchTrendDataPoint {
    date: String!
    totalResults: Int!
    searchTime: Float
    timestamp: String!
  }

  type SearchTrendSeries {
    query: String!
    dataPoints: [SearchTrendDataPoint!]!
    latestCount: Int!
    change: Float
    changePercent: Float
  }

  type GoogleSearchTrendsResult {
    queries: [String!]!
    series: [SearchTrendSeries!]!
    dateRange: DateRange!
    totalDataPoints: Int!
  }

  type DateRange {
    from: String!
    to: String!
  }

  type HistoricalTrendPoint {
    date: String!
    totalResults: Int!
    searchTime: Float
  }

  input GoogleSearchTrendFilters {
    queries: [String!]
    query: String
    dateFrom: String
    dateTo: String
    limit: Int
  }

  # Google Trends Data Types (what people are searching for)
  type GoogleTrendsDataPoint {
    id: Int!
    searchQuery: String!
    date: String!
    interestScore: Int! # 0-100 from Google Trends
    region: String! # Empty = worldwide, or country code
    category: String
    createdAt: String!
    updatedAt: String!
  }

  type GoogleTrendsSeries {
    query: String!
    dataPoints: [GoogleTrendsDataPoint!]!
    minScore: Int!
    maxScore: Int!
    avgScore: Float!
  }

  type GoogleTrendsResult {
    queries: [String!]!
    series: [GoogleTrendsSeries!]!
    dateRange: DateRange!
    region: String! # Geographic region filter used
    totalDataPoints: Int!
  }

  input GoogleTrendsFilters {
    queries: [String!]! # Array of search queries to fetch trends for
    startDate: String # Start date (YYYY-MM-DD), default: 5 years ago
    endDate: String # End date (YYYY-MM-DD), default: today
    region: String # Geographic region ('' = worldwide, 'US', 'GB', 'GR', etc.)
    granularity: String # 'daily', 'weekly', 'monthly' (default: 'daily')
    limit: Int # Limit number of data points
  }

  type GoogleTrendsSearchTerm {
    id: Int!
    searchTerm: String!
    category: String
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    lastQueriedDate: String
  }

  input GoogleTrendsSearchTermInput {
    searchTerm: String!
    category: String
    isActive: Boolean
  }

  # Input Types for Mutations
  input FocusInput {
    name: String!
    description: String
    type: FocusType!
    role: UserRole!
    components: [FocusComponentInput!]!
    isPublic: Boolean
  }

  input FocusComponentInput {
    type: ComponentType!
    position: ComponentPositionInput!
    settings: JSON
    dataSource: String
  }

  input ComponentPositionInput {
    x: Int!
    y: Int!
    width: Int!
    height: Int!
  }

  input UserPreferencesInput {
    theme: String
    fontSize: Int
    fontFamily: String
    spacingMode: String
    defaultFocus: String
    selectedSailCode: String
  }

  input FocusPreferenceInput {
    isFavorite: Boolean
    lastUsed: String
    customLayout: JSON
  }

  input FocusGroupInput {
    name: String!
    description: String
    isActive: Boolean
  }

  # Queries
  type Query {
    # User Management
    me: User
    users: [User!]!
    taliaUser(email: String!): TaliaUser
    
    # Focus Management
    focuses(filters: FocusFilters): [Focus!]!
    focusesByRole(role: String!): [Focus!]!
    focus(id: ID!): Focus
    myFocuses: [Focus!]!
    myFocusPreferences: [FocusPreference!]!
    focusGroups(isActive: Boolean): [FocusGroup!]!
    
    # Data Queries (with role-based filtering)
    sailings(filters: SailingFilters, userRole: UserRole): [Sailing!]!
    masterSail(filters: MasterSailFilters): [MasterSail!]!
    ships: [Ship!]!
    cabinAvailability(filters: DateFilters): [CabinAvailability!]!
    reservations(filters: ReservationFilters): [Reservation!]!
    kpis(userRole: UserRole): [KPI!]!
    exceptions(userRole: UserRole): [Exception!]!
    
    # Demand Heatmap
    demandHeatmapData(filters: DemandHeatmapFilters, includeMockData: Boolean): DemandHeatmapResult!
    
    # Google Search
    googleSearch(filters: GoogleSearchFilters): GoogleSearchResult!
    googleOAuthUrl(service: GoogleService!): GoogleOAuthResponse!
    googleSearchTrends(filters: GoogleSearchTrendFilters): GoogleSearchTrendsResult!
    trackedSearchQueries: [String!]!
    historicalSearchTrends(query: String!, startDate: String!, endDate: String!, intervalDays: Int): [HistoricalTrendPoint!]!
    
    # Google Trends (what people are searching for)
    googleTrends(filters: GoogleTrendsFilters!): GoogleTrendsResult!
    googleTrendsQueries: [String!]! # Get list of queries we have trends data for
    googleTrendsCategories: [String!]! # Get list of available query categories
    googleTrendsQueriesByCategory(category: String!): [String!]! # Get queries for a specific category
    googleTrendsSearchTerms: [GoogleTrendsSearchTerm!]! # Get editable search terms
    
    # Data Refresh Metadata
    refreshMetadata(dataSource: String!): RefreshMetadata
    
    # Booking Profile
    bookingProfile(sailCode: String!): BookingProfile
    bookingProfileYearOverYear(sailCode: String!, previousYearSailCode: String): YearOverYearComparison
    bookingProfileWithCurves(sailCode: String!): BookingProfileWithCurves
    
    # Target Profiles
    targetProfiles(filters: TargetProfileFilters): [TargetProfile!]!
    targetProfile(id: ID!): TargetProfile
    
    # Competitor Pricing
    competitorPricing(filters: CompetitorPricingFilters): [CompetitorPricingData!]!
    
    # Sync Status (for real-time polling)
    syncStatus(tableName: String!): SyncStatus
    
    # Connection Status
    synapseConnectionStatus: ConnectionStatus!
    
    # Legacy queries (for backward compatibility)
    books: [Book!]!
  }

  # Mutations
  type Mutation {
    # Focus Management
    createFocus(input: FocusInput!): Focus!
    updateFocus(id: ID!, input: FocusInput!): Focus!
    deleteFocus(id: ID!): Boolean!
    shareFocus(id: ID!, isPublic: Boolean!): Focus!
    
    # User Management
    updateUserPreferences(input: UserPreferencesInput!): User!
    
    # Focus Preferences
    updateFocusPreference(focusId: ID!, preferences: FocusPreferenceInput!): FocusPreference!
    toggleFavorite(focusId: ID!): FocusPreference!
    
    # Focus Groups (Admin)
    createFocusGroup(groupData: FocusGroupInput!): FocusGroup!
    updateFocusGroup(groupId: ID!, updateData: FocusGroupInput!): FocusGroup!
    deleteFocusGroup(groupId: ID!): Boolean!
    
    # Data Sync
    syncTable(tableName: String!, dataset: String, forceFullSync: Boolean): SyncResult!
    
    # Target Profiles
    createTargetProfile(input: TargetProfileInput!): TargetProfile!
    updateTargetProfile(id: ID!, input: TargetProfileInput!): TargetProfile!
    deleteTargetProfile(id: ID!): Boolean!
    
    # Google Search Trends
    trackGoogleSearch(query: String!, trackTrend: Boolean): TrackSearchResult!
    backfillHistoricalTrends(query: String!, monthsBack: Int): BackfillResult!
    
    # Google Trends
    fetchGoogleTrends(queries: [String!]!, startDate: String, endDate: String, region: String, storeResults: Boolean): GoogleTrendsResult!
    backfillGoogleTrends(queries: [String!]!, startDate: String, endDate: String, region: String): BackfillResult!
    fetchTrendsForCategory(category: String!, startDate: String, endDate: String, region: String): BackfillResult!
    fetchTrendsForAllQueries(startDate: String, endDate: String, region: String): BackfillResult!
    refreshGoogleTrends(queries: [String!], startDate: String, endDate: String, region: String): RefreshResult!
    
    # Google Trends Search Terms Management
    createGoogleTrendsSearchTerm(input: GoogleTrendsSearchTermInput!): GoogleTrendsSearchTerm!
    updateGoogleTrendsSearchTerm(id: Int!, input: GoogleTrendsSearchTermInput!): GoogleTrendsSearchTerm!
    deleteGoogleTrendsSearchTerm(id: Int!): Boolean!
    
    # Server Management
    restartServer: Boolean!
  }

  type SyncResult {
    success: Boolean!
    tableName: String!
    message: String!
    recordsProcessed: Int
    duration: Int
    error: String
    detailedLogs: [String!]
  }

  type SyncStatus {
    tableName: String!
    status: String! # 'running' | 'completed' | 'failed'
    startTime: Int!
    duration: Int!
    logs: [String!]!
    structuredLogs: [StructuredLog!]!
  }

  type StructuredLog {
    level: String!
    message: String!
    timestamp: String!
  }

  type ConnectionStatus {
    online: Boolean!
    server: String!
    database: String
    lastChecked: String
    error: String
  }

  # Data Refresh Metadata
  type RefreshMetadata {
    dataSource: String!
    lastRefreshedAt: String
    refreshStatus: String! # 'idle', 'in_progress', 'success', 'error'
    refreshError: String
    recordsUpdated: Int
    metadata: JSON
  }

  type RefreshResult {
    success: Boolean!
    message: String!
    lastRefreshedAt: String!
    recordsUpdated: Int!
    error: String
  }

  # Subscriptions (for real-time updates)
  type Subscription {
    dataUpdated(userRole: UserRole): DataUpdate!
    focusUpdated(userId: ID!): Focus!
  }

  type DataUpdate {
    type: String!
    data: JSON!
    timestamp: String!
  }

  # Legacy types (for backward compatibility)
  type Book {
    title: String
    author: String
  }

  # JSON scalar type for flexible data
  scalar JSON
`;

// Sample data for development
export const sampleData = {
  users: [
    {
      id: "1",
      email: "admin@celestyal.com",
      role: "ADMIN",
      name: "Admin User",
      preferences: {
        theme: "default",
        fontSize: 12,
        fontFamily: "Inter",
        spacingMode: "default",
        defaultFocus: "performance"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "2",
      email: "manager@celestyal.com",
      role: "MANAGER",
      name: "Manager User",
      preferences: {
        theme: "light",
        fontSize: 14,
        fontFamily: "Roboto",
        spacingMode: "compact",
        defaultFocus: "exception"
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  focuses: [
    {
      id: "1",
      name: "Performance Dashboard",
      description: "Main performance metrics and KPIs",
      type: "STANDARD",
      role: "ADMIN",
      components: [
        {
          id: "kpi-1",
          type: "KPI",
          position: { x: 0, y: 0, width: 6, height: 4 },
          settings: { title: "Total Bookings", unit: "passengers" },
          dataSource: "sailings"
        },
        {
          id: "chart-1",
          type: "CHART",
          position: { x: 6, y: 0, width: 6, height: 4 },
          settings: { type: "line", title: "Booking Trends" },
          dataSource: "sailings"
        }
      ],
      createdBy: "1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: true
    }
  ],
  sailings: [
    { id: "1", ship: "Celestyal Discovery", sailing: "7N Islands", depart: "2025-09-05", booked: 820, available: 950, projected: 910, status: "As expected" },
    { id: "2", ship: "Celestyal Journey", sailing: "3N Iconic Aegean", depart: "2025-09-06", booked: 620, available: 700, projected: 680, status: "Needs attention" },
    { id: "3", ship: "Celestyal Discovery", sailing: "4N Adriatic", depart: "2025-09-12", booked: 450, available: 760, projected: 720, status: "Below expected" },
    { id: "4", ship: "Celestyal Journey", sailing: "7N Idyllic Aegean", depart: "2025-09-13", booked: 910, available: 980, projected: 960, status: "As expected" },
    { id: "5", ship: "Celestyal Journey", sailing: "7N Three Continents", depart: "2025-09-20", booked: 700, available: 980, projected: 850, status: "Needs attention" },
    { id: "6", ship: "Celestyal Discovery", sailing: "3N Iconic Aegean", depart: "2025-09-27", booked: 300, available: 700, projected: 540, status: "Below expected" }
  ],
  kpis: [
    { id: "1", title: "Total Bookings", value: 3840, target: 4000, unit: "passengers", trend: "UP", change: 5.2, period: "30 days" },
    { id: "2", title: "Occupancy Rate", value: 78.5, target: 80.0, unit: "%", trend: "STABLE", change: 0.1, period: "30 days" },
    { id: "3", title: "Revenue", value: 2450000, target: 2500000, unit: "EUR", trend: "DOWN", change: -2.1, period: "30 days" },
    { id: "4", title: "Customer Satisfaction", value: 4.6, target: 4.5, unit: "/5", trend: "UP", change: 2.2, period: "30 days" }
  ],
  exceptions: [
    { id: "1", type: "Low Occupancy", severity: "MEDIUM", message: "Celestyal Discovery 3N Iconic Aegean has low occupancy", sailing: "3N Iconic Aegean", ship: "Celestyal Discovery", createdAt: new Date().toISOString(), resolved: false },
    { id: "2", type: "Overbooking", severity: "HIGH", message: "Potential overbooking detected for Journey 7N Idyllic Aegean", sailing: "7N Idyllic Aegean", ship: "Celestyal Journey", createdAt: new Date().toISOString(), resolved: false }
  ]
};
