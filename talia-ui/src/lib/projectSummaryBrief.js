/**
 * Management briefing for Project Summary: phases with their matrix elements,
 * and open risks ordered so the serious ones are said first.
 */

import { phaseSpans } from './projectPlan.js';
import { riskBand } from './riskRegister.js';

const BAND_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export const briefToday = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const resolveToday = (today) => (
  typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : briefToday()
);

const markCurrentPhase = (rows, today) => {
  let currentIndex = rows.findIndex((phase) => phase.targetOn && phase.targetOn >= today);
  if (currentIndex < 0) currentIndex = rows.length - 1;
  return rows.map((phase, index) => ({
    ...phase,
    current: index === currentIndex,
    upcoming: index === currentIndex && Boolean(phase.targetOn) && phase.targetOn >= today,
  }));
};

const uniqueElements = (items) => {
  const seen = new Set();
  const names = [];
  (items || []).forEach((item) => {
    const name = String(item?.element || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  });
  return names;
};

/** Platform map for the project overview. Same bands on screen and in the PDF. */
export const ARCHITECTURE_BANDS = [
  {
    id: 'people',
    title: 'People and access',
    kind: 'outside',
    items: [
      { title: 'Business users', detail: 'Browser, dashboards, and reports' },
      { title: 'Developers and ops', detail: 'Laptop, validate, and deploy scripts' },
    ],
  },
  {
    id: 'sources',
    title: 'Services and data sources',
    kind: 'outside',
    items: [
      { title: 'ngrok and DNS', detail: 'taliahub.com' },
      { title: 'Azure Synapse', detail: 'Data lake. Sync is one way.' },
      { title: 'Google APIs', detail: 'Search, Trends, and OAuth' },
      { title: 'Competitor intel', detail: 'Market pricing feeds' },
      { title: 'Ship tracking', detail: 'AIS and position feeds' },
      { title: 'Azure cloud', detail: 'MVP virtual machine' },
    ],
  },
  {
    id: 'hosts',
    title: 'Deployment hosts',
    kind: 'host',
    items: [
      { title: 'Local dev', detail: 'localhost and Supabase' },
      { title: 'Staging', detail: 'MiniPC, Docker, and ngrok' },
      { title: 'MVP', detail: 'Azure VM, same Docker stack' },
      { title: 'Source', detail: 'talia-ui, talia-server, and scripts' },
    ],
  },
  {
    id: 'application',
    title: 'Application',
    kind: 'talia',
    groups: [
      {
        title: 'talia-ui',
        detail: 'What people use',
        chips: ['Dockview layouts', 'Dashboard views', 'Tables and charts', 'Apollo', 'Event bus', 'Admin'],
      },
      {
        title: 'talia-server',
        detail: 'GraphQL on port 4000',
        chips: ['Resolvers', 'Sync stream', 'Synapse sync', 'External feeds'],
      },
    ],
  },
  {
    id: 'engine',
    title: 'Intelligence, planned',
    kind: 'planned',
    items: [
      { title: 'Demand forecasting' },
      { title: 'Price optimisation' },
      { title: 'Anomaly detection' },
      { title: 'Recommendations and alerts' },
    ],
  },
  {
    id: 'data',
    title: 'Supabase',
    kind: 'talia',
    items: [
      { title: 'PostgreSQL' },
      { title: 'Auth' },
      { title: 'API' },
      { title: 'Realtime' },
      { title: 'Storage' },
      { title: 'Studio' },
    ],
    note: 'The project record and the sailing data live here.',
  },
  {
    id: 'ops',
    title: 'Ops and tooling',
    kind: 'talia',
    items: [
      { title: 'Validate' },
      { title: 'Deploy' },
      { title: 'Sync' },
      { title: 'Targets and keys' },
    ],
  },
];

const WORK_STATUS_LABELS = { done: 'Done', in_progress: 'In progress' };

const mapWorkItem = (item) => ({
  id: item.id || item.title,
  title: item.title || '',
  detail: item.detail || '',
  status: item.status,
  statusLabel: WORK_STATUS_LABELS[item.status] || item.status,
  updatedAt: item.updatedAt || null,
  targetVersion: item.targetVersion || '',
  area: item.area || '',
  priority: item.priority || '',
});

export function selectRecentWork(items, limit = 8) {
  return (items || [])
    .filter((item) => item && (item.status === 'done' || item.status === 'in_progress'))
    .map(mapWorkItem)
    .sort((a, b) => {
      const rank = (a.status === 'done' ? 0 : 1) - (b.status === 'done' ? 0 : 1);
      if (rank !== 0) return rank;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    })
    .slice(0, limit);
}

/** In-progress items first, then the most recently finished, up to the limit. */
export function selectCurrentWork(items, limit = 12) {
  const rows = selectRecentWork(items, 500);
  const byRecent = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  const moving = rows.filter((item) => item.status === 'in_progress').sort(byRecent);
  const done = rows.filter((item) => item.status === 'done').sort(byRecent);
  return [...moving, ...done].slice(0, limit);
}

export function conversationRisks(risks) {
  return (risks || []).filter((item) => item?.response === 'avoid');
}

export function briefHeadline(brief) {
  const phases = brief?.phases || [];
  const risks = brief?.risks || [];
  return {
    current: phases.find((phase) => phase.current) || null,
    delivered: phases.find((phase) => String(phase.code) === '0') || null,
    decisions: conversationRisks(risks),
    openCount: risks.length,
    highCount: risks.filter((item) => item.band === 'high').length,
    criticalCount: risks.filter((item) => item.band === 'critical').length,
  };
}

export function buildManagementBrief({
  phases = [],
  milestones = [],
  matrixItems = [],
  risks = [],
  work = [],
  today,
} = {}) {
  const stamp = resolveToday(today);
  const spans = phaseSpans(phases, milestones);
  const phaseRows = markCurrentPhase(spans.map((span) => ({
    code: span.code,
    label: span.label,
    targetOn: span.targetOn || null,
    share: span.share,
    startMs: span.startMs,
    endMs: span.endMs,
    elements: uniqueElements((matrixItems || []).filter((item) => String(item.phase) === String(span.code))),
    milestones: (milestones || [])
      .filter((item) => item.phaseCode === span.code)
      .slice()
      .sort((a, b) => String(a.targetOn || '9999').localeCompare(String(b.targetOn || '9999'))),
  })), stamp);

  const openRisks = (risks || [])
    .filter((item) => item && item.status !== 'closed')
    .map((item) => ({ ...item, band: riskBand(item.likelihood, item.impact) }))
    .sort((a, b) => {
      const rank = (BAND_RANK[a.band] ?? 9) - (BAND_RANK[b.band] ?? 9);
      if (rank !== 0) return rank;
      return String(a.referenceCode || '').localeCompare(String(b.referenceCode || ''), undefined, { numeric: true });
    });

  return { phases: phaseRows, risks: openRisks, recentWork: selectCurrentWork(work) };
}
