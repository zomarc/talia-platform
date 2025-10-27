#!/usr/bin/env node

/**
 * Test Azure Synapse Connection Direct
 */

import dotenv from 'dotenv';
import { Connection, Request } from 'tedious';

// Load environment variables
dotenv.config();

// Azure Synapse configuration
const config = {
  server: process.env.AZURE_SYNAPSE_SERVER || 'celestyaldataplatform-prd.sql.azuresynapse.net',
  port: parseInt(process.env.AZURE_SYNAPSE_PORT) || 1433,
  database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
  userName: process.env.AZURE_SYNAPSE_USERNAME || 'RBryer',
  password: process.env.AZURE_SYNAPSE_PASSWORD || 'Cele5tyalrbUser!',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    rowCollectionOnRequestCompletion: true
  }
};

async function testAzureConnection() {
  console.log('🔍 Testing Azure Synapse connection...');
  console.log('Config:', JSON.stringify(config, null, 2));
  
  return new Promise((resolve, reject) => {
    const connection = new Connection(config);
    
    connection.on('connect', (err) => {
      if (err) {
        console.error('❌ Azure Synapse connection failed:', err);
        reject(err);
      } else {
        console.log('✅ Azure Synapse connection successful');
        
        // Test a simple query
        const request = new Request('SELECT 1 as test', (err, rowCount, rows) => {
          if (err) {
            console.error('❌ Query failed:', err);
            reject(err);
          } else {
            console.log('✅ Query successful');
            console.log('Rows:', rows);
            connection.close();
            resolve(true);
          }
        });
        
        connection.execSql(request);
      }
    });
    
    connection.on('error', (err) => {
      console.error('❌ Connection error:', err);
      reject(err);
    });
    
    connection.connect();
  });
}

// Run test
testAzureConnection().catch(console.error);


