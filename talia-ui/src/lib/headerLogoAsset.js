/**
 * Default Talia header logo — bundled by Vite so it resolves with any `base` path (unlike /public-only assets).
 */
import bundledDefaultLogo from '../assets/talia-default-logo.png?url';

export const DEFAULT_HEADER_LOGO_SRC = bundledDefaultLogo;

/** @deprecated Prefer DEFAULT_HEADER_LOGO_SRC */
export const DEFAULT_HEADER_LOGO_ASSET = 'talia-default-logo.png';

export function resolveAppPublicUrl(relativePath) {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const path = String(relativePath || '').replace(/^\//, '');
  return `${prefix}${path}`;
}
