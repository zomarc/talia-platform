#!/usr/bin/env node

/**
 * Test Azure Synapse Connection with connection string format
 */

import dotenv from 'dotenv';
import { Connection, Request } from 'tedious';

// Load environment variables
dotenv.config();

async function testAzureConnectionString() {
  console.log('🔍 Testing Azure Synapse connection with connection string...');
  
  // Try connection string format
  const connectionString = `Server=celestyaldataplatform-prd.sql.azuresynapse.net,1433;Database=CDP_Dedicated_SQL_DWH;User Id=RBryer;Password=Cele5tyalrbUser!;Encrypt=true;TrustServerCertificate=false;`;
  
  console.log('Connection String:', connectionString);

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
      rowCollectionOnRequestCompletion: true,
      // Try different authentication options
      authentication: {
        type: 'default',
        options: {
          userName: 'RBryer',
          password: 'Cele5tyalrbUser!'
        }
      }
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
testAzureConnectionString().catch(console.error);


