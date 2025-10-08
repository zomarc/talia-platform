# Multi-Customer Strategy

Talia Platform v0.1.0 (Alpha) - Multi-Customer Implementation Guide

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture Approach](#architecture-approach)
- [Environment-Based Configuration](#environment-based-configuration)
- [Branding Customization](#branding-customization)
- [Data Isolation Strategy](#data-isolation-strategy)
- [Deployment Per Customer](#deployment-per-customer)
- [Customer Onboarding](#customer-onboarding)
- [Future Enhancements](#future-enhancements)

---

## 🎯 Overview

Talia Platform is designed as a **multi-customer revenue and inventory management system**. The architecture supports deploying the same codebase for multiple customers with customized branding and isolated data.

### Key Principles

1. **Shared Codebase** - All customers use the same code
2. **Environment-Based Config** - Customer-specific settings via environment variables
3. **Data Isolation** - Complete separation of customer data
4. **Independent Deployment** - Each customer gets their own deployment
5. **Minimal Code Changes** - No code changes needed for new customers

---

## 🏗️ Architecture Approach

### Single Codebase, Multiple Deployments

```
┌─────────────────────────────────────────────────────────────┐
│              Talia Platform (GitHub Repo)                   │
│                  zomarc/talia-platform                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Deploy with different configs
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Celestyal    │  │  Customer A   │  │  Customer B   │
│  Deployment   │  │  Deployment   │  │  Deployment   │
│               │  │               │  │               │
│  ENV: Celestyal│  │  ENV: Acme   │  │  ENV: Beta   │
│  Data: DB1    │  │  Data: DB2   │  │  Data: DB3   │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Benefits

**For Development**:
- ✅ Single codebase to maintain
- ✅ Bug fixes benefit all customers
- ✅ Features deployed to all customers
- ✅ Easier testing and QA

**For Customers**:
- ✅ Custom branding
- ✅ Isolated data
- ✅ Independent scaling
- ✅ Custom domain names

**For Business**:
- ✅ Lower development costs
- ✅ Faster customer onboarding
- ✅ Consistent user experience
- ✅ Easier support and maintenance

---

## 🔧 Environment-Based Configuration

### Configuration Strategy

All customer-specific settings are managed through environment variables. No code changes required.

### Environment Variables

#### Customer Branding

```env
# Customer identity
VITE_CUSTOMER_NAME=Celestyal

# Visual branding
VITE_CUSTOMER_LOGO=/assets/celestyal-logo.png
VITE_CUSTOMER_PRIMARY_COLOR=#2E86AB
VITE_CUSTOMER_THEME=celestyal

# Optional: Custom domain
VITE_CUSTOMER_DOMAIN=talia.celestyal.com
```

#### Authentication

```env
# InstantDB (separate app per customer)
VITE_INSTANT_APP_ID=celestyal-app-id
```

#### API Configuration

```env
# GraphQL endpoint (can be shared or separate)
VITE_GRAPHQL_ENDPOINT=https://api.celestyal.talia.com/graphql
```

#### Feature Flags (Future)

```env
# Enable/disable features per customer
VITE_FEATURE_ADVANCED_ANALYTICS=true
VITE_FEATURE_MULTI_CURRENCY=true
VITE_FEATURE_CUSTOM_REPORTS=false
```

### Example: Three Customers

**Celestyal (Reference Implementation)**
```env
VITE_CUSTOMER_NAME=Celestyal
VITE_CUSTOMER_LOGO=/assets/celestyal-logo.png
VITE_CUSTOMER_PRIMARY_COLOR=#2E86AB
VITE_INSTANT_APP_ID=1c2b040a-7bb2-4eb5-8490-ce5832e19dd0
```

**Acme Cruises**
```env
VITE_CUSTOMER_NAME=Acme Cruises
VITE_CUSTOMER_LOGO=/assets/acme-logo.png
VITE_CUSTOMER_PRIMARY_COLOR=#FF6B35
VITE_INSTANT_APP_ID=acme-app-id-here
```

**Beta Lines**
```env
VITE_CUSTOMER_NAME=Beta Lines
VITE_CUSTOMER_LOGO=/assets/beta-logo.png
VITE_CUSTOMER_PRIMARY_COLOR=#4ECDC4
VITE_INSTANT_APP_ID=beta-app-id-here
```

---

## 🎨 Branding Customization

### Visual Elements

#### Logo
- Upload customer logo to `/public/assets/`
- Set `VITE_CUSTOMER_LOGO` to logo path
- Recommended size: 200x50px (PNG with transparency)

#### Colors
- Primary color: `VITE_CUSTOMER_PRIMARY_COLOR`
- Used for: buttons, links, highlights, focus indicators
- Format: Hex color code (e.g., `#2E86AB`)

#### Theme
- Default themes: `default`, `dark`, `light`
- Custom themes can be added to theme configuration
- Set via `VITE_CUSTOMER_THEME`

### Branding Implementation

**In Code** (no changes needed):
```javascript
// Theme automatically uses environment variables
const theme = {
  colors: {
    accent: process.env.VITE_CUSTOMER_PRIMARY_COLOR || '#2E86AB',
    // ... other colors derived from primary
  }
};

// Logo automatically uses environment variable
const logo = process.env.VITE_CUSTOMER_LOGO || '/default-logo.png';

// Customer name displayed throughout UI
const customerName = process.env.VITE_CUSTOMER_NAME || 'Talia Platform';
```

### Customization Levels

**Level 1: Basic Branding** (Current)
- Logo
- Primary color
- Customer name

**Level 2: Extended Branding** (Future)
- Secondary colors
- Font family
- Custom CSS
- Favicon

**Level 3: White Label** (Future)
- Complete UI customization
- Custom domain
- Remove Talia branding
- Custom email templates

---

## 🔒 Data Isolation Strategy

### Current Approach (Alpha)

**Separate InstantDB Apps**:
- Each customer gets their own InstantDB application
- Complete data isolation at the database level
- No risk of data leakage between customers
- Independent user management per customer

**Benefits**:
- ✅ Maximum security
- ✅ Simple to implement
- ✅ Easy to understand
- ✅ No cross-customer queries possible

**Drawbacks**:
- ❌ Higher costs (multiple InstantDB apps)
- ❌ No cross-customer analytics
- ❌ Duplicate data management

### Future Approach (Multi-Tenant Database)

**Single Database with Tenant Isolation**:

```sql
-- All tables include customerId
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  email VARCHAR(255),
  -- ... other fields
  CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Row-level security
CREATE POLICY customer_isolation ON users
  USING (customer_id = current_setting('app.current_customer_id')::INTEGER);
```

**Benefits**:
- ✅ Lower costs (single database)
- ✅ Cross-customer analytics possible
- ✅ Centralized data management
- ✅ Better for SaaS model

**Implementation**:
- PostgreSQL with row-level security (RLS)
- Middleware to set customer context
- Audit logging for compliance
- Encryption at rest

---

## 🚀 Deployment Per Customer

### Netlify Deployment

#### Step 1: Create New Site

1. Go to Netlify dashboard
2. Click "Add new site" → "Import an existing project"
3. Connect to `zomarc/talia-platform`
4. Name site: `talia-[customer-name]` (e.g., `talia-celestyal`)

#### Step 2: Configure Build

**Build settings**:
```
Base directory: (leave empty)
Build command: npm run build:all
Publish directory: talia-ui/dist
```

**Environment variables**:
```
NODE_VERSION=18
VITE_CUSTOMER_NAME=[Customer Name]
VITE_CUSTOMER_LOGO=/assets/[customer]-logo.png
VITE_CUSTOMER_PRIMARY_COLOR=[#HexColor]
VITE_INSTANT_APP_ID=[customer-app-id]
VITE_GRAPHQL_ENDPOINT=[api-url]
```

#### Step 3: Deploy

1. Click "Deploy site"
2. Wait for build to complete
3. Test deployment
4. Configure custom domain (optional)

### Custom Domains

**Subdomain Approach**:
- `celestyal.talia.com`
- `acme.talia.com`
- `beta.talia.com`

**Custom Domain Approach**:
- `talia.celestyal.com`
- `analytics.acmecruises.com`
- `dashboard.betalines.com`

**Configuration**:
1. Add custom domain in Netlify
2. Update DNS records
3. Enable HTTPS (automatic with Netlify)
4. Test deployment

---

## 👥 Customer Onboarding

### Onboarding Checklist

#### 1. Pre-Deployment
- [ ] Collect customer branding assets (logo, colors)
- [ ] Create InstantDB app for customer
- [ ] Prepare environment variables
- [ ] Upload customer assets to repository

#### 2. Deployment
- [ ] Create Netlify site
- [ ] Configure build settings
- [ ] Set environment variables
- [ ] Deploy and test
- [ ] Configure custom domain (if applicable)

#### 3. Configuration
- [ ] Create first admin user
- [ ] Configure user roles
- [ ] Set up demo data (if needed)
- [ ] Test authentication flow

#### 4. Training & Handoff
- [ ] Provide admin credentials
- [ ] Conduct training session
- [ ] Share documentation
- [ ] Set up support channel

### Time Estimate

**New Customer Onboarding**: 2-4 hours
- Branding preparation: 30 minutes
- Deployment setup: 1 hour
- Testing: 1 hour
- Training: 1-2 hours

---

## 🔮 Future Enhancements

### Planned Features

**Customer Management Portal**:
- Self-service customer onboarding
- Branding customization UI
- Feature flag management
- Usage analytics

**Advanced Customization**:
- Custom CSS injection
- Widget customization
- Custom reports
- API access for integrations

**Multi-Tenant Database**:
- Migrate to PostgreSQL with RLS
- Centralized customer management
- Cross-customer analytics (aggregated)
- Better cost efficiency

**Automated Deployment**:
- CI/CD pipeline per customer
- Automated testing
- Staging environments
- Rollback capabilities

---

## 📊 Customer Comparison

| Feature | Current (v0.1.0) | Future (v1.0.0) |
|---------|------------------|-----------------|
| Data Isolation | Separate InstantDB apps | Multi-tenant database |
| Branding | Environment variables | Self-service portal |
| Deployment | Manual Netlify setup | Automated CI/CD |
| Customization | Logo + colors | Full white label |
| Cost Model | Per-deployment | Per-user/usage |
| Onboarding Time | 2-4 hours | < 30 minutes |

---

## 🤝 Support

For questions about multi-customer deployment:
- Contact the development team
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment details
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details

---

**Version**: 0.1.0 (Alpha)  
**Last Updated**: 2025-10-08
