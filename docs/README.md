# Talia Business Intelligence Dashboard v0.1.0
## Initial Product Baseline

A comprehensive business intelligence dashboard with enhanced GraphQL integration, focus management, and role-based access control. Built with React, Apollo GraphQL, and Dockview.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](./VERSION-0.2.0.md)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![Documentation](https://img.shields.io/badge/docs-Version%200.2.0-green.svg)](./VERSION-0.2.0.md)

---

## 🚀 **Quick Start (3 Steps)**

```bash
# 1. Start both servers
cd /path/to/talia
./start-dev.sh

# 2. Access applications
# Frontend: http://localhost:5173
# GraphQL: http://localhost:4000

# 3. Add panels from sidebar to test integration
```

## 🎯 **What's New in v0.1.0**

### **Product Architecture**
- **Frontend (talia-ui v0.1.0)**: React dashboard with Apollo Client integration
- **Backend (talia-server v0.1.0)**: GraphQL server with core data access
- **Monorepo Configuration**: Unified development workflow

### **Advanced Features**
- ✅ **Role-Based Access Control**: ADMIN, MANAGER, USER, GUEST permissions
- ✅ **Focus Management**: User custom focuses and templates
- ✅ **Enhanced Data Types**: Sailings, KPIs, Exceptions, Ships, Cabin Availability
- ✅ **Real-time Ready**: GraphQL subscriptions support
- ✅ **Production Ready**: Netlify deployment configuration

---

## 🏗️ **Architecture**

### **Current Architecture (v0.1.0)**
```
Frontend (React + Apollo) ←→ GraphQL Server ←→ Data Sources
     ↓                           ↓
Role-Based UI              Role-Based Access
     ↓                           ↓
User Interactions         Focus Management
```

### **Future Architecture (v1.0.0+)**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   talia-ui      │    │  talia-server   │    │  talia-engine   │
│                 │    │                 │    │                 │
│  Frontend       │◄──►│  Data Gateway   │◄──►│  Analytics      │
│  User UX        │    │  GraphQL API    │    │  Python Models  │
│  React/Dockview │    │  Data Access    │    │  ML/AI Pipeline │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Project Structure**
```
talia-monorepo v0.1.0/
├── talia-ui v0.1.0/              # React Frontend
├── talia-server v0.1.0/          # GraphQL Backend
├── netlify/                      # Deployment config
├── start-dev.sh                  # Development script
└── package.json                  # Monorepo config
```

---

## 🛠️ **Development**

### **Prerequisites**
- Node.js 18+
- npm 8+

### **Development Commands**
```bash
# Start both projects
npm run dev:all

# Individual projects
npm run dev:frontend    # React app
npm run dev:backend     # GraphQL server

# Build for production
npm run build:all

# Install all dependencies
npm run install:all
```

### **Available Data Types**
- **🚢 Sailings**: Real-time sailing data with filtering
- **📊 KPIs**: Key performance indicators with role-based access
- **⚠️ Exceptions**: Exception management with severity levels
- **🚢 Ships**: Ship information and specifications
- **🏠 Cabin Availability**: Cabin occupancy data
- **🎯 Focus Management**: User custom focuses and layouts

---

## 🔐 **Security & Permissions**

### **Role-Based Access Control**
| Role | Access Level | Features |
|------|-------------|----------|
| **ADMIN** | Full Access | All data, user management, system configuration |
| **MANAGER** | Management | Management data, exceptions, team oversight |
| **USER** | Operational | Operational data, personal focuses |
| **GUEST** | Read-Only | Limited data access, view-only mode |

---

## 🌐 **Deployment**

### **Netlify Deployment**
```bash
# Build for production
npm run build:all

# Deploy to Netlify
npm run deploy:production
```

### **Environment Configuration**
- **Development**: Local GraphQL server (port 4000)
- **Production**: Netlify Functions endpoint
- **Automatic**: Environment detection and configuration

---

## 📊 **Technical Stack**

### **Frontend (talia-ui v0.1.0)**
- **Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.2
- **GraphQL**: Apollo Client 4.0.3
- **Dashboard**: Dockview 4.9.0
- **Charts**: Chart.js 4.5.0
- **Tables**: Tabulator 5.6.1
- **Auth**: Supabase Authentication

### **Backend (talia-server v0.1.0)**
- **Server**: Apollo Server 5.0.0
- **Language**: TypeScript 5.9.2
- **Runtime**: Node.js 18+
- **Data**: GraphQL + JSON
- **Deployment**: Netlify Functions

---

## 📚 **Documentation**

### **Quick Start & Development**
- **[Quick Start Guide](./QUICK-START-GUIDE.md)** - 3-step setup guide
- **[Development Workflow](./DEVELOPMENT-WORKFLOW.md)** - Comprehensive development guide
- **[Version 0.2.0 Details](./VERSION-0.2.0.md)** - Detailed version documentation

### **Configuration**
- **[Changelog](./CHANGELOG.md)** - Version history and changes
- **[netlify.toml](./netlify.toml)** - Deployment configuration
- **[start-dev.sh](./start-dev.sh)** - Development startup script

---

## 🎮 **Testing GraphQL**

### **GraphQL Playground**
Visit http://localhost:4000 to test queries:

```graphql
# Get sailings with role filtering
query GetSailings {
  sailings(userRole: ADMIN) {
    id
    ship
    sailing
    depart
    booked
    available
    projected
    status
  }
}

# Get KPIs
query GetKPIs {
  kpis(userRole: ADMIN) {
    id
    title
    value
    target
    unit
    trend
    change
    period
  }
}
```

---

## 🔮 **Roadmap**

### **v2.x.x Series - Two-Tier Architecture** (Stable/Demonstrable)

#### **v0.3.0 - Focus Management**
- Real InstantDB authentication integration
- Focus management UI implementation
- Custom focus creation interface

#### **v0.4.0 - Real-time Features**
- GraphQL subscriptions for live data
- Real-time collaboration features
- Advanced data visualization

#### **v0.5.0 - Server Evolution**
- talia-graphql-server → talia-server transformation
- Enhanced data integration capabilities
- Performance optimization

### **v3.x.x Series - Three-Tier Architecture** (Production Ready)

#### **v1.0.0 - Analytics Engine Introduction**
- talia-engine implementation (Python analytics)
- Containerized Python services
- Integration with talia-server

#### **v1.1.0 - Advanced Analytics**
- Machine learning pipelines
- Predictive modeling capabilities
- Statistical analysis tools

#### **v1.2.0 - Platform Integration**
- Full three-tier platform
- Advanced collaboration features
- Enterprise scalability

**🏗️ See [FUTURE-ARCHITECTURE.md](./FUTURE-ARCHITECTURE.md) for complete three-tier vision**  
**📋 See [VERSIONING-STRATEGY.md](./VERSIONING-STRATEGY.md) for our official versioning approach**

---

## 🤝 **Contributing**

### **Development Setup**
1. Clone the repository
2. Run `./start-dev.sh` to start development environment
3. Follow the [Development Workflow](./DEVELOPMENT-WORKFLOW.md)
4. Test your changes with the GraphQL Playground

### **Code Standards**
- TypeScript for backend code
- ESLint configuration for code quality
- Comprehensive error handling
- Documentation for all major features

---

## 📄 **License**

This project is proprietary software developed for Talia. All rights reserved.

---

## 🆘 **Support**

### **Getting Help**
- Check [Quick Start Guide](./QUICK-START-GUIDE.md) for setup issues
- Review [Development Workflow](./DEVELOPMENT-WORKFLOW.md) for development questions
- Use GraphQL Playground for testing queries
- Check console logs for error messages

### **Common Issues**
- **Port conflicts**: Ensure ports 4000 and 5173 are available
- **GraphQL errors**: Test queries in GraphQL Playground
- **Build issues**: Run `npm run clean` and rebuild

---

**Talia v0.1.0 - Initial Product Baseline**
*Empowering business intelligence through modern, role-based dashboards*

Built for Talia
