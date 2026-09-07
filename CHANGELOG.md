# Changelog

All notable changes to Talia Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.4.0] - 2026-09-07

### Summary

Introduce **talia-engine** v0: a TypeScript Agent Runtime that runs independently of talia-server (own process / Docker service on :4100). First RM Agent is Regulator. UI shows an RM Checklist of Findings and Engine Activity. Python is reserved for later discrete math/ML jobs.

### Added

- `talia-engine` runtime, Finding contract validation, Regulator vs inventory load-factor targets + occupancy.
- Finding store (`rm_findings`, `rm_engine_runs`) and GraphQL `rmFindings` / `runRmAgents` / `rmEngineStatus`.
- Focus panels **RM Checklist** and **Engine Activity**.
- Docker Compose service `talia-engine` (Python 3 in image for later elements).

### Notes

- Phase A / Advise only — no reservation writes, no Talia Assistant.
- Engine language is TypeScript; Python jobs are discrete and must not invent scores.

---

## [0.3.0] - 2026-08-11

### Summary

Development baseline for client discuss demos: durable `dev.taliahub.com` presenter, sail horizon through Dec 2027 (current bookings, not daily facts), MSE flat/date/month workflow, and denser explorer + reservation UX.

### Added

- **Demo presenter:** macOS launchd KeepAlive for vite preview `:4173` + ngrok (`scripts/install-demo-presenter.sh`); Start Demo rebuilds and claims the tunnel.
- **Global Month** criterion (departure calendar month ∩ Date window) for Flat MSE and shared table criteria.
- **MSE:** Date column first with YY, Nested/Flat views, month-driven flat preference.
- Sync horizon Sep 2025 → Dec 2027 for sail/departure facts; short snapshot lookback for cabin availability; ship cabin reserve sail filter; promotion subquery templates.

### Changed

- Ops validate menu/URL clarity (`PUBLIC_DEV_URL` discuss path; MiniPC/Azure as prove-deploy).
- Reservations report defaults to **Booked**.
- Data Management date displays include year.
- MSE payload densify and related inventory/booking improvements in this baseline.

---

## [0.2.0] - 2026-04-14

### Summary

Release focused on deploy reliability, ops validation, and focus/GraphQL alignment across environments.

### Changed

- **Deploy:** GraphQL updates use `docker compose build graphql-server` from synced source (no `docker cp` of `dist` only); `--graphql-only` syncs code and rebuilds the image; UI dist copy unchanged.
- **Validate:** MVP Supabase/Kong status uses SSH and GraphQL fallbacks when public ports are firewalled; “Checking…” progress line while probes run; ngrok / external mapping requires typing `ENABLE_NGROK_EXTERNAL` (or `TALIA_CONFIRM_NGROK`) before start.
- **Ops tokens:** `SCRIPT_VERSION` / `VALIDATE_SCRIPT_DOC_VERSION` bumped to **ops-4** (Instance & keys cross-check).
- **UI / GraphQL:** Focus and profile-state handling improvements; optional legacy Focus enum compatibility via env where needed.

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
- Reference implementation for initial customer
- Demo data and branding for product validation
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

<!-- Release tags are local or team-defined; deploy path is laptop → staging/MVP over SSH, not a public host. -->
