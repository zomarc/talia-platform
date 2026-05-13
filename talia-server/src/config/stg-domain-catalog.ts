export type StgDomainName =
  | 'capacity'
  | 'availability'
  | 'promotions'
  | 'booking_history'
  | 'sales_profile';

export type StgSourceTable = {
  domain: StgDomainName;
  sourceTable: string;
  targetTable: string | null;
  grain: string;
  dateColumns: string[];
  keyColumns: string[];
  notes: string;
};

export type StgQualityBaselineQuery = {
  id: string;
  domain: StgDomainName;
  description: string;
  sql: string;
};

export const STG_DOMAIN_SOURCE_CATALOG: StgSourceTable[] = [
  {
    domain: 'booking_history',
    sourceTable: 'stg.RES_HEADER',
    targetTable: 'reservation',
    grain: 'reservation current row',
    dateColumns: ['SAIL_DATE_FROM', 'SAIL_DATE_TO', 'LAST_UPDATED_AT'],
    keyColumns: ['RES_ID'],
    notes: 'Primary booking-state source; enrich sail metadata separately when needed.'
  },
  {
    domain: 'booking_history',
    sourceTable: 'stg.RES_HEADER_SNAPSHOT',
    targetTable: 'reservation_changes / reservation_current_state',
    grain: 'reservation snapshot event row',
    dateColumns: ['Snapshot_Date'],
    keyColumns: ['RES_ID', 'Snapshot_Date'],
    notes: 'Delta/event history source for change tracking and current-state derivation.'
  },
  {
    domain: 'promotions',
    sourceTable: 'stg.RES_PROMOTION',
    targetTable: 'reservation_promotion',
    grain: 'reservation-promotion row',
    dateColumns: [],
    keyColumns: ['RES_PROMO_ID', 'RES_ID'],
    notes: 'Reservation-linked promo data; active-window semantics need explicit contract.'
  },
  {
    domain: 'capacity',
    sourceTable: 'dwh.Dim_Master_Sail',
    targetTable: 'master_sail',
    grain: 'sailing/package row',
    dateColumns: ['Sail_Date_From', 'Sail_Date_To'],
    keyColumns: ['Sail_Code', 'Package_ID'],
    notes: 'Operational baseline until STG parity is established for capacity model.'
  },
  {
    domain: 'availability',
    sourceTable: 'dwh.Dim_Cabin_Availability',
    targetTable: 'cabin_availability',
    grain: 'sail/cabin/day availability row',
    dateColumns: ['Snapshot_Date'],
    keyColumns: ['Sail_Code', 'Cabin_Category', 'Snapshot_Date'],
    notes: 'Operational baseline while STG-equivalent feed quality is validated.'
  },
  {
    domain: 'availability',
    sourceTable: 'dwh.Dim_Sail_By_Cabin_Occupancy',
    targetTable: 'sail_by_cabin_occupancy',
    grain: 'sail/cabin occupancy row',
    dateColumns: ['Sail_Date_From'],
    keyColumns: ['Sail_Code', 'Cabin_Category'],
    notes: 'Used for occupancy pressure and cabin-level capacity context.'
  },
  {
    domain: 'sales_profile',
    sourceTable: 'stg.RES_HEADER + stg.RES_HEADER_SNAPSHOT',
    targetTable: 'booking profile derived series',
    grain: 'weekly point by sail code',
    dateColumns: ['SAIL_DATE_FROM', 'Snapshot_Date'],
    keyColumns: ['RES_ID', 'Sail_Code'],
    notes: 'Canonical profile should be server-generated with representative prior-year mapping.'
  }
];

export const STG_QUALITY_BASELINE_QUERIES: StgQualityBaselineQuery[] = [
  {
    id: 'booking_coverage_by_month',
    domain: 'booking_history',
    description: 'Booking volume and distinct reservations by sail month.',
    sql: `
SELECT
  FORMAT(CAST(SAIL_DATE_FROM AS date), 'yyyy-MM') AS sail_month,
  COUNT(*) AS row_count,
  COUNT(DISTINCT RES_ID) AS distinct_reservations
FROM stg.RES_HEADER
WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo
GROUP BY FORMAT(CAST(SAIL_DATE_FROM AS date), 'yyyy-MM')
ORDER BY sail_month;
`.trim()
  },
  {
    id: 'booking_nulls_and_uniqueness',
    domain: 'booking_history',
    description: 'Null rates and key uniqueness checks on reservation header.',
    sql: `
SELECT
  COUNT(*) AS total_rows,
  SUM(CASE WHEN RES_ID IS NULL THEN 1 ELSE 0 END) AS null_res_id,
  SUM(CASE WHEN SAIL_DATE_FROM IS NULL THEN 1 ELSE 0 END) AS null_sail_date_from,
  SUM(CASE WHEN RES_STATUS IS NULL THEN 1 ELSE 0 END) AS null_res_status,
  COUNT(DISTINCT RES_ID) AS distinct_res_id
FROM stg.RES_HEADER
WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo;
`.trim()
  },
  {
    id: 'snapshot_continuity',
    domain: 'booking_history',
    description: 'Snapshot day continuity and row counts.',
    sql: `
SELECT
  CAST(Snapshot_Date AS date) AS snapshot_day,
  COUNT(*) AS row_count,
  COUNT(DISTINCT RES_ID) AS distinct_reservations
FROM stg.RES_HEADER_SNAPSHOT
WHERE Snapshot_Date BETWEEN @dateFrom AND @dateTo
GROUP BY CAST(Snapshot_Date AS date)
ORDER BY snapshot_day;
`.trim()
  },
  {
    id: 'promotion_joinability',
    domain: 'promotions',
    description: 'Promotion rows joinable to reservation header in range.',
    sql: `
WITH base_res AS (
  SELECT RES_ID
  FROM stg.RES_HEADER
  WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo
)
SELECT
  COUNT(*) AS promo_rows,
  SUM(CASE WHEN br.RES_ID IS NULL THEN 1 ELSE 0 END) AS unmatched_promo_rows,
  COUNT(DISTINCT rp.RES_ID) AS promo_res_ids
FROM stg.RES_PROMOTION rp
LEFT JOIN base_res br ON br.RES_ID = rp.RES_ID;
`.trim()
  },
  {
    id: 'capacity_availability_joinability',
    domain: 'availability',
    description: 'Joinability of sail and cabin dimensions in baseline sources.',
    sql: `
SELECT
  COUNT(*) AS availability_rows,
  COUNT(DISTINCT ca.Sail_Code) AS availability_sails,
  COUNT(DISTINCT ms.Sail_Code) AS matched_master_sails
FROM dwh.Dim_Cabin_Availability ca
LEFT JOIN dwh.Dim_Master_Sail ms
  ON ms.Sail_Code = ca.Sail_Code
WHERE ca.Snapshot_Date BETWEEN @dateFrom AND @dateTo;
`.trim()
  }
];

export const getStgDomainCatalog = () => STG_DOMAIN_SOURCE_CATALOG;
export const getStgQualityBaselineQueries = () => STG_QUALITY_BASELINE_QUERIES;
