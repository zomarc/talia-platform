/**
 * Dense end-to-end Architecture Details board (Views → Details).
 * Full Mermaid architecture + data path, network routing, common components.
 */

import React, { useState } from 'react';
import HoverPreview from '../../shared/HoverPreview';
import MermaidDiagram from '../../focus-panels/DocumentRepository/MermaidDiagram';
import { buildArchitectureMermaid } from './architectureMermaid.js';
import {
  concernForHop,
  concernToState,
  findTarget,
  targetToState,
  worseState,
} from './networkStatus.js';

const HOP_ORDER = ['graphql_process', 'egress_public', 'azure_firewall', 'synapse_sql', 'supabase_kong'];

const HOP_FRIENDLY = {
  graphql_process: { title: 'GraphQL server', blurb: 'Where sync and warehouse calls start' },
  egress_public: { title: 'Static IP gateway', blurb: 'Public identity remote firewalls see' },
  azure_firewall: { title: 'Client firewall', blurb: 'Must allow the public identity' },
  synapse_sql: { title: 'Azure Synapse', blurb: 'Celestyal warehouse — system of record' },
  supabase_kong: { title: 'Talia database', blurb: 'Application Postgres for this instance' },
};

const COMMON_COMPONENTS = [
  {
    id: 'mse',
    title: 'Master Sailing Explorer',
    blurb: 'Primary sailing hierarchy browser',
    detail: 'Canonical selection emitter for sail/ship linking across the workspace.',
    family: 'Inventory',
  },
  {
    id: 'ship_day_berth',
    title: 'Ship Day Berth',
    blurb: 'Physical berths by ship and day',
    detail: 'Operations grain — listens to sail/ship selection via inventory_item.',
    family: 'Inventory',
  },
  {
    id: 'booking_curves',
    title: 'Booking curves / targets',
    blurb: 'Booking pace and target profiles',
    detail: 'Rates & booking family — uses Talia-owned targets and mirrored occupancy.',
    family: 'Rates & booking',
  },
  {
    id: 'data_mgmt',
    title: 'Data Management',
    blurb: 'Sync, integrations, this architecture view',
    detail: 'Admin path for table sync, Instance & keys, and connectivity status.',
    family: 'Admin & data',
  },
  {
    id: 'common_graphql',
    title: 'GraphQL server',
    blurb: 'Single data and control plane',
    detail: 'All panels read through GraphQL. Warehouse calls originate here.',
    family: 'Application',
    live: 'graphql',
  },
  {
    id: 'common_db',
    title: 'Talia database',
    blurb: 'Serving copy for this instance',
    detail: 'Supabase Postgres — mirrors, inventory_item, and Talia-owned tables.',
    family: 'Data',
    live: 'supabase',
  },
  {
    id: 'common_synapse',
    title: 'Azure Synapse',
    blurb: 'Client warehouse',
    detail: 'One-way source of record. Synapse sync pulls into mirrors.',
    family: 'Warehouse',
    live: 'synapse',
  },
  {
    id: 'common_egress',
    title: 'Static IP gateway',
    blurb: 'Allowlisted public egress',
    detail: 'Hetzner WireGuard SNAT — required when Synapse firewall is IP-locked.',
    family: 'Network',
    live: 'egress',
  },
];

const MIRROR_GROUPS = [
  { id: 'm_sail', title: 'Sailings', blurb: 'master_sail and related voyage dims' },
  { id: 'm_res', title: 'Reservations', blurb: 'reservation / current state mirrors' },
  { id: 'm_rates', title: 'Rates', blurb: 'published_rates and cabin occupancy' },
  { id: 'm_ship', title: 'Ship & cabin', blurb: 'ship, cabin, reserve tables' },
  { id: 'm_comp', title: 'Competitor & budget', blurb: 'competitor feeds, budget lookups' },
];

const TALIA_OWNED = [
  { id: 't_targets', title: 'Targets & profiles', blurb: 'booking_targets_supplied, target profiles' },
  { id: 't_rm', title: 'RM findings', blurb: 'rm_findings / engine runs' },
  { id: 't_ops', title: 'Config & ops', blurb: 'sync metadata, focuses, settings' },
];

const AIS_PROVIDERS = [
  { id: 'ais_aisstream', title: 'AISStream', setting: 'aisstreamApiKeyPresent', kind: 'key' },
  { id: 'ais_aishub', title: 'AISHub', setting: 'aishubUsername', kind: 'username' },
  { id: 'ais_vf', title: 'VesselFinder', setting: 'vesselfinderApiKeyPresent', kind: 'key' },
  { id: 'ais_mt', title: 'MarineTraffic', setting: 'marinetrafficApiKeyPresent', kind: 'key' },
];

function flagLabel(state) {
  if (state === 'blocked') return 'Blocked';
  if (state === 'warn') return 'Attention';
  if (state === 'ok') return 'OK';
  if (state === 'unknown') return 'Unknown';
  return null;
}

function hopFriendly(hop) {
  const preset = HOP_FRIENDLY[hop.id];
  if (preset) return preset;
  return { title: hop.label, blurb: hop.note || 'Network step' };
}

function selectHops(hops) {
  const byId = new Map((hops || []).map((h) => [h.id, h]));
  const selected = HOP_ORDER.map((id) => byId.get(id)).filter(Boolean);
  return selected.length ? selected : (hops || []);
}

function aisConfigured(settings, provider) {
  if (!settings) return false;
  const value = settings[provider.setting];
  if (provider.kind === 'username') return Boolean(value && String(value).trim());
  return Boolean(value);
}

function resolveLiveState(liveKey, ctx) {
  const { supabase, synapse, networking, concerns, syncDisabled } = ctx;
  if (liveKey === 'graphql') return { state: 'ok', concern: null, address: 'localhost / this host' };
  if (liveKey === 'supabase') {
    return {
      state: targetToState(supabase),
      concern: supabase && supabase.online === false
        ? { severity: 'high', title: 'Database unreachable', detail: supabase.detail || 'Probe failed.' }
        : null,
      address: supabase?.address,
    };
  }
  if (liveKey === 'synapse') {
    const concern = concernForHop('synapse_sql', concerns);
    return {
      state: worseState(targetToState(synapse), concernToState(concern) || 'ok'),
      concern: concern || (synapse && synapse.online === false
        ? { severity: 'high', title: 'Warehouse unreachable', detail: synapse.detail || 'Probe failed.' }
        : null),
      address: synapse?.address,
    };
  }
  if (liveKey === 'egress') {
    const concern = concernForHop('egress_public', concerns);
    return {
      state: concernToState(concern) || (networking?.egressIpv4 ? 'ok' : 'unknown'),
      concern,
      address: networking?.egressIpv4 || '—',
    };
  }
  if (liveKey === 'sync') {
    return {
      state: syncDisabled ? 'warn' : 'ok',
      concern: syncDisabled
        ? { severity: 'medium', title: 'Sync disabled', detail: 'Warehouse pull is turned off for this instance.' }
        : null,
      address: null,
    };
  }
  return { state: 'static', concern: null, address: null };
}

function DetailNode({ node, onShow, onHide, common = false }) {
  const flag = flagLabel(node.state);
  return (
    <button
      type="button"
      className={[
        'dm-arch-node',
        `dm-arch-node--${node.state || 'static'}`,
        common ? 'dm-arch-node--common' : '',
        node.compact ? 'dm-arch-node--compact' : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${node.title}${flag ? `, ${flag}` : ''}${common ? ', common' : ''}`}
      onMouseEnter={(event) => onShow(node, event.currentTarget.getBoundingClientRect())}
      onMouseLeave={onHide}
      onFocus={(event) => onShow(node, event.currentTarget.getBoundingClientRect())}
      onBlur={onHide}
    >
      <span className="dm-arch-node__title">{node.title}</span>
      {node.blurb ? <span className="dm-arch-node__blurb">{node.blurb}</span> : null}
      {node.address ? <span className="dm-arch-node__addr">{node.address}</span> : null}
      {common ? <span className="dm-arch-node__common-badge">Common</span> : null}
      {flag && node.state !== 'static' ? (
        <span className={`dm-arch-node__flag dm-arch-node__flag--${node.state}`}>{flag}</span>
      ) : null}
    </button>
  );
}

function FlowArrow({ blocked = false, label = null }) {
  return (
    <div
      className={`dm-arch-detailed__arrow${blocked ? ' dm-arch-detailed__arrow--blocked' : ''}`}
      aria-hidden="true"
    >
      {label ? <span className="dm-arch-detailed__arrow-label">{label}</span> : null}
      <span className="dm-arch-detailed__arrow-line" />
    </div>
  );
}

export default function ArchitectureDetailedDiagram({
  profile,
  networking,
  integrationSettings,
  hideMermaid = false,
}) {
  const [tip, setTip] = useState(null);

  const mermaidSource = hideMermaid
    ? ''
    : buildArchitectureMermaid({ profile, networking, integrationSettings });

  const targets = profile?.dataTargets || [];
  const concerns = networking?.concerns || [];
  const supabase = findTarget(targets, 'supabase_postgres');
  const synapse = findTarget(targets, 'azure_synapse');
  const syncDisabled = Boolean(profile?.synapseSyncDisabled);
  const hops = selectHops(networking?.hops);
  const ctx = { supabase, synapse, networking, concerns, syncDisabled };

  const gqlLive = resolveLiveState('graphql', ctx);
  const dbLive = resolveLiveState('supabase', ctx);
  const synapseLive = resolveLiveState('synapse', ctx);
  const egressLive = resolveLiveState('egress', ctx);
  const syncLive = resolveLiveState('sync', ctx);
  const pathBlocked = [egressLive, synapseLive].some((x) => x.state === 'blocked')
    || hops.some((hop) => concernToState(concernForHop(hop.id, concerns)) === 'blocked');

  const commonNodes = COMMON_COMPONENTS.map((item) => {
    if (!item.live) {
      return { ...item, state: 'static', detail: item.detail };
    }
    const live = resolveLiveState(item.live, ctx);
    return {
      ...item,
      state: live.state,
      address: live.address,
      concern: live.concern,
      detail: item.detail,
    };
  });

  const dataPathNodes = [
    {
      id: 'dp_synapse',
      title: 'Azure Synapse',
      blurb: 'Source of record',
      address: synapseLive.address,
      state: synapseLive.state,
      concern: synapseLive.concern,
      detail: 'One-way — Talia does not write back.',
      common: true,
    },
    ...MIRROR_GROUPS.map((g) => ({
      ...g,
      state: syncDisabled ? 'warn' : 'static',
      detail: `${g.blurb}. Landed by Synapse sync.`,
      compact: true,
    })),
    {
      id: 'dp_canon',
      title: 'inventory_item',
      blurb: 'Canonical sail / ship identity',
      detail: 'Source-independent hierarchy. Panels join facts to this layer.',
      state: 'static',
      common: true,
    },
    ...TALIA_OWNED.map((g) => ({
      ...g,
      state: 'static',
      detail: g.blurb,
      compact: true,
    })),
    {
      id: 'dp_serve',
      title: 'Served via GraphQL',
      blurb: 'Panels read here',
      detail: 'UI never talks to Synapse directly.',
      state: gqlLive.state,
      common: true,
    },
  ];

  const hopNodes = hops.map((hop) => {
    const friendly = hopFriendly(hop);
    const concern = concernForHop(hop.id, concerns);
    const state = concernToState(concern) || (hop.kind === 'policy' ? 'policy' : 'ok');
    return {
      id: `hop_${hop.id}`,
      title: friendly.title,
      blurb: friendly.blurb,
      address: hop.address,
      note: hop.note,
      detail: hop.note || friendly.blurb,
      concern,
      state,
      common: hop.id === 'egress_public' || hop.id === 'synapse_sql' || hop.id === 'supabase_kong',
    };
  });

  const aisNodes = AIS_PROVIDERS.map((provider) => {
    const ok = aisConfigured(integrationSettings, provider);
    return {
      id: provider.id,
      title: provider.title,
      blurb: ok ? 'Configured' : 'Not configured',
      detail: ok
        ? 'Credential present under Instance & keys → Integration settings.'
        : 'Missing — ship tracker may be limited for this provider.',
      state: ok ? 'ok' : 'warn',
      concern: ok
        ? null
        : { severity: 'medium', title: 'Not configured', detail: `Add ${provider.title} under Instance & keys.` },
      compact: true,
    };
  });

  const showTip = (node, rect) => {
    if (!rect || !node) {
      setTip(null);
      return;
    }
    setTip({
      rect,
      title: node.title,
      blurb: node.blurb,
      detail: node.detail,
      address: node.address,
      note: node.note,
      concern: node.concern,
      family: node.family,
    });
  };

  const hideTip = () => showTip(null, null);

  return (
    <div className="dm-arch-detailed" aria-label="Architecture details — end-to-end connectivity">
      <p className="dm-arch-detailed__lead">
        Structured connectivity — common components, data path, network routing, and feeds.
      </p>

      {!hideMermaid ? (
        <section className="dm-arch-detailed__section dm-arch-detailed__section--mermaid" aria-label="Full architecture diagram">
          <h4 className="dm-arch-detailed__section-title">Full architecture</h4>
          <div className="dm-arch-detailed__mermaid talia-card">
            <MermaidDiagram source={mermaidSource} />
          </div>
          <p className="dm-arch-detailed__section-lead">
            Labels include live probe tags (OK / ATTN / BLOCKED) from this instance snapshot.
          </p>
        </section>
      ) : null}

      <section className="dm-arch-detailed__section" aria-label="Common components">
        <h4 className="dm-arch-detailed__section-title">Architecture — common components</h4>
        <p className="dm-arch-detailed__section-lead">
          Everyday pieces management usually talks about. Highlighted boxes are the usual path.
        </p>
        <div className="dm-arch-detailed__grid">
          {commonNodes.map((node) => (
            <DetailNode key={node.id} node={node} common onShow={showTip} onHide={hideTip} />
          ))}
        </div>
      </section>

      <section className="dm-arch-detailed__section" aria-label="Data path">
        <h4 className="dm-arch-detailed__section-title">Data path</h4>
        <p className="dm-arch-detailed__section-lead">
          Warehouse → mirrors → canonical inventory_item → Talia-owned tables → GraphQL to the UI.
        </p>
        <div className="dm-arch-detailed__flow dm-arch-detailed__flow--wrap">
          {dataPathNodes.map((node, index) => (
            <React.Fragment key={node.id}>
              {index > 0 ? <FlowArrow blocked={pathBlocked && index === 1} /> : null}
              <DetailNode node={node} common={node.common} onShow={showTip} onHide={hideTip} />
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="dm-arch-detailed__section" aria-label="Network routing">
        <h4 className="dm-arch-detailed__section-title">Network routing</h4>
        <p className="dm-arch-detailed__section-lead">
          How this instance reaches the warehouse and local database. Same live concerns as Instance &amp; keys.
        </p>
        <div className="dm-arch-detailed__flow dm-arch-detailed__flow--wrap">
          {hopNodes.map((node, index) => (
            <React.Fragment key={node.id}>
              {index > 0 ? (
                <FlowArrow blocked={node.state === 'blocked' || hopNodes[index - 1]?.state === 'blocked'} />
              ) : null}
              <DetailNode node={node} common={node.common} onShow={showTip} onHide={hideTip} />
            </React.Fragment>
          ))}
        </div>

        <h5 className="dm-arch-detailed__subsection-title">AIS &amp; external feeds</h5>
        <div className="dm-arch-detailed__grid dm-arch-detailed__grid--feeds">
          {aisNodes.map((node) => (
            <DetailNode key={node.id} node={node} onShow={showTip} onHide={hideTip} />
          ))}
        </div>

        {targets.length > 0 ? (
          <>
            <h5 className="dm-arch-detailed__subsection-title">Live data targets</h5>
            <div className="dm-arch-detailed__chips" aria-label="Live data targets">
              {targets.map((target) => {
                const state = targetToState(target);
                const flag = flagLabel(state);
                return (
                  <button
                    key={target.id}
                    type="button"
                    className={`dm-arch-detailed__chip dm-arch-detailed__chip--${state}`}
                    onMouseEnter={(event) => showTip({
                      title: target.label,
                      blurb: target.role,
                      detail: target.detail,
                      address: target.address,
                      state,
                      concern: state === 'blocked'
                        ? { severity: 'high', title: 'Unreachable', detail: target.detail || 'Probe failed.' }
                        : null,
                    }, event.currentTarget.getBoundingClientRect())}
                    onMouseLeave={hideTip}
                    onFocus={(event) => showTip({
                      title: target.label,
                      blurb: target.role,
                      detail: target.detail,
                      address: target.address,
                      state,
                    }, event.currentTarget.getBoundingClientRect())}
                    onBlur={hideTip}
                  >
                    <span>{target.label}</span>
                    {flag ? <span className="dm-arch-detailed__chip-flag">{flag}</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <HoverPreview open={Boolean(tip)} anchorRect={tip?.rect || null} placement="bottom">
        {tip ? (
          <div className="dm-arch-diagram__tip">
            <strong>{tip.title}</strong>
            {tip.family ? <p className="dm-arch-detailed__tip-family">{tip.family}</p> : null}
            {tip.blurb ? <p>{tip.blurb}</p> : null}
            {tip.detail ? <p>{tip.detail}</p> : null}
            {tip.address ? <p><code>{tip.address}</code></p> : null}
            {tip.note ? <p>{tip.note}</p> : null}
            {tip.concern ? (
              <p className={`dm-arch-diagram__tip-concern dm-arch-diagram__tip-concern--${tip.concern.severity}`}>
                {tip.concern.title}: {tip.concern.detail}
              </p>
            ) : null}
          </div>
        ) : null}
      </HoverPreview>
    </div>
  );
}
