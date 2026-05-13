-- STG-first quality baseline query pack
-- Parameters expected by caller:
--   @dateFrom (date)
--   @dateTo   (date)

-- 1) Booking coverage by sail month
SELECT
  FORMAT(CAST(SAIL_DATE_FROM AS date), 'yyyy-MM') AS sail_month,
  COUNT(*) AS row_count,
  COUNT(DISTINCT RES_ID) AS distinct_reservations
FROM stg.RES_HEADER
WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo
GROUP BY FORMAT(CAST(SAIL_DATE_FROM AS date), 'yyyy-MM')
ORDER BY sail_month;

-- 2) Booking key quality
SELECT
  COUNT(*) AS total_rows,
  SUM(CASE WHEN RES_ID IS NULL THEN 1 ELSE 0 END) AS null_res_id,
  SUM(CASE WHEN SAIL_DATE_FROM IS NULL THEN 1 ELSE 0 END) AS null_sail_date_from,
  SUM(CASE WHEN RES_STATUS IS NULL THEN 1 ELSE 0 END) AS null_res_status,
  COUNT(DISTINCT RES_ID) AS distinct_res_id
FROM stg.RES_HEADER
WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo;

-- 3) Snapshot continuity
SELECT
  CAST(Snapshot_Date AS date) AS snapshot_day,
  COUNT(*) AS row_count,
  COUNT(DISTINCT RES_ID) AS distinct_reservations
FROM stg.RES_HEADER_SNAPSHOT
WHERE Snapshot_Date BETWEEN @dateFrom AND @dateTo
GROUP BY CAST(Snapshot_Date AS date)
ORDER BY snapshot_day;

-- 4) Promotion joinability
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

-- 5) Capacity/availability joinability (baseline dwh feeds)
SELECT
  COUNT(*) AS availability_rows,
  COUNT(DISTINCT ca.Sail_Code) AS availability_sails,
  COUNT(DISTINCT ms.Sail_Code) AS matched_master_sails
FROM dwh.Dim_Cabin_Availability ca
LEFT JOIN dwh.Dim_Master_Sail ms
  ON ms.Sail_Code = ca.Sail_Code
WHERE ca.Snapshot_Date BETWEEN @dateFrom AND @dateTo;
