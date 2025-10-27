#!/usr/bin/env node

/**
 * Test Azure Synapse Connection with explicit configuration
 */

import dotenv from 'dotenv';
import { Connection, Request } from 'tedious';

// Load environment variables
dotenv.config();

async function testAzureConnection() {
  console.log('🔍 Testing Azure Synapse connection...');
  
  // Explicit configuration
  const config = {
    server: 'celestyaldataplatform-prd.sql.azuresynapse.net',
    port: 1433,
    database: 'CDP_Dedicated_SQL_DWH',
    userName: 'RBryer',
    password: 'Cele5tyalrbUser!',
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
      rowCollectionOnRequestCompletion: true
    }
  };

  console.log('Config:', JSON.stringify(config, null, 2));

  return new Promise((resolve, reject) => {
    const connection = new Connection(config);
    
    connection.on('connect', (err) => {
      if (err) {
        console.error('❌ Connection failed:', err);
        reject(err);
      } else {
        console.log('✅ Connected successfully!');
        
        // Test a simple query
        const request = new Request('SELECT 1 as test', (err, rowCount, rows) => {
          if (err) {
            console.error('❌ Query failed:', err);
            reject(err);
          } else {
            console.log('✅ Query successful!');
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


