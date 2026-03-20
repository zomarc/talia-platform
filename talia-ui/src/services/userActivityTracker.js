import queryTracker from './data/queryTracker';
import { apolloClient } from '../lib/apolloClient';
import { gql } from '@apollo/client';

const STORAGE_KEY = 'taliaUserActivityLog';
const MAX_EVENTS = 1200;
const REMOTE_LIMIT = 3000;

const LOG_UI_ACTIVITY_EVENT_MUTATION = gql`
  mutation LogUiActivityEvent($input: UiActivityEventInput!) {
    logUiActivityEvent(input: $input)
  }
`;

const UI_ACTIVITY_EVENTS_QUERY = gql`
  query UiActivityEvents($sinceMinutes: Int, $limit: Int, $userId: String, $userEmail: String) {
    uiActivityEvents(sinceMinutes: $sinceMinutes, limit: $limit, userId: $userId, userEmail: $userEmail) {
      id
      at
      userId
      userEmail
      userRole
      kind
      report
      panelComponent
      purpose
      status
      performanceMs
      queryCount
      sourceQueryId
      criteria
    }
  }
`;

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const nowIso = () => new Date().toISOString();

const normalizeCriteria = (criteria) => {
  if (!criteria || typeof criteria !== 'object') return null;
  return {
    rangeKey: criteria.rangeKey || 'all',
    durationKey: criteria.durationKey || 'all',
    activeOnly: criteria.activeOnly !== false,
    dateFrom: criteria.dateFrom || '',
    dateTo: criteria.dateTo || ''
  };
};

const currentUserSnapshot = () => {
  const devUserId = localStorage.getItem('devUserId') || '';
  const userId = localStorage.getItem('userId') || devUserId || 'anonymous';
  const userEmail = localStorage.getItem('userEmail') || '';
  const userRole = localStorage.getItem('userRole') || localStorage.getItem('devUserRole') || 'USER';
  return {
    userId,
    userEmail,
    userRole,
  };
};

class UserActivityTracker {
  constructor() {
    this.events = [];
    this.sharedEvents = [];
    this.initialized = false;
    this.unsubscribeQueryTracker = null;
    this.listeners = new Set();
  }

  load() {
    this.events = safeJsonParse(localStorage.getItem(STORAGE_KEY), []);
    if (!Array.isArray(this.events)) this.events = [];
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events.slice(0, MAX_EVENTS)));
    this.notify();
  }

  async logToServer(event) {
    try {
      await apolloClient.mutate({
        mutation: LOG_UI_ACTIVITY_EVENT_MUTATION,
        variables: {
          input: {
            at: event.at,
            userId: event.userId,
            userEmail: event.userEmail,
            userRole: event.userRole,
            kind: event.kind || 'event',
            report: event.report || 'unknown',
            panelComponent: event.panelComponent || null,
            purpose: event.purpose || '',
            status: event.status || '',
            performanceMs: Number.isFinite(event.performanceMs) ? Math.round(event.performanceMs) : null,
            queryCount: Number.isFinite(event.queryCount) ? Math.round(event.queryCount) : null,
            sourceQueryId: event.sourceQueryId || null,
            criteria: event.criteria || null
          }
        },
        errorPolicy: 'all'
      });
    } catch {
      // swallow logging errors
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.load();

    this.unsubscribeQueryTracker = queryTracker.subscribe((queries) => {
      if (!Array.isArray(queries) || !queries.length) return;
      const latest = queries[0];
      if (!latest || !latest.id || latest.status === 'pending') return;
      const alreadyCaptured = this.events.some((event) => event.sourceQueryId === latest.id);
      if (alreadyCaptured) return;
      this.recordQuery(latest);
    });
  }

  dispose() {
    if (this.unsubscribeQueryTracker) {
      this.unsubscribeQueryTracker();
      this.unsubscribeQueryTracker = null;
    }
    this.initialized = false;
  }

  record(event) {
    const base = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      ...currentUserSnapshot(),
      criteria: normalizeCriteria(window.__taliaGlobalCriteria || {}),
      ...event
    };

    this.events.unshift(base);
    if (this.events.length > MAX_EVENTS) this.events = this.events.slice(0, MAX_EVENTS);
    this.save();
    this.logToServer(base);
    return base;
  }

  recordPanelAccess(panelComponent, panelTitle = '') {
    return this.record({
      kind: 'panel',
      report: panelTitle || panelComponent || 'unknown',
      panelComponent: panelComponent || null,
      performanceMs: null,
      queryCount: null
    });
  }

  recordQuery(queryRecord) {
    return this.record({
      kind: 'query',
      sourceQueryId: queryRecord.id,
      report: queryRecord.component || 'unknown',
      panelComponent: queryRecord.component || null,
      purpose: queryRecord.purpose || 'Data fetch',
      status: queryRecord.status || 'unknown',
      performanceMs: Number.isFinite(queryRecord.duration) ? Math.round(queryRecord.duration) : null,
      queryCount: 1
    });
  }

  getEvents() {
    return [...this.sharedEvents, ...this.events];
  }

  getEventsForUser(userId, email) {
    const source = this.getEvents();
    return source.filter((event) => {
      if (userId && event.userId === userId) return true;
      if (email && event.userEmail && event.userEmail.toLowerCase() === String(email).toLowerCase()) return true;
      return false;
    });
  }

  getUserSummary(userId, email) {
    const list = this.getEventsForUser(userId, email);
    if (!list.length) {
      return {
        lastAccessAt: null,
        reportSummary: '—',
        avgPerfMs: null,
        lastCriteria: null,
        events: 0
      };
    }

    const last = list[0];
    const reports = [...new Set(list.map((entry) => entry.report).filter(Boolean))].slice(0, 3);
    const perfValues = list.map((entry) => entry.performanceMs).filter((value) => Number.isFinite(value));
    const avgPerfMs = perfValues.length
      ? Math.round(perfValues.reduce((sum, value) => sum + value, 0) / perfValues.length)
      : null;

    return {
      lastAccessAt: last.at,
      reportSummary: reports.length ? reports.join(', ') : '—',
      avgPerfMs,
      lastCriteria: last.criteria || null,
      events: list.length
    };
  }

  getDetailRows(userId, email, limit = 40) {
    return this.getEventsForUser(userId, email)
      .slice(0, limit)
      .map((event) => ({
        id: event.id,
        at: event.at,
        report: event.report || 'unknown',
        kind: event.kind || 'event',
        purpose: event.purpose || '',
        status: event.status || '',
        performanceMs: Number.isFinite(event.performanceMs) ? event.performanceMs : null,
        criteria: event.criteria
          ? `${event.criteria.rangeKey || 'all'} | ${event.criteria.durationKey || 'all'} | ${event.criteria.activeOnly ? 'active' : 'all'}`
          : '—'
      }));
  }

  async fetchSharedEvents({ sinceMinutes = null, limit = REMOTE_LIMIT, userId = null, userEmail = null } = {}) {
    try {
      const { data } = await apolloClient.query({
        query: UI_ACTIVITY_EVENTS_QUERY,
        variables: {
          sinceMinutes,
          limit,
          userId,
          userEmail
        },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });
      this.sharedEvents = Array.isArray(data?.uiActivityEvents) ? data.uiActivityEvents : [];
      this.notify();
      return [...this.sharedEvents];
    } catch {
      return [...this.sharedEvents];
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.events);
      } catch {
        // no-op
      }
    });
  }
}

const userActivityTracker = new UserActivityTracker();

export const initUserActivityTracking = () => userActivityTracker.init();
export default userActivityTracker;

