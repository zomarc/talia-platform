/**
 * Architecture Mermaid sources for Data Management → Architecture.
 * Overview = compact. Details = full connectivity / data path / hosts.
 */

import {
  concernForHop,
  concernToState,
  findTarget,
  targetToState,
  worseState,
} from './networkStatus.js';

function statusTag(state) {
  if (state === 'blocked') return ' BLOCKED';
  if (state === 'warn') return ' ATTN';
  if (state === 'ok') return ' OK';
  if (state === 'unknown') return ' ?';
  return '';
}

function escapeLabel(text) {
  return String(text || '')
    .replace(/"/g, "'")
    .replace(/\n/g, ' ')
    .replace(/[<>]/g, '')
    .slice(0, 90);
}

function aisOk(settings, key, kind = 'key') {
  if (!settings) return false;
  const value = settings[key];
  if (kind === 'username') return Boolean(value && String(value).trim());
  return Boolean(value);
}

function liveContext({ profile, networking, integrationSettings } = {}) {
  const targets = profile?.dataTargets || [];
  const concerns = networking?.concerns || [];
  const supabase = findTarget(targets, 'supabase_postgres');
  const synapse = findTarget(targets, 'azure_synapse');
  const syncDisabled = Boolean(profile?.synapseSyncDisabled);

  const dbState = targetToState(supabase);
  const synConcern = concernForHop('synapse_sql', concerns);
  const synState = worseState(targetToState(synapse), concernToState(synConcern) || 'ok');
  const egressConcern = concernForHop('egress_public', concerns);
  const egressState = concernToState(egressConcern) || (networking?.egressIpv4 ? 'ok' : 'unknown');
  const fwConcern = concernForHop('azure_firewall', concerns);
  const fwState = concernToState(fwConcern) || 'policy';
  const syncState = syncDisabled ? 'warn' : 'ok';

  return {
    targets,
    concerns,
    supabase,
    synapse,
    syncDisabled,
    dbState,
    synState,
    egressState,
    fwState,
    syncState,
    egressIp: escapeLabel(networking?.egressIpv4 || 'unknown'),
    dbAddr: escapeLabel(supabase?.address || 'local Postgres'),
    synAddr: escapeLabel(synapse?.address || 'Azure Synapse'),
    gqlVer: escapeLabel(profile?.graphqlServerPackageVersion || ''),
    nodeEnv: escapeLabel(profile?.nodeEnv || ''),
    aisStream: aisOk(integrationSettings, 'aisstreamApiKeyPresent'),
    aisHub: aisOk(integrationSettings, 'aishubUsername', 'username'),
    vf: aisOk(integrationSettings, 'vesselfinderApiKeyPresent'),
    mt: aisOk(integrationSettings, 'marinetrafficApiKeyPresent'),
  };
}

function styleBlock(blockedIds, warnIds) {
  const blocked = (blockedIds || []).filter(Boolean);
  const warn = (warnIds || []).filter(Boolean);
  const lines = [
    'classDef blocked fill:#5a1d1d,stroke:#e06666,color:#ffe8e8,stroke-width:2px',
    'classDef warn fill:#5a4218,stroke:#d4a017,color:#fff6e0,stroke-width:1.5px',
    'classDef ok fill:#1d3a2a,stroke:#6c9,color:#e8fff0',
  ];
  if (blocked.length) lines.push(`class ${blocked.join(',')} blocked`);
  if (warn.length) lines.push(`class ${warn.join(',')} warn`);
  return lines.join('\n');
}

function pushState(listBlocked, listWarn, id, state) {
  if (state === 'blocked') listBlocked.push(id);
  else if (state === 'warn' || state === 'unknown') listWarn.push(id);
}

/** Compact board companion — used when Details is off (optional). */
export function buildArchitectureMermaid(args = {}) {
  const live = liveContext(args);
  const blocked = [];
  const warn = [];
  pushState(blocked, warn, 'DB', live.dbState);
  pushState(blocked, warn, 'Sync', live.syncState);
  pushState(blocked, warn, 'WG', live.egressState);
  pushState(blocked, warn, 'FW', live.fwState);
  pushState(blocked, warn, 'Syn', live.synState);
  if (!live.aisStream) warn.push('AISStream');
  if (!live.aisHub) warn.push('AISHub');
  if (!live.vf) warn.push('VF');
  if (!live.mt) warn.push('MT');

  return `
flowchart TB
  subgraph people ["People"]
    Users["Users / browser"]
  end

  subgraph workspace ["Workspace talia-ui"]
    Dock["Dockview workspace"]
    MSE["Master Sailing Explorer"]
    Berth["Ship Day Berth"]
    Booking["Booking curves / targets"]
    ShipMap["Ship Tracker Map"]
    DataMgmt["Data Management"]
    Dock --> MSE
    Dock --> Berth
    Dock --> Booking
    Dock --> ShipMap
    Dock --> DataMgmt
  end

  subgraph application ["Application talia-server"]
    GQL["GraphQL server OK"]
    Sync["Synapse sync${statusTag(live.syncState)}"]
    AIS["AIS aggregator"]
  end

  subgraph feeds ["External feeds"]
    AISStream["AISStream${live.aisStream ? ' OK' : ' missing'}"]
    AISHub["AISHub${live.aisHub ? ' OK' : ' missing'}"]
    VF["VesselFinder${live.vf ? ' OK' : ' missing'}"]
    MT["MarineTraffic${live.mt ? ' OK' : ' missing'}"]
  end

  subgraph data ["Talia data Supabase"]
    DB["Talia database${statusTag(live.dbState)}<br/>${live.dbAddr}"]
    Mirrors["Synapse mirrors<br/>sailings · reservations · rates · ship"]
    Canon["inventory_item<br/>canonical sail/ship"]
    Owned["Talia-owned<br/>targets · RM · config"]
    Mirrors --> Canon
    Canon --> DB
    Owned --> DB
  end

  subgraph network ["Path to warehouse"]
    WG["Static IP gateway${statusTag(live.egressState)}<br/>${live.egressIp}"]
    FW["Client firewall${statusTag(live.fwState)}"]
    Syn["Azure Synapse${statusTag(live.synState)}<br/>${live.synAddr}"]
    WG --> FW --> Syn
  end

  Users -->|HTTPS| Dock
  MSE --> GQL
  Berth --> GQL
  Booking --> GQL
  ShipMap --> GQL
  DataMgmt --> GQL
  GQL --> DB
  GQL --> Sync
  Sync -->|one-way| WG
  Syn -.->|sync pull| Mirrors
  AISStream --> AIS
  AISHub --> AIS
  VF --> AIS
  MT --> AIS
  AIS --> GQL

  ${styleBlock(blocked, warn)}
`.trim();
}

/**
 * Full Details diagram — hosts, auth, engine, mirror groups, routing, feeds.
 */
export function buildArchitectureDetailsMermaid(args = {}) {
  const live = liveContext(args);
  const blocked = [];
  const warn = [];
  pushState(blocked, warn, 'PG', live.dbState);
  pushState(blocked, warn, 'Sync', live.syncState);
  pushState(blocked, warn, 'WG', live.egressState);
  pushState(blocked, warn, 'FW', live.fwState);
  pushState(blocked, warn, 'Syn', live.synState);
  if (!live.aisStream) warn.push('AISStream');
  if (!live.aisHub) warn.push('AISHub');
  if (!live.vf) warn.push('VF');
  if (!live.mt) warn.push('MT');

  const gqlLabel = live.gqlVer
    ? `GraphQL ${live.gqlVer}${statusTag('ok')}<br/>${live.nodeEnv || 'this host'}`
    : `GraphQL server${statusTag('ok')}<br/>this host`;

  const targetLines = (live.targets || []).slice(0, 8).map((t) => {
    const state = targetToState(t);
    const id = `T_${String(t.id || 'x').replace(/[^a-zA-Z0-9_]/g, '_')}`;
    pushState(blocked, warn, id, state);
    const label = escapeLabel(`${t.label || t.id}${statusTag(state)}`);
    return `    ${id}["${label}"]`;
  }).join('\n');

  return `
flowchart TB
  subgraph access ["Access"]
    Users["Users"]
    Auth["InstantDB auth"]
    Users --> Auth
  end

  subgraph ui ["talia-ui React / Vite / Dockview"]
    direction TB
    Dock["Dockview layouts"]
    Inv["Inventory<br/>MSE · Ship Day Berth · Cabin"]
    Rates["Rates and booking<br/>Published rates · curves · targets"]
    Demand["Ship and demand<br/>Tracker · competitor · search"]
    Admin["Admin<br/>Data Management · RM checklist"]
    Dock --> Inv
    Dock --> Rates
    Dock --> Demand
    Dock --> Admin
  end

  subgraph api ["talia-server Apollo GraphQL"]
    GQL["${gqlLabel}"]
    Sync["Synapse sync service${statusTag(live.syncState)}"]
    AIS["Ship position / AIS"]
    Probe["Instance probes<br/>egress · targets · concerns"]
  end

  subgraph engine ["talia-engine optional"]
    Eng["RM agent runtime"]
    Findings["rm_findings"]
    Eng --> Findings
  end

  subgraph db ["Supabase Postgres serving copy"]
    Kong["Kong / PostgREST"]
    PG["Postgres${statusTag(live.dbState)}<br/>${live.dbAddr}"]
    SailM["Mirrors: sailings<br/>master_sail"]
    ResM["Mirrors: reservations"]
    RateM["Mirrors: rates / occupancy"]
    ShipM["Mirrors: ship / cabin"]
    CompM["Mirrors: competitor / budget"]
    Canon["inventory_item canonical"]
    Owned["Talia-owned<br/>targets · profiles · RM · config"]
    Kong --> PG
    SailM --> Canon
    ResM --> Canon
    RateM --> Canon
    ShipM --> Canon
    CompM --> Canon
    Canon --> PG
    Owned --> PG
    Findings --> PG
  end

  subgraph net ["Network path to Celestyal warehouse"]
    Host["App host<br/>Mac / MiniPC / Azure VM"]
    WG["WireGuard static-ip-gateway${statusTag(live.egressState)}<br/>${live.egressIp}"]
    FW["Synapse firewall allowlist${statusTag(live.fwState)}"]
    Syn["Azure Synapse SQL${statusTag(live.synState)}<br/>${live.synAddr}"]
    Host --> WG --> FW --> Syn
  end

  subgraph feeds ["External feeds"]
    AISStream["AISStream${live.aisStream ? ' OK' : ' missing'}"]
    AISHub["AISHub${live.aisHub ? ' OK' : ' missing'}"]
    VF["VesselFinder${live.vf ? ' OK' : ' missing'}"]
    MT["MarineTraffic${live.mt ? ' OK' : ' missing'}"]
    Trends["Google Search / Trends"]
  end

  subgraph probes ["Live data targets"]
${targetLines || '    NoTargets["No targets in snapshot"]'}
  end

  Auth -->|session| Dock
  Inv --> GQL
  Rates --> GQL
  Demand --> GQL
  Admin --> GQL
  GQL --> Kong
  GQL --> Sync
  GQL --> AIS
  GQL --> Probe
  Sync -->|TCP 1433 via egress| Host
  Syn -.->|one-way sync| SailM
  Syn -.-> ResM
  Syn -.-> RateM
  Syn -.-> ShipM
  Syn -.-> CompM
  AISStream --> AIS
  AISHub --> AIS
  VF --> AIS
  MT --> AIS
  Trends --> GQL
  Probe --> probes

  ${styleBlock(blocked, warn)}
`.trim();
}
