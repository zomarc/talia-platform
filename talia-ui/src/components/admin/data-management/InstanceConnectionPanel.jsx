/**
 * Shows this deployment's data targets and required env keys (no secret values).
 * Server snapshot from GraphQL; browser row shows VITE_* baked into this UI build.
 */

import React, { useCallback, useEffect, useState } from 'react';

const INSTANCE_PROFILE_QUERY = `
  query InstanceConnectionProfile {
    instanceConnectionProfile {
      collectedAt
      configEnvironmentName
      nodeEnv
      dataSourcePriority
      synapseSyncDisabled
      graphqlServerPackageVersion
      validateScriptDocVersion
      backupBetweenInstances
      architectureNotes
      dataTargets {
        id
        label
        role
        address
        skipped
        online
        detail
      }
      envKeys {
        key
        scope
        label
        present
        sensitive
        importance
        whenRequired
        note
      }
    }
  }
`;

const scopeOrder = ['graphql-server', 'docker-compose', 'ui-build'];
const importanceRank = { REQUIRED: 0, CONDITIONAL: 1, OPTIONAL: 2 };

function vitePresent(name) {
  const v = import.meta.env[name];
  return typeof v === 'string' && v.trim().length > 0;
}

export default function InstanceConnectionPanel({ formatDateTime }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: INSTANCE_PROFILE_QUERY }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      setProfile(json.data?.instanceConnectionProfile || null);
    } catch (e) {
      setError(e.message || 'Failed to load instance profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const viteRows = [
    {
      key: 'VITE_ENVIRONMENT',
      label: 'Deploy label (local | staging | mvp | production)',
      present: vitePresent('VITE_ENVIRONMENT'),
      valuePreview: import.meta.env.VITE_ENVIRONMENT || '',
    },
    {
      key: 'VITE_APP_VERSION',
      label: 'UI package version (build)',
      present: vitePresent('VITE_APP_VERSION'),
      valuePreview: import.meta.env.VITE_APP_VERSION || '',
    },
    {
      key: 'VITE_BUILD_TIME',
      label: 'UI bundle build timestamp (UTC ISO)',
      present: vitePresent('VITE_BUILD_TIME'),
      valuePreview: import.meta.env.VITE_BUILD_TIME || '',
    },
    {
      key: 'VITE_SUPABASE_URL',
      label: 'Public Supabase URL (browser)',
      present: vitePresent('VITE_SUPABASE_URL'),
      valuePreview: import.meta.env.VITE_SUPABASE_URL || '',
    },
    {
      key: 'VITE_SUPABASE_ANON_KEY',
      label: 'Public anon key (browser)',
      present: vitePresent('VITE_SUPABASE_ANON_KEY'),
      sensitive: true,
    },
    {
      key: 'VITE_GRAPHQL_ENDPOINT',
      label: 'GraphQL URL (optional if using /api/graphql)',
      present: vitePresent('VITE_GRAPHQL_ENDPOINT'),
      valuePreview: import.meta.env.VITE_GRAPHQL_ENDPOINT || '',
    },
    {
      key: 'VITE_BASE_PATH',
      label: 'Base path',
      present: vitePresent('VITE_BASE_PATH'),
      valuePreview: import.meta.env.VITE_BASE_PATH || '/',
    },
  ];

  const serverKeys = profile?.envKeys || [];
  const missingRequiredServer = serverKeys.filter(
    (k) => k.importance === 'REQUIRED' && !k.present
  );
  const missingRequiredVite = viteRows.filter(
    (r) =>
      r.key !== 'VITE_GRAPHQL_ENDPOINT' &&
      r.key !== 'VITE_BUILD_TIME' &&
      r.key !== 'VITE_ENVIRONMENT' &&
      r.key !== 'VITE_APP_VERSION' &&
      !r.present
  );

  const keysByScope = scopeOrder.map((scope) => ({
    scope,
    keys: serverKeys
      .filter((k) => k.scope === scope)
      .sort((a, b) => importanceRank[a.importance] - importanceRank[b.importance]),
  }));

  return (
    <div className="dm-instance-profile">
      <header className="talia-report__header dm-section-header">
        <div className="talia-report__header-left">
          <h3 className="talia-report__title dm-section-header__title">Instance &amp; connections</h3>
          <span className="talia-report__subtitle dm-section-header__subtitle">
            Data targets for this host, required keys (presence only — values are never shown), and notes for backup moves
          </span>
        </div>
        <div className="dm-instance-profile__actions">
          <button type="button" className="admin-button admin-button--secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="dm-instance-profile__error" role="alert">
          {error}
        </div>
      )}

      {loading && !profile && !error && <p className="dm-instance-profile__loading">Loading instance profile…</p>}

      {profile && (
        <>
          <div className="dm-instance-profile__summary talia-card">
            <div className="talia-card__content">
              <dl className="dm-instance-profile__dl">
                <div>
                  <dt>Snapshot time</dt>
                  <dd>{formatDateTime ? formatDateTime(profile.collectedAt) : profile.collectedAt}</dd>
                </div>
                <div>
                  <dt>Config environment (DB)</dt>
                  <dd>{profile.configEnvironmentName || '—'}</dd>
                </div>
                <div>
                  <dt>Node env</dt>
                  <dd>{profile.nodeEnv}</dd>
                </div>
                <div>
                  <dt>DATA_SOURCE_PRIORITY</dt>
                  <dd>{profile.dataSourcePriority}</dd>
                </div>
                <div>
                  <dt>Synapse sync</dt>
                  <dd>{profile.synapseSyncDisabled ? 'Disabled (backup-only style)' : 'Enabled'}</dd>
                </div>
                <div>
                  <dt>This browser</dt>
                  <dd>{typeof window !== 'undefined' ? window.location.origin : '—'}</dd>
                </div>
              </dl>
            </div>
          </div>

          <section className="dm-instance-profile__section">
            <h4 className="dm-instance-profile__h4">Deploy &amp; version cross-check (use on local, staging, MVP)</h4>
            <p className="dm-instance-profile__hint">
              Compare with the top bar <strong>Source</strong> / version and with <code>./scripts/validate</code> (script version + run time).
              GraphQL row is the running <code>talia-server</code>; UI rows are baked into this bundle at <code>npm run build</code>.
            </p>
            <div className="talia-card">
              <div className="talia-card__content">
                <dl className="dm-instance-profile__dl">
                  <div>
                    <dt>GraphQL server (package.json)</dt>
                    <dd>v{profile.graphqlServerPackageVersion}</dd>
                  </div>
                  <div>
                    <dt>Validate script doc version</dt>
                    <dd>
                      {profile.validateScriptDocVersion}
                      <span className="dm-instance-profile__note">
                        {' '}
                        — should match <code>SCRIPT_VERSION</code> in <code>scripts/validate</code>
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>UI VITE_ENVIRONMENT</dt>
                    <dd>{import.meta.env.VITE_ENVIRONMENT || (import.meta.env.DEV ? 'local (dev)' : 'production')}</dd>
                  </div>
                  <div>
                    <dt>UI VITE_APP_VERSION</dt>
                    <dd>{import.meta.env.VITE_APP_VERSION || '—'}</dd>
                  </div>
                  <div>
                    <dt>UI VITE_BUILD_TIME</dt>
                    <dd>{import.meta.env.VITE_BUILD_TIME || '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {(missingRequiredServer.length > 0 || missingRequiredVite.length > 0) && (
            <div className="dm-instance-profile__alert talia-card talia-card--warning">
              <div className="talia-card__header">
                <h4 className="talia-card__title">Missing required configuration</h4>
              </div>
              <div className="talia-card__content">
                {missingRequiredServer.length > 0 && (
                  <div>
                    <strong>GraphQL / compose (reported from server process)</strong>
                    <ul>
                      {missingRequiredServer.map((k) => (
                        <li key={k.key}>
                          <code>{k.key}</code> — {k.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {missingRequiredVite.length > 0 && (
                  <div>
                    <strong>This UI build</strong>
                    <ul>
                      {missingRequiredVite.map((r) => (
                        <li key={r.key}>
                          <code>{r.key}</code> — {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <section className="dm-instance-profile__section">
            <h4 className="dm-instance-profile__h4">Data targets</h4>
            <div className="dm-instance-profile__targets">
              {profile.dataTargets.map((t) => (
                <div
                  key={t.id}
                  className={`talia-card dm-instance-target ${
                    t.skipped ? 'dm-instance-target--skipped' : t.online ? 'dm-instance-target--ok' : 'dm-instance-target--bad'
                  }`}
                >
                  <div className="talia-card__header">
                    <h5 className="talia-card__title">
                      {t.skipped ? '◌' : t.online ? '●' : '○'} {t.label}
                    </h5>
                  </div>
                  <div className="talia-card__content">
                    <p className="dm-instance-target__role">{t.role}</p>
                    <p className="dm-instance-target__addr">
                      <code>{t.address}</code>
                    </p>
                    {t.detail && <p className="dm-instance-target__detail">{t.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="dm-instance-profile__section">
            <h4 className="dm-instance-profile__h4">Environment keys (this server process)</h4>
            <p className="dm-instance-profile__hint">
              <code>present</code> means the GraphQL container sees a non-empty value. Variables only used in other containers (e.g. only in Kong) may show as missing here even if set in compose.
            </p>
            {keysByScope.map(
              ({ scope, keys }) =>
                keys.length > 0 && (
                  <div key={scope} className="dm-instance-profile__scope-block">
                    <h5 className="dm-instance-profile__h5">{scope}</h5>
                    <table className="dm-instance-profile__table">
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>Label</th>
                          <th>Importance</th>
                          <th>Present</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map((k) => (
                          <tr key={`${scope}-${k.key}`} className={!k.present && k.importance === 'REQUIRED' ? 'dm-instance-profile__row--warn' : ''}>
                            <td>
                              <code>{k.key}</code>
                              {k.sensitive && <span className="dm-instance-profile__pill">secret</span>}
                            </td>
                            <td>
                              {k.label}
                              {k.note && <span className="dm-instance-profile__note"> — {k.note}</span>}
                              {k.whenRequired && (
                                <div className="dm-instance-profile__when">
                                  <em>When:</em> {k.whenRequired}
                                </div>
                              )}
                            </td>
                            <td>{k.importance}</td>
                            <td>{k.present ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )}
          </section>

          <section className="dm-instance-profile__section">
            <h4 className="dm-instance-profile__h4">This browser build (Vite)</h4>
            <p className="dm-instance-profile__hint">
              These values were baked in when the UI image was built. They must match this instance&apos;s Supabase project.
            </p>
            <table className="dm-instance-profile__table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Present</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {viteRows.map((r) => (
                  <tr key={r.key} className={!r.present && r.key !== 'VITE_GRAPHQL_ENDPOINT' ? 'dm-instance-profile__row--warn' : ''}>
                    <td>
                      <code>{r.key}</code>
                      {r.sensitive && <span className="dm-instance-profile__pill">secret</span>}
                    </td>
                    <td>{r.label}</td>
                    <td>{r.present ? 'Yes' : 'No'}</td>
                    <td>
                      {r.sensitive && r.present
                        ? '•••• (set)'
                        : r.valuePreview
                          ? String(r.valuePreview)
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dm-instance-profile__section">
            <h4 className="dm-instance-profile__h4">Moving backups between instances</h4>
            <div className="talia-card">
              <div className="talia-card__content">
                <p>{profile.backupBetweenInstances}</p>
                <ul className="dm-instance-profile__notes">
                  {(profile.architectureNotes || []).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
