import React, { useEffect, useMemo, useState } from 'react';
import queryTracker from '../../services/data/queryTracker';
const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

const formatList = (items = []) => {
  if (!items || items.length === 0) {
    return ['—'];
  }
  return items;
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
    snapshots.push({
      name: window.lastSailSelectEvent.type,
      detail: window.lastSailSelectEvent.detail || null,
      timestamp: new Date().toISOString(),
      source: 'window.lastSailSelectEvent'
    });
  }

  return snapshots;
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
  const exact = snapshots.find((entry) => entry?.name === eventName);
  if (exact) return exact;

  const aliasByDot = eventName.replace(/:/g, '.');
  const aliasByColon = eventName.replace(/\./g, ':');
  return snapshots.find((entry) => entry?.name === aliasByDot || entry?.name === aliasByColon) || null;
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

const ReportEventMeta = ({ emits = [], respondsTo = [], sources = [] }) => {
  const emitList = formatList(emits);
  const respondList = formatList(respondsTo);
  const sourceList = formatList(sources);
  const [copyStatus, setCopyStatus] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [queryVersion, setQueryVersion] = useState(0);
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
    [selectedEvent]
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
    () => collectSourcePerformance(sourceList.filter((item) => item !== '—')),
    [sourceList, queryVersion]
  );
  const performanceHistory = useMemo(
    () => collectPerformanceHistory(sourceList.filter((item) => item !== '—')),
    [sourceList, queryVersion]
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
  const popoverTitle = showPerformance ? 'Performance' : (selectedSource ? 'Source Details' : 'Event Message');
  const popoverName = showPerformance
    ? `Panel load timing (${Math.round(totalPerformanceMs)}ms)`
    : (selectedSource || selectedEvent || 'Select an event or source');
  const popoverBody = showPerformance
    ? performanceSummaryText
    : (selectedSource ? selectedSourceText : (selectedEventText || 'Select an event or source to view details.'));
  const hasSelection = Boolean(selectedEvent || selectedSource || showPerformance);

  useEffect(() => {
    const unsubscribe = queryTracker.subscribe(() => {
      const startedAt = performance.now();
      setQueryVersion((current) => current + 1);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setDisplayPerfMs(Math.max(0, performance.now() - startedAt));
        });
      });
    });
    return unsubscribe;
  }, []);

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

  const handleCopyEvent = async () => {
    if (!popoverBody) return;
    const success = await copyText(popoverBody);
    setCopyStatus(success ? (selectedSource ? 'Source copied' : 'Event copied') : 'Copy failed');
    window.setTimeout(() => setCopyStatus(''), 1500);
  };

  return (
    <div className="talia-event-meta" role="note" aria-label="Report event contract">
      <div className="talia-event-meta__summary-line">
        <div className="talia-event-meta__group">
          <span className="talia-event-meta__label">Emits</span>
          <div className="talia-event-meta__chips">
            {emitList.map((eventName) => (
              <button
                key={`emit-${eventName}`}
                type="button"
                className={`talia-event-meta__chip ${selectedEvent === eventName ? 'talia-event-meta__chip--selected' : ''}`}
                onClick={() => {
                  setSelectedSource(null);
                  setShowPerformance(false);
                  setSelectedEvent((current) => (current === eventName ? null : eventName));
                }}
                title={`View payload for ${eventName}`}
              >
                {eventName}
              </button>
            ))}
          </div>
        </div>
        <div className="talia-event-meta__group">
          <span className="talia-event-meta__label">Accepts</span>
          <div className="talia-event-meta__chips">
            {respondList.map((eventName) => (
              <button
                key={`respond-${eventName}`}
                type="button"
                className={`talia-event-meta__chip talia-event-meta__chip--secondary ${selectedEvent === eventName ? 'talia-event-meta__chip--selected' : ''}`}
                onClick={() => {
                  setSelectedSource(null);
                  setShowPerformance(false);
                  setSelectedEvent((current) => (current === eventName ? null : eventName));
                }}
                title={`View payload for ${eventName}`}
              >
                {eventName}
              </button>
            ))}
          </div>
        </div>
        <div className="talia-event-meta__group">
          <span className="talia-event-meta__label">Sources</span>
          <div className="talia-event-meta__chips">
            {sourceList.map((sourceName) => (
              <button
                key={`source-${sourceName}`}
                type="button"
                className={`talia-event-meta__chip talia-event-meta__chip--source ${selectedSource === sourceName ? 'talia-event-meta__chip--selected' : ''}`}
                onClick={() => {
                  setSelectedEvent(null);
                  setShowPerformance(false);
                  setSelectedSource((current) => (current === sourceName ? null : sourceName));
                }}
                title={`View query details for ${sourceName}`}
                aria-label={`Source ${sourceName}`}
              >
                <span className="talia-event-meta__source-icon" aria-hidden="true">{getSourceIconText(sourceName)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="talia-event-meta__group talia-event-meta__group--performance">
          <span className="talia-event-meta__label">Performance</span>
          <button
            type="button"
            className={`talia-event-meta__perf-bar ${showPerformance ? 'talia-event-meta__perf-bar--selected' : ''}`}
            onClick={() => {
              setSelectedEvent(null);
              setSelectedSource(null);
              setShowPerformance((current) => !current);
            }}
            title="View panel timing summary"
          >
            {phaseSegments.map((phase) => {
              return (
                <span
                  key={`perf-${phase.key}`}
                  className={`talia-event-meta__perf-segment talia-event-meta__perf-segment--${phase.key}`}
                  style={{ width: `${phase.percentage}%` }}
                  title={`${phase.label}: ${Math.round(phase.value)}ms`}
                >
                  <span className="talia-event-meta__perf-segment-label">
                    {phase.label.charAt(0)}
                  </span>
                </span>
              );
            })}
            <span className="talia-event-meta__perf-label">{Math.round(totalPerformanceMs)}ms</span>
          </button>
        </div>
      </div>
      {hasSelection && (
      <div className="talia-event-meta__popover" role="dialog" aria-label={`Event payload ${popoverName}`}>
          <div className="talia-event-meta__popover-header">
            <span className="talia-event-meta__label">{popoverTitle}</span>
            <div className="talia-event-meta__actions">
              <button type="button" className="talia-event-meta__copy-btn" onClick={handleCopySources}>
                Copy Contract
              </button>
              {(selectedEvent || selectedSource || showPerformance) && (
                <button type="button" className="talia-event-meta__copy-btn" onClick={handleCopyEvent}>
                  {selectedSource ? 'Copy Details' : (showPerformance ? 'Copy Summary' : 'Copy Event')}
                </button>
              )}
              {(selectedEvent || selectedSource || showPerformance) && (
                <button
                  type="button"
                  className="talia-event-meta__copy-btn"
                  onClick={() => {
                    setSelectedEvent(null);
                    setSelectedSource(null);
                    setShowPerformance(false);
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
          {copyStatus && <span className="talia-event-meta__copy-status">{copyStatus}</span>}
          <div className="talia-event-meta__popover-event">{popoverName}</div>
          {showPerformance ? (
            <div className="talia-event-meta__perf-detail">
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
