/**
 * Apply Views → Totals to a live Tabulator instance (ColumnCalcs API).
 *
 * Prefer the framework path: pass panelComponentId into getTabulatorOptions /
 * initTabulator so tabulatorConfig applies totals from component Options
 * automatically. Use this hook when a presenter needs an explicit bind
 * (e.g. tableBuilt epoch, tests, or panels without panelComponentId yet).
 */

import { useEffect } from 'react';
import { setTabulatorColumnTotalsVisible } from '../lib/tabulatorColumnTotals';

/**
 * @param {{ current: object|null }} instanceRef
 * @param {boolean} showTotals from useReportShellOptions
 * @param {unknown} [readyToken] bump when the table is (re)built so the effect re-runs
 */
export function useTabulatorColumnTotals(instanceRef, showTotals = true, readyToken = 0) {
  useEffect(() => {
    const table = instanceRef?.current;
    if (!table) return undefined;

    const apply = () => {
      setTabulatorColumnTotalsVisible(instanceRef.current, showTotals !== false);
    };

    apply();
    table.on?.('tableBuilt', apply);
    return () => {
      table.off?.('tableBuilt', apply);
    };
  }, [instanceRef, showTotals, readyToken]);
}

export default useTabulatorColumnTotals;
