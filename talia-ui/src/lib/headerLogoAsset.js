/**
 * Bundled raster fallback (custom uploads / legacy). Default header uses
 * theme-colored `TaliaBrandMark` when no custom logo URL is set.
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
