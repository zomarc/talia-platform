#!/usr/bin/env node

/**
 * Explore the structure of fou.Fact_Reservation_daily table
 */

import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const AZURE_SYNAPSE_CONFIG = {
  server: process.env.AZURE_SYNAPSE_SERVER,
  port: parseInt(process.env.AZURE_SYNAPSE_PORT || '1433'),
  database: process.env.AZURE_SYNAPSE_DATABASE,
  user: process.env.AZURE_SYNAPSE_USERNAME,
  password: process.env.AZURE_SYNAPSE_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  }
};

async function exploreTable() {
  console.log('🔍 Exploring fou.Fact_Reservation_daily structure...\n');
  let pool;
  
  try {
    pool = await sql.connect(AZURE_SYNAPSE_CONFIG);
    console.log('✅ Connected to Azure Synapse');

    // Get table structure
    console.log('\n📊 Getting table structure...');
    const structureResult = await sql.query`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        IS_NULLABLE
      FROM
        INFORMATION_SCHEMA.COLUMNS
      WHERE
        TABLE_SCHEMA = 'fou' AND TABLE_NAME = 'Fact_Reservation_daily'
      ORDER BY
        ORDINAL_POSITION;
    `;

    console.log('📋 Columns:');
    structureResult.recordset.forEach(col => {
      const type = col.DATA_TYPE + 
        (col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '') +
        (col.NUMERIC_PRECISION ? `(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})` : '');
      console.log(`  - ${col.COLUMN_NAME}: ${type} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Get sample data
    console.log('\n📊 Getting sample data (first 5 rows)...');
    const sampleResult = await sql.query`
      SELECT TOP 5 *
      FROM [fou].[Fact_Reservation_daily]
      WHERE SNAPSHOT_DATE >= '2025-01-01' AND SNAPSHOT_DATE < '2027-01-01'
      ORDER BY SNAPSHOT_DATE DESC, RES_ID;
    `;

    console.log('\n📋 Sample data:');
    console.log(JSON.stringify(sampleResult.recordset, null, 2));

    // Check for key columns
    console.log('\n🔑 Checking for key columns...');
    const keyColumns = ['RES_ID', 'SNAPSHOT_DATE', 'GUEST_COUNT', 'SAIL_CODE', 'AGENCY', 'GROUP_ID'];
    const existingColumns = structureResult.recordset.map(col => col.COLUMN_NAME.toUpperCase());
    
    keyColumns.forEach(col => {
      const exists = existingColumns.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? 'Found' : 'NOT FOUND'}`);
    });

    // Get row count for 2025-2026
    console.log('\n📊 Getting row count for 2025-2026...');
    const countResult = await sql.query`
      SELECT COUNT(*) as total_rows
      FROM [fou].[Fact_Reservation_daily]
      WHERE SNAPSHOT_DATE >= '2025-01-01' AND SNAPSHOT_DATE < '2027-01-01';
    `;
    console.log(`  Total rows: ${countResult.recordset[0].total_rows}`);

    // Check unique reservations
    const uniqueResResult = await sql.query`
      SELECT COUNT(DISTINCT RES_ID) as unique_reservations
      FROM [fou].[Fact_Reservation_daily]
      WHERE SNAPSHOT_DATE >= '2025-01-01' AND SNAPSHOT_DATE < '2027-01-01';
    `;
    console.log(`  Unique reservations: ${uniqueResResult.recordset[0].unique_reservations}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Disconnected from Azure Synapse');
    }
  }
}

exploreTable();
