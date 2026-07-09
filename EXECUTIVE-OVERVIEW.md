# Talia Platform
## Executive Overview

**Version:** 0.2.0  
**Date:** July 2026 (Week 28)  
**Status:** Alpha - Active Development

---

## 1. Overview

### What is Talia?

**Talia Platform** is a comprehensive revenue and inventory management system designed specifically for the cruise industry. It provides real-time analytics, pricing optimization, and capacity management capabilities through an intuitive, customizable dashboard interface.

### Core Value Proposition

- **Revenue Optimization**: Dynamic pricing analysis and revenue management tools
- **Inventory Management**: Real-time cabin availability tracking and capacity planning
- **Business Intelligence**: Interactive dashboards with customizable focus layouts
- **Multi-Customer Ready**: Environment-based configuration supporting multiple cruise lines
- **Data Integration**: Seamless synchronization with Azure Synapse Analytics

### Current Implementation

**Reference Customer**: Celestyal Cruises  
**Deployment Status**: 0.2.0 (Pre-production), actively developing

---

## 2. Architecture

### System Design Philosophy

Talia follows a **monorepo architecture** with clear separation between frontend (user experience) and backend (data access), designed for independent deployment while maintaining unified versioning and development workflow.

### Technology Stack

#### Frontend (talia-ui)
- **React 19.1.1** - Modern UI framework
- **Dockview 4.9.0** - Flexible, drag-and-drop dashboard layouts
- **GraphQL (Apollo Client)** - Efficient data querying
- **Chart.js & Tabulator** - Advanced data visualization
- **Vite** - Fast development and build tooling

#### Backend (talia-server)
- **Apollo Server 5.0** - GraphQL API server
- **TypeScript** - Type-safe development
- **Supabase (PostgreSQL)** - Local database with real-time capabilities
- **Azure Synapse Integration** - One-way data synchronization

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    External Access (ngrok)                   │
│                    https://taliahub.com                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Frontend (talia-ui)                            │
│  • React Dashboard                                          │
│  • Dockview Layout System                                   │
│  • Real-time Data Visualization                             │
└───────────────────────┬─────────────────────────────────────┘
                        │ GraphQL API
┌───────────────────────▼─────────────────────────────────────┐
│              Backend (talia-server)                         │
│  • GraphQL API Server                                       │
│  • Data Access Layer                                        │
│  • Business Logic                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐            ┌────────▼────────┐
│   Supabase     │            │  Azure Synapse  │
│  (PostgreSQL)  │            │   (Data Source) │
│  Local DB      │            │   One-way Sync  │
└────────────────┘            └─────────────────┘
```

### Key Architectural Principles

1. **Separation of Concerns**: Clear boundaries between UI, API, and data layers
2. **API-First Design**: GraphQL as the central data access layer
3. **Multi-Customer Ready**: Environment-based configuration for different cruise lines
4. **Secure External Access**: UI exposed via ngrok tunnel, backend remains local-only
5. **Modular Components**: Reusable UI components and focus panels

---

## 3. Development Goals and Approaches

### Primary Objectives

1. **Revenue Management Excellence**
   - Published rates tracking and analysis
   - Dynamic pricing optimization
   - Revenue forecasting and planning

2. **Inventory Optimization**
   - Real-time cabin availability monitoring
   - Capacity planning and management
   - Occupancy trend analysis

3. **User Experience**
   - Intuitive, customizable dashboards
   - Role-based access control
   - Responsive, modern interface

4. **Data Integration**
   - Seamless Azure Synapse synchronization
   - Real-time data updates
   - Historical data analysis

### Development Approach

#### Agile Methodology
- **Iterative Development**: Feature-driven releases
- **Continuous Integration**: Automated testing and deployment
- **Documentation-First**: Comprehensive guides and architecture docs

#### Quality Standards
- **Type Safety**: TypeScript for backend, PropTypes for frontend
- **Code Quality**: ESLint configuration and code review process
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Performance**: Optimized queries and efficient data loading

#### Versioning Strategy
- **Semantic Versioning**: Major.Feature.Bugfix (X.Y.Z)
- **Current Phase**: 0.x.x (Alpha) - Pre-release development
- **Target**: 1.0.0 (Production Release) - Feature complete, tested, documented

---

## 4. Development Progress

### ✅ Completed Features

#### Core Platform
- ✅ React-based dashboard with Dockview layout system
- ✅ GraphQL API server with comprehensive schema
- ✅ Supabase integration for local database
- ✅ Azure Synapse data synchronization
- ✅ User authentication and role-based access control
- ✅ Focus management system for customizable layouts

#### Revenue & Inventory Management
- ✅ Published rates tracking and display
- ✅ Sailing data components (summary, cabin category breakdown)
- ✅ KPI dashboard (revenue, occupancy, availability)
- ✅ Booking profile with build curves
- ✅ Target profile editor for forecasting
- ✅ Exception management system

#### Data Management
- ✅ Configuration-driven data sync from Azure Synapse
- ✅ Multiple dataset support (date-range filtering)
- ✅ Incremental and full sync capabilities
- ✅ Data management UI with sync controls
- ✅ Activity logging and status monitoring

#### User Experience
- ✅ Customizable dashboard layouts
- ✅ Role-based UI (admin, manager, user, guest)
- ✅ Theme customization (default, dark, light)
- ✅ Responsive design
- ✅ External access via ngrok (secure tunnel)

### 📊 Current Status

**Version**: 0.2.0  
**Development Phase**: Active feature development  
**Stability**: Pre-release, expect breaking changes  
**Production Ready**: No (targeting v1.0.0)

### Recent Changes (v0.2.0)

### Summary

Release focused on deploy reliability, ops validation, and focus/GraphQL alignment across environments.


### Recent Development Commits

_120 commits ahead of origin/main · showing 30 most recent of 120 · July 2026_

- `8b39ab6` fix(ui): Master Sailing Explorer reference row hover and tab loading
- `2451fd8` fix(ui): persistent active row highlight with hover coexistence
- `fba19ad` fix(ui): tab loading on listener panels only, instant selection — Defer selection-triggered fetches so emitters paint immediately, match tab
- `855e09e` fix(ui): show loading state on panel tab headers — Publish panel fetch loading through a shared hook wired into useTableDataWithContext
- `5506db0` fix(ui): persist sail selection highlight and auto-expand linked berths — Canonical selection should stay visible in Master Sailing Explorer after
- `5b6c872` fix(ui): constrain Ship Day Berths table to selected voyage scope
- `b0af781` fix(ui): Ship Day Berths filters on canonical selection events
- `8e91722` fix(ui): stop Direct Source Request query loop and stabilize fetch
- `df5eaab` fix(ui): redesign Direct Source Request and align booking panels to report shell
- `81efc64` fix(ui): align active report panels with shell vocabulary standard — Move header actions, mixed filter/controls rows, and admin header-right
- `b2c9bc5` feat(ui): add show/hide segments control to Master Sailing
- `d33c3b5` fix(ui): style report controls as outlined buttons and align shell layout — Add talia-btn--secondary for controls/actions rows, move Ship Day Berth
- `c056dad` fix(ui): keep visibility menu interactive when Controls is hidden — The talia-controls-hidden rule from 6f18aa6 hid all status-bar__criteria
- `6f18aa6` fix(ui): move Master Sailing Explorer controls out of title header — Expand/Collapse now live in talia-report__controls, hidden by the global
- `a8ff2d8` docs(ui): define standard report shell vocabulary (title, filters, controls)
- `fd74fa9` feat(ui): add global Column filters toggle for Tabulator headers — Separate Tabulator column header filters from Talia report filter rows so each can be shown or hidden independently via the header visibility menu.
- `dc24917` fix(ui): align Agency Directory with report shell standards — Add panel filter row, actions bar, callout, and Details visibility so Agency Directory honors global header toggles like Master Sailing Explorer.
- `5c27d47` fix(ui): normalize role in GraphQL auth headers consistently — Uppercase role via normalizeRole in getRequestHeaders, getUserRole, and
- `2f56662` fix(ui): forward auth headers in trackedFetchGraphql for admin mutations — Instance & keys saves use trackedFetchGraphql, which previously sent only
- `3d3408f` feat(ui): add component catalog and document inventory_item source linkage — Working dev version: extend Component Interaction Map with an All components
- `1f48539` feat(ui): add Component Interaction Map report with presentation mode — Add a Reports-category panel that derives the main panel-to-panel
- `555e70a` feat(platform): separate physical/selling layers with canonical selection linking — Introduce inventory_item.reference_sail_code as the canonical layer for
- `015d362` feat(docs): add executive overview PDF and in-app Project Summary panel. — Store the branded HTML in project_summary and expose it via GraphQL so stakeholders can view the latest architecture overview from Talia, with validate option 14 to regenerate and publish on demand.
- `94a17a4` feat(agency): sync dwh.Dim_Agency and add Agency Directory panel — Load the agency dimension from the data lake into Supabase and expose a filterable Tabulator focus panel with reservation cross-linking.
- `d1e72ac` feat(platform): stabilize tabulator fit behavior and align library-first standards — Finalize immediate Fit Width/Fit Data and grouped-row height refresh behavior across shared Tabulator config, standardize panel usage on shared tabulator options, and consolidate canonical development docs with legacy root docs archived. Bump UI package version to 0.2.1 and add Tabulator/DockView package visibility in Data Management cross-check.
- `1b50df2` feat(ui): enrich reservation activity details and align tabulator fit behavior — Improve reservation monitoring with history badges, richer booking change details, and merged current-state data while adding route/guest context to master sailing. Standardize Tabulator sizing to native data-fit behavior across focus panels for consistent readability.
- `ec20f03` fix(reservations): keep stg-driven sync and preserve delta current-state flow — Keep RES_HEADER as the primary bookings source while enriching sail fields from foundation data, and make reservation changes remain event-based deltas. Default CLI syncs to the active integration window with fail-fast behavior when no range is configured.
- `026a63b` fix(data-match): stabilize filters and simplify table readability — Align Data Match with panel-level filtering and predictable table behavior so global criteria no longer over-constrains results. Improve scanability with fixed-width columns, wrapped two-line headers, and cleaner match-cell tooltip/color presentation without intrusive table overrides.
- `aa882ca` fix(published-rates-grid): compact cards and maximize sparkline area — Refine latest-price cards to improve readability in dense layouts by removing redundant currency decimals, moving rate labels into sparkline overlays, and ensuring chart content fills available space without baseline gaps.
- `400bc49` feat(platform): unify focus/event flow UX and persist layout fit state — Consolidate the global criteria/focus improvements with shared tooltip behavior, cycle-aware flow diagnostics, and consistent table fit application on startup/refresh by persisting layout mode in appearance settings. Include related server/admin hardening and data-management updates so the platform now follows one minimal, consistent path across panels.

---

## 5. Current Goals

### Immediate Priorities (Q1 2025)

#### v0.2.0 - Enhanced Data Features
- [ ] Advanced filtering and search capabilities
- [ ] Export functionality (CSV, PDF)
- [ ] Enhanced data visualization options
- [ ] Performance optimizations for large datasets

#### v0.3.0 - User Experience Improvements
- [ ] Mobile-responsive design
- [ ] Enhanced focus management UI
- [ ] Improved error handling and user feedback
- [ ] Accessibility improvements

#### v0.4.0 - Analytics Enhancements
- [ ] Year-over-year comparison tools
- [ ] Advanced reporting capabilities
- [ ] Custom KPI definitions
- [ ] Trend analysis and forecasting

### Short-Term Goals (Q2 2025)

#### v0.9.0 - Beta Release Preparation
- [ ] Comprehensive testing suite
- [ ] Security audit and hardening
- [ ] Performance benchmarking
- [ ] Complete documentation
- [ ] User acceptance testing

#### v1.0.0 - Production Release
- [ ] Feature complete
- [ ] Production deployment
- [ ] Support and maintenance procedures
- [ ] Customer onboarding process

### Development Focus Areas

1. **Data Quality & Performance**
   - Optimize sync processes
   - Improve query performance
   - Enhance data validation

2. **User Experience**
   - Streamline workflows
   - Improve dashboard customization
   - Enhance mobile experience

3. **Business Intelligence**
   - Advanced analytics capabilities
   - Predictive modeling foundations
   - Enhanced reporting tools

---

## 6. Future Enhancements and Ideas

### Three-Tier Architecture Vision

Talia is designed to evolve into a comprehensive three-tier business intelligence platform:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  talia-ui   │    │ talia-server│    │ talia-engine│
│  Frontend   │◄──►│ Data Gateway│◄──►│  Analytics  │
│  User UX    │    │  GraphQL API│    │ Python/ML   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Planned Enhancements

#### Phase 2: Server Evolution (v2.1.0 - v2.3.0)
- **Real-time Subscriptions**: Live data updates via GraphQL subscriptions
- **Advanced Caching**: Redis integration for performance
- **External Integrations**: API connections to additional data sources
- **Microservices Preparation**: Service decomposition for scalability

#### Phase 3: Analytics Engine (v3.0.0 - v3.2.0)
- **Python Analytics Platform**: Containerized analytics services
- **Machine Learning**: Predictive modeling for bookings and revenue
- **Statistical Analysis**: Advanced forecasting and trend analysis
- **AI Integration**: Automated insights and recommendations

#### Phase 4: Enterprise Platform (v4.0.0+)
- **Multi-Tenant Support**: Advanced customer isolation
- **Enterprise Security**: Enhanced authentication and authorization
- **Scalability**: Horizontal scaling capabilities
- **Advanced Collaboration**: Real-time collaborative features

### Innovation Opportunities

#### Revenue Management
- **Dynamic Pricing Engine**: AI-powered pricing optimization
- **Demand Forecasting**: Predictive analytics for capacity planning
- **Market Analysis**: Competitive intelligence integration
- **Promotional Optimization**: Automated campaign effectiveness analysis

#### Inventory Management
- **Predictive Occupancy**: ML-based occupancy forecasting
- **Cabin Category Optimization**: Revenue maximization by category
- **Channel Management**: Multi-channel inventory allocation
- **Seasonal Planning**: Advanced seasonal pattern analysis

#### User Experience
- **Mobile Applications**: Native iOS/Android apps
- **Voice Controls**: Voice-activated dashboard navigation
- **Collaborative Workspaces**: Real-time team collaboration
- **Personalized Dashboards**: AI-driven layout recommendations

#### Data & Analytics
- **Real-time Streaming**: Live data pipeline integration
- **Advanced Visualizations**: 3D charts, interactive maps
- **Custom Reports**: User-defined report builder
- **Data Export**: Multiple format support (Excel, PDF, JSON)

### Strategic Considerations

#### Technology Evolution
- **Cloud-Native**: Full cloud deployment options
- **Containerization**: Docker/Kubernetes orchestration
- **API-First**: Comprehensive REST and GraphQL APIs
- **Event-Driven**: Message queue integration for scalability

#### Business Model
- **SaaS Platform**: Multi-tenant SaaS offering
- **White-Label**: Customizable branding per customer
- **API Licensing**: Data access API for partners
- **Professional Services**: Implementation and consulting

---

## Summary

### Current State
- **Status**: 0.2.0 (Alpha - Active Development) - Active development
- **Core Features**: Implemented and functional
- **Stability**: Pre-release, not production-ready
- **Customer**: Celestyal Cruises (reference implementation)

### Key Strengths
- ✅ Modern, scalable architecture
- ✅ Comprehensive data integration
- ✅ Flexible, customizable UI
- ✅ Strong development foundation
- ✅ Clear evolution path

### Next Steps
1. Continue feature development toward v1.0.0
2. Prepare for beta release (v0.9.0)
3. Plan production deployment
4. Begin analytics engine development (v3.0.0)

### Investment Areas
- **Development**: Feature completion and testing
- **Infrastructure**: Production deployment setup
- **Analytics**: Machine learning and AI capabilities
- **Support**: Customer onboarding and support processes

---

**Document Version**: 0.2.0  
**Last Updated**: July 2026 (Week 28)  
**Next Review**: August 2026

---

*For detailed technical documentation, see `/docs` directory.*  
*For development guides, see `/docs/DEVELOPMENT-WORKFLOW.md`.*  
*For architecture details, see `/docs/ARCHITECTURE.md`.*
