const GRAPHQL_ENDPOINT = '/api/graphql';

export const createTableActions = ({
  setReviewLoading,
  setReviewData,
  addClientLog,
  handleSync,
  logIdCounterRef,
  reviewLimit = 100
}) => {
  const logEvent = (payload) => {
    addClientLog({
      id: `${Date.now()}-${++logIdCounterRef.current}`,
      timestamp: new Date(),
      ...payload
    });
  };

  const handleReview = async (table) => {
    setReviewLoading(true);
    try {
      const query = `
        query GetTableData($tableName: String!, $limit: Int) {
          tableData(tableName: $tableName, limit: $limit)
        }
      `;

      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { tableName: table.tableName, limit: reviewLimit }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
      }

      const data = result.data?.tableData || [];
      setReviewData({ tableName: table.tableName, data });
      logEvent({
        type: 'info',
        message: `Loaded ${data.length} rows from ${table.tableName}`,
        tableName: table.tableName
      });
    } catch (err) {
      logEvent({
        type: 'error',
        message: `❌ Failed to load data for ${table.tableName}: ${err.message}`,
        tableName: table.tableName
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleIncrementalSync = (table) => handleSync(table.tableName, false);

  const handleFullSync = (table) => {
    logEvent({
      type: 'info',
      message: `⚡ Starting full refresh for "${table.tableName}" (will sync all data, not just changes)...`,
      tableName: table.tableName
    });
    handleSync(table.tableName, true);
  };

  return {
    handleReview,
    handleIncrementalSync,
    handleFullSync
  };
};
