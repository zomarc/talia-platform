/**
 * Shows this deployment's data targets and required env keys (no secret values).
 * Server snapshot from GraphQL; browser row shows VITE_* baked into this UI build.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import uiPackageJson from '../../../../package.json';

const INSTANCE_PROFILE_QUERY = `
  query InstanceConnectionProfile {
    instanceConnectionProfile {
      collectedAt
      configEnvironmentName
      nodeEnv
      dataSourcePriority
      synapseSyncDisabled
      graphqlServerPackageVersion
      nodeRuntimeVersion
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
    dataSources {
      id
      sourceName
      displayName
      sourceType
      isActive
      description
      connectionConfig
    }
    integrationSettings {
      aisstreamApiKeyPresent
      aishubUsername
      vesselfinderApiKeyPresent
      marinetrafficApiKeyPresent
    }
  }
`;

const UPDATE_DATA_SOURCE_MUTATION = `
  mutation UpdateDataSourceConnection($sourceName: String!, $connectionConfig: JSON!) {
    updateDataSourceConnection(sourceName: $sourceName, connectionConfig: $connectionConfig) {
      id
      sourceName
      displayName
      sourceType
      isActive
      description
      connectionConfig
    }
  }
`;

const SAVE_INTEGRATION_SETTINGS_MUTATION = `
  mutation SaveIntegrationSettings($input: IntegrationSettingsInput!) {
    saveIntegrationSettings(input: $input) {
      aisstreamApiKeyPresent
      aishubUsername
      vesselfinderApiKeyPresent
      marinetrafficApiKeyPresent
    }
  }
`;

const scopeOrder = ['graphql-server', 'docker-compose', 'ui-build'];
const importanceRank = { REQUIRED: 0, CONDITIONAL: 1, OPTIONAL: 2 };
const TABULATOR_VERSION = uiPackageJson?.dependencies?.['tabulator-tables'] || '—';
const DOCKVIEW_VERSION = uiPackageJson?.dependencies?.dockview || '—';

function vitePresent(name) {
  const v = import.meta.env[name];
  return typeof v === 'string' && v.trim().length > 0;
}

export default function InstanceConnectionPanel({ formatDateTime }) {
  const [profile, setProfile] = useState(null);
  const [dataSources, setDataSources] = useState([]);
  const [integrationSettings, setIntegrationSettings] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sourceSaveError, setSourceSaveError] = useState(null);
  const [sourceSaveStatus, setSourceSaveStatus] = useState(null);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [directReadEndpointDraft, setDirectReadEndpointDraft] = useState('');
  const [directWriteEndpointDraft, setDirectWriteEndpointDraft] = useState('');
  const [integrationDraft, setIntegrationDraft] = useState({
    aisstreamApiKey: '',
    aishubUsername: '',
    vesselfinderApiKey: '',
    marinetrafficApiKey: '',
  });
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationError, setIntegrationError] = useState(null);
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [gqlChecks, setGqlChecks] = useState({
    local: { checked: false, online: true, detail: 'Status pending.' },
    browser: { checked: false, online: true, detail: 'Status pending.' },
    externalRead: { checked: false, online: true, detail: 'Status pending.' },
    externalWrite: { checked: false, online: true, detail: 'Status pending.' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: INSTANCE_PROFILE_QUERY,
        component: 'InstanceConnectionPanel',
        purpose: 'Load instance connection profile',
        tableName: 'instance_connection_profile',
      });
      setProfile(data?.instanceConnectionProfile || null);
      setDataSources(data?.dataSources || []);
      setIntegrationSettings(data?.integrationSettings || null);
    } catch (e) {
      setError(e.message || 'Failed to load instance profile');
      setProfile(null);
      setDataSources([]);
      setIntegrationSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const directReadSource =
    dataSources.find((source) => source.sourceName === 'celestyal_b2b_api_read')
    || dataSources.find((source) => source.sourceName === 'celestyal_b2b_api');
  const directWriteSource =
    dataSources.find((source) => source.sourceName === 'celestyal_b2b_api_write')
    || dataSources.find((source) => source.sourceName === 'celestyal_b2b_api');
  const localGraphqlAddress = 'http://127.0.0.1:4000/api/graphql';
  const browserGraphqlAddress =
    import.meta.env.VITE_GRAPHQL_ENDPOINT ||
    (typeof window !== 'undefined' ? `${window.location.origin}/api/graphql` : '');
  const externalReadGraphqlAddress = directReadSource?.connectionConfig?.endpoint || '';
  const externalWriteGraphqlAddress = directWriteSource?.connectionConfig?.endpoint || '';

  useEffect(() => {
    if (!directReadSource) return;
    const endpoint = directReadSource.connectionConfig?.endpoint || '';
    setDirectReadEndpointDraft(endpoint);
  }, [directReadSource]);

  useEffect(() => {
    if (!directWriteSource) return;
    const endpoint = directWriteSource.connectionConfig?.endpoint || '';
    setDirectWriteEndpointDraft(endpoint);
  }, [directWriteSource]);

  useEffect(() => {
    setIntegrationDraft((prev) => ({
      ...prev,
      aishubUsername: integrationSettings?.aishubUsername || '',
    }));
  }, [integrationSettings]);

  const probeGraphqlEndpoint = useCallback(async (endpoint, key) => {
    if (!endpoint) {
      setGqlChecks((prev) => ({
        ...prev,
        [key]: { checked: true, online: false, detail: 'Endpoint not set.' },
      }));
      return;
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { __typename }' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      setGqlChecks((prev) => ({
        ...prev,
        [key]: { checked: true, online: true, detail: 'Probe OK.' },
      }));
    } catch (e) {
      setGqlChecks((prev) => ({
        ...prev,
        [key]: {
          checked: true,
          online: false,
          detail: e.message || 'Probe failed.',
        },
      }));
    }
  }, []);

  useEffect(() => {
    setGqlChecks((prev) => ({
      ...prev,
      local: { checked: false, online: true, detail: 'Status pending.' },
      browser: { checked: false, online: true, detail: 'Status pending.' },
      externalRead: { checked: false, online: true, detail: 'Status pending.' },
      externalWrite: { checked: false, online: true, detail: 'Status pending.' },
    }));
    probeGraphqlEndpoint(localGraphqlAddress, 'local');
    probeGraphqlEndpoint(browserGraphqlAddress, 'browser');
    probeGraphqlEndpoint(externalReadGraphqlAddress, 'externalRead');
    probeGraphqlEndpoint(externalWriteGraphqlAddress, 'externalWrite');
  }, [browserGraphqlAddress, externalReadGraphqlAddress, externalWriteGraphqlAddress, localGraphqlAddress, probeGraphqlEndpoint]);

  const handleSaveDirectEndpoint = useCallback(async (mode) => {
    const source = mode === 'write' ? directWriteSource : directReadSource;
    const draft = mode === 'write' ? directWriteEndpointDraft : directReadEndpointDraft;
    if (!source) return;
    const nextEndpoint = draft.trim();
    setSourceSaveError(null);
    setSourceSaveStatus(null);
    if (!nextEndpoint) {
      setSourceSaveError('Enter a valid endpoint URL before saving.');
      return;
    }
    setSourceSaving(true);
    try {
      const payload = {
        ...(source.connectionConfig || {}),
        endpoint: nextEndpoint,
        mode,
      };
      const data = await trackedFetchGraphql({
        query: UPDATE_DATA_SOURCE_MUTATION,
        variables: {
          sourceName: source.sourceName,
          connectionConfig: payload,
        },
        component: 'InstanceConnectionPanel',
        purpose: `Update direct source endpoint (${mode})`,
        tableName: 'data_source',
      });
      setSourceSaveStatus(`Direct source ${mode} endpoint updated.`);
      setDataSources((prev) =>
        prev.map((source) =>
          source.sourceName === data?.updateDataSourceConnection?.sourceName
            ? data?.updateDataSourceConnection || source
            : source
        )
      );
    } catch (e) {
      setSourceSaveError(e.message || 'Failed to update direct source endpoint.');
    } finally {
      setSourceSaving(false);
    }
  }, [directReadEndpointDraft, directReadSource, directWriteEndpointDraft, directWriteSource]);

  const handleSaveIntegrationSettings = useCallback(async () => {
    setIntegrationError(null);
    setIntegrationStatus(null);
    setIntegrationSaving(true);
    try {
      const input = {};
      if (integrationDraft.aisstreamApiKey.trim()) {
        input.aisstreamApiKey = integrationDraft.aisstreamApiKey.trim();
      }
      if (integrationDraft.vesselfinderApiKey.trim()) {
        input.vesselfinderApiKey = integrationDraft.vesselfinderApiKey.trim();
      }
      if (integrationDraft.marinetrafficApiKey.trim()) {
        input.marinetrafficApiKey = integrationDraft.marinetrafficApiKey.trim();
      }
      input.aishubUsername = integrationDraft.aishubUsername.trim();

      const data = await trackedFetchGraphql({
        query: SAVE_INTEGRATION_SETTINGS_MUTATION,
        variables: { input },
        component: 'InstanceConnectionPanel',
        purpose: 'Save integration settings',
        tableName: 'config_setting',
      });
      setIntegrationSettings(data?.saveIntegrationSettings || null);
      setIntegrationStatus('Integration settings saved.');
      setIntegrationDraft((prev) => ({
        ...prev,
        aisstreamApiKey: '',
        vesselfinderApiKey: '',
        marinetrafficApiKey: '',
      }));
    } catch (e) {
      setIntegrationError(e.message || 'Failed to save integration settings.');
    } finally {
      setIntegrationSaving(false);
    }
  }, [integrationDraft]);

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
    (k) =>
      k.scope === 'graphql-server' &&
      k.importance === 'REQUIRED' &&
      !k.present
  );
  const missingRequiredVite = viteRows.filter(
    (r) =>
      r.key !== 'VITE_GRAPHQL_ENDPOINT' &&
      r.key !== 'VITE_BUILD_TIME' &&
      r.key !== 'VITE_ENVIRONMENT' &&
      r.key !== 'VITE_APP_VERSION' &&
      r.key !== 'VITE_BASE_PATH' &&
      !r.present
  );

  const keysByScope = scopeOrder.map((scope) => ({
    scope,
    keys: serverKeys
      .filter((k) => k.scope === scope)
      .sort((a, b) => importanceRank[a.importance] - importanceRank[b.importance]),
  }));

  const targetById = new Map((profile?.dataTargets || []).map((t) => [t.id, t]));
  const providerState = (id, configured) => {
    const target = targetById.get(id);
    if (!configured) {
      return { online: false, detail: target?.detail || 'Not set.' };
    }
    if (!target) return { online: false, detail: 'No status yet.' };
    return { online: !!target.online, detail: target.detail || '' };
  };

  const aisstreamState = providerState('ais_stream', !!integrationSettings?.aisstreamApiKeyPresent);
  const aishubState = providerState('aishub', !!integrationSettings?.aishubUsername);
  const vesselfinderState = providerState('vesselfinder', !!integrationSettings?.vesselfinderApiKeyPresent);
  const marinetrafficState = providerState('marinetraffic', !!integrationSettings?.marinetrafficApiKeyPresent);

  const integrationProviders = [
    {
      id: 'aisstream',
      label: 'AISStream API key',
      inputId: 'aisstream-api-key',
      inputType: 'password',
      draftKey: 'aisstreamApiKey',
      helpUrl: 'https://aisstream.io/apikeys',
      configured: !!integrationSettings?.aisstreamApiKeyPresent,
      online: aisstreamState.online,
      detail: aisstreamState.detail,
      placeholder: integrationSettings?.aisstreamApiKeyPresent ? 'Configured' : 'Not set',
    },
    {
      id: 'aishub',
      label: 'AISHub username',
      inputId: 'aishub-username',
      inputType: 'text',
      draftKey: 'aishubUsername',
      helpUrl: 'https://www.aishub.net/join-us',
      configured: !!integrationSettings?.aishubUsername,
      online: aishubState.online,
      detail: aishubState.detail,
      placeholder: 'AISHub contributor username',
    },
    {
      id: 'vesselfinder',
      label: 'VesselFinder API key',
      inputId: 'vesselfinder-api-key',
      inputType: 'password',
      draftKey: 'vesselfinderApiKey',
      helpUrl: 'https://api.vesselfinder.com/',
      configured: !!integrationSettings?.vesselfinderApiKeyPresent,
      online: vesselfinderState.online,
      detail: vesselfinderState.detail,
      placeholder: integrationSettings?.vesselfinderApiKeyPresent ? 'Configured' : 'Not set',
    },
    {
      id: 'marinetraffic',
      label: 'MarineTraffic API key',
      inputId: 'marinetraffic-api-key',
      inputType: 'password',
      draftKey: 'marinetrafficApiKey',
      helpUrl: 'https://support.marinetraffic.com/en/articles/9552659-api-services',
      configured: !!integrationSettings?.marinetrafficApiKeyPresent,
      online: marinetrafficState.online,
      detail: marinetrafficState.detail,
      placeholder: integrationSettings?.marinetrafficApiKeyPresent ? 'Configured' : 'Not set',
    },
  ];

  const gqlTargets = (() => {
    const makeTarget = (id, label, role, address, key) => {
      const check = gqlChecks[key] || {};
      return {
        id,
        label,
        role,
        address,
        skipped: !check.checked,
        online: check.checked ? !!check.online : true,
        detail: check.detail || 'Status pending.',
      };
    };
    return [
      makeTarget(
        'graphql_local',
        'GraphQL server (local)',
        'Local GraphQL API (host loopback)',
        localGraphqlAddress,
        'local'
      ),
      makeTarget(
        'graphql_browser',
        'GraphQL server (browser)',
        'Browser-facing GraphQL API',
        browserGraphqlAddress,
        'browser'
      ),
      makeTarget(
        'graphql_external_source_read',
        'Celestyal B2B GraphQL (READ)',
        'Direct source for availability panels (recommended: UAT)',
        externalReadGraphqlAddress,
        'externalRead'
      ),
      makeTarget(
        'graphql_external_source_write',
        'Celestyal B2B GraphQL (WRITE)',
        'Direct source for write operations (recommended: Dedicated Talia)',
        externalWriteGraphqlAddress,
        'externalWrite'
      ),
    ].filter((target) => target.address);
  })();

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
                    <dt>GraphQL Node.js runtime</dt>
                    <dd>{profile.nodeRuntimeVersion}</dd>
                  </div>
                  <div>
                    <dt>Validate script doc version</dt>
                    <dd>
                      {profile.validateScriptDocVersion}
                      <span className="dm-instance-profile__note">
                        {' '}
                        — same token as <code>SCRIPT_VERSION</code> in <code>scripts/validate</code>
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
                  <div>
                    <dt>UI Tabulator package</dt>
                    <dd>{TABULATOR_VERSION}</dd>
                  </div>
                  <div>
                    <dt>UI DockView package</dt>
                    <dd>{DOCKVIEW_VERSION}</dd>
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
              {[...(profile.dataTargets || []), ...gqlTargets].map((t) => (
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
            <h4 className="dm-instance-profile__h4">Integration settings (AIS providers)</h4>
            <p className="dm-instance-profile__hint">
              Instance-scoped keys stored in <code>talia_config</code> (never deployed).
              {' '}● configured &amp; reachable · ◐ configured, not reachable · ○ not set.
            </p>
            <div className="talia-card dm-integration-card">
              <div className="dm-integration-grid">
                {integrationProviders.map((provider) => {
                  const state = provider.configured
                    ? provider.online
                      ? 'ok'
                      : 'bad'
                    : 'skipped';
                  return (
                    <div
                      key={provider.id}
                      className={`dm-integration-row dm-integration-row--${state}`}
                    >
                      <span
                        className={`dm-integration-dot dm-integration-dot--${state}`}
                        title={
                          state === 'ok'
                            ? 'Configured and reachable'
                            : state === 'bad'
                              ? 'Configured but not reachable'
                              : 'Not configured'
                        }
                        aria-label={`${provider.label}: ${state}`}
                      />
                      <label className="dm-integration-label" htmlFor={provider.inputId}>
                        {provider.label}
                        <span className="dm-integration-sub">{provider.detail}</span>
                      </label>
                      <input
                        id={provider.inputId}
                        type={provider.inputType}
                        className="admin-input dm-integration-input"
                        value={integrationDraft[provider.draftKey]}
                        onChange={(event) =>
                          setIntegrationDraft((prev) => ({
                            ...prev,
                            [provider.draftKey]: event.target.value,
                          }))
                        }
                        placeholder={provider.placeholder}
                      />
                      <a
                        className="dm-integration-help"
                        href={provider.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get key ↗
                      </a>
                    </div>
                  );
                })}
              </div>
              <div className="dm-integration-footer">
                <button
                  type="button"
                  className="dm-primary-button"
                  onClick={handleSaveIntegrationSettings}
                  disabled={integrationSaving}
                >
                  {integrationSaving ? 'Saving…' : 'Save integration settings'}
                </button>
                {integrationStatus && (
                  <span className="dm-instance-profile__hint dm-integration-footer__status">
                    {integrationStatus}
                  </span>
                )}
              </div>
              {integrationError && (
                <div className="dm-instance-profile__error" role="alert">
                  {integrationError}
                </div>
              )}
            </div>
          </section>

          <section className="dm-instance-profile__section">
            <h4 className="dm-instance-profile__h4">External GraphQL sources</h4>
            <div className="talia-card dm-instance-target dm-instance-target--skipped">
              <div className="dm-instance-target__header">
                <span className="dm-instance-target__label">
                  {directReadSource?.displayName || 'Celestyal B2B GraphQL'}
                </span>
                <span className="dm-instance-target__role">Split read/write Seaware endpoints</span>
              </div>
              <div className="dm-instance-target__body">
                <div className="admin-form-row">
                  <label className="admin-label" htmlFor="dm-direct-source-endpoint-read">
                    Read endpoint (availability/query)
                  </label>
                  <input
                    id="dm-direct-source-endpoint-read"
                    type="text"
                    className="admin-input"
                    value={directReadEndpointDraft}
                    onChange={(event) => setDirectReadEndpointDraft(event.target.value)}
                    placeholder="https://example.com/graphql"
                    disabled={!directReadSource || sourceSaving}
                  />
                </div>
                <div className="dm-integration-footer">
                  <button
                    type="button"
                    className="dm-primary-button"
                    onClick={() => handleSaveDirectEndpoint('read')}
                    disabled={!directReadSource || sourceSaving}
                  >
                    {sourceSaving ? 'Saving…' : 'Save read endpoint'}
                  </button>
                </div>

                <div className="admin-form-row" style={{ marginTop: 12 }}>
                  <label className="admin-label" htmlFor="dm-direct-source-endpoint-write">
                    Write endpoint (mutations)
                  </label>
                  <input
                    id="dm-direct-source-endpoint-write"
                    type="text"
                    className="admin-input"
                    value={directWriteEndpointDraft}
                    onChange={(event) => setDirectWriteEndpointDraft(event.target.value)}
                    placeholder="https://example.com/graphql"
                    disabled={!directWriteSource || sourceSaving}
                  />
                </div>
                <div className="dm-integration-footer">
                  <button
                    type="button"
                    className="dm-primary-button"
                    onClick={() => handleSaveDirectEndpoint('write')}
                    disabled={!directWriteSource || sourceSaving}
                  >
                    {sourceSaving ? 'Saving…' : 'Save write endpoint'}
                  </button>
                  {sourceSaveStatus && !sourceSaveError && (
                    <span className="dm-instance-profile__hint dm-integration-footer__status">
                      {sourceSaveStatus}
                    </span>
                  )}
                </div>
                {sourceSaveError && (
                  <div className="dm-instance-profile__error" role="alert">
                    {sourceSaveError}
                  </div>
                )}
                {!directReadSource && !directWriteSource && (
                  <div className="dm-instance-profile__hint">
                    Data sources <strong>celestyal_b2b_api_read</strong> / <strong>celestyal_b2b_api_write</strong> are not registered on this instance.
                  </div>
                )}
              </div>
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
