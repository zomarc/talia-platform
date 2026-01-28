# Architecture Documentation

Talia Platform v0.1.0 (Alpha) - System Architecture

---

## 📋 Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Authentication Flow](#authentication-flow)
- [User Mapping System](#user-mapping-system)
- [Revenue & Inventory Management](#revenue--inventory-management)
- [Multi-Customer Considerations](#multi-customer-considerations)
- [Technology Stack](#technology-stack)

---

## 🎯 Overview

Talia Platform is a **monorepo-based revenue and inventory management system** designed for multi-customer deployment. The architecture separates concerns between frontend (UI), backend (API), and authentication while maintaining flexibility for independent deployment.

### Key Architectural Principles

1. **Separation of Concerns** - Clear boundaries between UI, API, and auth
2. **Monorepo Structure** - Shared tooling, unified versioning, independent deployment
3. **Multi-Customer Ready** - Environment-based configuration for different customers
4. **API-First Design** - GraphQL API as the central data layer
5. **Modular Components** - Reusable UI components and focus panels

---

## 📁 Monorepo Structure

```
talia-platform/
├── talia-ui/              # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── contexts/      # React contexts (Auth, Theme)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # Business logic services
│   │   ├── lib/           # Utilities and libraries
│   │   └── data/          # Static data and configurations
│   ├── public/            # Static assets
│   └── package.json
│
├── talia-server/          # Backend GraphQL server
│   ├── src/
│   │   ├── schema.ts      # GraphQL schema definitions
│   │   ├── resolvers.ts   # GraphQL resolvers
│   │   └── index.ts       # Server entry point
│   ├── data/              # Demo data (JSON, SQL)
│   └── package.json
│
├── netlify/
│   └── functions/         # Serverless functions
│
├── docs/                  # Documentation
├── scripts/               # Build and deployment scripts
├── package.json           # Monorepo configuration
└── netlify.toml           # Deployment configuration
```

### Why Monorepo?

**Advantages**:
- ✅ Unified versioning across UI and server
- ✅ Shared dependencies and tooling
- ✅ Easier cross-project refactoring
- ✅ Single source of truth
- ✅ Simplified CI/CD

**Flexibility**:
- Can deploy together (unified) or separately (independent)
- Each subproject has its own `package.json`
- Independent deployment configurations

---

## 🎨 Frontend Architecture

### Technology Stack

- **React 19.1.1** - UI framework
- **Vite 7.1.2** - Build tool and dev server
- **Dockview 4.9.0** - Layout and panel management
- **Chart.js 4.5.0** - Data visualization
- **Tabulator 5.6.1** - Advanced tables
- **InstantDB 0.21.26** - Authentication and real-time data
- **Apollo Client 4.0.3** - GraphQL client

### Component Structure

```
src/
├── App.jsx                    # Main app component
├── AppWithAuth.jsx            # Auth wrapper
├── Dashboard.jsx              # Main dashboard with Dockview
│
├── components/
│   ├── focus-management/      # Focus system components
│   │   ├── FocusSelector.jsx
│   │   ├── FocusManager.jsx
│   │   └── FocusEditor.jsx
│   │
│   ├── focus-panels/          # Dashboard panels
│   │   ├── KPICards.jsx
│   │   ├── OccupancyChart.jsx
│   │   ├── RevenueBreakdown.jsx
│   │   ├── PublishedRates.jsx
│   │   ├── SailingSummary.jsx
│   │   └── SailingByCabinCategory.jsx
│   │
│   ├── admin/                 # Admin components
│   │   ├── AdminDashboard.jsx
│   │   ├── UserMappingTable.jsx
│   │   └── TaliaUserTable.jsx
│   │
│   ├── LandingPage.jsx        # Landing/login page
│   ├── UserProfile.jsx        # User profile component
│   └── ErrorBoundary.jsx      # Error handling
│
├── contexts/
│   └── AuthContext.jsx        # Authentication context
│
├── hooks/
│   ├── useFocusManagement.js
│   └── useTaliaFocusManagement.js
│
├── services/
│   ├── UserMappingService.js  # Auth ID → Talia ID mapping
│   ├── TaliaUserService.js    # User management
│   └── TaliaFocusService.js   # Focus management
│
└── lib/
    ├── db.js                  # InstantDB client
    └── apolloClient.js        # GraphQL client
```

### State Management

- **React Context** - Auth state, theme preferences
- **Local State** - Component-specific state with `useState`
- **Service Layer** - Business logic in service classes
- **Apollo Cache** - GraphQL query caching

### Layout System (Dockview)

- **Flexible Panels** - Drag-and-drop panel arrangement
- **Focus Layouts** - Predefined layouts for different user roles
- **Persistent State** - Layout saved to localStorage
- **Dynamic Components** - Panels loaded dynamically based on focus

---

## 🔧 Backend Architecture

### Technology Stack

- **Apollo Server 5.0.0** - GraphQL server
- **TypeScript 5.9.2** - Type-safe development
- **GraphQL 16.11.0** - API query language
- **Node.js >= 18** - Runtime environment

### GraphQL Schema

```graphql
type Query {
  # User queries
  user(id: ID!): User
  users: [User!]!
  
  # Focus queries
  focus(id: ID!): Focus
  focuses(filters: FocusFilters): [Focus!]!
  
  # Revenue & Inventory queries
  ships: [Ship!]!
  cabinAvailability(shipCode: String!): [CabinAvailability!]!
  sailings(filters: SailingFilters): [Sailing!]!
  kpis(filters: DateFilters): [KPI!]!
  exceptions(filters: DateFilters): [Exception!]!
}

type Mutation {
  # Focus mutations
  createFocus(input: FocusInput!): Focus!
  updateFocus(id: ID!, input: FocusInput!): Focus!
  deleteFocus(id: ID!): Boolean!
  
  # User mutations
  updateUserPreferences(input: UserPreferencesInput!): User!
}

type Subscription {
  # Real-time updates
  dataUpdate: DataUpdate!
}
```

### Resolver Structure

```typescript
// src/resolvers.ts
export const resolvers = {
  Query: {
    ships: () => getShips(),
    sailings: (_, { filters }) => getSailings(filters),
    kpis: (_, { filters }) => getKPIs(filters),
    // ... more resolvers
  },
  
  Mutation: {
    createFocus: (_, { input }) => createFocus(input),
    updateFocus: (_, { id, input }) => updateFocus(id, input),
    // ... more mutations
  },
  
  Subscription: {
    dataUpdate: {
      subscribe: () => pubsub.asyncIterator(['DATA_UPDATE'])
    }
  }
};
```

### Data Layer (Current: In-Memory)

**Alpha Version**:
- Demo data loaded from JSON files
- In-memory storage for development
- No database connection required

**Future**:
- PostgreSQL for persistent storage
- Redis for caching
- Real-time data sync with external systems

---

## 🔐 Authentication Flow

### InstantDB Integration

```
┌─────────────────────────────────────────────────────────────┐
│                     InstantDB (Auth)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Auth System: Authenticates users, provides authId   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  taliaUser Table (InstantDB storage)                 │   │
│  │  • instantAuthId → taliaUserId mapping               │   │
│  └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     │ Mapping Layer
                     │
┌────────────────────▼─────────────────────────────────────────┐
│                   Talia Internal System                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Talia Users (In-Memory)                             │   │
│  │  • taliaUserId: 1000, 1001, 1002...                 │   │
│  │  • Email, name, role, isActive                       │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Sign-In Flow

1. User enters email on landing page
2. InstantDB sends magic link to email
3. User clicks link, InstantDB authenticates
4. `AuthContext` receives InstantDB auth ID
5. `UserMappingService` maps auth ID → Talia user ID
6. `TaliaUserService` creates/retrieves Talia user
7. User data loaded with Talia user ID as primary identifier

### Why This Architecture?

**Clean Separation**:
- Auth system (InstantDB) completely separate from business logic
- Can replace InstantDB without touching business logic
- Business logic never uses InstantDB auth IDs

**Simple Mapping**:
- One table: `taliaUser`
- One purpose: Map auth ID → Talia user ID
- Numerical IDs (1000+) for Talia users

**No Dependencies**:
- Business logic always uses Talia user IDs
- Easy to replace auth system
- Easy to change database

---

## 👤 User Mapping System

### UserMappingService

```javascript
class UserMappingService {
  async getOrCreateMapping(instantAuthId) {
    // Check if mapping exists
    const existing = await db.queryOnce({
      taliaUser: {
        $: { where: { instantAuthId } }
      }
    });
    
    if (existing) return existing.taliaUserId;
    
    // Create new mapping
    const taliaUserId = this.nextTaliaUserId++;
    await db.transact([
      db.tx.taliaUser[taliaUserId].update({
        taliaUserId,
        instantAuthId
      })
    ]);
    
    return taliaUserId;
  }
}
```

### TaliaUserService

```javascript
class TaliaUserService {
  createTaliaUser(taliaUserId, email, role = 'user') {
    const taliaUser = {
      taliaUserId,
      email,
      name: email.split('@')[0],
      taliaRole: role,
      isActive: true,
      createdAt: new Date()
    };
    
    this.users.set(taliaUserId, taliaUser);
    return taliaUser;
  }
  
  getTaliaUserById(taliaUserId) {
    return this.users.get(taliaUserId);
  }
  
  isAdmin(taliaUserId) {
    const user = this.users.get(taliaUserId);
    return user && user.taliaRole === 'admin';
  }
}
```

### Role-Based Access Control

**Roles**:
- `admin` - Full system access, user management
- `manager` - Advanced features, reporting
- `user` - Standard dashboard access
- `guest` - Read-only access

**First User**:
- Automatically assigned `admin` role
- Can manage other users via admin dashboard

---

## 💰 Revenue & Inventory Management

### Core Features

**Revenue Management**:
- Published rates tracking
- Pricing analysis
- Revenue optimization
- Discount management

**Inventory Management**:
- Cabin availability tracking
- Sailing schedules
- Capacity management
- Occupancy monitoring

### Data Components

**Published Rates**:
- Rate type (CUG, BAR, PROMO)
- Fare per person
- Port taxes and services
- Discounts
- Cabin categories

**Sailing Data**:
- Sailing summaries
- Cabin category breakdown
- Occupancy rates
- Revenue metrics

**KPIs**:
- Total revenue
- Occupancy percentage
- Average daily rate
- Revenue per available cabin

---

## 🏢 Multi-Customer Considerations

### Environment-Based Configuration

```env
# Customer-specific settings
VITE_CUSTOMER_NAME=CustomerOne
VITE_CUSTOMER_LOGO=/assets/celestyal-logo.png
VITE_CUSTOMER_PRIMARY_COLOR=#2E86AB
VITE_CUSTOMER_THEME=celestyal
```

### Deployment Strategy

**Per-Customer Deployment**:
- Separate Netlify site per customer
- Custom environment variables
- Isolated data (separate InstantDB apps)
- Independent scaling

**Shared Codebase**:
- All customers use same code
- Branding via environment variables
- Feature flags for customer-specific features

### Data Isolation

**Current (Alpha)**:
- Separate InstantDB app per customer
- No data sharing between customers

**Future**:
- Multi-tenant database with tenant isolation
- Row-level security
- Customer-specific data partitioning

---

## 🛠️ Technology Stack

### Frontend
- React 19.1.1
- Vite 7.1.2
- Dockview 4.9.0
- Chart.js 4.5.0
- Tabulator 5.6.1
- InstantDB 0.21.26
- Apollo Client 4.0.3

### Backend
- Apollo Server 5.0.0
- GraphQL 16.11.0
- TypeScript 5.9.2
- Node.js >= 18

### Development
- ESLint 9.33.0
- Concurrently 8.2.2
- Netlify CLI 17.10.1

### Deployment
- Netlify (Frontend + Serverless)
- Railway/Render/AWS (Backend options)

---

## 📈 Future Architecture

### Planned Improvements

**Database Integration**:
- PostgreSQL for persistent storage
- Prisma ORM for type-safe database access
- Redis for caching and sessions

**Real-Time Features**:
- WebSocket subscriptions for live updates
- Real-time collaboration
- Live data sync with external systems

**Microservices**:
- Separate services for revenue, inventory, reporting
- Event-driven architecture
- Message queue (RabbitMQ/Kafka)

**Enhanced Security**:
- JWT tokens
- API rate limiting
- Audit logging
- Encryption at rest

---

**Version**: 0.1.0 (Alpha)  
**Last Updated**: 2025-10-08
