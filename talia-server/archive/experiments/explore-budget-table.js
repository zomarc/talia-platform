#!/usr/bin/env node

/**
 * Explore BUDGET table structure
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

async function exploreBudgetTable() {
  console.log('🔍 Exploring BUDGET table structure...\n');
  
  try {
    console.log('🔗 Connecting to Azure Synapse...');
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
      WHERE TABLE_SCHEMA = 'lkp' 
      AND TABLE_NAME = 'BUDGET'
      ORDER BY ORDINAL_POSITION
    `;
    
    console.log('📊 Getting table structure...');
    const structureResult = await sql.query(structureQuery);
    
    if (structureResult.recordset.length === 0) {
      console.log('❌ Table [lkp].[BUDGET] not found or no columns');
      
      // Try to find tables with similar names
      console.log('\n🔍 Looking for similar table names...');
      const similarQuery = `
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME LIKE '%BUDGET%'
        OR TABLE_NAME LIKE '%budget%'
        ORDER BY TABLE_NAME
      `;
      
      const similarResult = await sql.query(similarQuery);
      console.log('📋 Similar tables found:');
      similarResult.recordset.forEach(table => {
        console.log(`  - [${table.TABLE_SCHEMA}].[${table.TABLE_NAME}]`);
      });
      
    } else {
      console.log('✅ Table structure found:');
      console.log('📋 Columns:');
      structureResult.recordset.forEach(column => {
        console.log(`  - ${column.COLUMN_NAME}: ${column.DATA_TYPE}${column.CHARACTER_MAXIMUM_LENGTH ? `(${column.CHARACTER_MAXIMUM_LENGTH})` : ''} ${column.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      // Get sample data
      console.log('\n📊 Getting sample data...');
      const sampleQuery = `SELECT TOP 5 * FROM [lkp].[BUDGET]`;
      const sampleResult = await sql.query(sampleQuery);
      
      console.log('✅ Sample data:');
      console.log(JSON.stringify(sampleResult.recordset, null, 2));
    }
    
    await sql.close();
    console.log('🔌 Disconnected from Azure Synapse');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run exploration
exploreBudgetTable().catch(console.error);


