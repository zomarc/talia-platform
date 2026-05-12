/**
 * Focus export JSON for Admin → Focus Access (portable per instance).
 * `assignedUserId` in packs is a Talia user id meaningful only on the instance that produced the pack;
 * import defaults to clearing it for USER-type focuses unless opted in.
 */

export const FOCUS_EXPORT_ROOT_KEY = 'FocusExport';

export const FOCUS_EXPORT_VERSION = 1;

const deepClone = (v) => {
  try {
    return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  } catch {
    return v;
  }
};

/** Strip GraphQL transport-only layout from components (layout lives under layoutData.dockviewLayout). */
const scrubComponentsForExport = (components) => {
  if (!Array.isArray(components)) return [];
  return components.map((comp) => {
    if (!comp || typeof comp !== 'object') return comp;
    const next = deepClone(comp);
    if (next.settings && typeof next.settings === 'object' && '_dockviewLayout' in next.settings) {
      delete next.settings._dockviewLayout;
      if (Object.keys(next.settings).length === 0) {
        next.settings = null;
      }
    }
    return next;
  });
};

/**
 * @param {object} focus — row as returned from GraphQL / focus list
 * @returns {object} JSON-serializable root `{ [FOCUS_EXPORT_ROOT_KEY]: … }`
 */
export function buildFocusExportPack(focus) {
  if (!focus || typeof focus !== 'object') {
    throw new Error('Focus export requires a focus object');
  }
  const layoutIn =
    focus.layoutData && typeof focus.layoutData === 'object'
      ? deepClone(focus.layoutData)
      : { components: Array.isArray(focus.components) ? deepClone(focus.components) : [] };
  const components = scrubComponentsForExport(layoutIn.components || []);
  const layoutData = {
    ...layoutIn,
    components
  };

  return {
    [FOCUS_EXPORT_ROOT_KEY]: {
      version: FOCUS_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      focus: {
        name: String(focus.name || '').trim() || 'Untitled focus',
        description: focus.description != null ? String(focus.description) : '',
        type: String(focus.type || 'STANDARD').toUpperCase(),
        role: String(focus.role || focus.assignedRoles?.[0] || 'USER').toUpperCase(),
        assignedRoles: Array.isArray(focus.assignedRoles)
          ? focus.assignedRoles.map((r) => String(r).toUpperCase())
          : [],
        assignedUserId: focus.assignedUserId != null ? String(focus.assignedUserId) : null,
        isPublic: Boolean(focus.isPublic ?? focus.isStandard),
        layoutData
      },
      notes:
        'assignedUserId is the Talia user id on the source instance. On import, clear or remap for USER focuses.'
    }
  };
}

/**
 * @param {string} text
 * @returns {unknown}
 */
export function parseFocusPackJsonFileText(text) {
  const s = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!s) {
    throw new Error('File is empty.');
  }
  return JSON.parse(s);
}

/**
 * @param {unknown} raw — parsed JSON root object
 * @returns {{ ok: true, pack: object, importMode: 'createNew' } | { ok: false, error: string }}
 */
export function parseFocusExportPack(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Not a JSON object.' };
  }
  const root = raw[FOCUS_EXPORT_ROOT_KEY];
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {
      ok: false,
      error: `Expected { "${FOCUS_EXPORT_ROOT_KEY}": { … } } (export from Admin → Focus Access).`
    };
  }
  const version = Number(root.version);
  if (!Number.isFinite(version) || version < 1) {
    return { ok: false, error: 'Missing or invalid pack version.' };
  }
  const focus = root.focus;
  if (!focus || typeof focus !== 'object' || Array.isArray(focus)) {
    return { ok: false, error: 'Missing focus object in pack.' };
  }
  if (typeof focus.name !== 'string' || focus.name.trim() === '') {
    return { ok: false, error: 'Focus pack must include a non-empty name.' };
  }
  // v1: always create a new focus row. Reserved for future merge/replace-by-id modes.
  const importMode = 'createNew';
  return { ok: true, pack: root, importMode };
}

/**
 * Build payload for {@link graphQLFocusService.createFocus}.
 * @param {object} packRoot — `parseFocusExportPack` root (`raw.FocusExport`)
 * @param {{ name?: string, clearAssignedUserId?: boolean }} [options]
 */
export function buildCreateFocusPayloadFromPack(packRoot, options = {}) {
  const focus = packRoot?.focus;
  if (!focus || typeof focus !== 'object') {
    throw new Error('Invalid focus pack');
  }
  const nameOpt = typeof options.name === 'string' ? options.name.trim() : '';
  const name = nameOpt || String(focus.name || '').trim();
  if (!name) {
    throw new Error('Import name is required');
  }
  const clearAssignedUserId = options.clearAssignedUserId !== false;
  const type = String(focus.type || 'STANDARD').toUpperCase();
  const role = String(focus.role || focus.assignedRoles?.[0] || 'USER').toUpperCase();
  const assignedRoles = Array.isArray(focus.assignedRoles)
    ? focus.assignedRoles.map((r) => String(r).toUpperCase())
    : type === 'STANDARD'
      ? ['GUEST', 'USER', 'MANAGER', 'ADMIN']
      : [role];
  let assignedUserId = focus.assignedUserId != null ? String(focus.assignedUserId) : null;
  if (type === 'USER' && clearAssignedUserId) {
    assignedUserId = null;
  }
  const layoutData =
    focus.layoutData && typeof focus.layoutData === 'object'
      ? deepClone(focus.layoutData)
      : { components: Array.isArray(focus.components) ? deepClone(focus.components) : [] };

  return {
    name,
    description: focus.description != null ? String(focus.description) : '',
    type,
    role,
    assignedRoles,
    assignedUserId,
    components: Array.isArray(layoutData.components) ? layoutData.components : [],
    layoutData,
    isPublic: Boolean(focus.isPublic)
  };
}
