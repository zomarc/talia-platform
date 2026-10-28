/**
 * Functionality Matrix — pure grouping, reference codes, and JSON export.
 * Distinct from the Requirements Log pack.
 */

export const MATRIX_PHASES = ['0', 'mvp', '1', '2', '3'];
export const MATRIX_RANKS = ['L', 'M', 'H'];

export const MATRIX_PHASE_LABELS = {
  0: 'Dev',
  mvp: 'MVP',
  1: '1',
  2: '2',
  3: '3',
};

export const FUNCTIONALITY_MATRIX_EXPORT_ROOT_KEY = 'FunctionalityMatrixExport';
export const FUNCTIONALITY_MATRIX_EXPORT_VERSION = 1;

const normalizeOptional = (value) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

export const phaseLabel = (phase) => MATRIX_PHASE_LABELS[String(phase || '')] || String(phase || '');

export const rankPair = (item) => `${item?.complexity || '–'}/${item?.size || item?.sizeRank || '–'}`;

/**
 * Next R### code from existing references. Non-R codes are ignored.
 * @param {Array<{ referenceCode?: string }>} items
 */
export function nextReferenceCode(items) {
  let max = 0;
  (items || []).forEach((item) => {
    const match = /^R(\d+)$/i.exec(String(item?.referenceCode || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `R${String(max + 1).padStart(3, '0')}`;
}

/**
 * Rows for the compact grid: one row per element, cells in sort then reference order.
 * @param {object[]} items
 */
export function groupMatrixRows(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    const element = String(item?.element || '').trim() || 'Unassigned';
    if (!map.has(element)) map.set(element, []);
    map.get(element).push(item);
  });

  const rows = [...map.entries()].map(([element, rowItems]) => {
    const sorted = [...rowItems].sort((a, b) => {
      const order = (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0);
      if (order !== 0) return order;
      return String(a?.referenceCode || '').localeCompare(String(b?.referenceCode || ''), undefined, { numeric: true });
    });
    const minSort = sorted.reduce(
      (min, item) => Math.min(min, Number(item?.sortOrder) || 0),
      Number.POSITIVE_INFINITY,
    );
    return { element, items: sorted, minSort };
  });

  rows.sort((a, b) => a.minSort - b.minSort || a.element.localeCompare(b.element));
  return rows;
}

const scrubNote = (note) => ({
  body: String(note?.body || ''),
  createdAt: note?.createdAt != null ? String(note.createdAt) : null,
});

const scrubAssignment = (link) => ({
  id: link?.requirementItemId != null ? String(link.requirementItemId) : null,
  title: normalizeOptional(link?.title),
  section: normalizeOptional(link?.section),
  status: normalizeOptional(link?.status),
});

/**
 * One requirement, or a list, as a portable JSON document.
 * createdBy is omitted — it is an instance user id.
 * @param {object|object[]} items
 */
export function buildFunctionalityMatrixExport(items) {
  const list = Array.isArray(items) ? items : (items ? [items] : []);
  return {
    [FUNCTIONALITY_MATRIX_EXPORT_ROOT_KEY]: {
      version: FUNCTIONALITY_MATRIX_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      items: list.filter(Boolean).map((item) => ({
        referenceCode: String(item.referenceCode || ''),
        element: String(item.element || ''),
        function: String(item.functionName || ''),
        shortName: String(item.shortName || ''),
        name: String(item.name || ''),
        concept: normalizeOptional(item.concept),
        rationale: normalizeOptional(item.rationale),
        technicalRequirement: normalizeOptional(item.technicalRequirement),
        complexity: String(item.complexity || 'M'),
        size: String(item.size || 'M'),
        phase: String(item.phase || '0'),
        sortOrder: Number(item.sortOrder) || 0,
        notes: (item.notes || []).map(scrubNote),
        assignedRequirements: (item.links || []).map(scrubAssignment),
      })),
    },
  };
}

export function downloadFunctionalityMatrixExport(pack, filename) {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || `functionality-matrix-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
