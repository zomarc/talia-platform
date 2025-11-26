/**
 * Database compatibility stub
 * Provides a mock db interface for components that haven't been migrated to Supabase yet
 * This allows the UI to load even when database queries aren't available
 */

// Mock db object that provides useQuery hook
const db = {
  useQuery: (query) => {
    // Return empty/mock data structure
    return {
      isLoading: false,
      error: null,
      data: {
        // Return empty object matching the expected structure
        taliaUser: []
      }
    };
  }
};

export default db;



