/**
 * Shared Tabulator column footer totals (native ColumnCalcs / bottomCalc).
 *
 * Totals recalculate from activeRows — panel filters that replaceData, plus
 * Tabulator header filters, are reflected automatically.
 *
 * @example
 * withColumnTotal({ field: 'res_id', title: 'Res ID' }, 'count')
 * withColumnTotal({ field: 'guest_count', ... }, 'sum', { precision: 1 })
 * withColumnTotal({ field: 'net_ticket_revenue_eur', ... }, 'sum', { precision: 2 })
 */

const INTEGER_KINDS = new Set(['count', 'unique']);
const NUMERIC_KINDS = new Set(['sum', 'avg', 'min', 'max']);
const SUPPORTED_KINDS = new Set([...INTEGER_KINDS, ...NUMERIC_KINDS]);

const defaultPrecisionForKind = (kind) => {
  if (INTEGER_KINDS.has(kind)) return 0;
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
 * Precision comes from bottomCalcFormatterParams.precision.
 * @param {import('tabulator-tables').CellComponent} cell
 * @param {{ precision?: number }} [formatterParams]
 */
export const formatColumnTotalNumber = (cell, formatterParams = {}) => {
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
 * @param {{ precision?: number }} [params]
 * @returns {object}
 */
export const withColumnTotal = (column = {}, kind, params = {}) => {
  const calcKind = String(kind || '').trim().toLowerCase();
  if (!SUPPORTED_KINDS.has(calcKind)) {
    console.warn(`[withColumnTotal] Unsupported kind "${kind}" — expected one of: ${[...SUPPORTED_KINDS].join(', ')}`);
    return { ...column };
  }

  const precision = Object.prototype.hasOwnProperty.call(params, 'precision')
    ? params.precision
    : defaultPrecisionForKind(calcKind);

  const bottomCalcParams = INTEGER_KINDS.has(calcKind)
    ? undefined
    : { precision: precision === false ? false : precision };

  const isInteger = INTEGER_KINDS.has(calcKind);

  return {
    ...column,
    bottomCalc: calcKind,
    ...(bottomCalcParams ? { bottomCalcParams } : {}),
    bottomCalcFormatter: isInteger ? formatColumnTotalInteger : formatColumnTotalNumber,
    bottomCalcFormatterParams: isInteger ? undefined : { precision: precision === false ? 2 : precision },
  };
};
