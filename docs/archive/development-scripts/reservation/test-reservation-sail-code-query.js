#!/usr/bin/env node

/**
 * Test script to verify the reservation changes query with SAIL_CODE join
 * This tests the actual query structure that will be used in the sync
 */

import sql from 'mssql';

const synapseConfig = {
  server: process.env.AZURE_SYNAPSE_SERVER || 'celestyaldataplatform-prd.sql.azuresynapse.net',
  port: parseInt(process.env.AZURE_SYNAPSE_PORT) || 1433,
  database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
  user: process.env.AZURE_SYNAPSE_USER || process.env.AZURE_SYNAPSE_USERNAME,
  password: process.env.AZURE_SYNAPSE_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  }
};

async function testQuery() {
  let pool;
  
  try {
    console.log('🔌 Connecting to Azure Synapse...');
    pool = await sql.connect(synapseConfig);
    console.log('✅ Connected\n');

    // Test 1: Check if SAIL_CODE exists in RES_HEADER
    console.log('📋 Test 1: Checking RES_HEADER table structure...');
    const headerColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'stg' 
        AND TABLE_NAME = 'RES_HEADER'
        AND COLUMN_NAME LIKE '%SAIL%'
      ORDER BY COLUMN_NAME
    `);
    
    console.log('Columns in RES_HEADER containing "SAIL":');
    headerColumns.recordset.forEach(col => {
      console.log(`  • ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    console.log('');

    // Test 2: Check RES_HEADER_SNAPSHOT structure
    console.log('📋 Test 2: Checking RES_HEADER_SNAPSHOT table structure...');
    const snapshotColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'stg' 
        AND TABLE_NAME = 'RES_HEADER_SNAPSHOT'
        AND (COLUMN_NAME LIKE '%SAIL%' OR COLUMN_NAME IN ('RES_ID', 'Snapshot_Date'))
      ORDER BY COLUMN_NAME
    `);
    
    console.log('Relevant columns in RES_HEADER_SNAPSHOT:');
    snapshotColumns.recordset.forEach(col => {
      console.log(`  • ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    console.log('');

    // Test 3: Test the join query with a small sample
    console.log('📋 Test 3: Testing join query with sample data...');
    const testQuery = `
      SELECT TOP 10
        rhs.[Snapshot_Date],
        rhs.[RES_ID],
        rhs.[AGENCY_ID],
        rhs.[GROUP_ID],
        rhs.[RES_GUEST_COUNT],
        rh.[SAIL_CODE]
      FROM stg.RES_HEADER_SNAPSHOT rhs
      INNER JOIN stg.RES_HEADER rh ON rhs.[RES_ID] = rh.[RES_ID]
      WHERE rhs.[Snapshot_Date] >= '2025-09-01'
        AND rhs.[Snapshot_Date] <= '2025-12-31'
      ORDER BY rhs.[Snapshot_Date] DESC, rhs.[RES_ID]
    `;
    
    const result = await pool.request().query(testQuery);
    console.log(`✅ Query executed successfully. Retrieved ${result.recordset.length} rows\n`);
    
    if (result.recordset.length > 0) {
      console.log('Sample rows:');
      result.recordset.slice(0, 3).forEach((row, idx) => {
        console.log(`\n  Row ${idx + 1}:`);
        console.log(`    Snapshot_Date: ${row.Snapshot_Date}`);
        console.log(`    RES_ID: ${row.RES_ID}`);
        console.log(`    AGENCY_ID: ${row.AGENCY_ID}`);
        console.log(`    GROUP_ID: ${row.GROUP_ID}`);
        console.log(`    RES_GUEST_COUNT: ${row.RES_GUEST_COUNT}`);
        console.log(`    SAIL_CODE: ${row.SAIL_CODE || '(NULL)'}`);
      });
      
      // Check how many have NULL sail_code
      const nullCount = result.recordset.filter(r => !r.SAIL_CODE).length;
      console.log(`\n⚠️  Rows with NULL SAIL_CODE: ${nullCount} out of ${result.recordset.length}`);
    } else {
      console.log('⚠️  No data returned. Check date range or table contents.');
    }

    // Test 4: Check if there are any RES_IDs in SNAPSHOT that don't exist in HEADER
    console.log('\n📋 Test 4: Checking for orphaned RES_IDs...');
    const orphanQuery = `
      SELECT COUNT(*) as orphaned_count
      FROM stg.RES_HEADER_SNAPSHOT rhs
      LEFT JOIN stg.RES_HEADER rh ON rhs.[RES_ID] = rh.[RES_ID]
      WHERE rh.[RES_ID] IS NULL
        AND rhs.[Snapshot_Date] >= '2025-09-01'
        AND rhs.[Snapshot_Date] <= '2025-12-31'
    `;
    
    const orphanResult = await pool.request().query(orphanQuery);
    const orphanedCount = orphanResult.recordset[0].orphaned_count;
    console.log(`⚠️  Orphaned RES_IDs (in SNAPSHOT but not in HEADER): ${orphanedCount}`);
    
    if (orphanedCount > 0) {
      console.log('   This could cause rows to be excluded from the join.');
    }

    console.log('\n✅ All tests completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Connection closed');
    }
  }
}

testQuery();

