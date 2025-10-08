import { init } from '@instantdb/react';

// InstantDB configuration
const INSTANTDB_CONFIG = {
  appId: '1c2b040a-7bb2-4eb5-8490-ce5832e19dd0'
};

// Initialize InstantDB with your project ID
const db = init({
  appId: INSTANTDB_CONFIG.appId
});

// Simple validation without version checking
const validateInstantDBInit = () => {
  console.log('🔧 Initializing InstantDB...');
  console.log('📦 Project ID:', INSTANTDB_CONFIG.appId);
  
  if (!db) {
    console.error('❌ Failed to initialize InstantDB - db object is null');
    return false;
  }
  
  if (!db.auth) {
    console.error('❌ InstantDB auth not available');
    return false;
  }
  
  console.log('✅ InstantDB initialized successfully');
  console.log('🔐 Available methods:', Object.keys(db).filter(k => typeof db[k] === 'function'));
  
  return true;
};

// Simple validation on import
console.log('🔧 Starting InstantDB initialization...');
const isValid = validateInstantDBInit();
if (!isValid) {
  console.warn('⚠️ InstantDB validation failed, but continuing...');
}

export default db;
