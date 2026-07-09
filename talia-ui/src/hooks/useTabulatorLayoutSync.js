import { useEffect } from 'react';
import { scheduleTabulatorLayoutRefresh } from '../lib/tabulatorConfig';

/**
 * Re-apply the global Tabulator fit mode after data or visibility changes.
 * Tables created via initTabulator also auto-refresh on dataProcessed/dataLoaded.
 */
export const useTabulatorLayoutSync = (instanceRef, deps = []) => {
  useEffect(() => {
    const table = instanceRef?.current;
    if (!table) return undefined;
    scheduleTabulatorLayoutRefresh(table);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies explicit deps
  }, deps);
};

/** Call after replaceData (or similar) when not using the shared Tabulator wrapper hooks. */
export const afterTabulatorDataRefresh = (table, refreshPromise) => {
  const apply = () => scheduleTabulatorLayoutRefresh(table);
  if (refreshPromise && typeof refreshPromise.then === 'function') {
    refreshPromise.then(apply).catch(apply);
    return;
  }
  scheduleTabulatorLayoutRefresh(table);
};

export default useTabulatorLayoutSync;
