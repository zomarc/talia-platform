import { useEffect } from 'react';
import {
  captureTableScroll,
  restoreTableScrollSoon,
  scheduleTabulatorLayoutRefresh,
} from '../lib/tabulatorConfig';

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

/**
 * Call after starting replaceData. Pass a scroll snapshot taken *before*
 * replaceData — Tabulator clears scrollTop synchronously during replace.
 *
 *   const scroll = captureTableScroll(table);
 *   afterTabulatorDataRefresh(table, table.replaceData(rows), scroll);
 */
export const afterTabulatorDataRefresh = (table, refreshPromise, scrollSnapshot = null) => {
  const snapshot = scrollSnapshot || captureTableScroll(table);
  const finish = () => {
    restoreTableScrollSoon(snapshot);
    scheduleTabulatorLayoutRefresh(table);
    restoreTableScrollSoon(snapshot);
  };
  if (refreshPromise && typeof refreshPromise.then === 'function') {
    refreshPromise.then(finish).catch(finish);
    return;
  }
  finish();
};

export default useTabulatorLayoutSync;
