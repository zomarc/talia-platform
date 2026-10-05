# Product Review: Promotion Explorer, Deployment, Data Architecture

- **Date:** 2026-09-17
- **Plaud id:** `of_525a5bc995ff372cff490fd34f789225`
- **Also today:** SeaWare tunnel / event tracing — `of_6f4496d5a5c5406236366618d68669cc`
- **Source:** Plaud MCP (`get_note`)

## Meeting

Andy Wilson and Russell reviewed Talia’s pricing-governance scope, Promo Explorer direction, deployment path, and production data architecture. Central theme: tactical promotions must be registered and measurable in Talia, not buried in PDFs.

## Requirements (Talia)

### Promotion Explorer (demo target 5 Oct 2026)

- [ ] **Register-before-load promotions** — UI + data  
  - Panel: Promo Explorer (beyond heuristic v1)  
  - Acceptance: control record required before price extraction; PDF is not the source of truth
- [ ] **Capture core dates** — data  
  - Acceptance: effective start/end, booking period, departure start/end
- [ ] **Capture commercial scope** — data  
  - Acceptance: market, promo code, sailings/sale codes, agencies, pax type (group/FIT)
- [ ] **Capture price coverage** — UI + data  
  - Acceptance: all-categories vs per-category; 3rd/4th/single sub-offers where present
- [ ] **Governance trail + approval** — UI + data  
  - Acceptance: who requested / entered / approved; analyst → Marius/Andy approval path
- [ ] **Replace static GQL pricing parameter table** with user-maintained control structure — data  
  - Acceptance: agencies, rate types, currencies, markets, promo codes, effective dates drive extraction
- [ ] **GraphQL price extraction via agency impersonation** — data  
  - Acceptance: pull prices into Talia using registered agency/rate context (BAR/CUG + tactical)
- [ ] **Preserve price history for efficacy analysis** — data + engine  
  - Acceptance: every applicable price + dates retained; later statistical measurement possible
- [ ] **Talia is SoT; generate PDF from the record** — UI + docs  
  - Acceptance: tactical/seasonal PDF produced from Talia for Salesforce distribution

### RM product framing

- [ ] **RM levers as system scope** — UI  
  - Promotion · BAR · stop-sell · allocation (Allocation/Inventory Explorer)
- [ ] **Differentiated tariffs (discussion for 5 Oct)** — docs  
  - Nonrefundable vs flexible — not build yet
- [ ] **User-specific homepage** — UI  
  - Acceptance: RM synopsis / yesterday view before MSE
- [ ] **Role-based reduced UI** (RM vs admin) — UI
- [ ] **Lazy load explorers** — UI  
  - Dates first; bookings/cabins/targets background

### Deployment / architecture

- [ ] **Deploy next iteration to Russell’s Azure**, then Celestyal Azure — docs / ops
- [ ] **Prefer ODS / Talia schema or views** for production — data  
  - Isolate from Synapse BI; prefer views over unnecessary copies when no transform
- [ ] **Keep GraphQL abstraction** — data  
  - Small-batch loads + validation; repoint lake/Seaware without app rewrite

### SeaWare access enablers (second meeting)

- [ ] **SSM tunnel to Talia/SeaWare RDS** (Michalis; ~24 Sep) — data (external)
- [ ] **Load latest UAT dump into Talia instance** — data (external)
- [ ] **Event-trace group probability updates** — data  
  - Acceptance: document FE vs ODBC event flow; draft spec (group probabilities first)

## Out of scope / parking lot

- Funding / Excom / Opex commercial arrangements
- SaaS-vs-custom debate
- Full flat-file pricing as SoT (direction only)
- Cloning full Oracle UAT locally (tunnel preferred)

## Open questions

1. Minimum viable Promo Explorer for **5 Oct**: registration + metadata only, or also live GraphQL extract?
2. Where does the control table live first — Talia DB, ODS `ODS.Talia_*`, or both?
3. Approval workflow: in-app vs email/Slack for Marius/Andy?
4. Tunnel permissions: read-only / DBA-level for trace?

## Action items (from Plaud)

**Andy Wilson**

- [ ] Send Russell tactical rate-sheet examples for Promotion Explorer
- [ ] Add Russell’s Azure / infra costs as invoice line items

**Russell**

- [ ] Deploy next Talia iteration to Russell’s Azure (before Celestyal instance)

**Michalis Vlavianos** (SeaWare meeting)

- [ ] Configure AWS SSM port forwarding (~2026-09-24)
- [ ] Load latest UAT dump into Talia instance (~2026-09-24)
- [ ] Share DB dump file size when known
