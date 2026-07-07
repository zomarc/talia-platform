# Talia Platform
## Architecture & Achievements

**Version:** UI 0.2.1 · Server 0.2.0  
**Date:** July 2026  
**Status:** Alpha — client demo ready on staging

---

## Overview

**Talia** is Celestyal’s revenue and inventory intelligence platform. It connects Azure Synapse (data lake) to an interactive dashboard for sailing, pricing, reservations, agencies, and operational analytics — with role-based access and customizable focus layouts.

| | |
|---|---|
| **Purpose** | Revenue management, inventory visibility, booking analytics |
| **Users** | Commercial, revenue, and operations teams |
| **Deployment** | Local dev · LAN staging (MiniPC) · Azure MVP · external demo via taliahub.com |

---

## Architecture

High-level diagram (all Talia + external elements): open [`docs/EXECUTIVE-OVERVIEW.html`](docs/EXECUTIVE-OVERVIEW.html) — section **High-level architecture**.

```
┌────────────────────────── EXTERNAL ──────────────────────────┐
│ Business users          Developers / ops                      │
│ ngrok · taliahub.com    Azure Synapse (dwh · stg · fou)       │
│ Google APIs             Competitor intel · Ship AIS · Azure VM  │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTPS / VPN / tarball deploy
┌────────────────────────────▼───────────────────────────────────┐
│ DEPLOYMENT HOSTS: Local · MiniPC staging · Azure MVP · monorepo │
└────────────────────────────┬───────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
┌───────▼────────────────────┐    ┌──────────────▼──────────────────────┐
│ talia-ui                    │    │ talia-server                         │
│ Dockview · Focus panels     │───▶│ GraphQL :4000 · tableData/resolvers │
│ Tabulator · Chart.js        │    │ synapse-sync · external feeds       │
│ Apollo · Event bus · Admin  │    │ SSE sync :4001                      │
└─────────────────────────────┘    └──────────────┬──────────────────────┘
                                                  │
                    ┌─────────────────────────────┼──────────────────┐
                    │                             │                  │
         ┌──────────▼──────────┐       ┌──────────▼────────┐  (dashed sync)
         │ Supabase (Docker)    │◀──────│ Azure Synapse      │
         │ PG · Kong · Auth     │       │ batch ETL source   │
         │ PostgREST · Studio   │       └────────────────────┘
         │ Realtime · Storage   │
         └──────────────────────┘

┌────────────────────────── TALIA OPS ───────────────────────────┐
│ scripts/validate · deploy-to-staging/mvp · sync-cli · targets  │
│ Instance & keys version cross-check                            │
└────────────────────────────────────────────────────────────────┘
```

### Talia elements (in scope)

| Layer | Components |
|-------|------------|
| **UI** | talia-ui, Dockview, 30+ focus panels, Tabulator, Chart.js, Apollo Client, event bus, Admin / Data Management |
| **API** | talia-server GraphQL, resolvers, synapse-sync, sync.config.json, external feed services, SSE :4001 |
| **Data** | Supabase Postgres, Kong, GoTrue, PostgREST, Realtime, Storage, Studio, pg-meta, imgproxy |
| **Ops** | scripts/validate, deploy-to-staging, deploy-to-mvp, sync-cli, targets.env, Instance & keys panel |

### External elements

| System | Role |
|--------|------|
| **Business users** | Browser access to dashboards and reports |
| **Developers / ops** | Local dev, validate menu, tarball deploy from laptop |
| **Azure Synapse** | Authoritative data lake (dimensions & facts) |
| **ngrok + DNS** | External HTTPS access to staging UI (taliahub.com) |
| **Google APIs** | Search, Trends, OAuth integrations |
| **Competitor intel** | Market pricing feeds into Supabase |
| **Ship tracking (AIS)** | Position feeds for ship tracker panels |
| **Azure cloud** | MVP VM hosting; optional Caddy TLS |
| **Corporate VPN** | Synapse egress from deployment hosts |

### Design principles

1. **Library-first UI** — Tabulator, Dockview, and Chart.js via shared config; minimal custom overrides  
2. **API-first data** — GraphQL `tableData` + typed queries; Supabase as the serving layer  
3. **Config-driven sync** — `sync.config.json` maps Synapse → Postgres with direct and derived pipelines  
4. **Three-environment ops** — Same Docker stack; laptop tarball deploy to staging and MVP  
5. **Canonical documentation** — One authoritative doc map; archives for history; scripts as executable truth  

---

## Environments

| Environment | Host | Role | Deploy |
|-------------|------|------|--------|
| **Local** | `localhost:5173` | Day-to-day development | `npm run dev` + `npm start` |
| **Staging** | MiniPC `192.168.1.120` | Integration & client demo | `./scripts/deploy-to-staging.sh --ui-only` |
| **MVP** | Azure VM | Cloud-shaped test instance | `./scripts/deploy-to-mvp.sh` |
| **External** | `https://taliahub.com` | ngrok → staging (basic auth) | Staging must be online |

**Ops validation:** `./scripts/validate` · **Version cross-check:** Data Management → Instance & keys  

Details: `docs/ENVIRONMENTS-AND-DEPLOY.md`

---

## Achievements (v0.2.x baseline)

### Platform & architecture
- Monorepo with independent UI and GraphQL server, unified versioning  
- Supabase-backed local database with Docker staging/MVP parity  
- Synapse sync for dimensions and facts (ships, master sail, reservations, rates, competitor, **agency**)  
- Interactive validate/deploy toolchain (`targets.env`, tarball SSH deploy)  
- Management documentation stack: canonical index, archive policy, root redirect stubs  

### Data & analytics panels
- Master Sailing, Published Rates, Reservation Current State, Competitor Pricing  
- Demand heatmaps, booking profiles, KPI and revenue breakdowns  
- Data Match, Direct Source Request, Data Management admin  
- **Agency Directory** — `dwh.Dim_Agency` (~40k agencies) with market/type/status filters  

### UX & standards (0.2.1)
- Global Fit Width / Fit Data for all Tabulator tables via shared `tabulatorConfig`  
- Group expand/collapse row-height normalization (library-native)  
- Component template + standards aligned to `getTabulatorOptions` pattern  
- Theme system, appearance profiles, focus layout persistence  

### Operations
- MiniPC staging stack (UI, GraphQL, Supabase) with ngrok external access  
- Azure MVP VM provisioned (Bicep + Docker); UI deploy path proven  
- Instance & keys panel: GraphQL version, validate script token (`ops-5`), UI build metadata  

---

## Documentation stack

| Layer | Location | Purpose |
|-------|----------|---------|
| **Canonical map** | `docs/DOCS-CANONICAL.md` | Authoritative doc list |
| **Hub** | `docs/README.md` | Navigation entry point |
| **Standards** | `docs/DIRECTIVE.md` | Coding, styling, doc rules |
| **Ops runbook** | `docs/ENVIRONMENTS-AND-DEPLOY.md` | Deploy, backups, version pitfalls |
| **Archive** | `docs/archive/` | Historical notes (non-executable) |
| **This overview** | `EXECUTIVE-OVERVIEW.md` | Top-level architecture & achievements |

---

## Roadmap (near term)

| Priority | Item |
|----------|------|
| Deploy parity | Push 0.2.1 + agency to Azure MVP; align environment version matrix |
| Docs refresh | VERSION-0.2.1 notes; stub stale root runbooks (`README-DEPLOYMENT.md`) |
| Data expansion | Additional dimensions from Synapse as business needs arise |
| Production path | Beta hardening toward v1.0.0 |

---

## Quick links

- **Branded presentation (HTML):** open [`docs/EXECUTIVE-OVERVIEW.html`](docs/EXECUTIVE-OVERVIEW.html) in a browser, or `http://localhost:5173/executive-overview.html` when the UI dev server is running  
- **Run locally:** `docs/DEVELOPMENT-WORKFLOW.md`  
- **Deploy staging:** `docs/ENVIRONMENTS-AND-DEPLOY.md`  
- **Azure setup:** `docs/AZURE-STAGING.md`  
- **Visual overview:** [Talia platform canvas](/Users/russell/.cursor/projects/Users-russell-Dev-talia/canvases/talia-platform-overview.canvas.tsx) beside this chat  

---

**Document version:** 0.2.1 overview  
**Last updated:** July 2026  
**Maintained with:** `docs/DOCS-CANONICAL.md`
