/**
 * Browser tab identity for the UI instance (local / staging / mvp / …).
 * Keeps document.title + favicon aligned with Source in the status bar.
 */

const INSTANCE_COLORS = {
  local: '#3d9a6a',
  staging: '#d4a017',
  mvp: '#5b9bd5',
  production: '#c44a4a',
  unknown: '#8a8a9a',
};

const INSTANCE_LETTERS = {
  local: 'L',
  staging: 'S',
  mvp: 'M',
  production: 'P',
  unknown: '?',
};

export const normalizeInstanceLabel = (value) => {
  const s = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  return s || null;
};

export const resolveEnvInstanceLabel = () => {
  const raw =
    import.meta.env.VITE_ENVIRONMENT ||
    (import.meta.env.DEV ? 'local' : 'production');
  return normalizeInstanceLabel(raw) || 'local';
};

export const classifyInstanceLabel = (label) => {
  const key = normalizeInstanceLabel(label) || 'unknown';
  if (['local', 'staging', 'mvp', 'production'].includes(key)) return key;
  return 'unknown';
};

export const formatInstanceDocumentTitle = (label) => {
  const key = classifyInstanceLabel(label);
  const display = key === 'unknown' ? (normalizeInstanceLabel(label) || 'app') : key;
  return `Talia (${display})`;
};

const taliaInstanceManifestUrl = () => {
  if (typeof window === 'undefined') return null;
  const rawBase = import.meta.env.BASE_URL || '/';
  const lead = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const prefix = lead.endsWith('/') ? lead : `${lead}/`;
  const path = `${prefix}talia-instance.json`.replace(/([^:]\/)\/+/g, '$1');
  return new URL(path, window.location.origin).href;
};

/**
 * Prefer deploy-stamped talia-instance.json, else VITE_ENVIRONMENT / dev default.
 */
export async function resolveDeployInstanceLabel() {
  const fallback = resolveEnvInstanceLabel();
  const url = taliaInstanceManifestUrl();
  if (!url) return fallback;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    const data = await res.json();
    const fromManifest = normalizeInstanceLabel(data?.deployTarget);
    return fromManifest || fallback;
  } catch {
    return fallback;
  }
}

function buildInstanceFaviconDataUrl(label) {
  const key = classifyInstanceLabel(label);
  const fill = INSTANCE_COLORS[key] || INSTANCE_COLORS.unknown;
  const letter = INSTANCE_LETTERS[key] || INSTANCE_LETTERS.unknown;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#151528"/>
  <text x="11" y="23" text-anchor="middle" fill="#e8e8f0"
    font-family="system-ui,-apple-system,sans-serif" font-size="16" font-weight="700">T</text>
  <circle cx="23" cy="9" r="7.2" fill="${fill}"/>
  <text x="23" y="12.2" text-anchor="middle" fill="#0b0b12"
    font-family="system-ui,-apple-system,sans-serif" font-size="9.5" font-weight="800">${letter}</text>
</svg>`.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function ensureFaviconLink() {
  let link = document.querySelector("link[rel='icon'][data-talia-instance-icon='1']");
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('type', 'image/svg+xml');
    link.setAttribute('data-talia-instance-icon', '1');
    document.head.appendChild(link);
  }
  // Prefer our instance icon over the static vite.svg
  document.querySelectorAll("link[rel='icon']:not([data-talia-instance-icon])").forEach((el) => {
    el.remove();
  });
  return link;
}

/**
 * Apply title + favicon (+ html data attribute) for the given instance label.
 */
export function applyInstanceBrowserChrome(label) {
  if (typeof document === 'undefined') return classifyInstanceLabel(label);
  const key = classifyInstanceLabel(label);
  const title = formatInstanceDocumentTitle(label);
  document.title = title;
  document.documentElement.dataset.taliaInstance = key;
  try {
    const link = ensureFaviconLink();
    link.href = buildInstanceFaviconDataUrl(label);
  } catch {
    // Favicon is best-effort; title still helps.
  }
  return key;
}

/**
 * Resolve instance then paint browser chrome. Safe to call once at boot.
 * @returns {Promise<string>} classified instance key
 */
export async function applyInstanceBrowserIdentity() {
  const envLabel = resolveEnvInstanceLabel();
  applyInstanceBrowserChrome(envLabel);
  const resolved = await resolveDeployInstanceLabel();
  return applyInstanceBrowserChrome(resolved);
}
