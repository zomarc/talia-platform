/**
 * Architecture overview / details — monochrome HTML print report.
 *
 * Framework rule: print diagrams are HTML (printDiagramHtml), never Mermaid SVG.
 * On-screen Mermaid stays interactive; PDF uses this readable card topology.
 * Platform logo/datetime chrome is injected by panelDataExport.
 */

import { buildArchitectureOverviewLayers } from '../components/admin/data-management/architectureOverviewModel.js';
import {
  concernForHop,
  concernToState,
  findTarget,
  targetToState,
  worseState,
} from '../components/admin/data-management/networkStatus.js';
import {
  PRINT_DIAGRAM_CSS,
  printDiagramBand,
  printDiagramCard,
  printDiagramHFlow,
  printDiagramVArrow,
  printStatusLabel,
} from './printDiagramHtml.js';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function aisFlag(settings, key, kind = 'key') {
  if (!settings) return false;
  const value = settings[key];
  if (kind === 'username') return Boolean(value && String(value).trim());
  return Boolean(value);
}

function buildStatusStrip({ profile, networking, integrationSettings } = {}) {
  const targets = profile?.dataTargets || [];
  const concerns = networking?.concerns || [];
  const supabase = findTarget(targets, 'supabase_postgres');
  const synapse = findTarget(targets, 'azure_synapse');
  const egressConcern = concernForHop('egress_public', concerns);
  const fwConcern = concernForHop('azure_firewall', concerns);
  const synConcern = concernForHop('synapse_sql', concerns);

  const feedsOk = Boolean(
    aisFlag(integrationSettings, 'aisstreamApiKeyPresent')
    || aisFlag(integrationSettings, 'aishubUsername', 'username')
    || aisFlag(integrationSettings, 'vesselfinderApiKeyPresent')
    || aisFlag(integrationSettings, 'marinetrafficApiKeyPresent'),
  );
  const syncDisabled = Boolean(profile?.synapseSyncDisabled);

  const chips = [
    { label: 'Egress', value: networking?.egressIpv4 || '—', state: concernToState(egressConcern) || (networking?.egressIpv4 ? 'ok' : 'unknown') },
    { label: 'Database', value: printStatusLabel(targetToState(supabase)) || '—', state: targetToState(supabase) },
    { label: 'Firewall', value: printStatusLabel(concernToState(fwConcern) || 'unknown') || '—', state: concernToState(fwConcern) || 'unknown' },
    {
      label: 'Synapse',
      value: printStatusLabel(worseState(targetToState(synapse), concernToState(synConcern) || 'ok')) || '—',
      state: worseState(targetToState(synapse), concernToState(synConcern) || 'ok'),
    },
    { label: 'Feeds', value: feedsOk ? 'OK' : 'ATTN', state: feedsOk ? 'ok' : 'warn' },
    { label: 'Sync', value: syncDisabled ? 'DISABLED' : 'OK', state: syncDisabled ? 'warn' : 'ok' },
  ];

  return `<div class="arch-status-strip" role="group" aria-label="Live probe status">
    ${chips.map((chip) => `
      <div class="arch-chip arch-chip--${esc(chip.state)}">
        <span class="arch-chip__label">${esc(chip.label)}</span>
        <span class="arch-chip__value">${esc(chip.value)}</span>
      </div>`).join('')}
  </div>`;
}

function buildArchitectureBoardHtml({ profile, networking, integrationSettings } = {}) {
  const layers = buildArchitectureOverviewLayers({ profile, networking, integrationSettings });
  const pathBlocked = layers.path.some((n) => n.state === 'blocked');
  const dock = layers.workspace[0];
  const families = layers.workspace.slice(1);

  return `<div class="arch-board">
    ${printDiagramBand('People', layers.people.map((n) => printDiagramCard(n)).join(''))}
    ${printDiagramVArrow('HTTPS')}
    ${printDiagramBand('Workspace — talia-ui / Dockview', `
      ${printDiagramCard(dock)}
      <div class="pd-band__cards" style="width:100%;margin-top:2mm">${families.map((n) => printDiagramCard({ ...n, compact: true })).join('')}</div>
    `)}
    ${printDiagramVArrow('GraphQL')}
    ${printDiagramBand('Application — talia-server', layers.application.map((n) => printDiagramCard(n)).join(''))}
    ${printDiagramVArrow('Reads & sync', pathBlocked)}
    <div class="pd-split">
      ${printDiagramBand('Data — Supabase', layers.data.map((n) => printDiagramCard(n)).join(''))}
      ${printDiagramBand('Path to warehouse', layers.path.map((n) => printDiagramCard(n)).join(''))}
    </div>
    <p class="arch-footnote">Warehouse sync is one-way into Talia mirrors → canonical inventory_item. The browser never talks to Synapse.</p>
  </div>`;
}

/**
 * Details connectivity — same topology as the on-screen Mermaid, as print HTML.
 * This is the readable PDF “diagram”; Mermaid is UI-only.
 */
function buildConnectivityDiagramHtml({ profile, networking, integrationSettings } = {}) {
  const targets = profile?.dataTargets || [];
  const concerns = networking?.concerns || [];
  const supabase = findTarget(targets, 'supabase_postgres');
  const synapse = findTarget(targets, 'azure_synapse');
  const syncDisabled = Boolean(profile?.synapseSyncDisabled);
  const egressConcern = concernForHop('egress_public', concerns);
  const fwConcern = concernForHop('azure_firewall', concerns);
  const synConcern = concernForHop('synapse_sql', concerns);

  const dbState = targetToState(supabase);
  const syncState = syncDisabled ? 'warn' : 'ok';
  const egressState = concernToState(egressConcern) || (networking?.egressIpv4 ? 'ok' : 'unknown');
  const fwState = concernToState(fwConcern) || 'policy';
  const synState = worseState(targetToState(synapse), concernToState(synConcern) || 'ok');

  const gqlBlurb = [
    profile?.graphqlServerPackageVersion ? `Package ${profile.graphqlServerPackageVersion}` : null,
    profile?.nodeEnv || null,
  ].filter(Boolean).join(' · ') || 'Single data and control plane';

  const access = printDiagramHFlow([
    { title: 'Users', blurb: 'Browser clients', state: 'static' },
    { title: 'InstantDB auth', blurb: 'Session for Dockview', state: 'static' },
  ]);

  const ui = printDiagramBand('talia-ui — React / Vite / Dockview', [
    printDiagramCard({ title: 'Dockview layouts', blurb: 'Persisted focus workspaces', state: 'static' }),
    printDiagramCard({ title: 'Inventory', blurb: 'MSE · Ship Day Berth · Cabin', state: 'static', compact: true }),
    printDiagramCard({ title: 'Rates & booking', blurb: 'Published rates · curves · targets', state: 'static', compact: true }),
    printDiagramCard({ title: 'Ship & demand', blurb: 'Tracker · competitor · search', state: 'static', compact: true }),
    printDiagramCard({ title: 'Admin', blurb: 'Data Management · RM checklist', state: 'static', compact: true }),
  ].join(''));

  const api = printDiagramBand('talia-server — Apollo GraphQL', [
    printDiagramCard({ title: 'GraphQL server', blurb: gqlBlurb, address: 'localhost / this host', state: 'ok' }),
    printDiagramCard({ title: 'Synapse sync', blurb: 'One-way warehouse pull', state: syncState }),
    printDiagramCard({ title: 'Ship position / AIS', blurb: 'Aggregator for feeds', state: 'static' }),
    printDiagramCard({ title: 'Instance probes', blurb: 'egress · targets · concerns', state: 'ok' }),
  ].join(''));

  const engine = printDiagramBand('talia-engine (optional)', printDiagramHFlow([
    { title: 'RM agent runtime', blurb: 'Optional worker', state: 'static' },
    { title: 'rm_findings', blurb: 'Written to Postgres', state: 'static' },
  ]));

  const db = printDiagramBand('Supabase Postgres — serving copy', [
    printDiagramCard({ title: 'Kong / PostgREST', blurb: 'API gateway to Postgres', state: 'static', compact: true }),
    printDiagramCard({ title: 'Postgres', blurb: 'Application database', address: supabase?.address, state: dbState }),
    printDiagramCard({ title: 'Mirrors: sailings', blurb: 'master_sail', state: syncDisabled ? 'warn' : 'static', compact: true }),
    printDiagramCard({ title: 'Mirrors: reservations', blurb: 'reservation mirrors', state: syncDisabled ? 'warn' : 'static', compact: true }),
    printDiagramCard({ title: 'Mirrors: rates / occupancy', blurb: 'published rates', state: syncDisabled ? 'warn' : 'static', compact: true }),
    printDiagramCard({ title: 'Mirrors: ship / cabin', blurb: 'physical inventory', state: syncDisabled ? 'warn' : 'static', compact: true }),
    printDiagramCard({ title: 'Mirrors: competitor / budget', blurb: 'commercial feeds', state: syncDisabled ? 'warn' : 'static', compact: true }),
    printDiagramCard({ title: 'inventory_item', blurb: 'Canonical sail / ship identity', state: 'static', badge: 'CANONICAL' }),
    printDiagramCard({ title: 'Talia-owned', blurb: 'targets · profiles · RM · config', state: 'static', compact: true }),
  ].join(''), { note: 'Mirrors → inventory_item → Postgres. Engine findings land in Postgres.' });

  const netPathBlocked = [egressState, synState].includes('blocked');
  const net = printDiagramBand('Network path to Celestyal warehouse', printDiagramHFlow([
    { title: 'App host', blurb: 'Mac / MiniPC / Azure VM', state: 'static' },
    { title: 'Static IP gateway', blurb: 'WireGuard SNAT', address: networking?.egressIpv4 || '—', state: egressState },
    { title: 'Synapse firewall', blurb: 'Allowlist public identity', state: fwState },
    { title: 'Azure Synapse SQL', blurb: 'System of record (one-way)', address: synapse?.address, state: synState },
  ]), { note: 'Sync originates on GraphQL server → TCP 1433 via egress. Talia does not write back.' });

  const feeds = printDiagramBand('External feeds', [
    printDiagramCard({
      title: 'AISStream',
      blurb: aisFlag(integrationSettings, 'aisstreamApiKeyPresent') ? 'Configured' : 'Not configured',
      state: aisFlag(integrationSettings, 'aisstreamApiKeyPresent') ? 'ok' : 'warn',
      compact: true,
    }),
    printDiagramCard({
      title: 'AISHub',
      blurb: aisFlag(integrationSettings, 'aishubUsername', 'username') ? 'Configured' : 'Not configured',
      state: aisFlag(integrationSettings, 'aishubUsername', 'username') ? 'ok' : 'warn',
      compact: true,
    }),
    printDiagramCard({
      title: 'VesselFinder',
      blurb: aisFlag(integrationSettings, 'vesselfinderApiKeyPresent') ? 'Configured' : 'Not configured',
      state: aisFlag(integrationSettings, 'vesselfinderApiKeyPresent') ? 'ok' : 'warn',
      compact: true,
    }),
    printDiagramCard({
      title: 'MarineTraffic',
      blurb: aisFlag(integrationSettings, 'marinetrafficApiKeyPresent') ? 'Configured' : 'Not configured',
      state: aisFlag(integrationSettings, 'marinetrafficApiKeyPresent') ? 'ok' : 'warn',
      compact: true,
    }),
    printDiagramCard({ title: 'Search / Trends', blurb: 'Google Search / Trends', state: 'static', compact: true }),
  ].join(''));

  const probeCards = (targets || []).slice(0, 8).map((t) => printDiagramCard({
    title: t.label || t.id,
    blurb: t.role || '',
    address: t.address,
    state: targetToState(t),
    compact: true,
  })).join('');

  const probes = printDiagramBand(
    'Live data targets',
    probeCards || printDiagramCard({ title: 'No targets in snapshot', state: 'unknown' }),
  );

  return `<div class="arch-connectivity">
    <h2>System connectivity</h2>
    <p class="meta">Print diagram of the Details architecture (same topology as the on-screen Mermaid). Boxes and status always render in PDF.</p>
    ${printDiagramBand('Access', access)}
    ${printDiagramVArrow('session')}
    ${ui}
    ${printDiagramVArrow('GraphQL')}
    <div class="pd-split">
      ${api}
      ${engine}
    </div>
    ${printDiagramVArrow('reads · sync · probes')}
    ${db}
    ${printDiagramVArrow('TCP 1433 via egress', netPathBlocked)}
    ${net}
    ${printDiagramVArrow('feeds → AIS aggregator')}
    ${feeds}
    ${printDiagramVArrow('probe results')}
    ${probes}
  </div>`;
}

function buildDetailsSectionsHtml({ profile, networking, integrationSettings } = {}) {
  const targets = profile?.dataTargets || [];
  const concerns = networking?.concerns || [];
  const supabase = findTarget(targets, 'supabase_postgres');
  const synapse = findTarget(targets, 'azure_synapse');
  const syncDisabled = Boolean(profile?.synapseSyncDisabled);
  const egressConcern = concernForHop('egress_public', concerns);
  const synapseConcern = concernForHop('synapse_sql', concerns);

  const common = [
    { title: 'Master Sailing Explorer', blurb: 'Primary sailing hierarchy browser', state: 'static', badge: 'COMMON' },
    { title: 'Ship Day Berth', blurb: 'Physical berths by ship and day', state: 'static', badge: 'COMMON' },
    { title: 'Booking curves / targets', blurb: 'Booking pace and target profiles', state: 'static', badge: 'COMMON' },
    { title: 'Data Management', blurb: 'Sync, integrations, architecture', state: 'static', badge: 'COMMON' },
    {
      title: 'GraphQL server',
      blurb: 'Single data and control plane',
      address: 'localhost / this host',
      state: 'ok',
      badge: 'COMMON',
    },
    {
      title: 'Talia database',
      blurb: 'Application Postgres',
      address: supabase?.address,
      state: targetToState(supabase),
      badge: 'COMMON',
    },
    {
      title: 'Azure Synapse',
      blurb: 'Client warehouse',
      address: synapse?.address,
      state: worseState(targetToState(synapse), concernToState(synapseConcern) || 'ok'),
      badge: 'COMMON',
    },
    {
      title: 'Static IP gateway',
      blurb: 'Allowlisted public egress',
      address: networking?.egressIpv4 || '—',
      state: concernToState(egressConcern) || (networking?.egressIpv4 ? 'ok' : 'unknown'),
      badge: 'COMMON',
    },
  ];

  const dataPath = [
    {
      title: 'Azure Synapse',
      blurb: 'Source of record',
      address: synapse?.address,
      state: worseState(targetToState(synapse), concernToState(synapseConcern) || 'ok'),
      badge: 'COMMON',
    },
    {
      title: 'Synapse mirrors',
      blurb: 'sailings · reservations · rates · ship',
      state: syncDisabled ? 'warn' : 'static',
    },
    { title: 'inventory_item', blurb: 'Canonical sail / ship identity', state: 'static', badge: 'COMMON' },
    { title: 'Talia-owned tables', blurb: 'targets · profiles · RM · config', state: 'static' },
    { title: 'GraphQL → UI', blurb: 'Panels read here', state: 'ok', badge: 'COMMON' },
  ];

  const hops = (networking?.hops || []).map((hop) => {
    const concern = concernForHop(hop.id, concerns);
    return {
      title: hop.label || hop.id,
      blurb: hop.note || '',
      address: hop.address,
      state: concernToState(concern) || (hop.kind === 'policy' ? 'unknown' : 'ok'),
      badge: hop.id === 'egress_public' || hop.id === 'synapse_sql' || hop.id === 'supabase_kong' ? 'COMMON' : '',
    };
  });

  const fallbackHops = [
    { title: 'GraphQL server', blurb: 'Origin of warehouse calls', state: 'ok', badge: 'COMMON' },
    {
      title: 'Static IP gateway',
      blurb: 'Public egress identity',
      address: networking?.egressIpv4,
      state: concernToState(egressConcern) || (networking?.egressIpv4 ? 'ok' : 'unknown'),
      badge: 'COMMON',
    },
    {
      title: 'Azure Synapse',
      blurb: 'Warehouse',
      address: synapse?.address,
      state: worseState(targetToState(synapse), concernToState(synapseConcern) || 'ok'),
      badge: 'COMMON',
    },
  ];

  const ais = [
    { key: 'aisstreamApiKeyPresent', title: 'AISStream', kind: 'key' },
    { key: 'aishubUsername', title: 'AISHub', kind: 'username' },
    { key: 'vesselfinderApiKeyPresent', title: 'VesselFinder', kind: 'key' },
    { key: 'marinetrafficApiKeyPresent', title: 'MarineTraffic', kind: 'key' },
  ].map((provider) => {
    const ok = aisFlag(integrationSettings, provider.key, provider.kind);
    return {
      title: provider.title,
      blurb: ok ? 'Configured' : 'Not configured',
      state: ok ? 'ok' : 'warn',
      compact: true,
    };
  });

  return `<div class="arch-details">
    <h2>Architecture — common components</h2>
    <p class="meta">Everyday pieces management usually talks about.</p>
    <div class="pd-band__cards">${common.map((n) => printDiagramCard(n)).join('')}</div>

    <h2>Data path</h2>
    <p class="meta">Warehouse → mirrors → inventory_item → Talia-owned → GraphQL.</p>
    ${printDiagramHFlow(dataPath)}

    <h2>Network routing</h2>
    <p class="meta">How this instance reaches the warehouse and local database.</p>
    ${printDiagramHFlow(hops.length ? hops : fallbackHops)}

    <h2>AIS &amp; external feeds</h2>
    <div class="pd-band__cards">${ais.map((n) => printDiagramCard(n)).join('')}</div>
  </div>`;
}

const PRINT_CSS = `
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #ffffff;
  color: #111111;
  font-family: Inter, "Source Sans 3", system-ui, sans-serif;
  font-size: 10px;
  line-height: 1.35;
}
@page { size: A4 landscape; margin: 8mm; }
@media print {
  html, body {
    background: #ffffff !important;
    color: #111111 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
h1 { margin: 0 0 1mm; font-size: 16px; color: #111111; }
h2 { margin: 3.5mm 0 1.5mm; font-size: 12px; color: #111111; page-break-after: avoid; }
.meta { margin: 0 0 2mm; color: #555555; }

.arch-status-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm;
  margin: 0 0 3mm;
}
.arch-chip {
  border: 1.25px solid #111111;
  padding: 1.2mm 2mm;
  min-width: 28mm;
  background: #ffffff;
  break-inside: avoid;
  page-break-inside: avoid;
}
.arch-chip--blocked { background: #e8e8e8; border-width: 2px; }
.arch-chip--warn { border-style: dashed; }
.arch-chip__label {
  display: block;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #555555;
}
.arch-chip__value {
  display: block;
  margin-top: 0.4mm;
  font-size: 10px;
  font-weight: 700;
  color: #111111;
}

.arch-board { margin: 0 0 2mm; }
.arch-connectivity { margin: 0 0 2mm; }
.arch-footnote {
  margin: 2mm 0 0;
  font-size: 8px;
  color: #555555;
}
.arch-details { margin-top: 1mm; }

${PRINT_DIAGRAM_CSS}

table { width: 100%; border-collapse: collapse; margin: 0 0 2mm; }
th, td {
  border: 1px solid #111111;
  padding: 1.3mm 1.6mm;
  vertical-align: top;
  text-align: left;
  color: #111111;
  background: #ffffff;
}
th { background: #f0f0f0; font-weight: 650; }
tr.blocked td { font-weight: 650; }
tr { break-inside: avoid; page-break-inside: avoid; }
`;

/**
 * @param {object} opts
 * @param {string} opts.mode overview|details
 * @param {object} [opts.profile]
 * @param {object} [opts.networking]
 * @param {object} [opts.integrationSettings]
 * @param {string} [opts.collectedAt]
 * @param {Array} [opts.targets]
 * @param {Array} [opts.concerns]
 * @param {string} [opts.egressIpv4]
 */
export function buildArchitectureExport({
  mode = 'overview',
  profile = null,
  networking = null,
  integrationSettings = null,
  collectedAt = '',
  targets = [],
  concerns = [],
  egressIpv4 = '',
} = {}) {
  const isDetails = mode === 'details';
  const title = isDetails ? 'Talia architecture details' : 'Talia architecture overview';
  const net = networking || profile?.networking || null;

  let visual = `
    ${buildStatusStrip({ profile, networking: net, integrationSettings })}
  `;

  if (isDetails) {
    visual += buildConnectivityDiagramHtml({ profile, networking: net, integrationSettings });
  }

  visual += `
    <h2>Architecture board</h2>
    <p class="meta">Layered stack with live probe status on each box.</p>
    ${buildArchitectureBoardHtml({ profile, networking: net, integrationSettings })}
  `;

  if (isDetails) {
    visual += buildDetailsSectionsHtml({ profile, networking: net, integrationSettings });
  }

  const concernRows = (concerns || []).map((c) => (
    `<tr class="${c.severity === 'high' ? 'blocked' : ''}">
      <td>${esc(c.severity || '')}</td>
      <td>${esc(c.title || '')}</td>
      <td>${esc(c.detail || '')}</td>
    </tr>`
  )).join('\n');

  const targetRows = (targets || []).map((t) => {
    const status = t.skipped ? 'skipped' : (t.online === true ? 'online' : (t.online === false ? 'blocked' : 'unknown'));
    return `<tr class="${status === 'blocked' ? 'blocked' : ''}">
      <td>${esc(t.label || t.id || '')}</td>
      <td>${esc(t.role || '')}</td>
      <td>${esc(status)}</td>
      <td>${esc(t.address || '')}</td>
      <td>${esc(t.detail || '')}</td>
    </tr>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="meta">
    ${esc(collectedAt ? `Snapshot ${collectedAt}` : 'Live architecture export')}
    ${egressIpv4 ? ` · Egress ${esc(egressIpv4)}` : ''}
  </p>
  ${visual}
  ${(concerns || []).length ? `
  <h2>Concerns</h2>
  <table>
    <thead><tr><th>Severity</th><th>Title</th><th>Detail</th></tr></thead>
    <tbody>${concernRows}</tbody>
  </table>` : ''}
  ${(targets || []).length ? `
  <h2>Data targets</h2>
  <table>
    <thead><tr><th>Target</th><th>Role</th><th>Status</th><th>Address</th><th>Detail</th></tr></thead>
    <tbody>${targetRows}</tbody>
  </table>` : ''}
</body>
</html>`;

  return {
    title,
    html,
    columns: [
      { field: 'section', title: 'Section' },
      { field: 'item', title: 'Item' },
      { field: 'detail', title: 'Detail' },
    ],
    rows: [
      ...(concerns || []).map((c) => ({
        section: 'Concern',
        item: c.title || '',
        detail: `${c.severity || ''}: ${c.detail || ''}`,
      })),
      ...(targets || []).map((t) => ({
        section: 'Target',
        item: t.label || t.id || '',
        detail: `${t.online === false ? 'blocked' : (t.online ? 'online' : 'unknown')} · ${t.address || ''} · ${t.detail || ''}`,
      })),
    ],
  };
}
