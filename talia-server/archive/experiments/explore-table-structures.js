#!/usr/bin/env node

/**
 * Explore the actual structure of key business tables
 */

import dotenv from 'dotenv';
import sql from 'mssql';

// Load environment variables
dotenv.config();

// Azure Synapse configuration
const azureConfig = {
  server: process.env.AZURE_SYNAPSE_SERVER || 'celestyaldataplatform-prd.sql.azuresynapse.net',
  port: parseInt(process.env.AZURE_SYNAPSE_PORT) || 1433,
  database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
  user: process.env.AZURE_SYNAPSE_USERNAME || 'RBryer',
  password: process.env.AZURE_SYNAPSE_PASSWORD || 'Cele5tyalrbUser!',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  }
};

async function exploreTableStructure(schema, tableName) {
  console.log(`🔍 Exploring ${schema}.${tableName} structure...`);
  
  try {
    await sql.connect(azureConfig);
    console.log('✅ Connected to Azure Synapse');
    
    // Get table structure
    const structureQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${schema}' 
      AND TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `;
    
    console.log('📊 Getting table structure...');
    const structureResult = await sql.query(structureQuery);
    
    if (structureResult.recordset.length === 0) {
      console.log(`❌ Table ${schema}.${tableName} not found`);
      return null;
    }
    
    console.log(`✅ Table structure found for ${schema}.${tableName}:`);
    console.log('📋 Columns:');
    structureResult.recordset.forEach(column => {
      console.log(`  - ${column.COLUMN_NAME}: ${column.DATA_TYPE}${column.CHARACTER_MAXIMUM_LENGTH ? `(${column.CHARACTER_MAXIMUM_LENGTH})` : ''} ${column.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Get sample data
    console.log('\n📊 Getting sample data...');
    const sampleQuery = `SELECT TOP 3 * FROM [${schema}].[${tableName}]`;
    const sampleResult = await sql.query(sampleQuery);
    
    console.log('✅ Sample data:');
    console.log(JSON.stringify(sampleResult.recordset, null, 2));
    
    await sql.close();
    console.log('🔌 Disconnected from Azure Synapse');
    
    return structureResult.recordset;
    
  } catch (error) {
    console.error(`❌ Error exploring ${schema}.${tableName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Exploring key business table structures...\n');
  
  const tablesToExplore = [
    { schema: 'dwh', table: 'Dim_Cabin_Availability' },
    { schema: 'dwh', table: 'Dim_Cabin_Allocation' },
    { schema: 'dwh', table: 'Dim_Master_Sail' },
    { schema: 'dwh', table: 'Dim_Ship' },
    { schema: 'dwh', table: 'Dim_Itinerary' },
    { schema: 'dwh', table: 'Fact_Reservation' },
    { schema: 'fou', table: 'GQL_CABIN_AVAILABILITY' },
    { schema: 'fou', table: 'SAIL_HEADER' },
    { schema: 'fou', table: 'SHIP_CABIN' }
  ];
  
  for (const table of tablesToExplore) {
    await exploreTableStructure(table.schema, table.table);
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Run the exploration
main().catch(console.error);


