#!/usr/bin/env node

/**
 * Test Azure Synapse Connection with mssql package
 */

import dotenv from 'dotenv';
import sql from 'mssql';

// Load environment variables
dotenv.config();

async function testAzureMSSQL() {
  console.log('🔍 Testing Azure Synapse connection with mssql package...');
  
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

  console.log('Config:', JSON.stringify(config, null, 2));

  try {
    console.log('🔗 Connecting to Azure Synapse...');
    await sql.connect(config);
    console.log('✅ Connected successfully!');
    
    // Test a simple query
    const result = await sql.query('SELECT 1 as test');
    console.log('✅ Query successful!');
    console.log('Result:', result.recordset);
    
    await sql.close();
    console.log('🔌 Disconnected from Azure Synapse');
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

// Run test
testAzureMSSQL().catch(console.error);


