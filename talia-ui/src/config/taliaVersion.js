/**
 * Canonical Talia **application** semver (not npm dependency versions).
 * Source: talia-ui/package.json → vite define import.meta.env.VITE_APP_VERSION.
 * Ops/validate read the same value from index.html meta and /talia-app-version.json (build emits both).
 */

const SEMVER = /^\d+\.\d+\.\d+$/

export function getTaliaReleaseVersion() {
  const v = import.meta.env.VITE_APP_VERSION
  if (typeof v === 'string' && SEMVER.test(v.trim())) {
    return v.trim()
  }
  return '0.0.0'
}

/** Shown in chrome (e.g. ModeSelector): plain semver for production bundles; "-dev" only on the Vite dev server. */
export function getTaliaVersionDisplayLabel() {
  const base = getTaliaReleaseVersion()
  if (import.meta.env.DEV) {
    return `${base}-dev`
  }
  return base
}
