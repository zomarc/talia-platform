/**
 * Shared external-source availability (YES/NO).
 *
 * Probes configured data sources periodically with a hard abort timeout.
 * Panels must not invent their own reachability logic — ask this service
 * before refreshing. If unavailable (or not yet proven available), skip.
 */

import {
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_FAIL_FAST_MS,
  DIRECT_B2B_SOURCE_NAMES,
} from '../lib/directB2bFailFast';

const DATA_SOURCES_QUERY = `
  query ExternalSourceAvailabilityCatalog {
    dataSources {
      sourceName
      displayName
      connectionConfig
    }
  }
`;

const LIGHT_PROBE_QUERY = 'query { __typename }';
const PROBE_INTERVAL_MS = 60_000;
const CATALOG_REFRESH_MS = 5 * 60_000;

const READ_SOURCE_ALIASES = ['celestyal_b2b_api_read', 'celestyal_b2b_api'];
const WRITE_SOURCE_ALIASES = ['celestyal_b2b_api_write', 'celestyal_b2b_api'];

const createStatus = (overrides = {}) => ({
  sourceName: null,
  endpoint: null,
  checked: false,
  available: false,
  detail: 'Status pending.',
  lastChecked: null,
  ...overrides,
});

class ExternalSourceAvailabilityService {
  constructor() {
    this.statuses = new Map();
    this.listeners = new Set();
    this.started = false;
    this.probeTimer = null;
    this.catalogTimer = null;
    this.inFlight = false;
  }

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    // Until the first probe finishes, treat as unavailable so panels never hang.
    READ_SOURCE_ALIASES.forEach((name) => {
      if (!this.statuses.has(name)) {
        this.statuses.set(name, createStatus({
          sourceName: name,
          endpoint: DIRECT_B2B_DEFAULT_ENDPOINT,
          detail: 'Waiting for source probe…',
        }));
      }
    });
    this.notify();
    this.refreshCatalogAndProbe();
    this.probeTimer = window.setInterval(() => {
      this.probeAll().catch(() => {});
    }, PROBE_INTERVAL_MS);
    this.catalogTimer = window.setInterval(() => {
      this.refreshCatalogAndProbe().catch(() => {});
    }, CATALOG_REFRESH_MS);
  }

  stop() {
    if (this.probeTimer) window.clearInterval(this.probeTimer);
    if (this.catalogTimer) window.clearInterval(this.catalogTimer);
    this.probeTimer = null;
    this.catalogTimer = null;
    this.started = false;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    try {
      listener(this.getSnapshot());
    } catch {
      // ignore subscriber errors
    }
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return Object.fromEntries(
      Array.from(this.statuses.entries()).map(([key, value]) => [key, { ...value }])
    );
  }

  getStatus(sourceName) {
    const key = String(sourceName || '').trim();
    if (!key) return createStatus({ detail: 'No source name.' });
    return { ...(this.statuses.get(key) || createStatus({ sourceName: key })) };
  }

  /**
   * Resolve the first matching configured source from an alias list.
   */
  resolveSourceName(aliases = DIRECT_B2B_SOURCE_NAMES) {
    const list = Array.isArray(aliases) ? aliases : [aliases];
    for (const name of list) {
      const status = this.statuses.get(name);
      if (status?.endpoint) return name;
    }
    return list.find(Boolean) || null;
  }

  /**
   * YES only when a completed probe said the endpoint is reachable.
   * Pending / failed / unknown → NO (do not refresh).
   */
  isAvailable(sourceNameOrAliases) {
    const aliases = Array.isArray(sourceNameOrAliases)
      ? sourceNameOrAliases
      : [sourceNameOrAliases];
    const resolved = this.resolveSourceName(aliases) || aliases[0];
    const status = this.getStatus(resolved);
    return status.checked === true && status.available === true;
  }

  getUnavailableMessage(sourceNameOrAliases) {
    const aliases = Array.isArray(sourceNameOrAliases)
      ? sourceNameOrAliases
      : [sourceNameOrAliases];
    const resolved = this.resolveSourceName(aliases) || aliases[0];
    const status = this.getStatus(resolved);
    if (!status.checked) return 'External source not probed yet — refresh skipped.';
    return status.detail || 'External source unavailable — refresh skipped.';
  }

  reportSuccess(sourceName, detail = 'Reachable.') {
    this.#setStatus(sourceName, {
      checked: true,
      available: true,
      detail,
      lastChecked: new Date().toISOString(),
    });
  }

  reportFailure(sourceName, detail = 'Unreachable.') {
    this.#setStatus(sourceName, {
      checked: true,
      available: false,
      detail,
      lastChecked: new Date().toISOString(),
    });
  }

  async refreshNow() {
    this.start();
    await this.refreshCatalogAndProbe();
    return this.getSnapshot();
  }

  async refreshCatalogAndProbe() {
    await this.#loadCatalog();
    await this.probeAll();
  }

  async probeAll() {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const entries = Array.from(this.statuses.entries()).filter(([, status]) => status.endpoint);
      await Promise.all(entries.map(([name, status]) => this.#probeSource(name, status.endpoint)));
    } finally {
      this.inFlight = false;
    }
  }

  async #loadCatalog() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIRECT_B2B_FAIL_FAST_MS);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: DATA_SOURCES_QUERY }),
        signal: controller.signal,
      });
      const payload = await response.json();
      const sources = payload?.data?.dataSources || [];
      const pick = (aliases, fallbackEndpoint) => {
        const match = aliases
          .map((name) => sources.find((source) => source.sourceName === name))
          .find(Boolean);
        const endpoint = match?.connectionConfig?.endpoint || fallbackEndpoint;
        const sourceName = match?.sourceName || aliases[0];
        const prev = this.statuses.get(sourceName) || createStatus({ sourceName });
        this.statuses.set(sourceName, {
          ...prev,
          sourceName,
          endpoint,
        });
        // Mirror aliases so either name resolves.
        aliases.forEach((alias) => {
          if (alias === sourceName) return;
          const aliasPrev = this.statuses.get(alias) || createStatus({ sourceName: alias });
          this.statuses.set(alias, {
            ...aliasPrev,
            sourceName: alias,
            endpoint,
            checked: prev.checked,
            available: prev.available,
            detail: prev.detail,
            lastChecked: prev.lastChecked,
          });
        });
      };
      pick(READ_SOURCE_ALIASES, DIRECT_B2B_DEFAULT_ENDPOINT);
      pick(WRITE_SOURCE_ALIASES, DIRECT_B2B_DEFAULT_ENDPOINT);
      this.notify();
    } catch (error) {
      const detail = `Catalog load failed: ${error?.message || error}`;
      READ_SOURCE_ALIASES.forEach((name) => {
        const prev = this.statuses.get(name) || createStatus({ sourceName: name });
        this.statuses.set(name, {
          ...prev,
          endpoint: prev.endpoint || DIRECT_B2B_DEFAULT_ENDPOINT,
          checked: true,
          available: false,
          detail,
          lastChecked: new Date().toISOString(),
        });
      });
      this.notify();
    } finally {
      clearTimeout(timer);
    }
  }

  async #probeSource(sourceName, endpoint) {
    if (!endpoint) {
      this.reportFailure(sourceName, 'Endpoint not set.');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIRECT_B2B_FAIL_FAST_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: LIGHT_PROBE_QUERY }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json?.errors?.length) throw new Error(json.errors[0].message);
      this.#setStatus(sourceName, {
        endpoint,
        checked: true,
        available: true,
        detail: 'Probe OK.',
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError' || controller.signal.aborted;
      this.#setStatus(sourceName, {
        endpoint,
        checked: true,
        available: false,
        detail: timedOut
          ? `Probe timed out after ${DIRECT_B2B_FAIL_FAST_MS}ms`
          : (error?.message || 'Probe failed.'),
        lastChecked: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  #setStatus(sourceName, patch) {
    const key = String(sourceName || '').trim();
    if (!key) return;
    const prev = this.statuses.get(key) || createStatus({ sourceName: key });
    this.statuses.set(key, { ...prev, sourceName: key, ...patch });
    // Keep read aliases in sync when primary read status changes.
    if (READ_SOURCE_ALIASES.includes(key)) {
      READ_SOURCE_ALIASES.forEach((alias) => {
        if (alias === key) return;
        const aliasPrev = this.statuses.get(alias) || createStatus({ sourceName: alias });
        this.statuses.set(alias, {
          ...aliasPrev,
          sourceName: alias,
          endpoint: patch.endpoint ?? aliasPrev.endpoint ?? prev.endpoint,
          checked: patch.checked ?? aliasPrev.checked,
          available: patch.available ?? aliasPrev.available,
          detail: patch.detail ?? aliasPrev.detail,
          lastChecked: patch.lastChecked ?? aliasPrev.lastChecked,
        });
      });
    }
    this.notify();
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // ignore
      }
    });
  }
}

const externalSourceAvailability = new ExternalSourceAvailabilityService();

export const initExternalSourceAvailability = () => {
  externalSourceAvailability.start();
  return externalSourceAvailability;
};

export const getExternalSourceAvailability = () => externalSourceAvailability;

export {
  READ_SOURCE_ALIASES as EXTERNAL_B2B_READ_ALIASES,
  WRITE_SOURCE_ALIASES as EXTERNAL_B2B_WRITE_ALIASES,
};

export default externalSourceAvailability;
