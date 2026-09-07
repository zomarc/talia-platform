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
    role: String!
    createdAt: String!
    updatedAt: String!
    lastLoginAt: String
  }

  type UiActivityEvent {
    id: ID!
    at: String!
    userId: String
    userEmail: String
    userRole: String
    kind: String
    report: String
    panelComponent: String
    purpose: String
    status: String
    performanceMs: Int
    queryCount: Int
    sourceQueryId: String
    criteria: JSON
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

  type AppearanceProfile {
    id: ID!
    name: String!
    settings: JSON
    updatedAt: String
  }

  type AppearanceSettings {
    settings: JSON
    profiles: [AppearanceProfile!]!
    activeProfileId: String
  }

  # Raw global vs per-user profile rows (admin / Theme tools). Merged list = user overrides global by id.
  type AppearanceProfileBuckets {
    globalProfiles: [AppearanceProfile!]!
    userProfiles: [AppearanceProfile!]!
    activeProfileId: String
  }

  type TaliaUiThemeRegistryPayload {
    themes: JSON!
    assets: JSON!
  }

  type ColumnTerminologyDefinition {
    field: String!
    shortLabel: String
    longLabel: String
    userDefinition: String
    adminDefinition: String
    updatedAt: String
    updatedBy: String
  }

  type BreakoutScore {
    userId: String!
    highScore: Int!
    lastScore: Int!
    updatedAt: String
  }

  type BreakoutLeaderboard {
    top: [BreakoutScore!]!
    recent: [BreakoutScore!]!
  }

  type GameScore {
    gameId: String!
    userId: String!
    highScore: Int!
    lastScore: Int!
    updatedAt: String
  }

  type GameLeaderboard {
    gameId: String!
    top: [GameScore!]!
    recent: [GameScore!]!
  }

  type GameScoreBoard {
    top: [GameScore!]!
    recent: [GameScore!]!
  }

  # Focus Management Types
  type Focus {
    id: ID!
    name: String!
    description: String
    type: FocusType!
    role: UserRole!
    assignedRoles: [String!]!
    assignedUserId: String
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
    ROLE
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

  type ShipLivePosition {
    shipCode: String!
    shipName: String!
    mmsi: String
    latitude: Float
    longitude: Float
    speedKnots: Float
    course: Float
    heading: Float
    navStatus: String
    timestamp: String
    source: String!
    freshnessSeconds: Int
    isLive: Boolean!
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

  type InventoryItem {
    id: ID!
    localKey: String!
    sailCode: String
    referenceSailCode: String
    sailingRole: String
    parentInventoryItemId: ID
    isOperational: Boolean
    mmsi: String
    imoNumber: String
    shipCode: String
    shipName: String
    masterSailId: Float
    packageId: Float
    sourceTable: String
    sourceRowId: String
    metadata: JSON
    createdAt: String
    updatedAt: String
  }

  type InventoryMemo {
    id: ID!
    inventoryItemId: ID!
    memoText: String!
    memoType: String
    createdBy: String
    createdAt: String
    updatedAt: String
  }

  enum ProfileSeriesKind {
    REAL
    TARGET
    BUDGET
    MODEL
  }

  type CurvePoint {
    pointOrder: Int!
    weekLabel: String!
    weeksUntilSailing: Int
    valueBookings: Float
    valueGuests: Float
    asOfDate: String
    source: String
    metadata: JSON
  }

  enum ProfileSeriesScope {
    SYSTEM
    GLOBAL
    USER
  }

  type InventoryProfileSeries {
    inventoryItemId: ID!
    kind: ProfileSeriesKind!
    modelKey: String
    modelLabel: String
    profileScope: ProfileSeriesScope
    ownerKey: String
    lastEditedBy: String
    points: [CurvePoint!]!
  }

  type PortNewsItem {
    id: ID!
    title: String!
    url: String!
    source: String
    publishedAt: String
    summary: String
    port: String!
  }

  type PublicItineraryCatalogItem {
    url: String!
    title: String!
    description: String
    image: String!
    durationNights: Int
    slug: String
  }

  type PublicImagePoolItem {
    sourcePage: String!
    sourceLabel: String!
    imageUrl: String!
    title: String
  }

  type WeatherPoint {
    label: String!
    code: Int
    temperature: Float
    windSpeed: Float
    date: String
  }

  input InventoryItemFilters {
    id: ID
    localKey: String
    sailCode: String
    referenceSailCode: String
    sailingRole: String
    isOperational: Boolean
    mmsi: String
    shipCode: String
    masterSailId: Float
    limit: Int
  }

  input InventoryItemInput {
    id: ID
    sailCode: String
    referenceSailCode: String
    sailingRole: String
    parentInventoryItemId: ID
    isOperational: Boolean
    mmsi: String
    imoNumber: String
    shipCode: String
    shipName: String
    masterSailId: Float
    packageId: Float
    sourceTable: String
    sourceRowId: String
    metadata: JSON
  }

  input InventoryMemoInput {
    inventoryItemId: ID
    inventoryItem: InventoryItemInput
    memoText: String!
    memoType: String
  }

  input CurvePointInput {
    pointOrder: Int
    weekLabel: String!
    weeksUntilSailing: Int
    valueBookings: Float
    valueGuests: Float
    asOfDate: String
    source: String
    metadata: JSON
  }

  input InventoryProfileSeriesInput {
    inventoryItemId: ID!
    kind: ProfileSeriesKind!
    modelKey: String
    modelLabel: String
    profileScope: ProfileSeriesScope
    points: [CurvePointInput!]!
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

  enum ProfileBreakdown {
    none
    market
    market_group
    currency
  }

  type ProfileHistoryMeta {
    quality: String!
    distinctSnapshotDates: Int!
    minSnapshotDate: String
    maxSnapshotDate: String
    thinHistory: Boolean!
    message: String
  }

  type ProfileCompositionSlice {
    dimensionKey: String!
    bookings: Int!
    guests: Int!
    loadFactorPct: Float
  }

  type ProfileComposition {
    market: [ProfileCompositionSlice!]!
    marketGroup: [ProfileCompositionSlice!]!
    currency: [ProfileCompositionSlice!]!
  }

  type DimensionalCurvePoint {
    weekLabel: String!
    weeksUntilSailing: Int!
    bookings: Int!
    guests: Int!
    loadFactorPct: Float
  }

  type DimensionalSeries {
    dimensionKey: String!
    points: [DimensionalCurvePoint!]!
  }

  type BookingProfileDimensional {
    sailCode: String!
    referenceSailCode: String
    inventoryItemId: ID
    sailCodes: [String!]!
    sailDate: String!
    shipName: String
    shipCode: String
    currentBookings: Int!
    currentGuests: Int!
    capacity: Float
    capacitySource: String
    currentLoadFactorPct: Float
    bookingVelocity: Float!
    cancellationRate: Float!
    daysUntilSailing: Int
    breakdown: ProfileBreakdown!
    bookingDataPoints: [BookingDataPoint!]!
    buildCurves: [DimensionalCurvePoint!]!
    series: [DimensionalSeries!]!
    composition: ProfileComposition!
    history: ProfileHistoryMeta!
  }

  type DimensionalComparisonMetrics {
    bookingsDifference: Int!
    bookingsPercentageChange: Float!
    guestsDifference: Int!
    guestsPercentageChange: Float!
    velocityDifference: Float!
    velocityPercentageChange: Float!
    loadFactorDifference: Float
  }

  type BookingProfileDimensionalYoY {
    currentYear: BookingProfileDimensional!
    previousYear: BookingProfileDimensional
    comparison: DimensionalComparisonMetrics
    previousYearSailCode: String
    peerSource: String
    representativenessNote: String!
  }

  type BudgetComparisonRow {
    dimensionKey: String!
    budgetPassengers: Float!
    actualGuests: Int!
    actualBookings: Int!
    gapGuests: Float!
    budgetLoadFactorPct: Float
    actualLoadFactorPct: Float
    gapLoadFactorPct: Float
  }

  type BudgetEndStateComparison {
    sailCode: String!
    referenceSailCode: String
    shipCode: String
    shipName: String
    capacity: Float
    breakdown: ProfileBreakdown!
    streamLabel: String!
    totalBudgetPassengers: Float!
    totalActualGuests: Int!
    totalGapGuests: Float!
    rows: [BudgetComparisonRow!]!
    budgetRowCount: Int!
    message: String
  }

  type ReservationVelocityWindow {
    label: String!
    days: Int!
    bookings: Int!
    guests: Int!
    bookingsPerDay: Float!
    guestsPerDay: Float!
  }

  type ReservationVelocity {
    pastWeek: ReservationVelocityWindow!
    pastTwoWeeks: ReservationVelocityWindow!
    pastFourWeeks: ReservationVelocityWindow!
    pastSixtyDays: ReservationVelocityWindow!
  }

  type ReservationRevenueSummary {
    totalNetEur: Float!
    totalGrossEur: Float!
    revPerPaxEur: Float
    bookingsWithRevenue: Int!
    guestsWithRevenue: Int!
    totalGuests: Int!
    coveragePct: Float!
    currency: String!
    message: String
  }

  type ReservationCompetitorSnapshot {
    currency: String!
    ourMinFarePp: Float
    competitorMedianPp: Float
    competitorMinPp: Float
    competitorCount: Int!
    gapPct: Float
    departureMonth: String
    message: String
  }

  enum ReservationCurveSeriesMode {
    market
    channel
    pax_type
  }

  type ReservationBookingCurve {
    sailCode: String!
    referenceSailCode: String
    sailCodes: [String!]!
    sailDate: String
    shipCode: String
    shipName: String
    marketBreakdown: ProfileBreakdown!
    seriesMode: ReservationCurveSeriesMode!
    bookedCabins: Int
    totalCabins: Int
    loadFactorPct: Float
    capacitySource: String
    reservationBookings: Int!
    reservationGuests: Int!
    bookedGuests: Int
    contractedGuests: Int
    estimatedGuests: Float
    bookDateField: String!
    missingBookDates: Int!
    velocity: ReservationVelocity!
    revenue: ReservationRevenueSummary!
    competitor: ReservationCompetitorSnapshot
    series: [DimensionalSeries!]!
    totals: [DimensionalCurvePoint!]!
    contractSeries: [DimensionalSeries!]
    contractMessage: String
    """Active inventory target densified onto the Monday week axis (guest estimate from LF%)."""
    targetSeries: [DimensionalCurvePoint!]
    targetSource: String
    activeTargetName: String
    composition: [ProfileCompositionSlice!]!
    maxWeeks: Int!
    daysUntilSailing: Int
  }

  input SeasonalTradingPackFilters {
    asOfDate: String
    depMonthFrom: String
    depMonthTo: String
    marketGroup: String
    fyLabel: String
  }

  enum TargetDimensionLevel {
    voyage
    market_group
    market
    currency
  }

  type InventoryTargetProfileNode {
    id: ID!
    profileId: ID!
    dimensionLevel: TargetDimensionLevel!
    dimensionKey: String!
    parentNodeId: ID
    weekLabel: String
    weeksUntilSailing: Int
    lfPct: Float!
    pointOrder: Int!
    metadata: JSON
  }

  type InventoryTargetProfile {
    id: ID!
    inventoryItemId: ID!
    name: String!
    perspective: String!
    description: String
    metric: String!
    profileScope: String!
    ownerKey: String
    lastEditedBy: String
    isActive: Boolean!
    nodes: [InventoryTargetProfileNode!]!
    createdAt: String
    updatedAt: String
  }

  input InventoryTargetProfileNodeInput {
    dimensionLevel: TargetDimensionLevel!
    dimensionKey: String!
    parentTempKey: String
    tempKey: String
    weekLabel: String
    weeksUntilSailing: Int
    lfPct: Float!
    pointOrder: Int
    metadata: JSON
  }

  input UpsertInventoryTargetProfileInput {
    id: ID
    inventoryItemId: ID!
    name: String!
    perspective: String!
    description: String
    isActive: Boolean
    nodes: [InventoryTargetProfileNodeInput!]!
  }

  enum ProfileMatchMode {
    lazy
    manual
  }

  type ProfileModelMap {
    id: ID!
    inventoryItemId: ID!
    modelInventoryItemId: ID
    modelSailCode: String
    matchMode: ProfileMatchMode!
    notes: String
    confidence: Float
    matchedDow: Int
    matchedDuration: Int
    metadata: JSON
    lastEditedBy: String
    createdAt: String
    updatedAt: String
  }

  input UpsertProfileModelMapInput {
    inventoryItemId: ID!
    matchMode: ProfileMatchMode!
    modelSailCode: String
    notes: String
    confidence: Float
    matchedDow: Int
    matchedDuration: Int
    metadata: JSON
  }

  type ProfileLfPoint {
    weekLabel: String
    weeksUntilSailing: Int
    bookings: Float
    guests: Float
    lfPct: Float
  }

  type ProfileSeriesSummary {
    sailCode: String
    referenceSailCode: String
    sailDate: String
    shipCode: String
    shipName: String
    bookedCabins: Int
    totalCabins: Int
    loadFactorPct: Float
    reservationBookings: Int
    reservationGuests: Int
    daysUntilSailing: Int
    series: [ProfileLfPoint!]!
  }

  type ProfileModelCandidate {
    sailCode: String!
    sailDate: String
    shipCode: String
    shipName: String
    sailDays: Int
    isMain: Boolean
    packageType: String
    dayDiff: Int
  }

  type ProfileCompareResult {
    sailCode: String!
    referenceSailCode: String
    inventoryItemId: ID
    shipCode: String
    shipName: String
    sailDate: String
    matchMode: ProfileMatchMode!
    peerSource: String
    modelSailCode: String
    modelMap: ProfileModelMap
    real: ProfileSeriesSummary
    model: ProfileSeriesSummary
    activeTarget: InventoryTargetProfile
    targetSeries: [ProfileLfPoint!]!
    targetSource: String
    budget: BudgetEndStateComparison
    candidates: [ProfileModelCandidate!]!
  }

  type ProfileTargetReviewStatus {
    sailCode: String!
    referenceSailCode: String
    inventoryItemId: ID
    status: String!
    actualLfPct: Float
    targetLfPct: Float
    gapPp: Float
    activeTargetId: ID
    activeTargetName: String
  }

  enum ProfileAggGroupBy {
    ship_month
    dow_duration
  }

  input ProfileAggregationFilters {
    groupBy: ProfileAggGroupBy = ship_month
    shipCode: String
    monthFrom: String
    monthTo: String
  }

  type ProfileAggregationRow {
    dimensionKey: String!
    dimensionLabel: String!
    shipCode: String
    shipName: String
    month: String
    dow: String
    durationBucket: String
    sailCount: Int!
    withActiveTarget: Int!
    withManualModel: Int!
    withLazyModel: Int!
    sailCodes: [String!]!
  }

  type ProfileAggregationResult {
    groupBy: ProfileAggGroupBy!
    rows: [ProfileAggregationRow!]!
    message: String
  }

  type ProfileBackfillResult {
    fromDate: String!
    toDate: String
    dryRun: Boolean!
    considered: Int!
    created: Int!
    skippedExisting: Int!
    skippedNoCurve: Int!
    failed: Int!
    sampleSailCodes: [String!]!
    message: String
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
    profileScope: ProfileSeriesScope
    lastEditedBy: String
    createdAt: String!
    updatedAt: String!
    isActive: Boolean!
  }

  type BookingTargetSupplied {
    id: ID!
    sailCode: String!
    shipCode: String
    weekLabel: String!
    weeksUntilSailing: Int
    targetBookings: Int!
    targetGuests: Int!
    importBatchId: String!
    importedAt: String!
  }

  type TargetMappingConfig {
    id: ID!
    name: String!
    description: String
    config: JSON!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
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
    profileScope: ProfileSeriesScope
  }

  input TargetProfileFilters {
    sailCode: String
    shipCode: String
    packageType: String
    seasonCode: String
    isActive: Boolean
  }

  input TargetDataRowInput {
    sailCode: String!
    shipCode: String
    weekLabel: String!
    weeksUntilSailing: Int
    targetBookings: Int!
    targetGuests: Int
  }

  type ImportTargetDataResult {
    success: Boolean!
    rowsImported: Int!
    batchId: String!
    errors: [String!]
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

  input TableDataFilters {
    sail_code: String
    ship_code: String
    sail_date_from: String
    sail_date_to: String
    cabin_category: String
    ship_name: String
    package_name: String
    package_type: String
    geog_area_code: String
    departure_date_from: String
    departure_date_to: String
    agency_id: Float
    market: String
    agency_type: String
    country_code: String
    status: String
    include_non_real_sailings: Boolean
    is_main: Int
    sailing_role: String
    is_operational: Boolean
    reference_sail_code: String
    sail_codes: [String]
    is_latest_snapshot: String
    cabin_type: String
    query_column: String
    query_value: String
    query_operator: String
    # Add other common filters as needed
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

  type DateRangeConfig {
    environment: String!
    hasOverride: Boolean!
    dateRange: DateRange
    source: String!  # "environment variables" or "sync.config.json"
    datasetDefault: DateRange  # Default from dataset config (if available)
  }

  # ============================================================================
  # Talia Configuration Types (Database-backed)
  # ============================================================================
  
  type TaliaEnvironment {
    name: String!
    description: String
  }
  
  type IntegrationDateRange {
    id: Int!
    integrationName: String!
    displayName: String!
    description: String
    dateFrom: String!
    dateTo: String!
    dateColumn: String
    isActive: Boolean!
    isDefault: Boolean!
    createdAt: String
    updatedAt: String
  }
  
  type DataSource {
    id: Int!
    sourceName: String!
    displayName: String!
    sourceType: String!
    isActive: Boolean!
    isAvailable: Boolean
    healthStatus: String
    lastHealthCheck: String
    description: String
    connectionConfig: JSON
  }
  
  type TaliaConfigSummary {
    environment: TaliaEnvironment!
    defaultDateRange: IntegrationDateRange
    dateRanges: [IntegrationDateRange!]!
    dataSources: [DataSource!]!
    settings: JSON
  }

  type IntegrationSettings {
    aisstreamApiKeyPresent: Boolean!
    aishubUsername: String
    vesselfinderApiKeyPresent: Boolean!
    marinetrafficApiKeyPresent: Boolean!
  }

  enum EnvKeyImportance {
    REQUIRED
    CONDITIONAL
    OPTIONAL
  }

  type InstanceEnvKeyRow {
    key: String!
    scope: String!
    label: String!
    present: Boolean!
    sensitive: Boolean!
    importance: EnvKeyImportance!
    whenRequired: String
    note: String
  }

  type RuntimeDataTarget {
    id: String!
    label: String!
    role: String!
    address: String!
    """When true, online is not measured (e.g. Synapse sync disabled on this instance)."""
    skipped: Boolean!
    online: Boolean!
    detail: String
  }

  type InstanceConnectionProfile {
    collectedAt: String!
    configEnvironmentName: String
    nodeEnv: String!
    dataSourcePriority: String!
    synapseSyncDisabled: Boolean!
    dataTargets: [RuntimeDataTarget!]!
    envKeys: [InstanceEnvKeyRow!]!
    backupBetweenInstances: String!
    architectureNotes: [String!]!
    """talia-server package.json version running this GraphQL process."""
    graphqlServerPackageVersion: String!
    """Node.js runtime for this GraphQL process (process.version, e.g. v22.12.0)."""
    nodeRuntimeVersion: String!
    """Ops validate menu token (same value as SCRIPT_VERSION in scripts/validate)."""
    validateScriptDocVersion: String!
  }

  input IntegrationSettingsInput {
    aisstreamApiKey: String
    aishubUsername: String
    vesselfinderApiKey: String
    marinetrafficApiKey: String
  }
  
  input IntegrationDateRangeInput {
    integrationName: String
    displayName: String
    description: String
    dateFrom: String!
    dateTo: String!
    dateColumn: String
    isActive: Boolean
    isDefault: Boolean
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
    assignedRoles: [String!]
    assignedUserId: String
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

  input UiActivityEventInput {
    at: String
    userId: String
    userEmail: String
    userRole: String
    kind: String
    report: String
    panelComponent: String
    purpose: String
    status: String
    performanceMs: Int
    queryCount: Int
    sourceQueryId: String
    criteria: JSON
  }

  type RmFinding {
    findingId: ID!
    agentId: String!
    subjectType: String!
    subjectId: String!
    subject: JSON!
    asOf: String!
    score: Float!
    severity: String!
    recommendedAction: JSON!
    evidence: JSON!
    confidence: Float
    status: String!
    tenantId: String
    runId: String
    createdAt: String
    updatedAt: String
  }

  type RmEngineRun {
    runId: ID!
    startedAt: String!
    finishedAt: String
    status: String!
    agentIds: [String!]!
    findingCount: Int!
    error: String
    trigger: String
  }

  type RmEngineStatus {
    online: Boolean!
    url: String
    version: String
    error: String
    pythonAvailable: Boolean
    pythonInterpreter: String
    lastRun: RmEngineRun
  }

  input RmFindingFilters {
    status: String
    sailCode: String
    agentId: String
    limit: Int
  }

  input RunRmAgentsInput {
    sailCodes: [String!]
    agentIds: [String!]
    limit: Int
  }

  type RunRmAgentsResult {
    success: Boolean!
    runId: String
    findingCount: Int
    message: String
    error: String
  }

  # Queries
  type Query {
    # User Management
    me: User
    users: [User!]!
    taliaUser(email: String!): TaliaUser
    taliaUsers: [TaliaUser!]!
    uiActivityEvents(
      sinceMinutes: Int
      limit: Int
      userId: String
      userEmail: String
    ): [UiActivityEvent!]!
    
    # Focus Management
    focuses(filters: FocusFilters): [Focus!]!
    focusesByRole(role: String!, userId: String): [Focus!]!
    focus(id: ID!): Focus
    myFocuses: [Focus!]!
    myFocusPreferences: [FocusPreference!]!
    focusGroups(isActive: Boolean): [FocusGroup!]!
    
    # Data Queries (with role-based filtering)
    sailings(filters: SailingFilters, userRole: UserRole): [Sailing!]!
    masterSail(filters: MasterSailFilters): [MasterSail!]!
    ships: [Ship!]!
    liveShipPositions(shipCodes: [String!]): [ShipLivePosition!]!
    cabinAvailability(filters: DateFilters): [CabinAvailability!]!
    reservations(filters: ReservationFilters): [Reservation!]!
    inventoryItems(filters: InventoryItemFilters): [InventoryItem!]!
    inventoryMemos(inventoryItemId: ID!): [InventoryMemo!]!
    inventoryItemProfileSeries(inventoryItemId: ID!): [InventoryProfileSeries!]!
    publicItineraryCatalog(limit: Int): [PublicItineraryCatalogItem!]!
    publicImagePool(limit: Int): [PublicImagePoolItem!]!
    portNews(port: String!, limit: Int): [PortNewsItem!]!
    weatherAt(latitude: Float!, longitude: Float!, date: String): WeatherPoint
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

    # Project Summary (latest executive overview HTML for in-app display)
    projectSummaryLatest: ProjectSummary
    
    # Booking Profile
    bookingProfile(sailCode: String!): BookingProfile
    bookingProfileYearOverYear(sailCode: String!, previousYearSailCode: String): YearOverYearComparison
    bookingProfileWithCurves(sailCode: String!): BookingProfileWithCurves
    bookingProfileDimensional(sailCode: String!, breakdown: ProfileBreakdown = none): BookingProfileDimensional
    bookingProfileDimensionalYoY(sailCode: String!, breakdown: ProfileBreakdown = none, previousYearSailCode: String): BookingProfileDimensionalYoY
    budgetEndStateComparison(sailCode: String!, breakdown: ProfileBreakdown = market_group): BudgetEndStateComparison
    reservationBookingCurve(
      sailCode: String!
      marketBreakdown: ProfileBreakdown = market_group
      seriesMode: ReservationCurveSeriesMode = market
      includeCompetitor: Boolean = false
    ): ReservationBookingCurve
    seasonalTradingPack(filters: SeasonalTradingPackFilters): JSON!
    inventoryTargetProfiles(inventoryItemId: ID!): [InventoryTargetProfile!]!
    inventoryTargetProfile(id: ID!): InventoryTargetProfile
    profileModelMap(inventoryItemId: ID!): ProfileModelMap
    profileCompare(sailCode: String!, includeBudget: Boolean = true, includeTarget: Boolean = true): ProfileCompareResult!
    profileModelCandidates(sailCode: String!): [ProfileModelCandidate!]!
    profileTargetReviewStatuses(sailCodes: [String!]!, behindPp: Float, aheadPp: Float): [ProfileTargetReviewStatus!]!
    profileAggregations(filters: ProfileAggregationFilters): ProfileAggregationResult!
    
    # Target Profiles
    targetProfiles(filters: TargetProfileFilters): [TargetProfile!]!
    targetProfile(id: ID!): TargetProfile
    bookingTargetsSupplied(sailCode: String): [BookingTargetSupplied!]!
    targetMappingConfigs: [TargetMappingConfig!]!
    currentVsTarget(sailCode: String!, representativePriorYearSailCode: String): JSON!
    bookingRecommendations(sailCode: String!, representativePriorYearSailCode: String): JSON!
    
    # Data Debugging
    dataDebugInfo: DataDebugResponse!
    
    # Competitor Pricing
    competitorPricing(filters: CompetitorPricingFilters): [CompetitorPricingData!]!
    
    # Sync Status (for real-time polling)
    syncStatus(tableName: String!): SyncStatus
    
    # Connection Status
    synapseConnectionStatus: ConnectionStatus!
    supabaseConnectionStatus: ConnectionStatus!
    
    # Database Table Metadata
    syncMetadata: [SyncMetadataRecord!]!
    databaseTables: [DatabaseTableMetadata!]!
    tableMetadata(tableName: String!): DatabaseTableMetadata
    tableData(tableName: String!, limit: Int, filters: TableDataFilters, columns: [String!]): [JSON!]!  # Generic query; optional columns whitelist projection
    backupMetadata: BackupMetadata  # Get database backup status and info
    dataMatch(filters: DataMatchFilters): DataMatchResponse!  # Data completeness cross-tab
    
    # Date Range Configuration (legacy - env vars)
    dateRangeConfig: DateRangeConfig!
    
    # Instance wiring (safe snapshot: no secret values, only presence + addresses)
    instanceConnectionProfile: InstanceConnectionProfile!

    # Talia Configuration (database-backed)
    taliaConfig: TaliaConfigSummary!
    integrationSettings: IntegrationSettings!
    appearanceSettings(userId: String): AppearanceSettings!
    appearanceProfileBuckets(userId: String): AppearanceProfileBuckets!
    taliaUiThemeRegistry: TaliaUiThemeRegistryPayload!
    columnTerminologyDefinitions: [ColumnTerminologyDefinition!]!
    userProfileState(userId: String): JSON
    roleCriteria(role: String!): JSON
    roleComponentOps(role: String!): JSON
    effectiveGlobalCriteria(userId: String, role: String): JSON
    gameScore(gameId: String!, userId: String): GameScore!
    gameLeaderboard(gameId: String!, limitTop: Int, limitRecent: Int): GameLeaderboard!
    gameScoreBoard(gameId: String, limitTop: Int, limitRecent: Int): GameScoreBoard!
    breakoutScore(userId: String): BreakoutScore!
    breakoutLeaderboard(limitTop: Int, limitRecent: Int): BreakoutLeaderboard!
    integrationDateRanges: [IntegrationDateRange!]!
    integrationDateRange(id: Int!): IntegrationDateRange
    dataSources: [DataSource!]!
    stgDomainSourceCatalog: JSON!
    stgQualityBaselineQueries: JSON!
    canonicalDataContracts: JSON!
    externalFeedContracts: JSON!
    externalFeedStatus: JSON!
    
    # talia-engine Findings / Activity (Phase A)
    rmFindings(filters: RmFindingFilters): [RmFinding!]!
    rmEngineRuns(limit: Int): [RmEngineRun!]!
    rmEngineStatus: RmEngineStatus!

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
    updateTaliaUserRole(email: String, taliaUserId: Int, role: String!): TaliaUser!
    logUiActivityEvent(input: UiActivityEventInput!): Boolean!
    purgeUiActivityEvents(olderThanHours: Int!): Int!
    saveRoleCriteria(role: String!, criteria: JSON!): JSON
    saveRoleComponentOps(role: String!, ops: JSON!): JSON
    saveUserCriteriaOverride(userId: String!, criteria: JSON!, locked: Boolean): JSON
    
    # Focus Preferences
    updateFocusPreference(focusId: ID!, preferences: FocusPreferenceInput!): FocusPreference!
    toggleFavorite(focusId: ID!): FocusPreference!
    
    # Focus Groups (Admin)
    createFocusGroup(groupData: FocusGroupInput!): FocusGroup!
    updateFocusGroup(groupId: ID!, updateData: FocusGroupInput!): FocusGroup!
    deleteFocusGroup(groupId: ID!): Boolean!
    
    # Data Sync
    syncTable(tableName: String!, dataset: String, forceFullSync: Boolean): SyncResult!
    cancelSync(tableName: String): SyncCancelResult!
    syncInventoryStatus(dateFrom: String!, dateTo: String!): SyncResult!
    
    # Configuration Management
    updateIntegrationDateRange(id: Int!, input: IntegrationDateRangeInput!): IntegrationDateRange!
    createIntegrationDateRange(input: IntegrationDateRangeInput!): IntegrationDateRange!
    setDefaultDateRange(id: Int!): IntegrationDateRange!
    updateDataSourceConnection(sourceName: String!, connectionConfig: JSON!): DataSource!
    saveIntegrationSettings(input: IntegrationSettingsInput!): IntegrationSettings!
    saveAppearanceSettings(settings: JSON!, activeProfileId: String, userId: String): AppearanceSettings!
    saveAppearanceProfiles(profiles: JSON!, userId: String): [AppearanceProfile!]!
    saveTaliaUiThemeRegistry(themes: JSON, assets: JSON): TaliaUiThemeRegistryPayload!
    saveColumnTerminologyDefinitions(definitions: JSON!): [ColumnTerminologyDefinition!]!
    saveUserProfileState(patch: JSON!, userId: String): JSON
    saveGameScore(gameId: String!, score: Int!, userId: String): GameScore!
    saveBreakoutScore(score: Int!, userId: String): BreakoutScore!
    
    # Target Profiles
    createTargetProfile(input: TargetProfileInput!): TargetProfile!
    updateTargetProfile(id: ID!, input: TargetProfileInput!): TargetProfile!
    deleteTargetProfile(id: ID!): Boolean!
    importTargetData(rows: [TargetDataRowInput!]!): ImportTargetDataResult!
    upsertInventoryItem(input: InventoryItemInput!): InventoryItem!
    addInventoryMemo(input: InventoryMemoInput!): InventoryMemo!
    upsertInventoryProfileSeries(input: InventoryProfileSeriesInput!): InventoryProfileSeries!
    deleteInventoryProfileSeries(
      inventoryItemId: ID!
      kind: ProfileSeriesKind!
      modelKey: String
    ): Boolean!
    upsertInventoryTargetProfile(input: UpsertInventoryTargetProfileInput!): InventoryTargetProfile!
    deleteInventoryTargetProfile(id: ID!): Boolean!
    setActiveInventoryTargetProfile(id: ID!): InventoryTargetProfile!
    upsertProfileModelMap(input: UpsertProfileModelMapInput!): ProfileModelMap!
    clearProfileModelMap(inventoryItemId: ID!): Boolean!
    backfillTargetProfiles(fromDate: String, toDate: String, dryRun: Boolean, limit: Int): ProfileBackfillResult!
    
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
    
    # talia-engine (Phase A)
    updateRmFindingStatus(findingId: ID!, status: String!): RmFinding!
    runRmAgents(input: RunRmAgentsInput): RunRmAgentsResult!

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
    cancelled: Boolean
    detailedLogs: [String!]
  }

  type SyncCancelResult {
    success: Boolean!
    tableName: String
    cancelledCount: Int!
    runningTables: [String!]!
    message: String!
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

  # Database Table Metadata Types
  type SyncMetadataRecord {
    sync_type: String!
    last_sync_at: String
    duration_ms: Int
    records_processed: Int
    changes_detected: Int
    status: String
    error: String
  }

  type TableDateRange {
    min: String
    max: String
  }

  type TableDateCoverage {
    dateRole: String
    overlappingRows: Int
    rowCoveragePct: Int
    coveredSails: Int
    totalSails: Int
    sailCoveragePct: Int
    openEnded: Boolean
  }

  type DatabaseTableMetadata {
    tableName: String!
    hasSyncConfig: Boolean!
    source: String
    type: String
    loadMethod: String  # Optional - frontend calculates from tableSources config
    rowCount: Int!
    dateRange: TableDateRange!  # Configured sync date range (what should be synced)
    actualDataRange: TableDateRange  # Applicability or event span actually present
    dateRole: String
    coverage: TableDateCoverage
    latestSnapshotDate: String
    latestAvailableData: String
    lastSync: String
    syncDuration: Int
    recordsProcessed: Int
    changesDetected: Int
    lastError: String
    syncStatus: String!
    dataStatus: String!
    status: String!
    syncType: String
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

  # Backup Metadata
  type BackupMetadata {
    lastBackupAt: String
    backupStatus: String! # 'idle', 'in_progress', 'success', 'failed'
    backupFilePath: String
    backupSizeBytes: Int
    backupSizeHuman: String
    error: String
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

  # Project Summary — versioned executive overview document
  type ProjectSummary {
    id: ID!
    title: String!
    version: String
    format: String!
    content: String!
    sourcePath: String
    generatedAt: String
  }

  # Data Debugging Types
  type DataDebugOverview {
    shipCodes: [String!]!
    sailingDays: [SailingDayInfo!]!
    yearMonthBreakdown: [YearMonthInfo!]!
    totalCapacity: Int!
    totalBooked: Int!
  }

  type SailingDayInfo {
    date: String!
    shipCode: String
    sailCode: String
    capacity: Int!
    booked: Int!
    available: Int!
    year: Int!
    month: Int!
  }

  type YearMonthInfo {
    year: Int!
    month: Int!
    capacity: Int!
    booked: Int!
    available: Int!
    sailingDays: Int!
  }

  type TableDebugInfo {
    tableName: String!
    rowCount: Int!
    lastSnapshotDate: String
    changesLastSync: Int
    changes24Hours: Int!
    changesLastMonth: Int!
  }

  type DataDebugResponse {
    overview: DataDebugOverview!
    tables: [TableDebugInfo!]!
  }

  # Data Match Types
  type TableMatchCount {
    tableName: String!
    matchingCount: Int!
    missingCount: Int!
  }

  type DataMatchRow {
    ship_code: String!
    departure_date: String!
    sail_code: String!
    tableMatches: [TableMatchCount!]!
  }

  input DataMatchFilters {
    ship_code: String
    sail_code: String
    date_from: String
    date_to: String
  }

  type DataMatchResponse {
    rows: [DataMatchRow!]!
    tables: [String!]!
  }
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
