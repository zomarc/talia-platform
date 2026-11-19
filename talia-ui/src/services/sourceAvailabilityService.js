/**
 * Framework-level source availability (YES/NO).
 *
 * Owns the full source catalog and periodic fail-fast probes.
 * Refresh paths (useTableDataWithContext, trackedFetchGraphql) must ask
 * canRefresh() before fetching. Panels stay simple: declare requiredSources
 * (or accept the default talia_graphql) and render the framework error.
 *
 * Policy:
 * - internal (talia_graphql): optimistic — allow until proven down
 * - external (B2B, etc.): strict — allow only after a successful probe
 */

import {
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_FAIL_FAST_MS,
} from '../lib/directB2bFailFast';

export const SOURCE_IDS = Object.freeze({
  TALIA_GRAPHQL: 'talia_graphql',
  AZURE_SYNAPSE: 'azure_synapse',
  B2B_READ: 'celestyal_b2b_api_read',
  B2B_WRITE: 'celestyal_b2b_api_write',
});

/** Default for normal Talia panels (Supabase via GraphQL). */
export const DEFAULT_REQUIRED_SOURCES = Object.freeze([SOURCE_IDS.TALIA_GRAPHQL]);

export const B2B_READ_ALIASES = Object.freeze([
  SOURCE_IDS.B2B_READ,
  'celestyal_b2b_api',
]);

export const B2B_WRITE_ALIASES = Object.freeze([
  SOURCE_IDS.B2B_WRITE,
  'celestyal_b2b_api',
]);

const PROBE_INTERVAL_MS = 60_000;
const CATALOG_REFRESH_MS = 5 * 60_000;
const LIGHT_PROBE_QUERY = 'query { __typename }';

const SYNAPSE_STATUS_QUERY = `
  query SourceAvailabilitySynapse {
    synapseConnectionStatus {
      online
      server
      database
      lastChecked
      error
    }
  }
`;

const DATA_SOURCES_QUERY = `
  query SourceAvailabilityCatalog {
    dataSources {
      sourceName
      displayName
      connectionConfig
    }
  }
`;

const SOURCE_DEFS = [
  {
    id: SOURCE_IDS.TALIA_GRAPHQL,
    label: 'Talia GraphQL',
    role: 'Primary app API (Supabase via Kong)',
    policy: 'optimistic',
    kind: 'graphql_http',
    endpoint: '/api/graphql',
  },
  {
    id: SOURCE_IDS.AZURE_SYNAPSE,
    label: 'Azure Synapse SQL',
    role: 'Warehouse source for configured dataset sync',
    policy: 'optimistic',
    kind: 'synapse_status',
  },
  {
    id: SOURCE_IDS.B2B_READ,
    label: 'Celestyal B2B GraphQL (READ)',
    role: 'Direct source for availability panels',
    policy: 'strict',
    kind: 'graphql_http',
    endpoint: DIRECT_B2B_DEFAULT_ENDPOINT,
    aliases: B2B_READ_ALIASES,
  },
  {
    id: SOURCE_IDS.B2B_WRITE,
    label: 'Celestyal B2B GraphQL (WRITE)',
    role: 'Direct source for write operations',
    policy: 'strict',
    kind: 'graphql_http',
    endpoint: DIRECT_B2B_DEFAULT_ENDPOINT,
    aliases: B2B_WRITE_ALIASES,
  },
];

const createStatus = (def, overrides = {}) => ({
  id: def.id,
  sourceName: def.id,
  label: def.label,
  role: def.role,
  policy: def.policy,
  kind: def.kind,
  endpoint: def.endpoint || null,
  checked: false,
  available: false,
  detail: 'Status pending.',
  lastChecked: null,
  ...overrides,
});

const normalizeSourceIds = (sourceIds) => {
  if (!sourceIds) return [...DEFAULT_REQUIRED_SOURCES];
  const list = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  return list.map((id) => String(id || '').trim()).filter(Boolean);
};

class SourceAvailabilityService {
  constructor() {
    this.statuses = new Map();
    this.listeners = new Set();
    this.started = false;
    this.probeTimer = null;
    this.catalogTimer = null;
    this.inFlight = false;
    SOURCE_DEFS.forEach((def) => {
      this.statuses.set(def.id, createStatus(def));
    });
  }

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
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
      listener(this.getAllStatuses());
    } catch {
      // ignore
    }
    return () => this.listeners.delete(listener);
  }

  getAllStatuses() {
    return SOURCE_DEFS.map((def) => ({ ...this.statuses.get(def.id) }));
  }

  getSnapshot() {
    return Object.fromEntries(
      Array.from(this.statuses.entries()).map(([key, value]) => [key, { ...value }])
    );
  }

  resolveSourceId(sourceNameOrAliases) {
    const aliases = normalizeSourceIds(sourceNameOrAliases);
    for (const alias of aliases) {
      if (this.statuses.has(alias)) return alias;
      const def = SOURCE_DEFS.find((entry) => entry.aliases?.includes(alias));
      if (def) return def.id;
    }
    return aliases[0] || null;
  }

  getStatus(sourceNameOrAliases) {
    const id = this.resolveSourceId(sourceNameOrAliases);
    if (!id) {
      return createStatus(
        { id: null, label: 'Unknown', role: '', policy: 'strict', kind: 'unknown' },
        { detail: 'No source id.' }
      );
    }
    return { ...(this.statuses.get(id) || createStatus({ id, label: id, role: '', policy: 'strict', kind: 'unknown' })) };
  }

  /**
   * Framework YES/NO for refresh.
   * optimistic: YES until proven down
   * strict: YES only after a successful probe
   */
  canRefresh(sourceNameOrAliases) {
    const ids = normalizeSourceIds(sourceNameOrAliases).map((id) => this.resolveSourceId(id) || id);
    if (!ids.length) return true;
    return ids.every((id) => {
      const status = this.getStatus(id);
      if (status.policy === 'optimistic') {
        return !(status.checked === true && status.available === false);
      }
      return status.checked === true && status.available === true;
    });
  }

  getUnavailableMessage(sourceNameOrAliases) {
    const ids = normalizeSourceIds(sourceNameOrAliases).map((id) => this.resolveSourceId(id) || id);
    const blocked = ids
      .map((id) => this.getStatus(id))
      .filter((status) => !this.canRefresh(status.id));
    if (!blocked.length) return null;
    return blocked
      .map((status) => `${status.label || status.id}: ${status.detail || 'unavailable'}`)
      .join(' · ');
  }

  /**
   * Throw if any required source cannot refresh. Used by framework fetch paths.
   */
  assertCanRefresh(sourceNameOrAliases) {
    if (this.canRefresh(sourceNameOrAliases)) return;
    const error = new Error(
      this.getUnavailableMessage(sourceNameOrAliases) || 'Required data source unavailable — refresh skipped.'
    );
    error.code = 'SOURCE_UNAVAILABLE';
    error.sourceIds = normalizeSourceIds(sourceNameOrAliases);
    throw error;
  }

  reportSuccess(sourceName, detail = 'Reachable.') {
    const id = this.resolveSourceId(sourceName);
    if (!id) return;
    this.#patch(id, {
      checked: true,
      available: true,
      detail,
      lastChecked: new Date().toISOString(),
    });
  }

  reportFailure(sourceName, detail = 'Unreachable.') {
    const id = this.resolveSourceId(sourceName);
    if (!id) return;
    this.#patch(id, {
      checked: true,
      available: false,
      detail,
      lastChecked: new Date().toISOString(),
    });
  }

  async refreshNow() {
    this.start();
    await this.refreshCatalogAndProbe();
    return this.getAllStatuses();
  }

  async refreshCatalogAndProbe() {
    await this.#loadCatalog();
    await this.probeAll();
  }

  async probeAll() {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      await Promise.all(SOURCE_DEFS.map((def) => this.#probeDef(def)));
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Infer required source ids from a GraphQL URL for framework gating.
   */
  inferSourcesForUrl(url = '/api/graphql') {
    const value = String(url || '').trim();
    if (!value || value.startsWith('/')) return [SOURCE_IDS.TALIA_GRAPHQL];
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : null;
      if (origin && new URL(value, origin).origin === origin) {
        return [SOURCE_IDS.TALIA_GRAPHQL];
      }
    } catch {
      // fall through
    }
    const read = this.getStatus(SOURCE_IDS.B2B_READ);
    const write = this.getStatus(SOURCE_IDS.B2B_WRITE);
    if (read.endpoint && value.startsWith(read.endpoint.replace(/\/$/, ''))) {
      return [SOURCE_IDS.B2B_READ];
    }
    if (write.endpoint && value.startsWith(write.endpoint.replace(/\/$/, ''))) {
      return [SOURCE_IDS.B2B_WRITE];
    }
    // Unknown external host → treat as strict B2B read dependency.
    if (/^https?:\/\//i.test(value)) return [SOURCE_IDS.B2B_READ];
    return [SOURCE_IDS.TALIA_GRAPHQL];
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
      const applyEndpoint = (aliases, sourceId, fallback) => {
        const match = aliases
          .map((name) => sources.find((source) => source.sourceName === name))
          .find(Boolean);
        const endpoint = match?.connectionConfig?.endpoint || fallback;
        this.#patch(sourceId, { endpoint });
      };
      applyEndpoint(B2B_READ_ALIASES, SOURCE_IDS.B2B_READ, DIRECT_B2B_DEFAULT_ENDPOINT);
      applyEndpoint(B2B_WRITE_ALIASES, SOURCE_IDS.B2B_WRITE, DIRECT_B2B_DEFAULT_ENDPOINT);
    } catch (error) {
      // Catalog failure does not mark talia_graphql down (probe will).
      this.#patch(SOURCE_IDS.B2B_READ, {
        checked: true,
        available: false,
        detail: `Catalog load failed: ${error?.message || error}`,
        lastChecked: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async #probeDef(def) {
    if (def.kind === 'synapse_status') {
      await this.#probeSynapse(def.id);
      return;
    }
    if (def.kind === 'graphql_http') {
      const status = this.statuses.get(def.id);
      const endpoint = status?.endpoint || def.endpoint;
      await this.#probeGraphqlHttp(def.id, endpoint);
    }
  }

  async #probeGraphqlHttp(sourceId, endpoint) {
    if (!endpoint) {
      this.reportFailure(sourceId, 'Endpoint not set.');
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
      this.#patch(sourceId, {
        endpoint,
        checked: true,
        available: true,
        detail: 'Probe OK.',
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError' || controller.signal.aborted;
      this.#patch(sourceId, {
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

  async #probeSynapse(sourceId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DIRECT_B2B_FAIL_FAST_MS);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: SYNAPSE_STATUS_QUERY }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json?.errors?.length) throw new Error(json.errors[0].message);
      const status = json?.data?.synapseConnectionStatus;
      const online = status?.online === true;
      this.#patch(sourceId, {
        checked: true,
        available: online,
        detail: online
          ? `Probe OK${status?.server ? ` (${status.server})` : ''}.`
          : (status?.error || 'Synapse unreachable.'),
        lastChecked: status?.lastChecked || new Date().toISOString(),
        endpoint: status?.server || null,
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError' || controller.signal.aborted;
      this.#patch(sourceId, {
        checked: true,
        available: false,
        detail: timedOut
          ? `Probe timed out after ${DIRECT_B2B_FAIL_FAST_MS}ms`
          : (error?.message || 'Synapse probe failed.'),
        lastChecked: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  #patch(sourceId, patch) {
    const prev = this.statuses.get(sourceId);
    if (!prev) return;
    this.statuses.set(sourceId, { ...prev, ...patch, id: sourceId, sourceName: sourceId });
    this.notify();
  }

  notify() {
    const all = this.getAllStatuses();
    this.listeners.forEach((listener) => {
      try {
        listener(all);
      } catch {
        // ignore
      }
    });
  }
}

const sourceAvailability = new SourceAvailabilityService();

export const initSourceAvailability = () => {
  sourceAvailability.start();
  return sourceAvailability;
};

export const getSourceAvailability = () => sourceAvailability;

export default sourceAvailability;
