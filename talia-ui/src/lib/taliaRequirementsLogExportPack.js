/**
 * Requirements Log export JSON for selective instance portability.
 * Full board moves with pg_dump; this pack copies items without a full restore.
 * `createdBy` is scrubbed on import (instance-local auth user ids).
 */

export const REQUIREMENTS_LOG_EXPORT_ROOT_KEY = 'RequirementsLogExport';

export const REQUIREMENTS_LOG_EXPORT_VERSION = 1;

const SECTIONS = new Set(['deliverable', 'external', 'question']);
const STATUSES = new Set(['backlog', 'in_progress', 'done', 'cancelled']);
const PRIORITIES = new Set(['p0', 'p1', 'p2']);
const AREAS = new Set(['ui', 'data', 'engine', 'docs', 'ops']);
const SOURCES = new Set(['manual', 'plaud', 'cursor']);

const deepClone = (v) => {
  try {
    return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  } catch {
    return v;
  }
};

const normalizeOptional = (value) => {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
};

/**
 * @param {object} item — GraphQL RequirementItem row
 * @returns {object} serializable item (snake-ish keys avoided; camelCase matches GraphQL)
 */
export function scrubRequirementItemForExport(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    id: item.id != null ? String(item.id) : null,
    section: String(item.section || ''),
    title: String(item.title || ''),
    detail: normalizeOptional(item.detail),
    status: String(item.status || 'backlog'),
    priority: String(item.priority || 'p1'),
    area: normalizeOptional(item.area),
    targetVersion: normalizeOptional(item.targetVersion),
    taliaVersion: normalizeOptional(item.taliaVersion),
    owner: normalizeOptional(item.owner),
    source: String(item.source || 'manual'),
    sourceRef: normalizeOptional(item.sourceRef),
    createdAt: item.createdAt != null ? String(item.createdAt) : null,
    updatedAt: item.updatedAt != null ? String(item.updatedAt) : null,
    // Never ship instance user ids in packs
    createdBy: null,
  };
}

/**
 * @param {object[]} items
 * @returns {object} JSON-serializable root `{ RequirementsLogExport: … }`
 */
export function buildRequirementsLogExportPack(items) {
  const list = Array.isArray(items) ? items : [];
  const scrubbed = list.map(scrubRequirementItemForExport).filter(Boolean);
  return {
    [REQUIREMENTS_LOG_EXPORT_ROOT_KEY]: {
      version: REQUIREMENTS_LOG_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      items: scrubbed,
      notes:
        'createdBy is scrubbed. Import with merge-by-id (keep ids) or create-new (remap ids).',
    },
  };
}

/**
 * @param {string} text
 * @returns {unknown}
 */
export function parseRequirementsLogPackJsonFileText(text) {
  const s = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!s) {
    throw new Error('File is empty.');
  }
  return JSON.parse(s);
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, pack: object } | { ok: false, error: string }}
 */
export function parseRequirementsLogExportPack(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Not a JSON object.' };
  }
  const root = raw[REQUIREMENTS_LOG_EXPORT_ROOT_KEY];
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {
      ok: false,
      error: `Expected { "${REQUIREMENTS_LOG_EXPORT_ROOT_KEY}": { … } } (export from Requirements Log).`,
    };
  }
  const version = Number(root.version);
  if (!Number.isFinite(version) || version < 1) {
    return { ok: false, error: 'Missing or invalid pack version.' };
  }
  if (!Array.isArray(root.items)) {
    return { ok: false, error: 'Pack items must be an array.' };
  }
  return { ok: true, pack: root };
}

/**
 * Map pack items to GraphQL RequirementItemInput[].
 * @param {object} packRoot — parseRequirementsLogExportPack().pack
 * @param {{ mode?: 'mergeById' | 'createNew' }} [options]
 * @returns {object[]}
 */
export function buildRequirementInputsFromPack(packRoot, options = {}) {
  const mode = options.mode === 'createNew' ? 'createNew' : 'mergeById';
  const items = Array.isArray(packRoot?.items) ? packRoot.items : [];
  return items.map((item) => {
    const section = String(item?.section || '').trim();
    if (!SECTIONS.has(section)) {
      throw new Error(`Invalid section in pack item: ${section || '(empty)'}`);
    }
    const title = String(item?.title || '').trim();
    if (!title) throw new Error('Pack item missing title');

    const status = String(item?.status || 'backlog').trim();
    if (!STATUSES.has(status)) throw new Error(`Invalid status: ${status}`);

    const priority = String(item?.priority || 'p1').trim();
    if (!PRIORITIES.has(priority)) throw new Error(`Invalid priority: ${priority}`);

    const area = normalizeOptional(item?.area);
    if (area && !AREAS.has(area)) throw new Error(`Invalid area: ${area}`);

    const source = String(item?.source || 'manual').trim();
    if (!SOURCES.has(source)) throw new Error(`Invalid source: ${source}`);

    const input = {
      section,
      title,
      detail: normalizeOptional(item?.detail),
      status,
      priority,
      area,
      targetVersion: normalizeOptional(item?.targetVersion),
      taliaVersion: normalizeOptional(item?.taliaVersion),
      owner: normalizeOptional(item?.owner),
      source,
      sourceRef: normalizeOptional(item?.sourceRef),
    };

    if (mode === 'mergeById' && item?.id) {
      input.id = String(item.id);
    }
    // createNew: omit id so server allocates new UUIDs
    return input;
  });
}

/**
 * Download helper for browser.
 * @param {object} packRootObject — full `{ RequirementsLogExport: … }`
 * @param {string} [filename]
 */
export function downloadRequirementsLogPack(packRootObject, filename) {
  const blob = new Blob([JSON.stringify(packRootObject, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `requirements-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export { deepClone };
