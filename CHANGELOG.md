# Changelog

All notable changes to Talia Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2025-10-08 (Alpha)

### Initial Development Baseline

First alpha release of Talia Platform with core features for revenue and inventory management.

### Added

#### Core Features
- React-based dashboard with Dockview layout system
- GraphQL server with TypeScript
- InstantDB authentication integration
- User mapping and role management system
- Focus management system for customizable dashboard layouts
- Admin dashboard for user and system management
- Published rates component with Tabulator integration
- Sailing data components (summary, by cabin category)
- Revenue and inventory management capabilities
- Monorepo structure with independent deployment capability

#### Authentication & User Management
- Magic link authentication via InstantDB
- User mapping service (InstantDB auth ID → Talia user ID)
- Role-based access control (admin, manager, user, guest)
- Admin dashboard for user management
- User profile management

#### Dashboard & UI
- Dockview-based layout system
- Focus selector and focus manager
- Multiple focus panels (KPI cards, occupancy charts, revenue breakdown, exception lists, itinerary lists)
- Theme customization (default, dark, light)
- Font and spacing customization
- Responsive design

#### Backend
- GraphQL API with Apollo Server
- TypeScript implementation
- Modular schema and resolvers
- Support for ships, cabins, sailings, KPIs, exceptions data

#### Deployment
- Netlify configuration for unified deployment
- Independent deployment configs for UI and server
- Environment-based configuration
- Multi-customer support architecture

### Reference Implementation
- Celestyal Cruises as initial customer
- Demo data and branding for Celestyal
- Sample sailing and cabin data

### Known Limitations
- Pre-release software, expect breaking changes
- In active development
- Not production-ready
- In-memory data storage (will migrate to database)
- Limited error handling in some components
- No automated tests yet

### Technical Details
- **Frontend**: React 19.1.1, Vite 7.1.2, Dockview 4.9.0
- **Backend**: Apollo Server 5.0.0, GraphQL 16.11.0, TypeScript 5.9.2
- **Authentication**: InstantDB 0.21.26
- **Node Version**: >= 18.0.0

---

## Future Releases

### [0.2.0] - Planned
- Database integration for persistent storage
- Enhanced error handling and validation
- Automated testing suite
- Additional focus panels and components
- Performance optimizations

### [0.9.0] - Planned (Beta)
- Feature complete for production
- Comprehensive testing
- Documentation completion
- Security audit
- Performance benchmarking

### [1.0.0] - Planned (Production Release)
- First stable production release
- Full multi-customer support
- Production-ready deployment
- Complete documentation
- Support and maintenance plan

---

[0.1.0]: https://github.com/zomarc/talia-platform/releases/tag/v0.1.0
