#!/usr/bin/env node

/**
 * Save Azure data to CSV file
 */

import dotenv from 'dotenv';
import sql from 'mssql';
import fs from 'fs';

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

async function saveCabinAvailabilityToCSV() {
  console.log('🚀 Saving Azure cabin availability data to CSV...\n');
  
  try {
    // Connect to Azure
    console.log('🔗 Connecting to Azure Synapse...');
    await sql.connect(azureConfig);
    console.log('✅ Connected to Azure Synapse');
    
    // Query 2025 data
    const query = `
      SELECT TOP 1000 *
      FROM [dwh].[Dim_Cabin_Availability]
      WHERE YEAR([Snapshot_Date]) = 2025
      ORDER BY [Snapshot_Date] DESC
    `;
    
    console.log('📊 Querying Azure table: [dwh].[Dim_Cabin_Availability] for 2025 data');
    const result = await sql.query(query);
    console.log(`✅ Retrieved ${result.recordset.length} rows from Dim_Cabin_Availability`);
    
    // Convert to CSV
    const csvData = convertToCSV(result.recordset);
    
    // Save to file
    const filename = 'cabin_availability_2025.csv';
    fs.writeFileSync(filename, csvData);
    
    console.log(`📁 Saved data to ${filename}`);
    console.log(`📊 File size: ${(csvData.length / 1024).toFixed(2)} KB`);
    console.log(`📋 Rows: ${result.recordset.length}`);
    
    await sql.close();
    console.log('🔌 Disconnected from Azure Synapse');
    
    console.log('\n🎉 Data export completed successfully!');
    console.log(`📁 CSV file: ${filename}`);
    console.log('📋 You can now import this file into Supabase manually');
    
  } catch (error) {
    console.error('\n❌ Export failed:', error);
  }
}

function convertToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }
  
  // Get headers from first row
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Run export
saveCabinAvailabilityToCSV().catch(console.error);


