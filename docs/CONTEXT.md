# TALIA UI - Development Context & Structure

## 🎯 **Project Overview**
Talia is a revenue and inventory management system providing analytics, focus management, and role-based access control.

## 📁 **Project Structure**

### **Monorepo Organization**
```
/path/to/talia/
├── talia-ui/                    # Frontend React Application
├── talia-server/                # Backend GraphQL Server
├── CONTEXT.md                   # This file - development context
├── README.md                    # Main project documentation
├── VERSION-0.1.0.md            # Current baseline documentation
├── CHANGELOG.md                # Version history
└── VERSIONING-STRATEGY.md      # Versioning approach
```

## 🚀 **Entry Points**

### **Frontend (talia-ui)**
- **Main Entry**: `src/main.jsx`
  - Renders `<AppWithAuth />` with React StrictMode
  - Handles authentication routing and error boundaries

- **App Flow**: `main.jsx` → `AppWithAuth.jsx` → `Dashboard.jsx`
  - `main.jsx`: React root and error handling
  - `AppWithAuth.jsx`: Authentication provider and routing
  - `Dashboard.jsx`: **Main dashboard component** (the actual app)

### **Backend (talia-server)**
- **Main Entry**: `dist/index.js` (compiled from `src/index.ts`)
  - Apollo GraphQL Server on port 4000
  - Enhanced with Focus Management & Role-based Access

## 🏗️ **Component Architecture**

### **Frontend Components Location**
All React components are organized in `src/components/`:

```
src/components/
├── focus-management/           # Focus Management System
│   ├── FocusSelector.jsx      # User focus selection
│   ├── FocusManager.jsx       # Admin focus management
│   ├── FocusLayoutEditor.jsx  # Layout customization
│   ├── focus-management.css   # Component styles
│   └── index.js               # Central exports
├── focus-panels/              # Dashboard panels
│   ├── KPICards.jsx          # Key Performance Indicators
│   ├── OccupancyChart.jsx    # Occupancy visualization
│   ├── RevenueBreakdown.jsx  # Revenue analytics
│   ├── ExceptionList.jsx     # Exception management
│   └── ItineraryList.jsx     # Itinerary management
├── ErrorBoundary.jsx          # Error handling
├── LandingPage.jsx            # Authentication landing
└── UserProfile.jsx            # User management
```

### **Core Services & Hooks**
```
src/
├── contexts/
│   └── AuthContext.jsx        # Authentication provider
├── hooks/
│   └── useFocusManagement.js  # Focus management logic
├── services/
│   └── FocusService.js        # Database operations
├── lib/
│   └── db.js                  # InstantDB configuration
└── data/
    └── focusLayouts.js        # Layout definitions
```

## 🔧 **Key Technologies**

### **Frontend Stack**
- **React 19.1.1**: UI framework
- **Vite 7.1.2**: Build tool and dev server
- **Dockview 4.9.0**: Layout and docking system
- **InstantDB 0.21.26**: Real-time database
- **Chart.js 4.5.0**: Data visualization
- **Tabulator 5.6.1**: Data tables

### **Backend Stack**
- **Apollo Server 5.0.0**: GraphQL server
- **TypeScript**: Backend language
- **Node.js**: Runtime environment

### **Development Tools**
- **Netlify**: Deployment platform
- **Git**: Version control
- **npm**: Package management

## 🎮 **Development Workflow**

### **Starting Development**
```bash
# Terminal 1: Frontend
cd talia-ui && npm run dev
# Runs on http://localhost:5173

# Terminal 2: Backend  
cd talia-server && npm run start
# Runs on http://localhost:4000
```

### **Current Status (v0.1.0)**
- ✅ **Dev Baseline**: Committed and tagged
- ✅ **Focus Management**: Fully integrated
- ✅ **Authentication**: InstantDB-based
- ✅ **Role-Based Access**: Admin, Manager, User, Guest
- ✅ **Real-time Updates**: InstantDB integration
- ✅ **Test Environment**: Comprehensive testing pages

## 🔍 **Focus Management System**

### **Architecture**
- **Database**: InstantDB with enhanced schema
- **State Management**: `useFocusManagement` hook
- **UI Components**: FocusSelector, FocusManager, FocusLayoutEditor
- **Fallback System**: Works offline with static focuses

### **Focus Types**
- **Standard Focuses**: Admin-defined, system-wide
- **User-Defined**: Custom focuses per user
- **Template Focuses**: Reusable layouts
- **Shared Focuses**: Collaborative focuses

### **Current Implementation**
- ✅ **Database Schema**: Extended InstantDB schema
- ✅ **Service Layer**: FocusService for CRUD operations
- ✅ **React Hook**: useFocusManagement for state
- ✅ **UI Components**: Complete component library
- ✅ **Integration**: Fully integrated with Dashboard.jsx
- ✅ **Testing**: Comprehensive test environment

## 📊 **Dashboard Features**

### **Core Panels**
- **Sailings Table**: Real-time sailing data with filtering
- **KPI Cards**: Revenue, occupancy, availability metrics
- **Occupancy Chart**: Weekly occupancy and revenue trends
- **Revenue Breakdown**: Category-based revenue analysis
- **Exception List**: Active exception management

### **Focus System**
- **Dynamic Layouts**: Dockview-based panel arrangement
- **Role-Based Access**: Different focuses per user role
- **Customization**: User-defined focus creation
- **Persistence**: Layout saving and restoration

## 🔐 **Authentication & Authorization**

### **Authentication Flow**
1. **Landing Page**: Email-based magic link authentication
2. **InstantDB Auth**: Secure token-based authentication
3. **User Context**: Role-based access control
4. **Session Management**: Persistent login state

### **Role Hierarchy**
- **Admin**: Full system access, focus management
- **Manager**: Business operations, limited admin
- **User**: Standard dashboard access
- **Guest**: Read-only access

## 🚀 **Deployment**

### **Netlify Integration**
- **Frontend**: Automatic deployment from Git
- **Backend**: Netlify Functions for GraphQL server
- **Environment**: Production and staging environments

### **Versioning Strategy**
- **x.y.z Format**: Production.BaselineOrFeature.DevRelease
- **Current Version**: 0.2.0 (Dev Baseline)
- **Development**: Feature releases increment y, testable increments z

## 📝 **Development Notes**

### **Important Files**
- **`Dashboard.jsx`**: Main application component (NOT App.jsx)
- **`AppWithAuth.jsx`**: Authentication wrapper
- **`main.jsx`**: React entry point
- **`instant.schema.ts`**: Database schema definition

### **Testing**
- **Test Pages**: `public/test-focus.html`, `public/test-focus-simple.html`
- **Status Monitoring**: Server health checks
- **Development Commands**: Quick access to features

### **Debug Information**
- **Console Logging**: Comprehensive debug output
- **Visual Indicators**: Test banners for verification
- **Error Boundaries**: Graceful error handling

---

## 🎯 **Quick Start Checklist**

1. ✅ **Verify Entry Points**: `main.jsx` → `AppWithAuth.jsx` → `Dashboard.jsx`
2. ✅ **Check Components**: All in `src/components/`
3. ✅ **Start Servers**: Frontend (5173) + Backend (4000)
4. ✅ **Test Focus Management**: Look for test banners in sidebar
5. ✅ **Verify Authentication**: User login and role assignment
6. ✅ **Check Database**: InstantDB connection and schema

**Current Status**: Focus Management System is fully operational with comprehensive testing and debugging capabilities.
