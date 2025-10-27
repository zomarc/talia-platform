#!/usr/bin/env node

// Quick script to discover actual column names in reservations table

import sql from 'mssql';

const config = {
  server: 'celestyaldataplatform-prd.sql.azuresynapse.net',
  port: 1433,
  database: 'CDP_Dedicated_SQL_DWH',
  user: 'RBryer',
  password: 'Cele5tyalrbUser!',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  }
};

async function discoverColumns() {
  try {
    const pool = await sql.connect(config);
    console.log('✅ Connected to Azure Synapse');
    
    // Get column information for reservations table
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'dwh' 
      AND TABLE_NAME = 'Fact_Reservation_History'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\n📋 Columns in dwh.Fact_Reservation_History:');
    result.recordset.forEach(col => {
      console.log(`  • ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    
    // Test a simple query with TOP 1
    console.log('\n🧪 Testing simple query...');
    const testResult = await pool.request().query(`
      SELECT TOP 1 *
      FROM dwh.Fact_Reservation_History
      WHERE YEAR(Sail_From_Date) IN (2025, 2026)
    `);
    
    console.log('✅ Sample record columns:');
    Object.keys(testResult.recordset[0]).forEach(col => {
      console.log(`  • ${col}`);
    });
    
    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

discoverColumns();
