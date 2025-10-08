# Talia Dual Project Development Workflow

## 🎯 Overview
This document outlines the development workflow for working with both `talia-ui` (frontend) and `talia-graphql-server` (backend) simultaneously.

**📋 Versioning Strategy**: See [VERSIONING-STRATEGY.md](./VERSIONING-STRATEGY.md) for our official stability-driven versioning approach.

## 📁 Project Structure
```
/Users/russell/Work/AA-Celestyal/Dev/
├── talia-ui/                 # React frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── talia-graphql-server/     # GraphQL backend
    ├── src/
    ├── data/
    ├── package.json
    └── tsconfig.json
```

## 🔧 Development Setup

### Terminal 1: Frontend (talia-ui)
```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia-ui
npm run dev
# Runs on http://localhost:5173
```

### Terminal 2: Backend (talia-graphql-server)
```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia-graphql-server
npm run start
# Runs on http://localhost:4000
```

### Terminal 3: Development Commands
```bash
# Navigate between projects
cd /Users/russell/Work/AA-Celestyal/Dev/talia-ui      # Frontend
cd /Users/russell/Work/AA-Celestyal/Dev/talia-graphql-server  # Backend

# Or use aliases (add to ~/.zshrc)
alias talia-ui="cd /Users/russell/Work/AA-Celestyal/Dev/talia-ui"
alias talia-api="cd /Users/russell/Work/AA-Celestyal/Dev/talia-graphql-server"
```

## 🔄 Development Workflow

### 1. Backend-First Development
- Start with GraphQL schema changes
- Add new resolvers and data sources
- Test with GraphQL Playground (http://localhost:4000)
- Update frontend to consume new schema

### 2. Frontend Integration
- Update Apollo Client queries in talia-ui
- Add new components for new data
- Test cross-panel data flow
- Implement role-based filtering

### 3. Iterative Development
1. **Schema Design** → Backend
2. **Resolver Implementation** → Backend  
3. **Frontend Query Updates** → Frontend
4. **UI Component Updates** → Frontend
5. **Integration Testing** → Both
6. **Repeat**

## 🌐 Netlify Deployment Strategy

### Option 1: Monorepo Approach (Recommended)
Deploy both projects from a single repository:

```
talia-monorepo/
├── apps/
│   ├── frontend/          # talia-ui
│   └── backend/           # talia-graphql-server
├── netlify.toml
└── package.json
```

### Option 2: Separate Deployments
- **Frontend**: Deploy talia-ui to Netlify (static site)
- **Backend**: Deploy talia-graphql-server to Netlify Functions

### Netlify Configuration
```toml
# netlify.toml
[build]
  base = "."
  command = "npm run build:all"
  publish = "apps/frontend/dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 📋 Development Priorities

### Phase 1: Enhanced GraphQL Schema
- [ ] Add focus management types
- [ ] Add user/role management
- [ ] Add real-time subscriptions
- [ ] Add data filtering capabilities

### Phase 2: Frontend Integration
- [ ] Replace mock data with GraphQL queries
- [ ] Implement Apollo Client caching
- [ ] Add real-time updates
- [ ] Implement role-based data access

### Phase 3: Production Deployment
- [ ] Set up Netlify deployment
- [ ] Configure environment variables
- [ ] Set up monitoring and logging
- [ ] Implement CI/CD pipeline

## 🛠️ Development Commands

### Backend Development
```bash
# Start development server
npm run start

# Watch mode (if available)
npm run dev

# Build for production
npm run build
```

### Frontend Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing Both Projects
```bash
# Test GraphQL server
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ ships { Ship_Name } }"}'

# Test frontend connection
# Open http://localhost:5173 and check GraphQL panels
```

## 🔍 Debugging Tips

### GraphQL Server Issues
- Check console logs in terminal running the server
- Use GraphQL Playground at http://localhost:4000
- Verify data files in `/data` directory

### Frontend Issues
- Check browser console for Apollo Client errors
- Verify GraphQL endpoint in network tab
- Check if CORS is properly configured

### Integration Issues
- Ensure both servers are running
- Check port conflicts (5173 for frontend, 4000 for backend)
- Verify GraphQL queries match schema

## 📚 Next Steps

1. **Enhance GraphQL Schema** for focus management
2. **Update Frontend Queries** to use real data
3. **Implement Role-Based Access** in both projects
4. **Set up Netlify Deployment** configuration
5. **Create Development Scripts** for easier workflow

---

**Remember**: Always start the backend server before the frontend to ensure GraphQL queries work properly.
