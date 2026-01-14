#!/usr/bin/env node

/**
 * Executive Overview Generator
 * 
 * Generates/updates the EXECUTIVE-OVERVIEW.md document with current information
 * from package.json, CHANGELOG.md, and other documentation sources.
 * 
 * Usage:
 *   node scripts/generate-executive-overview.js
 *   npm run generate:overview
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper function to read JSON file
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
    return null;
  }
}

// Helper function to read text file
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
    return null;
  }
}

// Get current date in readable format
function getCurrentDate() {
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

// Get current week number
function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

// Extract version from package.json
function getVersion() {
  const pkg = readJSON(path.join(rootDir, 'package.json'));
  return pkg?.version || '0.1.0';
}

// Extract recent changes from CHANGELOG
function getRecentChanges() {
  const changelog = readFile(path.join(rootDir, 'CHANGELOG.md'));
  if (!changelog) return null;
  
  // Extract the first version entry
  const match = changelog.match(/##\s+\[([^\]]+)\][^\n]*\n\n([\s\S]*?)(?=\n##|$)/);
  if (match) {
    return {
      version: match[1],
      content: match[2].trim()
    };
  }
  return null;
}

// Generate the executive overview document
function generateExecutiveOverview() {
  const version = getVersion();
  const currentDate = getCurrentDate();
  const weekNumber = getCurrentWeek();
  const recentChanges = getRecentChanges();
  
  // Determine status based on version
  let status = 'Active Development';
  if (version.startsWith('0.')) {
    status = 'Alpha - Active Development';
  } else if (version.startsWith('1.')) {
    status = 'Production';
  } else if (version.startsWith('0.9')) {
    status = 'Beta - Pre-Production';
  }

  const template = `# Talia Platform
## Executive Overview

**Version:** ${version}  
**Date:** ${currentDate} (Week ${weekNumber})  
**Status:** ${status}

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
**Deployment Status**: ${version} (${status.includes('Alpha') ? 'Pre-production' : status.includes('Beta') ? 'Pre-production' : 'Production'}), actively developing

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

\`\`\`
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
\`\`\`

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
- **Current Phase**: ${version.startsWith('0.') ? '0.x.x (Alpha)' : version.startsWith('1.') ? '1.x.x (Production)' : 'x.x.x'} - ${version.startsWith('0.') ? 'Pre-release development' : 'Production release'}
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

**Version**: ${version}  
**Development Phase**: ${status.includes('Alpha') ? 'Active feature development' : status.includes('Beta') ? 'Beta testing and refinement' : 'Production maintenance'}  
**Stability**: ${version.startsWith('0.') ? 'Pre-release, expect breaking changes' : 'Stable, production-ready'}  
**Production Ready**: ${version.startsWith('0.') ? 'No (targeting v1.0.0)' : 'Yes'}

${recentChanges ? `### Recent Changes (v${recentChanges.version})

${recentChanges.content.split('\n').slice(0, 20).join('\n')}
${recentChanges.content.split('\n').length > 20 ? '\n...' : ''}
` : ''}
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

\`\`\`
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  talia-ui   │    │ talia-server│    │ talia-engine│
│  Frontend   │◄──►│ Data Gateway│◄──►│  Analytics  │
│  User UX    │    │  GraphQL API│    │ Python/ML   │
└─────────────┘    └─────────────┘    └─────────────┘
\`\`\`

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
- **Status**: ${version} (${status}) - ${status.includes('Alpha') ? 'Active development' : status.includes('Beta') ? 'Beta testing' : 'Production'}
- **Core Features**: Implemented and functional
- **Stability**: ${version.startsWith('0.') ? 'Pre-release, not production-ready' : 'Production-ready'}
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

**Document Version**: ${version}  
**Last Updated**: ${currentDate} (Week ${weekNumber})  
**Next Review**: ${getNextReviewDate()}

---

*For detailed technical documentation, see \`/docs\` directory.*  
*For development guides, see \`/docs/DEVELOPMENT-WORKFLOW.md\`.*  
*For architecture details, see \`/docs/ARCHITECTURE.md\`.*
`;

  return template;
}

// Calculate next review date (next month)
function getNextReviewDate() {
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const nextMonth = (now.getMonth() + 1) % 12;
  const nextYear = nextMonth === 0 ? now.getFullYear() + 1 : now.getFullYear();
  return `${months[nextMonth]} ${nextYear}`;
}

// Main execution
function main() {
  console.log('📊 Generating Executive Overview...');
  
  const content = generateExecutiveOverview();
  const outputPath = path.join(rootDir, 'EXECUTIVE-OVERVIEW.md');
  
  fs.writeFileSync(outputPath, content, 'utf8');
  
  console.log('✅ Executive Overview generated successfully!');
  console.log(`📄 Output: ${outputPath}`);
  console.log('\n💡 Next steps:');
  console.log('   - Review the document: EXECUTIVE-OVERVIEW.md');
  console.log('   - Generate PDF: npm run generate:overview:pdf');
  console.log('   - Or use gamma.app to create a presentation');
}

main();




