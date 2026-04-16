# Published rates: price history in Talia

## Purpose

- **`published_rates_current_state`** — one row per **rate identity** (`rate_key`): the latest fare snapshot Talia uses for comparisons and UI “current price” views.
- **`published_rates_changes`** — append-only **history** when a rate’s money fields or selected attributes change between warehouse snapshots during sync.

Source warehouse object: **`fou.GQL_PUBLISHED_RATES`** (see [sync.config.json](../talia-server/sync.config.json)).

## Canonical rate identity (`rate_key`)

`rate_key` must match how the business identifies a **single sellable published rate line** (one price point to track over time).

**Format (v2, current):** pipe-separated, stable `NULL` token for missing dimensions:

```text
sail_code|cabin_category|rate_type|promo_name|departure_date|ship_code|currency_code
```

| Segment           | Source column   | Notes |
|-------------------|-----------------|--------|
| `sail_code`       | `SAIL_CODE`     | |
| `cabin_category`  | `CABIN_CATEGORY`| |
| `rate_type`       | `RATE_TYPE`     | |
| `promo_name`      | `PROMO_NAME`    | Literal `NULL` if missing |
| `departure_date`  | `DEPARTURE_DATE`| `YYYY-MM-DD`; distinguishes sailings that reuse codes |
| `ship_code`       | `SHIP_CODE`     | |
| `currency_code`   | `CURRENCY_CODE` | |

Implementation: [`getPublishedRateKey`](../talia-server/src/services/published-rates-sync.js).

### After changing `rate_key`

Existing rows in `published_rates_current_state` / `published_rates_changes` use the **old** key shape until you:

1. **Truncate** both tables (and reset `sync_metadata` for `published_rates` if you want a clean incremental window), **or**
2. Run a **one-off migration** that recomputes keys (non-trivial), then **re-sync**.

For most environments, truncate + full re-sync is the practical path.

## Initial sync vs incremental

- **Incremental** runs only load warehouse rows with `SNAPSHOT_DATE` newer than the last processed snapshot (see `syncDerivedTableWithBatching`).
- **Initial** runs (no `last_processed` / `forceFullSync`) previously pulled **every** historical snapshot in the departure window, which could emit one change row per snapshot transition per rate and **bloat** `published_rates_changes`. Initial runs are now **scoped to the latest `SNAPSHOT_DATE` within the same departure filter** so the first Talia load matches “current published file for that sailing window,” not full multi-year replay. See [synapse-sync.js](../talia-server/src/services/synapse-sync.js).

## Noise control

Sync compares money fields with a **small epsilon** (see `published-rates-sync.js`) to avoid logging changes from floating-point jitter. Duplicate rows in the same batch for the same `(rate_key, snapshot_date)` are collapsed before insert.

## Related docs

- [PUBLISHED_RATES_RETENTION.md](./PUBLISHED_RATES_RETENTION.md) — indexes, retention, backups
- [BACKUP-RESTORE.md](../talia-server/scripts/BACKUP-RESTORE.md) — excluding `published_rates_changes` data from dumps
