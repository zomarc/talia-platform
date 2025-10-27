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
  }

  # Focus Management Types
  type Focus {
    id: ID!
    name: String!
    description: String
    type: FocusType!
    role: UserRole!
    components: [FocusComponent!]!
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
  }

  # Queries
  type Query {
    # User Management
    me: User
    users: [User!]!
    
    # Focus Management
    focuses(filters: FocusFilters): [Focus!]!
    focus(id: ID!): Focus
    myFocuses: [Focus!]!
    
    # Data Queries (with role-based filtering)
    sailings(filters: SailingFilters, userRole: UserRole): [Sailing!]!
    ships: [Ship!]!
    cabinAvailability(filters: DateFilters): [CabinAvailability!]!
    kpis(userRole: UserRole): [KPI!]!
    exceptions(userRole: UserRole): [Exception!]!
    
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
