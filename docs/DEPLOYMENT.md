# Deployment Guide

This guide covers deployment options for Talia Platform v0.1.0 (Alpha).

---

## 📋 Table of Contents

- [Overview](#overview)
- [API Keys & Configuration](#api-keys--configuration)
- [Deployment Options](#deployment-options)
- [Environment Variables](#environment-variables)
- [Multi-Customer Deployment](#multi-customer-deployment)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

Talia Platform supports three deployment strategies:

1. **Unified Deployment** - Deploy both UI and server together (Netlify monorepo)
2. **Independent UI Deployment** - Deploy only the frontend (Netlify)
3. **Independent Server Deployment** - Deploy only the backend (Railway/Render/AWS)

Choose the strategy that best fits your infrastructure and scaling needs.

---

## 🔑 API Keys & Configuration

### InstantDB

**Good News**: Existing InstantDB App ID can be reused!

- App ID is tied to your InstantDB application, not the GitHub repository
- All user data and mappings persist when moving to a new repository
- No reconfiguration needed

**Setup**:
1. Get your App ID from [InstantDB Dashboard](https://instantdb.com/dash)
2. Add to environment variables: `VITE_INSTANT_APP_ID=your-app-id`

### Netlify

**Reusing Existing Site**:
1. Go to your existing Netlify site
2. Navigate to: Site Settings → Build & Deploy → Configure repository
3. Select the new repository: `zomarc/talia-platform`
4. Keep existing build settings
5. Environment variables remain unchanged

**Creating New Site**:
1. Create new site on Netlify
2. Connect to `zomarc/talia-platform`
3. Copy environment variables from existing deployment
4. Use build settings from this guide

---

## 🚀 Deployment Options

### Option A: Unified Deployment (Netlify Monorepo)

Deploy both frontend and backend together using Netlify's monorepo support.

**Configuration**: Root `netlify.toml`

**Build Settings**:
```toml
[build]
  command = "npm run build:all"
  publish = "talia-ui/dist"

[build.environment]
  NODE_VERSION = "18"
  NODE_ENV = "production"
```

**Deploy**:
```bash
# Preview deployment
npm run deploy:preview

# Production deployment
npm run deploy:production
```

**Pros**:
- Single deployment pipeline
- Shared environment variables
- Simpler configuration
- Lower cost (one site)

**Cons**:
- Less flexibility for independent scaling
- Both components deploy together

---

### Option B: Independent UI Deployment (Netlify)

Deploy only the frontend application.

**Configuration**: `talia-ui/netlify.toml`

**Build Settings**:
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"
```

**Deploy**:
```bash
cd talia-ui
netlify deploy --prod
```

**Environment Variables Required**:
- `VITE_INSTANT_APP_ID` - InstantDB App ID
- `VITE_GRAPHQL_ENDPOINT` - GraphQL server URL
- `VITE_CUSTOMER_NAME` - Customer name (optional)
- `VITE_CUSTOMER_LOGO` - Logo URL (optional)
- `VITE_CUSTOMER_PRIMARY_COLOR` - Brand color (optional)

**Pros**:
- Independent frontend scaling
- Faster deployments (UI only)
- Can use different backend

**Cons**:
- Need separate backend deployment
- More configuration

---

### Option C: Independent Server Deployment

Deploy the backend GraphQL server to a dedicated service.

#### Railway

**Configuration**: Create `talia-server/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run compile"
  },
  "deploy": {
    "startCommand": "node ./dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Deploy**:
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `cd talia-server && railway init`
4. Deploy: `railway up`

#### Render

**Configuration**: Create `talia-server/render.yaml`

```yaml
services:
  - type: web
    name: talia-server
    env: node
    buildCommand: npm install && npm run compile
    startCommand: node ./dist/index.js
    envVars:
      - key: NODE_VERSION
        value: 18
      - key: PORT
        value: 4000
```

**Deploy**:
1. Connect repository to Render
2. Select `talia-server` directory
3. Use `render.yaml` configuration
4. Deploy

#### AWS (ECS/Fargate)

**Docker Configuration**: Create `talia-server/Dockerfile`

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run compile
EXPOSE 4000
CMD ["node", "./dist/index.js"]
```

**Deploy**:
1. Build image: `docker build -t talia-server .`
2. Push to ECR
3. Create ECS task definition
4. Deploy to Fargate

**Pros**:
- Independent backend scaling
- Better for high-traffic APIs
- More control over resources

**Cons**:
- More complex setup
- Higher cost
- Requires DevOps knowledge

---

## 🔧 Environment Variables

### Root Level

```env
# Customer Configuration
CUSTOMER_NAME=Celestyal
CUSTOMER_LOGO_URL=/assets/celestyal-logo.png
CUSTOMER_PRIMARY_COLOR=#2E86AB
CUSTOMER_THEME=celestyal

# InstantDB
VITE_INSTANT_APP_ID=your-app-id

# API Configuration
VITE_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

### Frontend (talia-ui)

```env
# Customer Branding
VITE_CUSTOMER_NAME=Celestyal
VITE_CUSTOMER_LOGO=/assets/celestyal-logo.png
VITE_CUSTOMER_PRIMARY_COLOR=#2E86AB

# InstantDB
VITE_INSTANT_APP_ID=your-app-id

# API
VITE_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

### Backend (talia-server)

```env
# Server Configuration
PORT=4000
NODE_ENV=production

# Database (future)
# DATABASE_URL=postgresql://...

# API Keys (if needed)
# API_KEY=your-api-key
```

---

## 🏢 Multi-Customer Deployment

### Strategy

Each customer gets their own deployment with customized branding:

1. **Shared Codebase**: All customers use the same code
2. **Environment-Based Config**: Customer-specific settings via environment variables
3. **Separate Deployments**: Each customer has their own Netlify site/server
4. **Data Isolation**: Separate InstantDB apps per customer (or shared with tenant isolation)

### Deployment Per Customer

**Example: Deploying for Customer "Acme"**

1. Create new Netlify site: `talia-acme`
2. Connect to `zomarc/talia-platform`
3. Set environment variables:
   ```env
   VITE_CUSTOMER_NAME=Acme
   VITE_CUSTOMER_LOGO=/assets/acme-logo.png
   VITE_CUSTOMER_PRIMARY_COLOR=#FF6B35
   VITE_INSTANT_APP_ID=acme-app-id
   ```
4. Deploy from `main` branch

**Benefits**:
- Independent deployments per customer
- Custom branding per customer
- Isolated data per customer
- Independent scaling

---

## 🐛 Troubleshooting

### Build Failures

**Issue**: `concurrently: command not found`
```bash
# Solution: Install root dependencies
npm install
```

**Issue**: Build fails with TypeScript errors
```bash
# Solution: Ensure TypeScript is installed
cd talia-server
npm install
npm run compile
```

### Deployment Issues

**Issue**: Environment variables not working
- Ensure variables are prefixed with `VITE_` for frontend
- Check Netlify dashboard for correct variable names
- Rebuild after changing environment variables

**Issue**: GraphQL endpoint not reachable
- Verify `VITE_GRAPHQL_ENDPOINT` points to correct URL
- Check CORS settings on backend
- Ensure backend is deployed and running

### InstantDB Issues

**Issue**: Authentication not working
- Verify `VITE_INSTANT_APP_ID` is correct
- Check InstantDB dashboard for app status
- Ensure app is not paused or deleted

---

## 📚 Additional Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Railway Documentation](https://docs.railway.app/)
- [Render Documentation](https://render.com/docs)
- [InstantDB Documentation](https://docs.instantdb.com/)

---

**Need Help?** Contact the development team for deployment support.
