# D013 — Multi-model MR framework (MR00 / MR01 / SR00)

| Field | Value |
|-------|--------|
| **Reference** | D013 |
| **Status** | Shipped (registry + panel picker + Retrospect compare + MR01 presets) |
| **Date** | 6 November 2026 |
| **Author** | Talia delivery |
| **Related** | D005 · D006 · D006-1 · D012 MR Retrospect · Groups Explorer · Talia MR Method · Historic MR Path |
| **Audience** | Revenue Management · Product / delivery |
| **Code** | `talia-ui/src/lib/mrModels/` |

---

## 1. Purpose

Materialisation expectation must be **model-aware**: the same hold inputs can be scored by more than one predictor, and models must be **measurable** on how early they predict the named outcome.

This document is the design record for the multi-model MR framework.

---

## 2. Models

| Id | Role | Point-in-time behaviour |
|---|---|---|
| **MR00** | Baseline | Always 50%. Expected = `0.5 × requested`. Ignores named/source. Cancels → 0. |
| **MR01** | Current Talia method | Prior, named blend, offer/named adjustments, optional source nudge, distress cut. Parameters and presets in Views. |
| **SR00** | Source model | Rate = held source probability. Expected = `sourceMr × requested`. No Talia steps. |

**Shared hold context** (what every model may read): requested, as-of named, status, source probability, sail distress flags, cancel.

**Outcome for accuracy** (unchanged): final named guests. Never fed into the model at earlier DTDs.

---

## 3. Delivery (three slices — complete)

1. **Registry + panel switcher** — `scoreWithModel`, Views → **MR model**, client rescore via `mrPathRescore`.
2. **Retrospect compare** — overlay MR00/MR01/SR00 vs named outcome; path error; earliest accurate DTD; leaderboard.
3. **MR01 presets** — default / no source nudge / stronger prior (replaces global source-nudge as the primary control).

---

## 4. Accuracy metrics (Retrospect)

Per model, on a group or sail window:

- **Abs gap at DTD** — `|expected − outcomeNamed|`
- **Signed bias** — expected − outcome
- **Earliest accurate DTD** — largest DTD where abs gap ≤ max(5 guests, 10% of outcome)
- **Path error** — mean abs gap across DTDs (lower is better)

---

## 5. Success criteria

- MR00 shows a flat 50% path; SR00 tracks source holds; MR01 matches prior Talia behaviour
- Retrospect ranks models by earliest accurate DTD / path error
- Adding MR02 is a new scorer file + registry entry, not a panel rewrite

---

## 6. Deliberately not in this release

- Training / ML models
- Persisting scored series per model in Postgres
- Replacing Source MR Review calibration charts
- Multi-overlay on every panel (Explorer stays single selected model)
