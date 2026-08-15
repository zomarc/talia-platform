/**
 * Shared Tabulator column footer totals (native ColumnCalcs / bottomCalc).
 *
 * Totals recalculate from activeRows — panel filters that replaceData, plus
 * Tabulator header filters, are reflected automatically.
 *
 * Display precision follows semantic number kinds (see numberDisplay.js /
 * tabulatorColumnLabelDictionary). Pass params.precision to override.
 *
 * Visibility: use setTabulatorColumnTotalsVisible (Tabulator ColumnCalcs
 * removeCalcs / reinitializeCalcs + recalc). Prefer framework wiring in
 * tabulatorConfig (Views → Totals via component options) over CSS hides.
 *
 * @example
 * withColumnTotal({ field: 'res_id', title: 'Res ID' }, 'count')
 * withColumnTotal({ field: 'guest_count', ... }, 'sum')
 * withColumnTotal({ field: 'net_ticket_revenue_eur', ... }, 'sum')
 */

import { resolveGlobalTabulatorDisplayKind } from './tabulatorColumnLabelDictionary.js';
import {
  createNumberDisplayTotalFormatter,
  displayDecimalsForKind,
  formatDisplayNumber,
  isNumberDisplayKind,
} from './numberDisplay.js';

const INTEGER_KINDS = new Set(['count', 'unique']);
const NUMERIC_KINDS = new Set(['sum', 'avg', 'min', 'max']);
const SUPPORTED_KINDS = new Set([...INTEGER_KINDS, ...NUMERIC_KINDS]);

const defaultPrecisionForKind = (kind, displayKind = null) => {
  if (INTEGER_KINDS.has(kind)) return 0;
  if (isNumberDisplayKind(displayKind)) return displayDecimalsForKind(displayKind);
  if (kind === 'avg') return 2;
  return 2;
};

const formatIntegerTotal = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return Math.round(numeric).toLocaleString('en-US');
};

const formatNumericTotal = (value, precision) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const digits = Number.isFinite(precision) ? precision : 2;
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/**
 * Tabulator bottomCalcFormatter for integer-style totals (count / unique).
 * @param {import('tabulator-tables').CellComponent} cell
 */
export const formatColumnTotalInteger = (cell) => formatIntegerTotal(cell?.getValue?.());

/**
 * Tabulator bottomCalcFormatter for numeric totals (sum / avg / min / max).
 * Prefer displayKind in formatterParams when set by tabulatorConfig.
 * @param {import('tabulator-tables').CellComponent} cell
 * @param {{ precision?: number, displayKind?: string }} [formatterParams]
 */
export const formatColumnTotalNumber = (cell, formatterParams = {}) => {
  const displayKind = formatterParams?.displayKind;
  if (isNumberDisplayKind(displayKind)) {
    return formatDisplayNumber(cell?.getValue?.(), displayKind);
  }
  const precision = Number.isFinite(formatterParams?.precision)
    ? formatterParams.precision
    : 2;
  return formatNumericTotal(cell?.getValue?.(), precision);
};

/**
 * Merge native Tabulator bottomCalc options onto a column definition.
 *
 * @param {object} column - Tabulator column definition
 * @param {'count'|'sum'|'avg'|'min'|'max'|'unique'} kind
 * @param {{ precision?: number, displayKind?: string }} [params]
 * @returns {object}
 */
export const withColumnTotal = (column = {}, kind, params = {}) => {
  const calcKind = String(kind || '').trim().toLowerCase();
  if (!SUPPORTED_KINDS.has(calcKind)) {
    console.warn(`[withColumnTotal] Unsupported kind "${kind}" — expected one of: ${[...SUPPORTED_KINDS].join(', ')}`);
    return { ...column };
  }

  const displayKind = isNumberDisplayKind(params.displayKind)
    ? String(params.displayKind).trim().toLowerCase()
    : resolveGlobalTabulatorDisplayKind(column.field);

  const precision = Object.prototype.hasOwnProperty.call(params, 'precision')
    ? params.precision
    : defaultPrecisionForKind(calcKind, displayKind);

  const bottomCalcParams = INTEGER_KINDS.has(calcKind)
    ? undefined
    : { precision: precision === false ? false : precision };

  const isInteger = INTEGER_KINDS.has(calcKind);
  const useDisplayTotal = !isInteger && isNumberDisplayKind(displayKind);

  return {
    ...column,
    bottomCalc: calcKind,
    ...(bottomCalcParams ? { bottomCalcParams } : {}),
    bottomCalcFormatter: isInteger
      ? formatColumnTotalInteger
      : (useDisplayTotal ? createNumberDisplayTotalFormatter(displayKind) : formatColumnTotalNumber),
    bottomCalcFormatterParams: isInteger
      ? undefined
      : (useDisplayTotal
        ? { displayKind, precision: precision === false ? 0 : precision }
        : { precision: precision === false ? 2 : precision }),
  };
};

/**
 * Show/hide native Tabulator column-calc footer (and top calcs) immediately.
 * Uses ColumnCalcs.removeCalcs / reinitializeCalcs + recalc so rowManager
 * adjusts height (no blank gap). Safe no-op when the module/columns absent.
 *
 * @param {object|null|undefined} table Tabulator instance
 * @param {boolean} visible
 * @returns {boolean} true when applied
 */
export const setTabulatorColumnTotalsVisible = (table, visible = true) => {
  if (!table) return false;
  const show = visible !== false;

  try {
    if (typeof table.setOption === 'function') {
      table.setOption('columnCalcs', show);
    } else if (table.options && typeof table.options === 'object') {
      table.options.columnCalcs = show;
    }

    const calcs = table.modules?.columnCalcs;
    if (!calcs) return false;

    if (show) {
      calcs.reinitializeCalcs?.();
      if (typeof table.recalc === 'function') {
        table.recalc();
      } else if (typeof calcs.recalcActiveRows === 'function') {
        calcs.recalcActiveRows();
      } else if (typeof calcs.recalc === 'function') {
        calcs.recalc(table.rowManager?.activeRows || []);
      }
    } else {
      calcs.removeCalcs?.();
    }

    syncEmptyFooterChrome(table, show);
    table.rowManager?.adjustTableSize?.();
    return true;
  } catch (error) {
    console.warn('[setTabulatorColumnTotalsVisible]', error?.message || error);
    return false;
  }
};

/** Hide residual empty .tabulator-footer after calcs are removed (avoids blank strip). */
const syncEmptyFooterChrome = (table, show) => {
  const root = typeof table.getElement === 'function' ? table.getElement() : table.element;
  const footer = root?.querySelector?.('.tabulator-footer');
  if (!footer) return;

  if (show) {
    footer.style.removeProperty('display');
    return;
  }

  const hasCalcs = Boolean(footer.querySelector('.tabulator-calcs-holder'));
  const hasPager = Boolean(footer.querySelector('.tabulator-page, .tabulator-paginator, .tabulator-footer-contents .tabulator-page'));
  const contents = footer.querySelector('.tabulator-footer-contents');
  const contentsEmpty = !contents || contents.childElementCount === 0;
  if (!hasCalcs && !hasPager && contentsEmpty) {
    footer.style.display = 'none';
  }
};
