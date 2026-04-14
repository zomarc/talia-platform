import { createRequire } from 'module';
import { supabaseDataService } from '../../services/supabase.js';
import { synapseSyncService, isSynapseSyncDisabled } from '../../services/synapse-sync.js';
import { configService } from '../../services/config-service.js';

/** Must match SCRIPT_VERSION in scripts/validate (same string token; bump both when the cross-check contract changes). */
export const VALIDATE_SCRIPT_DOC_VERSION = 'ops-4';

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
    const [supabaseCheck, synapseCheck, dbEnv] = await Promise.all([
      supabaseRuntimeCheck(),
      synapseSyncDisabled
        ? Promise.resolve({ online: false, error: null as string | null })
        : synapseRuntimeCheck(),
      configService.getEnvironment().catch(() => null),
    ]);

    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    const sc = synapseSyncService.synapseConfig;

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
        address: `${sc.server},${sc.port} / ${sc.database}`,
        skipped: synapseSyncDisabled,
        online: synapseSyncDisabled ? true : synapseCheck.online,
        detail: synapseSyncDisabled
          ? 'TALIA_SYNAPSE_SYNC_DISABLED — warehouse not probed (typical for backup-only instances)'
          : synapseCheck.error,
      },
    ];

    const envKeys = buildEnvRows(synapseSyncDisabled);

    return {
      collectedAt: new Date().toISOString(),
      configEnvironmentName: dbEnv?.environment_name || null,
      nodeEnv: process.env.NODE_ENV || 'development',
      dataSourcePriority: trim(process.env.DATA_SOURCE_PRIORITY) || 'supabase',
      synapseSyncDisabled,
      dataTargets,
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
      ],
      graphqlServerPackageVersion: readGraphqlServerPackageVersion(),
      validateScriptDocVersion: VALIDATE_SCRIPT_DOC_VERSION,
    };
  },
};
