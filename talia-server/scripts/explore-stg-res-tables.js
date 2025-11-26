#!/usr/bin/env node
/**
 * Script to explore stg.RES_* tables in Azure Synapse
 * This helps understand the structure before rebuilding the reservation integration
 */

import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const synapseConfig = {
  server: process.env.AZURE_SYNAPSE_SERVER || 'celestyal-synapse-workspace.sql.azuresynapse.net',
  database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
  user: process.env.AZURE_SYNAPSE_USERNAME || 'RBryer',
  password: process.env.AZURE_SYNAPSE_PASSWORD || 'Cele5tyalrbUser!',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function exploreStgResTables() {
  console.log('🔍 Exploring stg.RES_* tables in Azure Synapse...\n');

  try {
    const pool = await sql.connect(synapseConfig);
    console.log('✅ Connected to Azure Synapse\n');

    // Step 1: List all stg.RES_* tables
    console.log('📋 Step 1: Finding all stg.RES_* tables...');
    const tablesResult = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'stg' AND TABLE_NAME LIKE 'RES%'
      ORDER BY TABLE_NAME
    `);

    const tables = tablesResult.recordset;
    console.log(`Found ${tables.length} tables:\n`);
    tables.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
    });
    console.log('');

    if (tables.length === 0) {
      console.log('⚠️  No stg.RES_* tables found. Checking all stg tables...');
      const allStgResult = await pool.request().query(`
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'stg'
        ORDER BY TABLE_NAME
      `);
      console.log(`Found ${allStgResult.recordset.length} total stg tables`);
      allStgResult.recordset.slice(0, 20).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
      });
      if (allStgResult.recordset.length > 20) {
        console.log(`  ... and ${allStgResult.recordset.length - 20} more`);
      }
      await pool.close();
      return;
    }

    // Step 2: Get schema for each table
    console.log('\n📊 Step 2: Getting schema for each table...\n');
    for (const table of tables) {
      const tableName = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Table: ${tableName}`);
      console.log('='.repeat(80));

      // Get columns
      const columnsResult = await pool.request().query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE,
          IS_NULLABLE,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${table.TABLE_SCHEMA}' 
          AND TABLE_NAME = '${table.TABLE_NAME}'
        ORDER BY ORDINAL_POSITION
      `);

      console.log(`\nColumns (${columnsResult.recordset.length}):`);
      console.log('─'.repeat(80));
      columnsResult.recordset.forEach(col => {
        let type = col.DATA_TYPE;
        if (col.CHARACTER_MAXIMUM_LENGTH) {
          type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
        } else if (col.NUMERIC_PRECISION) {
          type += `(${col.NUMERIC_PRECISION}${col.NUMERIC_SCALE ? ',' + col.NUMERIC_SCALE : ''})`;
        }
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${col.COLUMN_NAME.padEnd(40)} ${type.padEnd(20)} ${nullable}`);
      });

      // Get row count
      try {
        const countResult = await pool.request().query(`
          SELECT COUNT(*) as row_count
          FROM ${tableName}
        `);
        console.log(`\nRow Count: ${countResult.recordset[0].row_count.toLocaleString()}`);
      } catch (err) {
        console.log(`\n⚠️  Could not get row count: ${err.message}`);
      }

      // Get sample data (first 5 rows)
      try {
        const sampleResult = await pool.request().query(`
          SELECT TOP 5 *
          FROM ${tableName}
        `);
        if (sampleResult.recordset.length > 0) {
          console.log(`\nSample Data (${sampleResult.recordset.length} rows):`);
          console.log('─'.repeat(80));
          const columns = Object.keys(sampleResult.recordset[0]);
          columns.slice(0, 10).forEach(col => {
            console.log(`  ${col}: ${sampleResult.recordset[0][col]}`);
          });
          if (columns.length > 10) {
            console.log(`  ... and ${columns.length - 10} more columns`);
          }
        }
      } catch (err) {
        console.log(`\n⚠️  Could not get sample data: ${err.message}`);
      }

      // Check for date columns
      const dateColumns = columnsResult.recordset.filter(col => 
        col.DATA_TYPE.includes('date') || col.DATA_TYPE.includes('time')
      );
      if (dateColumns.length > 0) {
        console.log(`\n📅 Date/Time Columns:`);
        dateColumns.forEach(col => {
          console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
      }

      // Check for ID columns
      const idColumns = columnsResult.recordset.filter(col => 
        col.COLUMN_NAME.toLowerCase().includes('id') || 
        col.COLUMN_NAME.toLowerCase().includes('_id')
      );
      if (idColumns.length > 0) {
        console.log(`\n🔑 ID Columns:`);
        idColumns.forEach(col => {
          console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
      }
    }

    // Step 3: Check for relationships/foreign keys
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('Step 3: Checking for relationships...');
    console.log('='.repeat(80));

    for (const table of tables) {
      const tableName = `${table.TABLE_SCHEMA}.${table.TABLE_NAME}`;
      try {
        const fkResult = await pool.request().query(`
          SELECT 
            fk.name AS ForeignKeyName,
            tp.name AS ParentTable,
            cp.name AS ParentColumn,
            tr.name AS ReferencedTable,
            cr.name AS ReferencedColumn
          FROM sys.foreign_keys AS fk
          INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
          INNER JOIN sys.tables AS tp ON fkc.parent_object_id = tp.object_id
          INNER JOIN sys.columns AS cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
          INNER JOIN sys.tables AS tr ON fkc.referenced_object_id = tr.object_id
          INNER JOIN sys.columns AS cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
          WHERE tp.schema_id = SCHEMA_ID('${table.TABLE_SCHEMA}')
            AND tp.name = '${table.TABLE_NAME}'
        `);

        if (fkResult.recordset.length > 0) {
          console.log(`\n${tableName}:`);
          fkResult.recordset.forEach(fk => {
            console.log(`  ${fk.ForeignKeyName}: ${fk.ParentColumn} -> ${fk.ReferencedTable}.${fk.ReferencedColumn}`);
          });
        }
      } catch (err) {
        // Ignore FK errors for now
      }
    }

    await pool.close();
    console.log('\n✅ Exploration complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the exploration
exploreStgResTables();


