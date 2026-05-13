#!/usr/bin/env node
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const dateFrom = process.argv[2] || process.env.STG_BASELINE_FROM || '2025-09-01';
const dateTo = process.argv[3] || process.env.STG_BASELINE_TO || '2026-12-31';

const synapseConfig = {
  server: process.env.AZURE_SYNAPSE_SERVER,
  database: process.env.AZURE_SYNAPSE_DATABASE,
  user: process.env.AZURE_SYNAPSE_USERNAME,
  password: process.env.AZURE_SYNAPSE_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false }
};

const assertConfig = () => {
  const missing = ['AZURE_SYNAPSE_SERVER', 'AZURE_SYNAPSE_DATABASE', 'AZURE_SYNAPSE_USERNAME', 'AZURE_SYNAPSE_PASSWORD']
    .filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
};

const QUERIES = [
  {
    id: 'booking_coverage_by_month',
    sql: `
      SELECT FORMAT(CAST(SAIL_DATE_FROM AS date), 'yyyy-MM') AS sail_month, COUNT(*) AS row_count, COUNT(DISTINCT RES_ID) AS distinct_reservations
      FROM stg.RES_HEADER
      WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo
      GROUP BY FORMAT(CAST(SAIL_DATE_FROM AS date), 'yyyy-MM')
      ORDER BY sail_month;
    `
  },
  {
    id: 'booking_nulls_and_uniqueness',
    sql: `
      SELECT COUNT(*) AS total_rows,
             SUM(CASE WHEN RES_ID IS NULL THEN 1 ELSE 0 END) AS null_res_id,
             SUM(CASE WHEN SAIL_DATE_FROM IS NULL THEN 1 ELSE 0 END) AS null_sail_date_from,
             SUM(CASE WHEN RES_STATUS IS NULL THEN 1 ELSE 0 END) AS null_res_status,
             COUNT(DISTINCT RES_ID) AS distinct_res_id
      FROM stg.RES_HEADER
      WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo;
    `
  },
  {
    id: 'snapshot_continuity',
    sql: `
      SELECT CAST(Snapshot_Date AS date) AS snapshot_day, COUNT(*) AS row_count, COUNT(DISTINCT RES_ID) AS distinct_reservations
      FROM stg.RES_HEADER_SNAPSHOT
      WHERE Snapshot_Date BETWEEN @dateFrom AND @dateTo
      GROUP BY CAST(Snapshot_Date AS date)
      ORDER BY snapshot_day;
    `
  },
  {
    id: 'promotion_joinability',
    sql: `
      WITH base_res AS (
        SELECT RES_ID
        FROM stg.RES_HEADER
        WHERE SAIL_DATE_FROM BETWEEN @dateFrom AND @dateTo
      )
      SELECT COUNT(*) AS promo_rows,
             SUM(CASE WHEN br.RES_ID IS NULL THEN 1 ELSE 0 END) AS unmatched_promo_rows,
             COUNT(DISTINCT rp.RES_ID) AS promo_res_ids
      FROM stg.RES_PROMOTION rp
      LEFT JOIN base_res br ON br.RES_ID = rp.RES_ID;
    `
  },
  {
    id: 'capacity_availability_joinability',
    sql: `
      SELECT COUNT(*) AS availability_rows,
             COUNT(DISTINCT ca.Sail_Code) AS availability_sails,
             COUNT(DISTINCT ms.Sail_Code) AS matched_master_sails
      FROM dwh.Dim_Cabin_Availability ca
      LEFT JOIN dwh.Dim_Master_Sail ms ON ms.Sail_Code = ca.Sail_Code
      WHERE ca.Snapshot_Date BETWEEN @dateFrom AND @dateTo;
    `
  }
];

const run = async () => {
  assertConfig();
  const pool = await sql.connect(synapseConfig);
  try {
    const output = {};
    for (const query of QUERIES) {
      const result = await pool
        .request()
        .input('dateFrom', sql.Date, dateFrom)
        .input('dateTo', sql.Date, dateTo)
        .query(query.sql);
      output[query.id] = result.recordset || [];
      console.log(`\n[${query.id}] rows=${output[query.id].length}`);
      console.log(JSON.stringify(output[query.id].slice(0, 10), null, 2));
    }
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error('[run-stg-quality-baseline] failed:', error?.message || error);
  process.exit(1);
});
