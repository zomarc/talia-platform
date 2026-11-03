/**
 * Shared architecture overview board model (UI + PDF).
 */

import {
  concernForHop,
  concernToState,
  findTarget,
  targetToState,
  worseState,
} from './networkStatus.js';

export const PANEL_FAMILIES = [
  {
    id: 'family_inventory',
    title: 'Inventory',
    blurb: 'Sailing hierarchy, berths, physical capacity',
    examples: ['Master Sailing Explorer', 'Ship Day Berth', 'Inventory tables'],
  },
  {
    id: 'family_rates',
    title: 'Rates & booking',
    blurb: 'Published rates, booking curves, targets and profiles',
    examples: ['Booking target chart', 'Published rates', 'Target profiles'],
  },
  {
    id: 'family_ship',
    title: 'Ship & demand',
    blurb: 'Ship tracker, competitor, search and trends',
    examples: ['Ship Tracker Map', 'Competitor', 'Search / Trends'],
  },
  {
    id: 'family_admin',
    title: 'Admin & data',
    blurb: 'Data Management, RM checklist, operations',
    examples: ['Data Management', 'RM checklist', 'Ops panels'],
  },
];

export function buildArchitectureOverviewLayers({ profile, networking, integrationSettings } = {}) {
  const targets = profile?.dataTargets || [];
  const concerns = networking?.concerns || [];
  const supabase = findTarget(targets, 'supabase_postgres');
  const synapse = findTarget(targets, 'azure_synapse');

  const egressConcern = concernForHop('egress_public', concerns);
  const firewallConcern = concernForHop('azure_firewall', concerns);
  const synapseConcern = concernForHop('synapse_sql', concerns);

  const egressState = concernToState(egressConcern) || (networking?.egressIpv4 ? 'ok' : 'unknown');
  const firewallState = concernToState(firewallConcern) || 'policy';
  const synapseState = worseState(
    targetToState(synapse),
    concernToState(synapseConcern) || 'ok',
  );

  const aisConfigured = Boolean(
    integrationSettings?.aisstreamApiKeyPresent
    || (integrationSettings?.aishubUsername && String(integrationSettings.aishubUsername).trim())
    || integrationSettings?.vesselfinderApiKeyPresent
    || integrationSettings?.marinetrafficApiKeyPresent,
  );

  const syncDisabled = Boolean(profile?.synapseSyncDisabled);

  const people = [
    {
      id: 'users',
      title: 'Users',
      blurb: 'Revenue and commercial teams in the browser',
      detail: 'Sign in and open Dockview workspaces. The warehouse is never called from the browser.',
      state: 'static',
      layer: 'people',
    },
  ];

  const workspace = [
    {
      id: 'dockview',
      title: 'Dockview workspace',
      blurb: 'Drag-and-drop focus panels',
      detail: 'Layouts persist per focus. Panels talk through shared sail/ship selection events.',
      state: 'static',
      layer: 'workspace',
    },
    ...PANEL_FAMILIES.map((family) => ({
      id: family.id,
      title: family.title,
      blurb: family.blurb,
      detail: `Example panels: ${family.examples.join(', ')}.`,
      state: 'static',
      layer: 'workspace',
      family: true,
    })),
  ];

  const application = [
    {
      id: 'graphql',
      title: 'GraphQL server',
      blurb: 'Single data and control plane for this instance',
      detail: [
        profile?.graphqlServerPackageVersion ? `Package ${profile.graphqlServerPackageVersion}` : null,
        profile?.nodeRuntimeVersion ? `Node ${profile.nodeRuntimeVersion}` : null,
        profile?.nodeEnv ? `NODE_ENV=${profile.nodeEnv}` : null,
      ].filter(Boolean).join(' · ') || 'This process serves the UI and runs sync.',
      address: 'localhost / this host',
      state: 'ok',
      layer: 'application',
    },
    {
      id: 'synapse_sync',
      title: 'Synapse sync',
      blurb: 'One-way pull from the client warehouse',
      detail: syncDisabled
        ? 'Sync is disabled on this instance (SYNAPSE_SYNC_DISABLED or equivalent).'
        : 'Warehouse and sync calls originate on the GraphQL server — not the browser.',
      state: syncDisabled ? 'warn' : 'ok',
      concern: syncDisabled
        ? { severity: 'medium', title: 'Sync disabled', detail: 'Warehouse pull is turned off for this instance.' }
        : null,
      layer: 'application',
    },
    {
      id: 'ais_feeds',
      title: 'AIS & feeds',
      blurb: 'Ship positions and external look-ups',
      detail: aisConfigured
        ? 'At least one AIS provider key or username is configured.'
        : 'No AIS provider credentials detected. Ship tracker may be limited.',
      state: aisConfigured ? 'ok' : 'warn',
      concern: aisConfigured
        ? null
        : { severity: 'medium', title: 'Feeds not configured', detail: 'Add AIS keys under Instance & keys → Integration settings.' },
      layer: 'application',
    },
  ];

  const data = [
    {
      id: 'supabase',
      title: 'Talia database',
      blurb: 'Application Postgres for this instance',
      detail: supabase?.detail || 'Serving copy used by panels and sync.',
      address: supabase?.address,
      state: targetToState(supabase),
      concern: supabase && supabase.online === false
        ? { severity: 'high', title: 'Database unreachable', detail: supabase.detail || 'Probe failed.' }
        : null,
      layer: 'data',
    },
    {
      id: 'inventory_item',
      title: 'inventory_item',
      blurb: 'Canonical sail and ship identity',
      detail: 'Source-independent hierarchy. Panels join facts to this layer — they do not re-derive master↔segment links.',
      state: 'static',
      layer: 'data',
    },
    {
      id: 'mirrors',
      title: 'Synapse mirrors',
      blurb: 'Synced warehouse tables in Talia',
      detail: 'master_sail, reservations, rates, occupancy, ship/cabin, competitor, budget, and related mirrors.',
      state: syncDisabled ? 'warn' : 'static',
      layer: 'data',
    },
  ];

  const path = [
    {
      id: 'static_ip',
      title: 'Static IP gateway',
      blurb: 'Public identity seen by remote firewalls',
      detail: networking?.egressSource
        ? `Detected via ${networking.egressSource}.`
        : 'Hetzner WireGuard gateway SNAT when the tunnel is up.',
      address: networking?.egressIpv4 || '—',
      state: egressState,
      concern: egressConcern,
      layer: 'path',
    },
    {
      id: 'firewall',
      title: 'Client firewall',
      blurb: 'Must allow the public identity',
      detail: networking?.egressIpv4
        ? `${networking.egressIpv4}/32 must be on the Synapse / SQL allowlist.`
        : 'Egress IP unknown — cannot verify allowlist.',
      state: firewallState,
      concern: firewallConcern,
      layer: 'path',
    },
    {
      id: 'synapse',
      title: 'Azure Synapse',
      blurb: 'Celestyal warehouse — system of record',
      detail: synapse?.detail || 'One-way source for sync. Talia does not write back.',
      address: synapse?.address,
      state: synapseState,
      concern: synapseConcern || (synapse && synapse.online === false
        ? { severity: 'high', title: 'Warehouse unreachable', detail: synapse.detail || 'Probe failed.' }
        : null),
      layer: 'path',
    },
  ];

  return { people, workspace, application, data, path };
}
