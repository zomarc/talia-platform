import { buildArchitectureExport } from './architecturePrint.js';

const profile = {
  synapseSyncDisabled: false,
  collectedAt: '2026-11-03T11:00:00.000Z',
  graphqlServerPackageVersion: '0.3.1',
  nodeEnv: 'development',
  dataTargets: [
    {
      id: 'supabase_postgres',
      label: 'Supabase Postgres',
      role: 'Primary DB',
      address: 'http://127.0.0.1:54321',
      online: true,
      detail: 'ok',
    },
    {
      id: 'azure_synapse',
      label: 'Azure Synapse SQL',
      role: 'Warehouse',
      address: 'example.sql.azuresynapse.net,1433',
      online: true,
      detail: 'ok',
    },
  ],
};

const networking = {
  egressIpv4: '2.31.203.69',
  concerns: [
    { severity: 'info', title: 'Egress matches expected static IP', detail: '2.31.203.69 matches expected.' },
  ],
  hops: [
    { id: 'graphql_process', label: 'GraphQL server', address: 'localhost', note: 'Origin' },
    { id: 'egress_public', label: 'Static IP gateway', address: '2.31.203.69', note: 'Egress' },
    { id: 'synapse_sql', label: 'Azure Synapse', address: 'example.sql.azuresynapse.net', note: 'Warehouse' },
  ],
};

const integrationSettings = {
  aisstreamApiKeyPresent: true,
  aishubUsername: '',
  vesselfinderApiKeyPresent: true,
  marinetrafficApiKeyPresent: true,
};

const overview = buildArchitectureExport({
  mode: 'overview',
  profile,
  networking,
  integrationSettings,
  collectedAt: '03 Nov 2026 11:00 AM',
  targets: profile.dataTargets,
  concerns: networking.concerns,
  egressIpv4: networking.egressIpv4,
});

if (!overview.html.includes('Architecture board')) throw new Error('overview missing board');
if (overview.html.includes('System connectivity')) throw new Error('overview must not include connectivity diagram');
if (overview.html.includes('<svg') && overview.html.includes('flowchart')) {
  throw new Error('overview must not embed Mermaid');
}
if (overview.html.includes('class="arch-connectivity"')) throw new Error('overview must not include connectivity block');

const details = buildArchitectureExport({
  mode: 'details',
  profile,
  networking,
  integrationSettings,
  collectedAt: '03 Nov 2026 11:00 AM',
  targets: profile.dataTargets,
  concerns: networking.concerns,
  egressIpv4: networking.egressIpv4,
});

if (!details.html.includes('System connectivity')) throw new Error('details missing connectivity heading');
if (!details.html.includes('arch-connectivity')) throw new Error('details missing connectivity block');
if (!details.html.includes('pd-band')) throw new Error('details missing print diagram bands');
if (!details.html.includes('pd-card__title')) throw new Error('details missing print cards');
if (!details.html.includes('inventory_item')) throw new Error('details connectivity missing canonical node');
if (!details.html.includes('Network path to Celestyal warehouse')) {
  throw new Error('details connectivity missing network band');
}
if (!details.html.includes('Architecture — common components')) throw new Error('details missing common components');
// Must be HTML cards, not Mermaid SVG diagram
if (details.html.includes('class="arch-diagram"')) throw new Error('details must not use Mermaid arch-diagram figure');

console.log('architecturePrint.test.mjs ok');
