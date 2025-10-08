# Changelog

All notable changes to the Talia Business Intelligence Dashboard will be documented in this file.

**Versioning Strategy**: Talia uses a **stability-driven versioning approach** where major versions (x.0.0) represent stable, demonstrable baselines. See [VERSIONING-STRATEGY.md](./VERSIONING-STRATEGY.md) for complete details.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.0.0] - 2025-01-02 - "Enhanced Dual-Project Baseline"

### 🎯 Major Release - Complete Architecture Overhaul

This release establishes a comprehensive dual-project architecture with enhanced GraphQL integration, focus management capabilities, and production-ready deployment configuration.

### Added
- **Enhanced GraphQL Server (talia-graphql-server v2.0.0)**
  - Comprehensive GraphQL schema with focus management
  - Role-based access control (ADMIN, MANAGER, USER, GUEST)
  - Advanced data types: Sailings, KPIs, Exceptions, Ships, Cabin Availability
  - Focus management system with user custom focuses
  - TypeScript support with full type safety
  - CORS configuration for development
  - Netlify Functions wrapper for production deployment

- **Enhanced Frontend (talia-ui v2.0.0)**
  - Apollo Client integration with advanced caching
  - Enhanced GraphQL data panels for all data types
  - Role-based UI with dynamic permissions
  - User context management across components
  - Enhanced default layout with new panels
  - Environment-based configuration (dev/prod)

- **Development Workflow**
  - Dual-project development setup
  - Startup script (`./start-dev.sh`) for one-command development
  - Monorepo configuration with workspace management
  - Comprehensive development documentation
  - Quick start guide with 3-step setup

- **Deployment Ready**
  - Netlify configuration for production deployment
  - Environment management (dev vs prod endpoints)
  - Automated build scripts for both projects
  - CI/CD ready configuration

- **Documentation**
  - `QUICK-START-GUIDE.md` - 3-step development setup
  - `DEVELOPMENT-WORKFLOW.md` - Comprehensive development guide
  - `VERSION-2.0.0.md` - Detailed version documentation
  - `netlify.toml` - Deployment configuration
  - Inline code documentation throughout

### Changed
- **Architecture**: Moved from single-project to dual-project architecture
- **GraphQL Integration**: Enhanced from basic fetch to full Apollo Client integration
- **Data Access**: Implemented role-based data filtering and access control
- **Development Experience**: Streamlined development workflow with automated scripts
- **Deployment**: Prepared for production deployment to Netlify

### Enhanced
- **GraphQL Schema**: Comprehensive schema with focus management and role-based queries
- **Data Panels**: Enhanced panels with new data types (KPIs, Exceptions, Sailings)
- **User Experience**: Role-based interface with dynamic content
- **Performance**: Apollo Client caching and optimized queries
- **Type Safety**: Full TypeScript support for backend
- **Error Handling**: Comprehensive error handling and logging

### Technical Details
- **Frontend**: React 19.1.1, Apollo Client 4.0.3, Dockview 4.9.0
- **Backend**: Apollo Server 5.0.0, TypeScript 5.9.2, Node.js 18+
- **Development**: Vite 7.1.2, ESLint 9.33.0, Concurrently for dual development
- **Deployment**: Netlify Functions, Environment-based configuration

### Security
- Role-based access control implementation
- User context management
- Secure GraphQL query handling
- CORS configuration for development
- Production-ready security headers

---

## [1.0.0] - 2024-12-01 - "Initial Release"

### Added
- Basic React dashboard with Dockview integration
- Tabulator tables and Chart.js visualizations
- Basic GraphQL server with demo data
- Theme system with multiple themes
- Layout persistence and customization
- InstantDB authentication integration
- Focus management foundation

### Technical Stack
- React 19.1.1 with Vite
- Dockview 4.9.0 for dashboard layout
- Chart.js 4.5.0 for visualizations
- Tabulator 5.6.1 for data tables
- Apollo Server 5.0.0 for GraphQL
- InstantDB 0.21.26 for authentication

---

## [0.9.0] - 2024-11-15 - "Pre-Release"

### Added
- Initial project setup
- Basic dashboard structure
- Core component library
- Development environment configuration

---

## Version History Summary

| Version | Date | Codename | Major Changes |
|---------|------|----------|---------------|
| 2.0.0 | 2025-01-02 | Enhanced Dual-Project Baseline | Complete architecture overhaul, GraphQL integration, role-based access |
| 1.0.0 | 2024-12-01 | Initial Release | Basic dashboard with Dockview and GraphQL |
| 0.9.0 | 2024-11-15 | Pre-Release | Initial project setup and structure |

---

## Development Notes

### Breaking Changes in v2.0.0
- **Architecture Change**: Moved to dual-project structure
- **GraphQL Integration**: Replaced direct fetch with Apollo Client
- **Data Access**: Implemented role-based filtering (may affect existing queries)
- **Configuration**: Updated development and deployment configuration

### Migration Guide for v2.0.0
1. **Update Development Setup**: Use new startup script `./start-dev.sh`
2. **GraphQL Queries**: Update queries to use new Apollo Client integration
3. **Data Access**: Implement role-based user context for data filtering
4. **Deployment**: Use new Netlify configuration for production deployment

### Future Roadmap
- **v2.1.0**: Real InstantDB authentication, Focus management UI
- **v2.2.0**: Custom focus creation, Real-time subscriptions
- **v2.3.0**: Advanced analytics, Mobile responsiveness
- **v3.0.0**: Enterprise features, Advanced collaboration

---

*For detailed technical information, see [VERSION-2.0.0.md](./VERSION-2.0.0.md)*
