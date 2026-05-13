import React, { useEffect, useMemo, useRef, useState } from 'react';
import queryTracker from '../../services/data/queryTracker';
import TaliaTooltip from './TaliaTooltip';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { isAdmin as isAdminRole } from '../../utils/roleUtils';
const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';
const DASHBOARD_TABLE_LAYOUT_EVENT = 'talia:dashboard.tableLayout';

const formatList = (items = []) => {
  if (!items || items.length === 0) {
    return ['—'];
  }
  return items;
};

const normalizeList = (items = []) => (
  (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter((item) => item && item !== '—')
);

const compactEventLabel = (value) => {
  const text = String(value || '').trim();
  if (!text || text === '—') return '—';
  if (text.includes(':')) {
    return text.split(':').slice(1).join(':') || text;
  }
  if (text.includes('.')) {
    return text.split('.').slice(1).join('.') || text;
  }
  return text;
};

const formatFlowTimestamp = (ts) => {
  if (!Number.isFinite(Number(ts))) return '--:--:--.---';
  const date = new Date(Number(ts));
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const msec = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${msec}`;
};

const buildComponentVisibilitySummary = () => {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const style = root?.dataset?.taliaUiTheme || root?.dataset?.taliaBgColor || 'default';
  const controls = window.__taliaControlsVisible === true ? 'on' : 'off';
  const filters = window.__taliaFiltersVisible === true ? 'on' : 'off';
  const details = window.__taliaGlobalReportDetailsVisible === false ? 'off' : 'on';
  const fit = window.__taliaTableLayoutMode === 'data' ? 'data' : 'width';
  return [
    `style: ${style}`,
    `controls: ${controls}`,
    `filters: ${filters}`,
    `details: ${details}`,
    `fit: ${fit}`
  ].join(' | ');
};

const resolveCycleForTimestamp = (cycleHistory, tsMs) => {
  if (!Array.isArray(cycleHistory) || cycleHistory.length === 0) return null;
  const ordered = [...cycleHistory].sort((a, b) => a.startTs - b.startTs);
  let selected = null;
  ordered.forEach((cycle) => {
    if (Number.isFinite(Number(tsMs)) && cycle.startTs <= tsMs) {
      selected = cycle;
    }
  });
  return selected || ordered[ordered.length - 1] || null;
};

const copyText = async (text) => {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy fallback.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

const getStoredEvents = () => {
  const snapshots = [];
  const storageKeys = ['talia:persisted:lastEvent', 'talia:test:lastEvent'];
  storageKeys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name) snapshots.push(parsed);
    } catch {
      // Ignore malformed entries.
    }
  });

  if (window.latestEvent?.name) {
    snapshots.push(window.latestEvent);
  }
  if (window.lastSailSelectEvent?.type) {
    const detailTimestamp = window.lastSailSelectEvent?.detail?.timestamp;
    snapshots.push({
      name: window.lastSailSelectEvent.type,
      detail: window.lastSailSelectEvent.detail || null,
      timestamp: typeof detailTimestamp === 'string' && detailTimestamp ? detailTimestamp : new Date().toISOString(),
      source: 'window.lastSailSelectEvent'
    });
  }

  return snapshots;
};

const toSnapshotTimestampMs = (snapshot) => {
  const raw = snapshot?.timestamp;
  if (!raw) return 0;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getGlobalCriteriaSnapshot = () => {
  const criteria = window.__taliaGlobalCriteria;
  if (!criteria || typeof criteria !== 'object') return null;
  return {
    name: 'talia:dashboard.globalCriteria',
    detail: criteria,
    timestamp: new Date().toISOString(),
    source: 'window.__taliaGlobalCriteria'
  };
};

const resolveEventSnapshot = (eventName) => {
  if (!eventName || eventName === '—') return null;

  if (eventName === 'talia:dashboard.globalCriteria') {
    return getGlobalCriteriaSnapshot();
  }

  const snapshots = getStoredEvents();
  const exactMatches = snapshots.filter((entry) => entry?.name === eventName);
  if (exactMatches.length) {
    return exactMatches.sort((a, b) => toSnapshotTimestampMs(b) - toSnapshotTimestampMs(a))[0];
  }

  const aliasByDot = eventName.replace(/:/g, '.');
  const aliasByColon = eventName.replace(/\./g, ':');
  const aliasMatches = snapshots.filter((entry) => entry?.name === aliasByDot || entry?.name === aliasByColon);
  if (!aliasMatches.length) return null;
  return aliasMatches.sort((a, b) => toSnapshotTimestampMs(b) - toSnapshotTimestampMs(a))[0];
};

const formatEventText = (snapshot, eventName) => {
  if (!snapshot) {
    return `Event: ${eventName}\nStatus: No captured payload yet`;
  }
  const detail = snapshot.detail ?? null;
  return [
    `Event: ${snapshot.name || eventName}`,
    `Source: ${snapshot.source || 'unknown'}`,
    `Timestamp: ${snapshot.timestamp || 'unknown'}`,
    'Payload:',
    JSON.stringify(detail, null, 2)
  ].join('\n');
};

const extractSourceTokens = (sourceName = '') => {
  const stopWords = new Set([
    'requires', 'graphql', 'connection', 'endpoint', 'and', 'context',
    'mapping', 'from', 'with', 'data', 'source', 'sources', 'to', 'the'
  ]);
  const fromSupabase = sourceName.match(/supabase:\s*([a-z0-9_]+)/i);
  const tokens = [];
  if (fromSupabase?.[1]) tokens.push(fromSupabase[1].toLowerCase());

  const explicitTable = sourceName.match(/\b([a-z]+_[a-z0-9_]+)\b/gi) || [];
  tokens.push(...explicitTable.map((token) => token.toLowerCase()));

  const camelTerms = sourceName.match(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g) || [];
  tokens.push(...camelTerms.map((token) => token.toLowerCase()));

  const plainTerms = sourceName
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopWords.has(token));
  tokens.push(...plainTerms);

  const normalized = tokens
    .map((token) => token.replace(/[^a-z0-9_]/g, ''))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const getSourceIconText = (sourceName = '') => {
  const tokens = extractSourceTokens(sourceName);
  if (tokens.length > 0) {
    const primary = tokens[0];
    const parts = primary.split('_').filter(Boolean);
    const icon = parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    return icon || 'SRC';
  }
  const compact = sourceName
    .replace(/[^a-z0-9]/gi, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return compact || 'SRC';
};

const resolveSourceSnapshot = (sourceName, allQueries = queryTracker.getQueries()) => {
  if (!sourceName || sourceName === '—') return null;
  const sourceTokens = extractSourceTokens(sourceName);
  if (sourceTokens.length === 0) {
    return {
      sourceName,
      relatedQueries: [],
      fallback: true
    };
  }
  const relatedQueries = allQueries.filter((entry) => {
    const tableName = String(entry?.variables?.tableName || '').toLowerCase();
    if (tableName && sourceTokens.includes(tableName)) return true;
    const queryText = String(entry?.query || '').toLowerCase();
    const purposeText = String(entry?.purpose || '').toLowerCase();
    return sourceTokens.some((token) => queryText.includes(token) || purposeText.includes(token));
  });

  return {
    sourceName,
    relatedQueries: relatedQueries.slice(0, 5),
    fallback: relatedQueries.length === 0
  };
};

const formatSourceText = (snapshot, sourceName) => {
  if (!snapshot) {
    return `Source: ${sourceName}\nStatus: No query details found`;
  }
  const queryLines = snapshot.relatedQueries.length
    ? snapshot.relatedQueries.map((entry, index) => (
      [
        `#${index + 1} ${entry.status || 'unknown'} ${entry.duration ? `(${Math.round(entry.duration)}ms)` : ''}`.trim(),
        `Component: ${entry.component || 'Unknown'}`,
        `Purpose: ${entry.purpose || 'Data fetch'}`,
        `Variables: ${JSON.stringify(entry.variables || {}, null, 2)}`,
        'Query:',
        String(entry.query || '').trim()
      ].join('\n')
    ))
    : ['No matching tracked queries yet.'];

  return [
    `Source: ${snapshot.sourceName}`,
    `Tracked Queries: ${snapshot.relatedQueries.length}`,
    `Match mode: source-matched only`,
    '',
    queryLines.join('\n\n')
  ].join('\n');
};

const collectSourcePerformance = (sources = []) => {
  const sourceList = sources.length ? sources : [];
  const allQueries = queryTracker.getQueries();
  return sourceList.map((sourceName) => {
    const snapshot = resolveSourceSnapshot(sourceName, allQueries);
    const related = snapshot?.relatedQueries || [];
    const completed = related.filter((entry) => Number.isFinite(entry?.duration));
    const totalMs = completed.reduce((sum, entry) => sum + Number(entry.duration || 0), 0);
    const avgMs = completed.length ? totalMs / completed.length : 0;
    const latestMs = completed.length ? Number(completed[0]?.duration || 0) : 0;
    return {
      sourceName,
      count: completed.length,
      totalMs,
      avgMs,
      latestMs
    };
  });
};

const collectPerformanceHistory = (sources = []) => {
  const allQueries = queryTracker.getQueries();
  const tokens = new Set(
    sources
      .flatMap((source) => extractSourceTokens(source))
      .filter(Boolean)
  );
  if (!tokens.size) return [];
  return allQueries
    .filter((entry) => {
      const tableName = String(entry?.variables?.tableName || '').toLowerCase();
      if (tableName && tokens.has(tableName)) return Number.isFinite(entry?.duration);
      const queryText = String(entry?.query || '').toLowerCase();
      const purposeText = String(entry?.purpose || '').toLowerCase();
      const tokenMatch = Array.from(tokens).some((token) => queryText.includes(token) || purposeText.includes(token));
      return tokenMatch && Number.isFinite(entry?.duration);
    })
    .slice(0, 16)
    .map((entry) => Number(entry.duration || 0));
};

const getLatestRelatedQuery = (sources = [], allQueriesInput = null) => {
  const sourceNames = (sources || []).filter((item) => item && item !== '—');
  if (!sourceNames.length) return null;
  const allQueries = Array.isArray(allQueriesInput) ? allQueriesInput : queryTracker.getQueries();
  let latest = null;
  sourceNames.forEach((sourceName) => {
    const snapshot = resolveSourceSnapshot(sourceName, allQueries);
    const candidate = snapshot?.relatedQueries?.[0] || null;
    if (!candidate) return;
    if (!latest) {
      latest = candidate;
      return;
    }
    const candidateTs = Date.parse(String(candidate.timestamp || ''));
    const latestTs = Date.parse(String(latest.timestamp || ''));
    if (Number.isFinite(candidateTs) && (!Number.isFinite(latestTs) || candidateTs > latestTs)) {
      latest = candidate;
    }
  });
  return latest;
};

const formatPerformanceText = (rows = [], phases = { networkMs: 0, loadingMs: 0, displayMs: 0 }) => {
  if (!rows.length) return 'Performance: No component-scoped sources were declared for this report.';
  const totalLatest = rows.reduce((sum, row) => sum + row.latestMs, 0);
  const totalAvg = rows.reduce((sum, row) => sum + row.avgMs, 0);
  const lines = rows.map((row, index) => (
    [
      `#${index + 1} ${row.sourceName}`,
      `Latest: ${Math.round(row.latestMs)}ms`,
      `Average: ${Math.round(row.avgMs)}ms`,
      `Samples: ${row.count}`
    ].join(' | ')
  ));
  return [
    `Panel timing summary`,
    `Total (latest): ${Math.round(totalLatest)}ms`,
    `Total (average): ${Math.round(totalAvg)}ms`,
    `Network: ${Math.round(phases.networkMs)}ms`,
    `Loading: ${Math.round(phases.loadingMs)}ms`,
    `Display: ${Math.round(phases.displayMs)}ms`,
    `Composite: ${Math.round(phases.networkMs + phases.loadingMs + phases.displayMs)}ms`,
    'Scope: component source-matched queries only',
    '',
    ...lines
  ].join('\n');
};

const resolveSourceDataMode = (sourceName = '') => {
  const text = String(sourceName || '').toLowerCase();
  if (!text) return 'LOCAL';

  if (
    text.includes('seaware')
    || text.includes('availablevoyages')
    || text.includes('celestyal_b2b')
    || text.includes('direct source')
    || text.includes('b2b')
  ) {
    return 'DIRECT';
  }

  if (
    text.includes('supabase')
    || text.includes('stg.')
    || text.includes('fou.')
    || text.includes('dwh.')
    || text.includes('tabledata')
    || text.includes('reservation')
    || text.includes('master_sail')
    || text.includes('published_rates')
    || text.includes('cabin_availability')
    || text.includes('synapse')
    || text.includes('warehouse')
    || text.includes('integrat')
    || text.includes('snapshot')
  ) {
    return 'INTEGRATED';
  }

  return 'LOCAL';
};

const ReportEventMeta = ({ emits = [], respondsTo = [], sources = [] }) => {
  const { user } = useSupabaseAuth();
  const emitItems = useMemo(() => normalizeList(emits), [emits]);
  const respondItems = useMemo(() => normalizeList(respondsTo), [respondsTo]);
  const sourceItems = useMemo(() => normalizeList(sources), [sources]);
  const emitList = useMemo(() => formatList(emitItems), [emitItems]);
  const respondList = useMemo(() => formatList(respondItems), [respondItems]);
  const sourceList = useMemo(() => formatList(sourceItems), [sourceItems]);
  const showAdminSourceBadge = useMemo(() => isAdminRole(user?.role), [user?.role]);
  const [copyStatus, setCopyStatus] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [showCurrentCycleOnly, setShowCurrentCycleOnly] = useState(false);
  const [queryVersion, setQueryVersion] = useState(0);
  const [eventVersion, setEventVersion] = useState(0);
  const [flowEntries, setFlowEntries] = useState([]);
  const [activeFlowId, setActiveFlowId] = useState(null);
  const seenDataFlowSignalsRef = useRef(new Set());
  const flowSequenceRef = useRef(0);
  const flowCycleRef = useRef(0);
  const flowCycleHistoryRef = useRef([]);
  const [criteriaPerf, setCriteriaPerf] = useState({ applyMs: 0, timestamp: null, count: 0 });
  const [displayPerfMs, setDisplayPerfMs] = useState(0);
  const copyPayload = useMemo(() => (
    [
      `Emits: ${emitList.join(', ')}`,
      `Accepts: ${respondList.join(', ')}`,
      `Sources: ${sourceList.join(', ')}`
    ].join('\n')
  ), [emitList, respondList, sourceList]);

  const handleCopySources = async () => {
    const success = await copyText(copyPayload);
    setCopyStatus(success ? 'Copied' : 'Copy failed');
    window.setTimeout(() => setCopyStatus(''), 1500);
  };

  const selectedSnapshot = useMemo(
    () => (selectedEvent ? resolveEventSnapshot(selectedEvent) : null),
    [selectedEvent, eventVersion]
  );
  const selectedEventText = useMemo(
    () => (selectedEvent ? formatEventText(selectedSnapshot, selectedEvent) : ''),
    [selectedEvent, selectedSnapshot]
  );
  const selectedSourceSnapshot = useMemo(
    () => (selectedSource ? resolveSourceSnapshot(selectedSource) : null),
    [selectedSource, queryVersion]
  );
  const selectedSourceText = useMemo(
    () => (selectedSource ? formatSourceText(selectedSourceSnapshot, selectedSource) : ''),
    [selectedSource, selectedSourceSnapshot]
  );
  const performanceRows = useMemo(
    () => collectSourcePerformance(sourceItems),
    [sourceItems, queryVersion]
  );
  const performanceHistory = useMemo(
    () => collectPerformanceHistory(sourceItems),
    [sourceItems, queryVersion]
  );
  const networkPerfMs = useMemo(
    () => performanceRows.reduce((sum, row) => sum + row.latestMs, 0),
    [performanceRows]
  );
  const loadingPerfMs = useMemo(
    () => (criteriaPerf.applyMs > 0 ? criteriaPerf.applyMs : Math.max(8, networkPerfMs * 0.08)),
    [criteriaPerf.applyMs, networkPerfMs]
  );
  const phaseSegments = useMemo(() => {
    const phases = [
      { key: 'network', label: 'Network', value: networkPerfMs },
      { key: 'loading', label: 'Loading', value: loadingPerfMs },
      { key: 'display', label: 'Display', value: displayPerfMs },
    ];
    const total = phases.reduce((sum, phase) => sum + phase.value, 0);
    if (total <= 0) {
      return phases.map((phase) => ({ ...phase, percentage: 33.3 }));
    }
    return phases.map((phase) => ({
      ...phase,
      percentage: Math.max((phase.value / total) * 100, 12),
    }));
  }, [networkPerfMs, loadingPerfMs, displayPerfMs]);
  const performanceSummaryText = useMemo(
    () => {
      const base = formatPerformanceText(performanceRows, {
        networkMs: networkPerfMs,
        loadingMs: loadingPerfMs,
        displayMs: displayPerfMs
      });
      if (!criteriaPerf.timestamp) return base;
      return [
        base,
        '',
        'Global criteria apply',
        `Last apply: ${Math.round(criteriaPerf.applyMs)}ms`,
        `Updates: ${criteriaPerf.count}`,
        `Timestamp: ${criteriaPerf.timestamp}`
      ].join('\n');
    },
    [performanceRows, criteriaPerf, networkPerfMs, loadingPerfMs, displayPerfMs]
  );
  const totalPerformanceMs = useMemo(() => (
    networkPerfMs + loadingPerfMs + displayPerfMs
  ), [networkPerfMs, loadingPerfMs, displayPerfMs]);
  const flowEntriesLatestFirst = useMemo(
    () => [...flowEntries].sort((a, b) => b.seq - a.seq),
    [flowEntries]
  );
  const currentCycleId = useMemo(() => {
    const latestWithCycle = flowEntriesLatestFirst.find((entry) => Number.isFinite(Number(entry?.cycleId)));
    return latestWithCycle?.cycleId || null;
  }, [flowEntriesLatestFirst]);
  const visibleFlowEntries = useMemo(() => {
    if (!showCurrentCycleOnly || !currentCycleId) return flowEntriesLatestFirst;
    return flowEntriesLatestFirst.filter((entry) => entry?.cycleId === currentCycleId);
  }, [flowEntriesLatestFirst, showCurrentCycleOnly, currentCycleId]);
  const groupedFlowByCycle = useMemo(() => {
    const groups = new Map();
    flowEntriesLatestFirst.forEach((entry) => {
      const key = entry.cycleId ? `cycle-${entry.cycleId}` : 'background';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          cycleId: entry.cycleId || null,
          lane: entry.cycleId ? 'cycle' : 'background',
          entries: []
        });
      }
      groups.get(key).entries.push(entry);
    });
    return Array.from(groups.values()).sort((a, b) => {
      const aSeq = a.entries[0]?.seq || 0;
      const bSeq = b.entries[0]?.seq || 0;
      return bSeq - aSeq;
    });
  }, [flowEntriesLatestFirst]);
  const flowBarSummary = useMemo(() => {
    if (!visibleFlowEntries.length) {
      return {
        eventCount: 0,
        dataCount: 0,
        lifecycleCount: 0,
        latest: 'No flow',
        segments: [
          { key: 'event', label: 'E', value: 0, percentage: 33.3, showLabel: true },
          { key: 'data', label: 'D', value: 0, percentage: 33.3, showLabel: true },
          { key: 'update', label: 'U', value: 0, percentage: 33.4, showLabel: true }
        ]
      };
    }
    const recent = visibleFlowEntries.slice(0, 8);
    const counts = recent.reduce((acc, entry) => {
      const key = entry?.type || 'note';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const latestText = String(recent[0]?.text || '').replace(/^\.\.\s*/, '').trim();
    const compactLatest = latestText.length > 28 ? `${latestText.slice(0, 28)}...` : latestText;
    const eventCount = counts.event || 0;
    const dataCount = counts.data || 0;
    const lifecycleCount = counts.lifecycle || 0;
    const total = Math.max(1, eventCount + dataCount + lifecycleCount);
    const segments = [
      { key: 'event', label: 'E', value: eventCount, percentage: (eventCount / total) * 100 },
      { key: 'data', label: 'D', value: dataCount, percentage: (dataCount / total) * 100 },
      { key: 'update', label: 'U', value: lifecycleCount, percentage: (lifecycleCount / total) * 100 }
    ].map((segment) => ({
      ...segment,
      percentage: Math.max(segment.percentage, segment.value > 0 ? 10 : 0),
      showLabel: segment.value > 0
    }));
    return {
      eventCount,
      dataCount,
      lifecycleCount,
      latest: compactLatest,
      segments
    };
  }, [visibleFlowEntries]);
  const activeFlowEntry = useMemo(
    () => visibleFlowEntries.find((entry) => entry.id === activeFlowId) || visibleFlowEntries[0] || null,
    [visibleFlowEntries, activeFlowId]
  );
  const flowText = useMemo(() => {
    if (!activeFlowEntry) return 'Flow: No activity captured yet.';
    if (activeFlowEntry.type === 'event' && activeFlowEntry.eventName) {
      const snapshot = resolveEventSnapshot(activeFlowEntry.eventName);
      if (snapshot) {
        return formatEventText(snapshot, activeFlowEntry.eventName);
      }
    }
    return activeFlowEntry.fullText || activeFlowEntry.text || 'Flow: No activity captured yet.';
  }, [activeFlowEntry, eventVersion]);
  const flowExportText = useMemo(() => {
    if (!flowEntriesLatestFirst.length) return 'Flow: No activity captured yet.';
    const lines = groupedFlowByCycle.flatMap((group) => {
      const heading = group.cycleId
        ? `--- Cycle ${group.cycleId} ---`
        : '--- Background / pre-cycle ---';
      const rows = group.entries.map((entry) => (
        `#${entry.seq} ${entry.timeLabel || formatFlowTimestamp(entry.ts)} ${entry.text}`
      ));
      return [heading, ...rows, ''];
    });
    const detailCandidates = [];
    if (activeFlowEntry) detailCandidates.push(activeFlowEntry);
    flowEntriesLatestFirst.slice(0, 4).forEach((entry) => {
      if (!detailCandidates.some((candidate) => candidate.id === entry.id)) {
        detailCandidates.push(entry);
      }
    });
    const details = detailCandidates.map((entry) => {
      let detailText = entry.fullText || entry.text || '';
      if (entry.type === 'event' && entry.eventName) {
        const snapshot = resolveEventSnapshot(entry.eventName);
        if (snapshot) {
          detailText = formatEventText(snapshot, entry.eventName);
        }
      }
      return [
        `## #${entry.seq} ${entry.timeLabel || formatFlowTimestamp(entry.ts)} ${entry.text}`,
        detailText
      ].join('\n');
    });
    return [
      'FLOW - lifecycle/event flow',
      '',
      ...lines,
      '',
      '--- Details (current/recent) ---',
      '',
      ...details
    ].join('\n');
  }, [flowEntriesLatestFirst, groupedFlowByCycle, activeFlowEntry, eventVersion]);
  const popoverTitle = showFlow
    ? `FLOW - lifecycle/event flow${showCurrentCycleOnly && currentCycleId ? ` (C${currentCycleId})` : ''}${activeFlowEntry?.seq ? ` (#${activeFlowEntry.seq})` : ''}`
    : (showPerformance
      ? `PERF - load (${Math.round(totalPerformanceMs)}ms)`
      : (selectedSource
        ? `SOURCE - ${selectedSource}`
        : `EVENT - ${selectedEvent || 'none'}`));
  const popoverName = showPerformance
    ? `PERF - load (${Math.round(totalPerformanceMs)}ms)`
    : (showFlow ? 'FLOW - lifecycle/event flow' : (selectedSource || selectedEvent || 'Select an event or source'));
  const popoverBody = showFlow
    ? flowText
    : (showPerformance
      ? performanceSummaryText
      : (selectedSource ? selectedSourceText : (selectedEventText || 'Select an event or source to view details.')));
  const hasSelection = Boolean(selectedEvent || selectedSource || showPerformance || showFlow);

  useEffect(() => {
    if (!visibleFlowEntries.length) {
      setActiveFlowId(null);
      return;
    }
    if (!activeFlowId || !visibleFlowEntries.some((entry) => entry.id === activeFlowId)) {
      setActiveFlowId(visibleFlowEntries[0].id);
    }
  }, [visibleFlowEntries, activeFlowId]);

  const appendFlowEntry = React.useCallback((entry) => {
    const raw = typeof entry === 'string' ? { text: entry } : (entry || {});
    const text = String(raw.text || '').trim();
    if (!text) return;
    setFlowEntries((current) => {
      const nowTs = Date.now();
      const seq = ++flowSequenceRef.current;
      const cycleId = Number.isFinite(Number(raw.cycleId)) ? Number(raw.cycleId) : (flowCycleRef.current || null);
      const isLifecycleStartup = (raw.type || 'note') === 'lifecycle'
        && (text === 'Component opened' || text.startsWith('using events') || text === 'component rendered');
      const nextEntry = {
        id: `${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
        seq,
        cycleId,
        ts: nowTs,
        timeLabel: formatFlowTimestamp(nowTs),
        type: raw.type || 'note',
        eventName: raw.eventName || null,
        devReplay: false,
        text,
        fullText: raw.fullText || text
      };
      if (isLifecycleStartup) {
        const alreadySeenStartup = current.some((item) => (
          item.type === 'lifecycle'
          && (item.text === text)
          && (item.cycleId == null)
        ));
        if (alreadySeenStartup) {
          nextEntry.devReplay = true;
          nextEntry.fullText = `${nextEntry.fullText}\n(dev replay / StrictMode remount)`;
        }
      }
      const next = [...current, nextEntry];
      return next.slice(-30);
    });
  }, []);

  useEffect(() => {
    const accepted = respondItems;
    const acceptedLabel = accepted.length ? accepted.join(' ') : '—';
    appendFlowEntry({ type: 'lifecycle', cycleId: null, text: 'Component opened' });
    appendFlowEntry({ type: 'lifecycle', cycleId: null, text: `using events: ${acceptedLabel}` });
    window.requestAnimationFrame(() => {
      appendFlowEntry({
        type: 'lifecycle',
        cycleId: null,
        text: 'component rendered',
        fullText: `component rendered\n${buildComponentVisibilitySummary()}`
      });
    });
  }, [appendFlowEntry, respondItems]);

  useEffect(() => {
    const unsubscribe = queryTracker.subscribe((queries) => {
      const startedAt = performance.now();
      setQueryVersion((current) => current + 1);
      const latestQuery = getLatestRelatedQuery(sourceItems, queries);
      const isCompleted = latestQuery?.status === 'success' || latestQuery?.status === 'error';
      if (isCompleted) {
        const queryStartTs = Date.parse(String(latestQuery.timestamp || ''));
        const matchedCycle = resolveCycleForTimestamp(flowCycleHistoryRef.current, queryStartTs);
        const rowCount = Number.isFinite(Number(latestQuery?.rowCount)) ? Number(latestQuery.rowCount) : null;
        const rowText = rowCount !== null ? ` (${rowCount} rows)` : '';
        const signal = `${latestQuery.id}:${latestQuery.status}:${rowText}`;
        if (!seenDataFlowSignalsRef.current.has(signal)) {
          seenDataFlowSignalsRef.current.add(signal);
          if (seenDataFlowSignalsRef.current.size > 300) {
            seenDataFlowSignalsRef.current.clear();
          }
          appendFlowEntry({
            type: 'data',
            cycleId: matchedCycle?.id || null,
            text: latestQuery.status === 'error'
              ? 'data failed'
              : `data retrieved${rowText}`,
            fullText: latestQuery
              ? `${latestQuery.status === 'error' ? 'data failed' : `data retrieved${rowText}`}\nQuery: ${latestQuery.purpose || 'Data fetch'}`
              : (latestQuery.status === 'error' ? 'data failed' : `data retrieved${rowText}`)
          });
          if (matchedCycle) {
            appendFlowEntry({
              type: 'lifecycle',
              cycleId: matchedCycle.id,
              text: 'component rendered (post-data)',
              fullText: `component rendered (post-data)\nCycle: ${matchedCycle.id}\n${buildComponentVisibilitySummary()}`
            });
          }
        }
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setDisplayPerfMs(Math.max(0, performance.now() - startedAt));
        });
      });
    });
    return unsubscribe;
  }, [appendFlowEntry, sourceItems]);

  useEffect(() => {
    const eventNames = Array.from(new Set(
      [...emitList, ...respondList]
        .map((name) => String(name || '').trim())
        .filter((name) => name && name !== '—')
    ));
    if (!eventNames.length) return undefined;

    const subscribedNames = Array.from(new Set(
      eventNames.flatMap((name) => {
        const alt = name.includes(':') ? name.replace(/:/g, '.') : name.replace(/\./g, ':');
        return [name, alt];
      })
    ));

    const handleEventActivity = (event) => {
      const eventName = String(event?.type || '').trim();
      if (!eventName) return;
      const cycleId = ++flowCycleRef.current;
      flowCycleHistoryRef.current.push({
        id: cycleId,
        startTs: Date.now(),
        eventName
      });
      if (flowCycleHistoryRef.current.length > 120) {
        flowCycleHistoryRef.current = flowCycleHistoryRef.current.slice(-120);
      }
      setEventVersion((current) => current + 1);
      appendFlowEntry({
        type: 'event',
        cycleId,
        eventName,
        text: `event received: ${compactEventLabel(eventName)}`,
        fullText: `event received: ${eventName}`
      });
      window.requestAnimationFrame(() => {
        appendFlowEntry({
          type: 'lifecycle',
          cycleId,
          text: 'component updated',
          fullText: `component updated\n${buildComponentVisibilitySummary()}`
        });
      });
    };

    subscribedNames.forEach((name) => window.addEventListener(name, handleEventActivity));
    return () => {
      subscribedNames.forEach((name) => window.removeEventListener(name, handleEventActivity));
    };
  }, [appendFlowEntry, emitList, respondList]);

  useEffect(() => {
    const handleGlobalCriteria = () => {
      const start = performance.now();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const end = performance.now();
          setCriteriaPerf((current) => ({
            applyMs: Math.max(0, end - start),
            timestamp: new Date().toISOString(),
            count: (current.count || 0) + 1
          }));
          // Force refresh even when no network query was executed.
          setQueryVersion((current) => current + 1);
        });
      });
    };
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteria);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteria);
  }, []);

  useEffect(() => {
    const handleTableLayoutChange = (event) => {
      const mode = String(event?.detail?.mode || '').toLowerCase() === 'data' ? 'data' : 'width';
      appendFlowEntry({
        type: 'lifecycle',
        cycleId: null,
        text: `appearance updated: fit ${mode}`,
        fullText: `appearance updated: fit ${mode}\n${buildComponentVisibilitySummary()}`
      });
      setQueryVersion((current) => current + 1);
      setEventVersion((current) => current + 1);
    };
    window.addEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, handleTableLayoutChange);
    return () => window.removeEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, handleTableLayoutChange);
  }, [appendFlowEntry]);

  const handleCopyEvent = async () => {
    const textToCopy = showFlow ? flowExportText : popoverBody;
    if (!textToCopy) return;
    const success = await copyText(textToCopy);
    setCopyStatus(success ? (selectedSource ? 'Source copied' : (showFlow ? 'Flow copied' : 'Event copied')) : 'Copy failed');
    window.setTimeout(() => setCopyStatus(''), 1500);
  };

  return (
    <div className="talia-event-meta" role="note" aria-label="Report event contract">
      <div className="talia-event-meta__summary-line">
        {emitItems.length > 0 && (
        <div className="talia-event-meta__group">
          <span className="talia-event-meta__label">Out</span>
          <div className="talia-event-meta__chips">
            {emitItems.map((eventName) => (
              <TaliaTooltip key={`emit-tip-${eventName}`} content={eventName} placement="bottom-left" delayMs={180}>
                <button
                  key={`emit-${eventName}`}
                  type="button"
                  className={`talia-event-meta__chip ${selectedEvent === eventName ? 'talia-event-meta__chip--selected' : ''}`}
                  onClick={() => {
                    setSelectedSource(null);
                    setShowFlow(false);
                    setShowPerformance(false);
                    setSelectedEvent((current) => (current === eventName ? null : eventName));
                  }}
                  aria-label={`Emits ${eventName}`}
                >
                  <span className="talia-event-meta__chip-text">{compactEventLabel(eventName)}</span>
                </button>
              </TaliaTooltip>
            ))}
          </div>
        </div>
        )}
        {respondItems.length > 0 && (
        <div className="talia-event-meta__group">
          <span className="talia-event-meta__label">In</span>
          <div className="talia-event-meta__chips">
            {respondItems.map((eventName) => (
              <TaliaTooltip key={`respond-tip-${eventName}`} content={eventName} placement="bottom-left" delayMs={180}>
                <button
                  key={`respond-${eventName}`}
                  type="button"
                  className={`talia-event-meta__chip talia-event-meta__chip--secondary ${selectedEvent === eventName ? 'talia-event-meta__chip--selected' : ''}`}
                  onClick={() => {
                    setSelectedSource(null);
                    setShowFlow(false);
                    setShowPerformance(false);
                    setSelectedEvent((current) => (current === eventName ? null : eventName));
                  }}
                  aria-label={`Accepts ${eventName}`}
                >
                  <span className="talia-event-meta__chip-text">{compactEventLabel(eventName)}</span>
                </button>
              </TaliaTooltip>
            ))}
          </div>
        </div>
        )}
        <div className="talia-event-meta__group">
          <span className="talia-event-meta__label">Src</span>
          <div className="talia-event-meta__chips">
            {sourceList.map((sourceName) => {
              const sourceMode = resolveSourceDataMode(sourceName);
              return (
              <button
                key={`source-${sourceName}`}
                type="button"
                className={`talia-event-meta__chip talia-event-meta__chip--source ${showAdminSourceBadge ? 'talia-event-meta__chip--source-labeled' : ''} ${selectedSource === sourceName ? 'talia-event-meta__chip--selected' : ''}`}
                onClick={() => {
                  setSelectedEvent(null);
                  setShowFlow(false);
                  setShowPerformance(false);
                  setSelectedSource((current) => (current === sourceName ? null : sourceName));
                }}
                title={`View query details for ${sourceName}`}
                aria-label={`Source ${sourceName}`}
              >
                <span className="talia-event-meta__source-icon" aria-hidden="true">{getSourceIconText(sourceName)}</span>
                {showAdminSourceBadge && (
                  <span
                    className={`talia-event-meta__source-badge talia-event-meta__source-badge--${sourceMode.toLowerCase()}`}
                    aria-label={`Data mode ${sourceMode}`}
                  >
                    {sourceMode}
                  </span>
                )}
              </button>
              );
            })}
          </div>
        </div>
        <div className="talia-event-meta__group talia-event-meta__group--performance">
          <div className="talia-event-meta__metrics-stack">
            <TaliaTooltip content={`N = Network, L = Loading, D = Display. Total ${Math.round(totalPerformanceMs)}ms`} placement="bottom-left" delayMs={260}>
              <button
                type="button"
                className={`talia-event-meta__perf-bar ${showPerformance ? 'talia-event-meta__perf-bar--selected' : ''}`}
                onClick={() => {
                  setSelectedEvent(null);
                  setSelectedSource(null);
                  setShowFlow(false);
                  setShowPerformance((current) => !current);
                }}
                aria-label={`Performance bar. N network, L loading, D display. Total ${Math.round(totalPerformanceMs)} milliseconds`}
              >
                {phaseSegments.map((phase) => {
                  return (
                    <span
                      key={`perf-${phase.key}`}
                      className={`talia-event-meta__perf-segment talia-event-meta__perf-segment--${phase.key}`}
                      style={{ width: `${phase.percentage}%` }}
                    >
                      <span className="talia-event-meta__perf-segment-label">
                        {phase.label.charAt(0)}
                      </span>
                    </span>
                  );
                })}
                <span className="talia-event-meta__perf-label">{Math.round(totalPerformanceMs)}ms</span>
              </button>
            </TaliaTooltip>
            <TaliaTooltip content={`E = Events (${flowBarSummary.eventCount}), D = Data (${flowBarSummary.dataCount}), U = Updates (${flowBarSummary.lifecycleCount})`} placement="bottom-left" delayMs={260}>
              <button
                type="button"
                className={`talia-event-meta__perf-bar talia-event-meta__perf-bar--flow ${showFlow ? 'talia-event-meta__perf-bar--selected' : ''}`}
                onClick={() => {
                  setSelectedEvent(null);
                  setSelectedSource(null);
                  setShowPerformance(false);
                  setShowFlow((current) => !current);
                }}
                aria-label={`Flow bar. E events ${flowBarSummary.eventCount}, D data ${flowBarSummary.dataCount}, U updates ${flowBarSummary.lifecycleCount}`}
              >
                <span className="talia-event-meta__flow-inline">
                  <span className="talia-event-meta__flow-segments" aria-hidden="true">
                    {flowBarSummary.segments.map((segment) => (
                      <span
                        key={`flow-segment-${segment.key}`}
                        className={`talia-event-meta__flow-segment talia-event-meta__flow-segment--${segment.key}`}
                        style={{ width: `${segment.percentage}%` }}
                      >
                        {segment.showLabel && (
                          <span className="talia-event-meta__flow-segment-label">
                            {segment.label}{segment.value}
                          </span>
                        )}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="talia-event-meta__perf-label">FLOW</span>
              </button>
            </TaliaTooltip>
          </div>
        </div>
      </div>
      {hasSelection && (
      <div className="talia-event-meta__popover" role="dialog" aria-label={`Event payload ${popoverName}`}>
          <div className="talia-event-meta__popover-header">
            <span className="talia-event-meta__label">{popoverTitle}</span>
            <div className="talia-event-meta__actions">
              {showFlow && (
                <button
                  type="button"
                  className={`talia-event-meta__copy-btn ${showCurrentCycleOnly ? 'talia-event-meta__copy-btn--active' : ''}`}
                  onClick={() => setShowCurrentCycleOnly((current) => !current)}
                  title="Filter flow to current cycle"
                >
                  {showCurrentCycleOnly ? 'All Cycles' : 'Current Cycle'}
                </button>
              )}
              <button type="button" className="talia-event-meta__copy-btn" onClick={handleCopySources}>
                Copy Contract
              </button>
              {(selectedEvent || selectedSource || showPerformance || showFlow) && (
                <button type="button" className="talia-event-meta__copy-btn" onClick={handleCopyEvent}>
                  {selectedSource ? 'Copy Details' : (showPerformance ? 'Copy Summary' : (showFlow ? 'Copy Flow' : 'Copy Event'))}
                </button>
              )}
              {(selectedEvent || selectedSource || showPerformance || showFlow) && (
                <button
                  type="button"
                  className="talia-event-meta__copy-btn"
                  onClick={() => {
                    setSelectedEvent(null);
                    setSelectedSource(null);
                    setShowPerformance(false);
                    setShowFlow(false);
                    setShowCurrentCycleOnly(false);
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
          {copyStatus && <span className="talia-event-meta__copy-status">{copyStatus}</span>}
          {(showPerformance || showFlow) ? (
            <div className="talia-event-meta__perf-detail">
              {!showFlow && (
                <div className="talia-event-meta__perf-chart" role="img" aria-label="Performance timing chart">
                  <div className="talia-event-meta__perf-chart-bars">
                    {[
                      { key: 'network', label: 'N', value: networkPerfMs },
                      { key: 'loading', label: 'L', value: loadingPerfMs },
                      { key: 'display', label: 'D', value: displayPerfMs },
                    ].map((phase) => (
                      <div key={phase.key} className="talia-event-meta__perf-phase-row">
                        <span className="talia-event-meta__perf-phase-label">{phase.label}</span>
                        <div className="talia-event-meta__perf-phase-track">
                          <span
                            className={`talia-event-meta__perf-phase-fill talia-event-meta__perf-phase-fill--${phase.key}`}
                            style={{ width: `${Math.min(100, (phase.value / Math.max(totalPerformanceMs, 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="talia-event-meta__perf-phase-ms">{Math.round(phase.value)}ms</span>
                      </div>
                    ))}
                  </div>
                  <div className="talia-event-meta__perf-timeline">
                    {performanceHistory.length > 0 ? performanceHistory.map((duration, index) => {
                      const maxDuration = Math.max(...performanceHistory, 1);
                      const height = Math.max(14, (duration / maxDuration) * 48);
                      return (
                        <span
                          key={`perf-point-${index}`}
                          className="talia-event-meta__perf-point"
                          style={{ height: `${height}px` }}
                          title={`Query ${performanceHistory.length - index}: ${Math.round(duration)}ms`}
                        />
                      );
                    }) : (
                      <span className="talia-event-meta__perf-empty">No timeline samples</span>
                    )}
                  </div>
                </div>
              )}
              {showFlow && (
                <div className="talia-event-meta__flow-list" role="list" aria-label="Event flow list">
                  {visibleFlowEntries.length === 0 && (
                    <div className="talia-event-meta__flow-empty">No flow entries yet.</div>
                  )}
                  {visibleFlowEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      role="listitem"
                      className={`talia-event-meta__flow-item ${activeFlowEntry?.id === entry.id ? 'talia-event-meta__flow-item--active' : ''} ${entry.devReplay ? 'talia-event-meta__flow-item--dev' : ''} ${currentCycleId && entry.cycleId === currentCycleId ? 'talia-event-meta__flow-item--current-cycle' : ''}`}
                      onClick={() => setActiveFlowId(entry.id)}
                      title={entry.fullText || entry.text}
                    >
                      <span className="talia-event-meta__flow-dot" aria-hidden="true" />
                      <span className="talia-event-meta__flow-cycle">{entry.cycleId ? `C${entry.cycleId}` : 'BG'}</span>
                      <span className="talia-event-meta__flow-seq">#{entry.seq}</span>
                      <span className="talia-event-meta__flow-text">{entry.text}</span>
                      <span className="talia-event-meta__flow-time">{entry.timeLabel || formatFlowTimestamp(entry.ts)}</span>
                    </button>
                  ))}
                </div>
              )}
              <pre className="talia-event-meta__popover-body talia-event-meta__popover-body--perf">{popoverBody}</pre>
            </div>
          ) : (
            <pre className="talia-event-meta__popover-body">{popoverBody}</pre>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportEventMeta;
