export const createTableActions = ({
  setReviewLoading,
  setReviewData,
  addClientLog,
  handleSync,
  handleStopSync,
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
    setReviewLoading(false);
    setReviewData({
      tableName: table.tableName,
      data: [],
      limit: reviewLimit,
      filters: {},
    });
    logEvent({
      type: 'info',
      message: `Opening review for ${table.tableName} (top ${reviewLimit})`,
      tableName: table.tableName
    });
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

  const handleStop = (table) => {
    logEvent({
      type: 'warning',
      message: `⏹ Stopping sync for "${table.tableName}"...`,
      tableName: table.tableName
    });
    handleStopSync?.(table.tableName);
  };

  return {
    handleReview,
    handleIncrementalSync,
    handleFullSync,
    handleStop,
  };
};
