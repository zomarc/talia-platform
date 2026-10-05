# Commercial book targets — discussion note

**For:** commercial and product review  
**Date:** 6 October 2026  
**Status:** implemented locally, header switch default **Off**. Not a replacement for finance budget.

This note describes the first use of `lkp.Commercial_Book_Targets` in Talia: how the table is stored, why the panels read pre-aggregated views, and exactly what each report shows when the header **Cml** switch is On.

---

## What this source is

The warehouse table is weekly commercial pace for a voyage. Each row is a fraction of the commercial book at a snapshot week (`wc_snapshot_date`), not a running total and not “the latest week”.

A voyage total is the **sum of those weeks**:

- guests = `SUM(guest_count)`
- ticket = `SUM(gross_ticket_revenue_eur)`
- passenger-nights = `SUM(pax_nights)`

Local load after sync: about **1.15 million** rows, about **370** voyages. Panels do not query that base table.

### What is included

| Source field | How Talia uses it |
|---|---|
| `master_voyage` | The commercial voyage key. Matched to the selected sailing’s `reference_sail_code`. |
| `pax_type` **F** | Named FIT. |
| `pax_type` **G** | Named Group. |
| `pax_type` **A** | Excluded until the business defines it. |
| `market_grouping` | Header market dimension when the header is set to Group. |
| `agency_market` | Header market dimension when the header is set to Market. |
| `agency_channel` | Channel rollup (see Distribution). |
| `wc_snapshot_date` | Week of the pace point, used only on the booking curve. |
| `master_voyage_length` | Nights, used if passenger-nights are missing. |
| `guest_count`, `gross_ticket_revenue_eur`, `pax_nights` | Summed. Values are fractional at week grain and become voyage totals only after the sum. |

Held and GTY are **not** in this file. Booked columns that include held will not match commercial Group.

Status columns on the source (BK / named flags) are not used as filters.

### What this does not replace

- Finance budget from `lkp.BUDGET` (the Budget / finance comparison already in profiles).
- The CSV supplied curve `booking_targets_supplied` (the dashed **Target** line on Reservation Profile).
- Live booked, estimated, and contracted reservations.

Commercial is a third series, drawn beside those numbers only when **Cml** is On.

---

## Header switch

The criteria strip has **Cml**, next to Bk and Cat.

| Setting | Behaviour |
|---|---|
| **Off** (default) | Panels do not query commercial targets. Existing booked, target, and budget displays are unchanged. |
| **On** | The four reports below load the pre-aggregated views and draw commercial figures next to live booked figures. |

The choice is stored on global criteria as `commercialTargets` (`off` or `on`) and follows the saved dashboard profile. Turning it off stops the extra queries; it does not delete the synced table.

---

## Pre-aggregated views

The base table is too large to filter inside a panel on every sail click. Three Postgres views collapse the weekly pace before Talia reads it. They live in `public` and are exposed through the existing table GraphQL path. Grants are `SELECT` for `anon`, `authenticated`, and `service_role`.

Local row counts after the views were created:

| View | Rows | Grain |
|---|---:|---|
| `commercial_book_targets` (base) | ~1,145,000 | one weekly pace row |
| `commercial_book_target_sail` | 1,023 | voyage × pax type |
| `commercial_book_target_voyage` | 18,056 | voyage × pax type × market group × agency market × channel |
| `commercial_book_target_week` | per voyage (a busy sail is a few thousand grouped rows) | voyage × snapshot date × pax type × market group × agency market × channel |

Each view carries:

- `master_voyage`
- `pax_type`
- `master_voyage_length` (`MAX`)
- `guest_count`, `gross_ticket_revenue_eur`, `pax_nights` (`SUM`, stored as float)

`commercial_book_target_voyage` also carries `market_grouping`, `agency_market`, `agency_channel`.

`commercial_book_target_week` adds `wc_snapshot_date`. The cumulative curve is built in the browser from that grain. The view itself stays weekly.

### Why three grains

| View | Who reads it | Why this grain |
|---|---|---|
| Sail | Master Sailing Explorer | One voyage total per sail, split FIT / Group. About a thousand rows, one fetch for the open list. |
| Voyage | Distribution, Seasonal Trading Pack | Same voyage total, cut by market and channel. Distribution asks for **one** voyage. The seasonal pack asks for the voyages already in the departure window, in chunks of 80 sail codes. The unfiltered 18k-row view is not loaded into Distribution. |
| Week | Reservation Profile | Needs the shape of the book through time. Asked for **one** voyage (limit 20,000). |

Sail and voyage views are on the large-table query path so the row cap is not the normal 5,000-row table limit. The sail view is still well under that. The week view must stay on that path because one voyage can exceed 5,000 grouped rows.

### How a panel asks for a voyage

Selling panels already receive `reference_sail_code` on the sail selection. Commercial queries filter `master_voyage` equal to that code. They do not re-derive master and segment relationships.

When **Cml** is Off the query is not sent.

Observed with the switch On, on the open workspace: four GraphQL calls, the largest body about 100 KB, each returning in well under a second. That is the views, not the 1.1 million-row table.

---

## PPPD (per passenger per day)

Two definitions, both plotted on a **right-hand euro axis**. The left axis stays cabins or guests.

| Line | Formula | When it is drawn |
|---|---|---|
| **PPPD** (actual) | cumulative net ticket EUR ÷ cumulative guests ÷ voyage nights | Always, while the Reservation Profile graph is on. Nights are the usual reservation sail duration. The point is omitted when cumulative guests are under 20, so a one-guest week does not stretch the axis. |
| **Cml PPPD** | cumulative gross ticket EUR ÷ cumulative passenger-nights | Only when **Cml** is On, and only once cumulative commercial guests are at least 20. If passenger-nights are missing, ticket ÷ guests ÷ voyage length. |

Actual PPPD uses **net** ticket from reservations. Commercial PPPD uses **gross** ticket from the commercial file. They will not match euro for euro. On a sample April 2027 Discovery sailing the actual line settled near €216 and the commercial line near €190, on a right axis of about €0–€350, with the left axis still in cabins.

The right axis title is **€ PPPD**. Grid lines stay on the plot. The euro scale does not stack with the cabin series.

---

## What each component shows

### 1. Reservation Profile

**View:** `commercial_book_target_week`, one selected voyage.

**Always (graph on), whether Cml is Off or On**

- Booked, Estimated, Contracted on the left axis (cabins or guests, following the header unit).
- Supplied **Target** curve, when that CSV profile exists. Unchanged.
- **PPPD** on the right axis, from live reservations.
- Capacity reference (**Cap**) and **Today**, unchanged.

**When Cml is On**

- Weekly pace is turned into a cumulative curve on the same week axis as the booking curve (weeks before sail, rounded the same way as the Monday snapshots).
- **Totals** mode: one dashed **Commercial** guest line, plus **Cml PPPD** on the right axis.
- **Series** mode: commercial guests split by the header market dimension (`market_grouping` or `agency_market`). Those lines are not added into the booked stack.
- Pax type A is dropped. F and G are both included in the guest lines.

The commercial lines are pace-to-date shape, not a second copy of Booked.

### 2. Master Sailing Explorer

**View:** `commercial_book_target_sail`. One fetch of voyage × pax type, joined onto the voyages already on screen (including the reference sail code).

**When Cml is On**

| Layout | Columns |
|---|---|
| Compact | One **Cml** column, `FIT/Group` guests (for example `438/397`). |
| Wide | **Cml F**, **Cml G**, **Cml €** (summed gross ticket). |

These are named booked targets only. They follow F and G in the commercial file. They do not include held or GTY, and they do not change the existing booked FIT/Group columns. All three booked-composition modes still show the commercial F and G columns when the switch is on.

**When Cml is Off** those columns are absent. No commercial query.

### 3. Distribution

**View:** `commercial_book_target_voyage`, filtered to the selected voyage.

**When Cml is On** each of the three bars becomes a pair: **Booked** and **Commercial**.

| Chart | Booked (existing) | Commercial |
|---|---|---|
| Channel | Agency, Direct, Tour Op, as today | Same labels. Source `Travel Agency` → Agency, `Direct` → Direct, `Tour Operator` and `DMC` → Tour Op, anything else → Other. |
| Market | Header dimension (group or market) | Same dimension: `market_grouping` or `agency_market`. |
| Group / FIT | Current booked composition, which can include held | Named FIT and Group only. A excluded. Held is not in the commercial bar. |

Percent mode divides **each bar by its own total**. A commercial share is not a share of the booked total.

Available capacity stays on the booked channel bar. The commercial bar does not invent an “available” slice.

**When Cml is Off** the charts stay a single booked bar.

### 4. Seasonal Trading Pack

**View:** `commercial_book_target_voyage`, on the server, only for sail codes already in the pack’s departure window, and only when the client sends `includeCommercialTargets`.

The pack still loads reservations as it does today. Commercial rows are then summed into the same months, using the reservation’s departure month for that voyage. The pack’s market-group filter applies. Only F and G are kept.

**When Cml is On**

- Snapshot card: commercial ticket, with guest count and the F / G split.
- Matrix row **Commercial guests** or **Commercial ticket**, beside the booked row, by month.
- Details section **Commercial by channel**: source channel name (Travel Agency, Tour Operator, DMC, Direct, and so on), guests, and ticket. This table keeps the warehouse channel names. Distribution folds DMC into Tour Op; the seasonal table does not.
- If the commercial query fails, the pack still loads and shows a short message instead of commercial figures.

**When Cml is Off** the request omits the flag and the server does not read the view. No commercial row, card, or channel table.

A timed check for November 2026–January 2027 (switch logically on) returned commercial guests **10,060**, ticket about **€5.49m**, FIT **7,600**, Group **2,460**, across the three months. Channel split in that window: Travel Agency 5,215, Tour Operator 2,449, DMC 1,485, Direct 911. The request time was dominated by the existing reservation load, not by the commercial view.

---

## Reading the numbers in a meeting

1. **Cml Off** is the normal screen. Booked, target, and budget mean what they meant before this work.
2. **Cml On** adds the commercial file beside those figures. It does not overwrite them.
3. Commercial guests are the **sum of weekly pace**, F and G only.
4. Commercial Group will sit below a booked Group that includes held.
5. Actual PPPD is net ticket per guest per night. Commercial PPPD is gross ticket per passenger-night. Same axis, different numerator.
6. The expensive table stays in the database. Reports read a voyage total, a market/channel total, or one voyage’s weeks.
