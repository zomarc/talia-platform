import { createRequire } from 'module';
import { supabaseDataService } from '../../services/supabase.js';
import { synapseSyncService, isSynapseSyncDisabled } from '../../services/synapse-sync.js';
import { configService } from '../../services/config-service.js';
import { shipPositionService } from '../../services/ship-position-service.js';

/** Must match SCRIPT_VERSION in scripts/validate (same string token; bump both when the cross-check contract changes). */
export const VALIDATE_SCRIPT_DOC_VERSION = 'ops-7';

type Importance = 'REQUIRED' | 'CONDITIONAL' | 'OPTIONAL';

function readGraphqlServerPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../../package.json') as { version?: string };
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

const trim = (v: string | undefined) => (typeof v === 'string' ? v.trim() : '');
const isSet = (v: string | undefined) => trim(v).length > 0;

async function supabaseRuntimeCheck(): Promise<{ online: boolean; error: string | null }> {
  try {
    const { error } = await supabaseDataService.client
      .from('operation_metadata')
      .select('operation_name')
      .limit(1);
    return { online: !error, error: error ? error.message : null };
  } catch (e: any) {
    return { online: false, error: e?.message || 'Unknown error' };
  }
}

async function synapseRuntimeCheck(): Promise<{ online: boolean; error: string | null }> {
  try {
    const result = await synapseSyncService.testConnectionDetailed();
    return { online: !!result.online, error: result.error || null };
  } catch (e: any) {
    return { online: false, error: e?.message || 'Unknown error' };
  }
}

/** Caps Synapse probe time for instanceConnectionProfile so validate/UI do not block on warehouse TCP (often ~10–30s when VPN is off). */
const INSTANCE_PROFILE_SYNAPSE_BUDGET_MS = (() => {
  const fallback = process.env.NODE_ENV === 'development' ? 12000 : 4000;
  const raw = Number.parseInt(
    process.env.TALIA_INSTANCE_PROFILE_SYNAPSE_MS || String(fallback),
    10
  );
  if (Number.isFinite(raw)) {
    return Math.min(60000, Math.max(500, raw));
  }
  return fallback;
})();

async function synapseRuntimeCheckBudgeted(): Promise<{ online: boolean; error: string | null }> {
  const ms = INSTANCE_PROFILE_SYNAPSE_BUDGET_MS;
  return Promise.race([
    synapseRuntimeCheck(),
    new Promise<{ online: boolean; error: string | null }>((resolve) => {
      setTimeout(() => {
        resolve({
          online: false,
          error: `Synapse probe exceeded ${ms}ms (warehouse slow or unreachable — VPN, firewall, or TALIA_SYNAPSE_SYNC_DISABLED=1)`,
        });
      }, ms);
    }),
  ]);
}

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

async function detectEgressIpv4(): Promise<{ ip: string | null; source: string; error: string | null }> {
  const urls = ['https://api.ipify.org', 'https://ifconfig.me/ip', 'https://icanhazip.com'];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/plain' } });
      clearTimeout(timer);
      if (!res.ok) continue;
      const ip = (await res.text()).trim().split(/\s+/)[0];
      if (ip && IPV4_RE.test(ip)) {
        return { ip, source: url, error: null };
      }
    } catch {
      /* try next */
    }
  }
  return { ip: null, source: 'none', error: 'Could not determine this host’s public IPv4' };
}

function extractBlockedClientIp(message: string | null | undefined): string | null {
  if (!message) return null;
  const match = message.match(/Client with IP address ['"]?([\d.]+)['"]? is not allowed/i);
  return match?.[1] && IPV4_RE.test(match[1]) ? match[1] : null;
}

function buildNetworkingSnapshot(opts: {
  synapseSyncDisabled: boolean;
  synapseOnline: boolean;
  synapseError: string | null;
  synapseAddress: string;
  supabaseUrl: string;
  egressIp: string | null;
  egressSource: string;
  egressError: string | null;
}) {
  const expected = trim(process.env.TALIA_EXPECTED_EGRESS_IPV4) || null;
  const egressLabel = trim(process.env.TALIA_EGRESS_LABEL) || null;
  const hops: Array<{
    id: string;
    label: string;
    address: string | null;
    kind: string;
    note: string | null;
  }> = [
    {
      id: 'graphql_process',
      label: 'GraphQL server (this process)',
      address: `host=${process.env.HOSTNAME || 'localhost'} · NODE_ENV=${process.env.NODE_ENV || 'development'}`,
      kind: 'local',
      note: 'Warehouse and sync calls originate here — not from the browser.',
    },
    {
      id: 'egress_public',
      label: egressLabel ? `Public egress (${egressLabel})` : 'Public egress IPv4',
      address: opts.egressIp,
      kind: 'public',
      note: opts.egressIp
        ? `Seen by remote firewalls when this instance dials out (${opts.egressSource}).`
        : opts.egressError || 'Egress IP unknown.',
    },
  ];

  if (!opts.synapseSyncDisabled) {
    hops.push({
      id: 'azure_firewall',
      label: 'Azure Synapse firewall / allowlist',
      address: opts.egressIp ? `${opts.egressIp}/32 must be allowed` : 'Allowlist this host’s public IPv4',
      kind: 'policy',
      note: 'Azure rejects SQL clients whose source IP is not on the server firewall.',
    });
    hops.push({
      id: 'synapse_sql',
      label: 'Azure Synapse SQL',
      address: opts.synapseAddress,
      kind: 'remote',
      note: opts.synapseOnline ? 'Probe OK from this host.' : opts.synapseError || 'Unreachable from this host.',
    });
  }

  hops.push({
    id: 'supabase_kong',
    label: 'Supabase Postgres (via Kong)',
    address: opts.supabaseUrl,
    kind: opts.supabaseUrl.includes('127.0.0.1') || opts.supabaseUrl.includes('localhost') ? 'local' : 'remote',
    note: 'Application database path for this instance.',
  });

  const concerns: Array<{
    id: string;
    severity: string;
    title: string;
    detail: string;
    relatedTargetId: string | null;
  }> = [];

  const blockedIp = extractBlockedClientIp(opts.synapseError);
  if (blockedIp) {
    concerns.push({
      id: 'synapse_ip_firewall',
      severity: 'high',
      title: 'Synapse firewall blocks this egress IP',
      detail: `Azure reported client IP ${blockedIp} is not allowed. Add ${blockedIp}/32 on the Synapse / SQL firewall (or corporate gateway allowlist), then refresh.`,
      relatedTargetId: 'azure_synapse',
    });
  } else if (!opts.synapseSyncDisabled && !opts.synapseOnline && opts.synapseError) {
    concerns.push({
      id: 'synapse_unreachable',
      severity: 'medium',
      title: 'Synapse not reachable from this instance',
      detail: opts.synapseError,
      relatedTargetId: 'azure_synapse',
    });
  }

  if (opts.egressIp && expected && opts.egressIp !== expected) {
    concerns.push({
      id: 'egress_mismatch',
      severity: 'high',
      title: 'Egress IP does not match expected static identity',
      detail: `This host egresses as ${opts.egressIp}, but TALIA_EXPECTED_EGRESS_IPV4=${expected}. Tunnel may be down or traffic is bypassing the gateway.`,
      relatedTargetId: null,
    });
  } else if (opts.egressIp && expected && opts.egressIp === expected) {
    concerns.push({
      id: 'egress_matches_expected',
      severity: 'info',
      title: 'Egress matches expected static IP',
      detail: `${opts.egressIp} matches TALIA_EXPECTED_EGRESS_IPV4.`,
      relatedTargetId: null,
    });
  }

  if (!opts.egressIp) {
    concerns.push({
      id: 'egress_unknown',
      severity: 'medium',
      title: 'Public egress IP could not be detected',
      detail: opts.egressError || 'Outbound HTTPS to IP echo services failed.',
      relatedTargetId: null,
    });
  }

  const notes = [
    'Each instance (laptop, staging Mini PC, MVP) has its own egress IP and allowlist requirements.',
    'Browser → local UI/GraphQL uses loopback; Synapse allowlisting follows the GraphQL server host’s public IP.',
    'Optional: set TALIA_EXPECTED_EGRESS_IPV4 and TALIA_EGRESS_LABEL in the server env to assert a static gateway identity.',
  ];

  return {
    egressIpv4: opts.egressIp,
    egressSource: opts.egressIp ? opts.egressSource : opts.egressError || 'none',
    hops,
    concerns,
    notes,
  };
}

function buildEnvRows(synapseSyncDisabled: boolean) {
  const rows: Array<{
    key: string;
    scope: string;
    label: string;
    sensitive: boolean;
    importance: Importance;
    whenRequired: string | null;
    note: string;
  }> = [
    {
      key: 'SUPABASE_URL',
      scope: 'graphql-server',
      label: 'Supabase API base (GraphQL → Kong/PostgREST)',
      sensitive: false,
      importance: 'REQUIRED',
      whenRequired: null,
      note: 'In Docker this is usually http://supabase-kong:8000. The browser uses VITE_SUPABASE_URL (public Kong URL) instead.',
    },
    {
      key: 'SUPABASE_ANON_KEY',
      scope: 'graphql-server',
      label: 'Supabase anon JWT (server + compose)',
      sensitive: true,
      importance: 'REQUIRED',
      whenRequired: null,
      note: 'Same value must appear in docker-compose .env for Kong/GoTrue and in graphql-server.',
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      scope: 'graphql-server',
      label: 'Supabase service-role JWT (server + compose)',
      sensitive: true,
      importance: 'REQUIRED',
      whenRequired: null,
      note: 'graphql-server needs this; compose passes it from .env.staging / .env.',
    },
    {
      key: 'DATA_SOURCE_PRIORITY',
      scope: 'graphql-server',
      label: 'Primary data priority (supabase | azure | both)',
      sensitive: false,
      importance: 'OPTIONAL',
      whenRequired: null,
      note: 'Defaults to supabase when unset.',
    },
    {
      key: 'TALIA_SYNAPSE_SYNC_DISABLED',
      scope: 'graphql-server',
      label: 'Block Synapse → Supabase sync',
      sensitive: false,
      importance: 'OPTIONAL',
      whenRequired: null,
      note: 'Set to 1 on MVP/staging when you only use backups (no live warehouse sync).',
    },
    {
      key: 'AISSTREAM_API_KEY',
      scope: 'graphql-server',
      label: 'AISStream API key (public AIS)',
      sensitive: true,
      importance: 'OPTIONAL',
      whenRequired: null,
      note: 'Prefer Data Management → Integration settings. Env is fallback only.',
    },
    {
      key: 'AISHUB_USERNAME',
      scope: 'graphql-server',
      label: 'AISHub username (contributor AIS)',
      sensitive: false,
      importance: 'OPTIONAL',
      whenRequired: null,
      note: 'Prefer Data Management → Integration settings. Rate limited to 1 request/min.',
    },
    {
      key: 'VESSELFINDER_API_KEY',
      scope: 'graphql-server',
      label: 'VesselFinder API key',
      sensitive: true,
      importance: 'OPTIONAL',
      whenRequired: null,
      note: 'Prefer Data Management → Integration settings.',
    },
    {
      key: 'MARINETRAFFIC_API_KEY',
      scope: 'graphql-server',
      label: 'MarineTraffic API key',
      sensitive: true,
      importance: 'OPTIONAL',
      whenRequired: null,
      note: 'Prefer Data Management → Integration settings.',
    },
    {
      key: 'AZURE_SYNAPSE_SERVER',
      scope: 'graphql-server',
      label: 'Azure Synapse host',
      sensitive: false,
      importance: synapseSyncDisabled ? 'OPTIONAL' : 'CONDITIONAL',
      whenRequired: synapseSyncDisabled ? null : 'When Synapse sync is enabled',
      note: 'Warehouse endpoint for dataset sync and status checks.',
    },
    {
      key: 'AZURE_SYNAPSE_PORT',
      scope: 'graphql-server',
      label: 'Synapse port',
      sensitive: false,
      importance: synapseSyncDisabled ? 'OPTIONAL' : 'CONDITIONAL',
      whenRequired: synapseSyncDisabled ? null : 'When Synapse sync is enabled',
      note: 'Usually 1433.',
    },
    {
      key: 'AZURE_SYNAPSE_DATABASE',
      scope: 'graphql-server',
      label: 'Synapse database name',
      sensitive: false,
      importance: synapseSyncDisabled ? 'OPTIONAL' : 'CONDITIONAL',
      whenRequired: synapseSyncDisabled ? null : 'When Synapse sync is enabled',
      note: '',
    },
    {
      key: 'AZURE_SYNAPSE_USERNAME',
      scope: 'graphql-server',
      label: 'Synapse SQL user',
      sensitive: false,
      importance: synapseSyncDisabled ? 'OPTIONAL' : 'CONDITIONAL',
      whenRequired: synapseSyncDisabled ? null : 'When Synapse sync is enabled',
      note: '',
    },
    {
      key: 'AZURE_SYNAPSE_PASSWORD',
      scope: 'graphql-server',
      label: 'Synapse SQL password',
      sensitive: true,
      importance: synapseSyncDisabled ? 'OPTIONAL' : 'CONDITIONAL',
      whenRequired: synapseSyncDisabled ? null : 'When Synapse sync is enabled',
      note: '',
    },
    {
      key: 'POSTGRES_PASSWORD',
      scope: 'docker-compose',
      label: 'PostgreSQL password for Supabase roles',
      sensitive: true,
      importance: 'REQUIRED',
      whenRequired: null,
      note: 'Used by db, PostgREST, GoTrue, etc. After pg_restore, align role passwords with PostgREST (see scripts/supabase/align-db-role-passwords.sh).',
    },
  ];

  return rows.map((r) => ({
    ...r,
    present: isSet(process.env[r.key]),
  }));
}

export const instanceConnectionQueryResolvers = {
  instanceConnectionProfile: async () => {
    const synapseSyncDisabled = isSynapseSyncDisabled();
    const [supabaseCheck, synapseCheck, dbEnv, egress] = await Promise.all([
      supabaseRuntimeCheck(),
      synapseSyncDisabled
        ? Promise.resolve({ online: false, error: null as string | null })
        : synapseRuntimeCheckBudgeted(),
      configService.getEnvironment().catch(() => null),
      detectEgressIpv4(),
    ]);

    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    const sc = synapseSyncService.synapseConfig;
    const synapseAddress = `${sc.server},${sc.port} / ${sc.database}`;
    const providerTargets = await shipPositionService.getProviderTargets({ connectAisStream: false });

    const dataTargets = [
      {
        id: 'supabase_postgres',
        label: 'Supabase Postgres (via Kong)',
        role: 'Primary application database — reservations, master sail, Talia config, auth',
        address: supabaseUrl,
        skipped: false,
        online: supabaseCheck.online,
        detail: supabaseCheck.error,
      },
      {
        id: 'azure_synapse',
        label: 'Azure Synapse SQL',
        role: synapseSyncDisabled
          ? 'Warehouse (sync disabled on this instance — data via backup/restore only)'
          : 'Warehouse source for configured dataset sync into Supabase',
        address: synapseAddress,
        skipped: synapseSyncDisabled,
        online: synapseSyncDisabled ? true : synapseCheck.online,
        detail: synapseSyncDisabled
          ? 'TALIA_SYNAPSE_SYNC_DISABLED — warehouse not probed (typical for backup-only instances)'
          : synapseCheck.error,
      },
      ...providerTargets,
    ];

    const networking = buildNetworkingSnapshot({
      synapseSyncDisabled,
      synapseOnline: !!synapseCheck.online,
      synapseError: synapseCheck.error,
      synapseAddress,
      supabaseUrl,
      egressIp: egress.ip,
      egressSource: egress.source,
      egressError: egress.error,
    });

    const envKeys = buildEnvRows(synapseSyncDisabled);

    return {
      collectedAt: new Date().toISOString(),
      configEnvironmentName: dbEnv?.environment_name || null,
      nodeEnv: process.env.NODE_ENV || 'development',
      dataSourcePriority: trim(process.env.DATA_SOURCE_PRIORITY) || 'supabase',
      synapseSyncDisabled,
      dataTargets,
      networking,
      envKeys: envKeys.map((k) => ({
        key: k.key,
        scope: k.scope,
        label: k.label,
        present: k.present,
        sensitive: k.sensitive,
        importance: k.importance,
        whenRequired: k.whenRequired,
        note: k.note,
      })),
      backupBetweenInstances:
        'Business data lives in Postgres (Supabase). pg_dump backups can be restored on local (laptop), staging (MiniPC), or MVP (Azure). Each host keeps its own JWT secrets and POSTGRES_PASSWORD; after restore use scripts/supabase/align-db-role-passwords.sh and match VITE_* to that host. talia_config tables travel inside the dump.',
      architectureNotes: [
        'GraphQL uses SUPABASE_URL inside Docker (often http://supabase-kong:8000). Browsers use VITE_SUPABASE_URL pointing at the host-mapped Kong port (e.g. :54321). Both must refer to the same logical Supabase project.',
        'Separate instances should use separate .env / secrets. Only restore backups onto a target after aligning passwords and keys for that target.',
        'Code reaches staging/MVP via ./scripts/deploy-to-staging.sh and ./scripts/deploy-to-mvp.sh (local tar + dist), not by relying on unpushed Git on your laptop.',
        'Warehouse allowlists follow this GraphQL host’s public egress IP (see networking). Laptop vs staging vs MVP each need their own firewall entry unless they share a static gateway.',
      ],
      graphqlServerPackageVersion: readGraphqlServerPackageVersion(),
      nodeRuntimeVersion: typeof process !== 'undefined' && process.version ? process.version : 'unknown',
      validateScriptDocVersion: VALIDATE_SCRIPT_DOC_VERSION,
    };
  },
};
