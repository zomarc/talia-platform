# Talia Platform - Revenue and Inventory Management System

> ⚠️ **ALPHA VERSION 0.1.0** - This is pre-release software in active development. Expect breaking changes.

**Talia Platform** is a multi-customer revenue and inventory management system designed for the cruise industry. This repository contains the complete monorepo with both frontend UI and backend GraphQL server.

**Reference Implementation**: Celestyal Cruises

---

## 📋 Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Quick Start](#quick-start)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Version](#version)
- [License](#license)

---

## 🎯 Overview

Talia Platform provides:
- **Revenue Management**: Published rates, pricing analysis, and revenue optimization
- **Inventory Management**: Cabin availability, sailing schedules, and capacity management
- **Interactive Dashboard**: React-based UI with customizable focus layouts using Dockview
- **GraphQL API**: TypeScript-based backend with flexible data querying
- **Multi-Customer Support**: Environment-based configuration for different customers
- **User Management**: Role-based access control with InstantDB authentication

### Key Features

- ✅ React-based dashboard with Dockview layout system
- ✅ GraphQL server with TypeScript
- ✅ InstantDB authentication integration
- ✅ User mapping and role management (admin, manager, user, guest)
- ✅ Focus management system for customizable layouts
- ✅ Admin dashboard for user and system management
- ✅ Published rates and sailing data components
- ✅ Revenue and inventory management capabilities
- ✅ Monorepo structure with independent deployment capability

---

## 📁 Monorepo Structure

```
talia-platform/
├── talia-ui/              # Frontend React application
│   ├── src/
│   ├── package.json
│   └── netlify.toml       # Independent UI deployment
├── talia-server/          # Backend GraphQL server
│   ├── src/
│   └── package.json
├── netlify/
│   └── functions/         # Serverless functions
├── docs/                  # Documentation
├── package.json           # Monorepo configuration
└── netlify.toml           # Unified deployment
```

### Subprojects

- **[talia-ui](./talia-ui/)** - Frontend application built with React, Vite, and Dockview
- **[talia-server](./talia-server/)** - GraphQL API server built with TypeScript and Apollo Server

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/zomarc/talia-platform.git
cd talia-platform

# Install all dependencies (root + subprojects)
npm run install:all
```

### Configuration

1. Copy environment example files:
```bash
cp .env.example .env
cp talia-ui/.env.example talia-ui/.env
cp talia-server/.env.example talia-server/.env
```

2. Update `.env` files with your configuration:
   - InstantDB App ID
   - GraphQL endpoint
   - Customer branding (optional)

### Run Development Environment

```bash
# Start both frontend and backend
npm run dev

# Or run individually:
npm run dev:frontend  # UI only (port 5173)
npm run dev:backend   # Server only (port 4000)
```

### Build for Production

```bash
# Build both projects
npm run build

# Or build individually:
npm run build:frontend
npm run build:backend
```

---

## 💻 Development

### Available Scripts

From the root directory:

```bash
npm run dev            # Run both UI and server in development mode
npm run build          # Build both projects for production
npm run clean          # Clean build artifacts
npm run lint           # Lint both projects
npm run test           # Run tests for both projects
```

### Development Workflow

1. **Active Development**: Use the `development` branch
2. **Feature Development**: Create feature branches from `development`
3. **Stable Releases**: Merge to `main` branch
4. **Version Tags**: Tag releases (e.g., `v0.1.0`)

### Branch Strategy

- `main` - Stable baseline (protected)
- `development` - Active development (default branch)
- `feature/*` - Feature branches
- `hotfix/*` - Bug fixes
- `release/*` - Release preparation

---

## 🚢 Deployment

Talia Platform supports multiple deployment strategies:

### Option A: Unified Deployment (Netlify Monorepo)
Deploy both frontend and backend together using the root `netlify.toml` configuration.

### Option B: Independent UI Deployment
Deploy only the frontend using `talia-ui/netlify.toml`.

### Option C: Independent Server Deployment
Deploy the backend to Railway, Render, or AWS using the server configuration.

**See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed deployment instructions.**

---

## 📚 Documentation

- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and design decisions
- **[Deployment](./docs/DEPLOYMENT.md)** - Deployment options and configurations
- **[Multi-Customer](./docs/MULTI-CUSTOMER.md)** - Multi-customer strategy and implementation
- **[Changelog](./CHANGELOG.md)** - Version history and changes

---

## 📦 Version

**Current Version**: 0.1.0 (Alpha)

### Version Strategy

- **0.x.x** - Pre-release development versions (Alpha/Beta)
- **1.0.0** - First production release
- **X.Y.Z** - Semantic Versioning: Major.Feature.Bugfix

### Version Roadmap

- **0.1.x** - Alpha development (current)
- **0.2.x** - Alpha with additional features
- **0.9.x** - Beta (feature complete, testing)
- **1.0.0** - First production release

---

## 🏢 Organization

This project is maintained by **Zomarc** and is part of the Talia Platform product suite.

**Repository**: https://github.com/zomarc/talia-platform

---

## 📄 License

UNLICENSED - Proprietary software. All rights reserved.

---

## ⚠️ Alpha Status Notice

This is an **alpha release** (v0.1.0) in active development:

- ⚠️ Expect breaking changes
- ⚠️ Not production-ready
- ⚠️ API may change without notice
- ⚠️ Use at your own risk

For production use, wait for version 1.0.0 or later.

---

## 🤝 Contributing

This is a private repository. For questions or support, please contact the development team.

---

**Built with ❤️ for the cruise industry**
