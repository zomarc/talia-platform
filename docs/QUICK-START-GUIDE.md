# 🚀 Talia Development Quick Start Guide

## 📋 Prerequisites
- Node.js 18+ installed
- npm 8+ installed
- Git (for version control)

## 🎯 Quick Start (3 Steps)

### Step 1: Start Both Servers
```bash
# Option A: Use the startup script (Recommended)
cd /Users/russell/Work/AA-Celestyal/Dev
./start-dev.sh

# Option B: Manual startup (2 terminals)
# Terminal 1 - Backend
cd /Users/russell/Work/AA-Celestyal/Dev/talia-graphql-server
npm run start

# Terminal 2 - Frontend  
cd /Users/russell/Work/AA-Celestyal/Dev/talia-ui
npm run dev
```

### Step 2: Access Applications
- **Frontend**: http://localhost:5173
- **GraphQL Server**: http://localhost:4000
- **GraphQL Playground**: http://localhost:4000

### Step 3: Test Integration
1. Open the frontend dashboard
2. Add new panels from the sidebar:
   - 🚢 Sailings Data
   - 📊 KPI Dashboard  
   - ⚠️ Exceptions
3. Verify data loads from GraphQL server

## 🔧 Development Workflow

### Backend Development (GraphQL Server)
```bash
cd talia-graphql-server
npm run start          # Start server
npm run compile        # Compile TypeScript
```

**Key Files:**
- `src/schema.ts` - GraphQL schema definitions
- `src/resolvers.ts` - Query/mutation resolvers
- `src/index.ts` - Server configuration

### Frontend Development (React App)
```bash
cd talia-ui
npm run dev            # Start development server
npm run build          # Build for production
```

**Key Files:**
- `src/App.jsx` - Main application
- `src/lib/apolloClient.js` - GraphQL client configuration
- `src/components/focus-panels/` - Dashboard components

## 📊 Available Data Types

### Enhanced GraphQL Schema
- **Sailings**: Real-time sailing data with filtering
- **KPIs**: Key performance indicators with role-based access
- **Exceptions**: Exception management with severity levels
- **Ships**: Ship information and specifications
- **Cabin Availability**: Cabin occupancy data
- **Focus Management**: User custom focuses and layouts

### Role-Based Access
- **ADMIN**: Full access to all data and features
- **MANAGER**: Access to management data and exceptions
- **USER**: Access to operational data
- **GUEST**: Limited read-only access

## 🎮 Testing GraphQL Queries

### Using GraphQL Playground (http://localhost:4000)
```graphql
# Get sailings data
query GetSailings {
  sailings {
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

# Get KPIs with role filtering
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

# Get exceptions (Manager+ only)
query GetExceptions {
  exceptions(userRole: MANAGER) {
    id
    type
    severity
    message
    sailing
    ship
    createdAt
    resolved
  }
}
```

## 🌐 Deployment to Netlify

### Option 1: Monorepo Deployment (Recommended)
```bash
# Build both projects
npm run build:all

# Deploy to Netlify
npm run deploy:production
```

### Option 2: Separate Deployments
1. **Frontend**: Deploy `talia-ui` as static site
2. **Backend**: Deploy `talia-graphql-server` as Netlify Functions

## 🛠️ Development Commands

### Root Level Commands
```bash
npm run dev:all         # Start both frontend and backend
npm run build:all       # Build both projects
npm run clean           # Clean build artifacts
npm run install:all     # Install all dependencies
```

### Individual Project Commands
```bash
# Frontend
npm run dev:frontend    # Start React dev server
npm run build:frontend  # Build React app
npm run lint:frontend   # Lint frontend code

# Backend  
npm run dev:backend     # Start GraphQL server
npm run build:backend   # Build GraphQL server
npm run lint:backend    # Lint backend code
```

## 🔍 Debugging Tips

### Common Issues
1. **GraphQL Server Not Starting**
   - Check port 4000 is available
   - Verify TypeScript compilation: `npm run compile`

2. **Frontend Can't Connect to Backend**
   - Ensure GraphQL server is running on port 4000
   - Check CORS configuration in server

3. **Data Not Loading**
   - Check browser console for Apollo Client errors
   - Verify GraphQL queries in Network tab
   - Test queries in GraphQL Playground

### Useful URLs
- **Frontend Dashboard**: http://localhost:5173
- **GraphQL Playground**: http://localhost:4000
- **GraphQL Endpoint**: http://localhost:4000/graphql

## 📚 Next Steps

1. **Enhance GraphQL Schema**: Add more business logic
2. **Implement Real Authentication**: Connect to InstantDB
3. **Add Real-time Subscriptions**: Live data updates
4. **Deploy to Production**: Set up Netlify deployment
5. **Add Testing**: Unit and integration tests

## 🆘 Getting Help

- Check console logs for error messages
- Use GraphQL Playground to test queries
- Verify both servers are running
- Check network connectivity between frontend and backend

---

**Happy Coding! 🎉**
