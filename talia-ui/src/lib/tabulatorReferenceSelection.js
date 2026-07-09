/**
 * Shared Tabulator reference-selection styling helpers.
 *
 * Applies a persistent CSS class so canonical selections stay visible across
 * data refresh while Tabulator hover feedback remains on other rows.
 */

/** CSS class for persistent reference / active row highlight */
export const REFERENCE_ROW_CLASS = 'tabulator-row--reference';

/**
 * Compose multiple Tabulator rowFormatter callbacks into one.
 * @param {...Function} formatters
 * @returns {Function}
 */
export function chainRowFormatters(...formatters) {
  const fns = formatters.filter((fn) => typeof fn === 'function');
  return (row) => {
    fns.forEach((fn) => fn(row));
  };
}

/**
 * Create a rowFormatter that toggles the reference-selection class.
 * @param {(rowData: object) => boolean} isReferenceRow
 * @returns {Function}
 */
export function createReferenceRowFormatter(isReferenceRow) {
  return (row) => {
    const element = row.getElement();
    if (!element) return;
    const data = row.getData?.() || {};
    const isActive = typeof isReferenceRow === 'function' ? isReferenceRow(data) : false;
    element.classList.toggle(REFERENCE_ROW_CLASS, Boolean(isActive));
  };
}

const isGroupRow = (row) => {
  if (!row) return false;
  if (typeof row.getType === 'function') {
    return row.getType() === 'group';
  }
  const data = row.getData?.();
  return !data || typeof data !== 'object' || Object.keys(data).length === 0;
};

/**
 * Visit every rendered data row, including rows nested under group headers.
 * @param {import('tabulator-tables').TabulatorFull} table
 * @param {(row: object) => void} visit
 */
export function forEachTableRow(table, visit) {
  if (!table || typeof visit !== 'function') return;

  const walkRows = (rows) => {
    (rows || []).forEach((row) => {
      if (!row) return;
      if (isGroupRow(row)) {
        walkGroup(row);
        return;
      }
      visit(row);
    });
  };

  const walkGroup = (group) => {
    if (!group) return;
    walkRows(group.getRows?.() || []);
    (group.getSubGroups?.() || []).forEach(walkGroup);
  };

  const topGroups = table.getGroups?.();
  if (topGroups?.length) {
    topGroups.forEach(walkGroup);
    return;
  }

  walkRows(table.getRows?.() || []);
}

/**
 * Re-apply reference class on all rendered rows (e.g. after external selection change).
 * @param {import('tabulator-tables').TabulatorFull} table
 * @param {(rowData: object) => boolean} isReferenceRow
 */
export function refreshReferenceRowClasses(table, isReferenceRow) {
  if (!table || typeof isReferenceRow !== 'function') return;
  forEachTableRow(table, (row) => {
    const element = row.getElement?.();
    if (!element) return;
    const data = row.getData?.() || {};
    element.classList.toggle(REFERENCE_ROW_CLASS, Boolean(isReferenceRow(data)));
  });
}
