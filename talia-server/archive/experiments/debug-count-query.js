import { synapseSyncService } from './src/lib/synapse-sync.js';

async function debugCountQuery() {
  console.log('🔍 Debugging count query generation...\n');
  
  const config = synapseSyncService.getTableConfig('reservations');
  console.log('📋 Original query:');
  console.log(config.query);
  console.log('\n');
  
  // Test the count query generation
  const countQuery = config.query.replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) as total FROM');
  
  console.log('\n📋 Generated count query:');
  console.log(countQuery);
}

debugCountQuery();
