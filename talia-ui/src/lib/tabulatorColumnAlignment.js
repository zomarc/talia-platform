const HEADER_ALIGN_VALUES = new Set(['left', 'center', 'right']);

/**
 * Tabulator aligns cell content via hozAlign but headers use headerHozAlign,
 * which defaults to left when unset. Mirror hozAlign onto headerHozAlign so
 * header labels line up with their column data.
 */
export const normalizeColumnHeaderAlignment = (columns = []) => {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    if (!column || typeof column !== 'object') return column;
    const next = { ...column };
    if (
      next.headerHozAlign == null &&
      HEADER_ALIGN_VALUES.has(next.hozAlign)
    ) {
      next.headerHozAlign = next.hozAlign;
    }
    if (Array.isArray(next.columns)) {
      next.columns = normalizeColumnHeaderAlignment(next.columns);
    }
    return next;
  });
};
