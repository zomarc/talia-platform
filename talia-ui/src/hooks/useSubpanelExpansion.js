import { useCallback, useState } from 'react';

export const useSubpanelExpansion = (initialKey = null) => {
  const [expandedKey, setExpandedKey] = useState(initialKey);

  const toggleExpandedKey = useCallback((key) => {
    setExpandedKey((previous) => (previous === key ? null : key));
  }, []);

  const clearExpandedKey = useCallback(() => setExpandedKey(null), []);
  const isExpanded = useCallback((key) => expandedKey === key, [expandedKey]);

  return {
    expandedKey,
    setExpandedKey,
    toggleExpandedKey,
    clearExpandedKey,
    isExpanded,
  };
};

export default useSubpanelExpansion;
