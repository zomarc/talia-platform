#!/usr/bin/env node

/**
 * List all available tables in Azure Synapse
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

async function listAllTables() {
  console.log('🔍 Listing all available tables in Azure Synapse...\n');
  
  try {
    console.log('🔗 Connecting to Azure Synapse...');
    await sql.connect(azureConfig);
    console.log('✅ Connected to Azure Synapse');
    
    // Get all tables with their schemas
    const query = `
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `;
    
    console.log('📊 Querying table information...');
    const result = await sql.query(query);
    
    if (result.recordset.length === 0) {
      console.log('❌ No tables found');
      return;
    }
    
    console.log(`✅ Found ${result.recordset.length} tables:\n`);
    
    // Group tables by schema
    const tablesBySchema = {};
    result.recordset.forEach(table => {
      if (!tablesBySchema[table.TABLE_SCHEMA]) {
        tablesBySchema[table.TABLE_SCHEMA] = [];
      }
      tablesBySchema[table.TABLE_SCHEMA].push(table.TABLE_NAME);
    });
    
    // Display tables grouped by schema
    Object.keys(tablesBySchema).sort().forEach(schema => {
      console.log(`📋 Schema: ${schema}`);
      tablesBySchema[schema].forEach(tableName => {
        console.log(`  - ${tableName}`);
      });
      console.log('');
    });
    
    // Show some sample tables that might be relevant
    console.log('🎯 Potentially relevant tables for migration:');
    const relevantTables = result.recordset.filter(table => 
      table.TABLE_NAME.toLowerCase().includes('budget') ||
      table.TABLE_NAME.toLowerCase().includes('rate') ||
      table.TABLE_NAME.toLowerCase().includes('cabin') ||
      table.TABLE_NAME.toLowerCase().includes('sail') ||
      table.TABLE_NAME.toLowerCase().includes('voyage') ||
      table.TABLE_NAME.toLowerCase().includes('revenue') ||
      table.TABLE_NAME.toLowerCase().includes('passenger')
    );
    
    relevantTables.forEach(table => {
      console.log(`  - [${table.TABLE_SCHEMA}].[${table.TABLE_NAME}]`);
    });
    
    await sql.close();
    console.log('\n🔌 Disconnected from Azure Synapse');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the listing
listAllTables().catch(console.error);


