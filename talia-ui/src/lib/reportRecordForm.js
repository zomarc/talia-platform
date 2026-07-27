/**
 * Shared helpers for single-row vertical record forms driven by Tabulator column defs.
 * Prefer titleLong → dictionary long → title → titleShort → field for labels.
 */

import { resolveGlobalTabulatorLabel } from './tabulatorColumnLabelDictionary.js';

export const shouldShowReportRecordForm = (data) => (
  Array.isArray(data) && data.length === 1 && data[0] != null && typeof data[0] === 'object'
);

export const resolveReportRecordLabel = (column = {}) => {
  if (column.titleLong) return String(column.titleLong);
  const mapped = resolveGlobalTabulatorLabel({
    field: column.field,
    title: column.title || column.titleShort,
  });
  if (mapped?.long) return mapped.long;
  if (column.title) return String(column.title);
  if (column.titleShort) return String(column.titleShort);
  if (column.field) return String(column.field);
  return 'Field';
};

const isHtmlString = (value) => (
  typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)
);

/** Minimal Tabulator cell shim so column formatters can run outside Tabulator. */
export const createReportRecordCellShim = (column, row) => {
  const field = column?.field;
  const value = field ? row?.[field] : undefined;
  const element = typeof document !== 'undefined' ? document.createElement('div') : null;
  return {
    getValue: () => value,
    getField: () => field,
    getData: () => row,
    getElement: () => element,
    getColumn: () => ({
      getField: () => field,
      getDefinition: () => column,
    }),
    getRow: () => ({
      getData: () => row,
      getElement: () => element,
    }),
    getTable: () => null,
  };
};

export const isReportRecordColumn = (column) => {
  if (!column || typeof column !== 'object') return false;
  if (column.visible === false) return false;
  if (column.excludeFromRecordForm === true) return false;
  if (column.formatter === 'rowSelection') return false;
  if (column.rowHandle) return false;
  // Need a field and/or a formatter to display something meaningful.
  if (!column.field && typeof column.formatter !== 'function') return false;
  return true;
};

export const formatReportRecordValue = (column, row) => {
  if (typeof column?.formatter === 'function') {
    try {
      const formatted = column.formatter(createReportRecordCellShim(column, row), column.formatterParams);
      if (formatted == null || formatted === '') {
        return { text: null, html: null, empty: true };
      }
      if (typeof formatted === 'string') {
        if (isHtmlString(formatted)) {
          return { text: null, html: formatted, empty: false };
        }
        return { text: formatted, html: null, empty: false };
      }
      if (typeof formatted === 'number' || typeof formatted === 'boolean') {
        return { text: String(formatted), html: null, empty: false };
      }
      // DOM nodes / React elements from formatters are uncommon; fall back to raw field.
    } catch {
      // Fall through to raw field value.
    }
  }

  const raw = column?.field ? row?.[column.field] : null;
  if (raw == null || raw === '') {
    return { text: null, html: null, empty: true };
  }
  return { text: String(raw), html: null, empty: false };
};

export const buildReportRecordFields = (columns, row) => {
  if (!row || !Array.isArray(columns)) return [];
  return columns
    .filter(isReportRecordColumn)
    .map((column, index) => {
      const value = formatReportRecordValue(column, row);
      return {
        key: column.field || `col-${index}`,
        label: resolveReportRecordLabel(column),
        field: column.field || null,
        ...value,
      };
    });
};
