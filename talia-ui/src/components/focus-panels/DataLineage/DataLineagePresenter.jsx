/**
 * Data Lineage presenter — grid or table, table/component orientation, Details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';
import {
  COVERAGE_FILTER_DEFAULT,
  COVERAGE_FILTER_OPTIONS,
  KEY_FILTER_DEFAULT,
  KEY_FILTER_OPTIONS,
} from '../../../lib/dataLineageCoverage';
import {
  CATEGORY_FILTER_ADMIN,
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_APPLICATION,
  CATEGORY_FILTER_DEFAULT,
  RECENCY_OPTIONS,
  ROLE_FILTER_OPTIONS,
  SCOPE_OPTIONS,
} from '../../../lib/dataLineageView';
import {
  buildDataLineageExportHtml,
  buildDataLineageExportRows,
  DATA_LINEAGE_EXPORT_COLUMNS,
} from '../../../lib/dataLineagePrint';
import { formatCompactDateTime, formatCompactRelativeAge } from '../../../lib/dateFormat';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import { getTabulatorOptions, initTabulator, captureTableScroll } from '../../../lib/tabulatorConfig';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import SubpanelExpandButton from '../../shared/SubpanelExpandButton';
import './data-lineage.css';

const SIDE_WIDTH_MIN = 280;
const SIDE_WIDTH_MAX = 720;
const SIDE_WIDTH_DEFAULT = 360;

const formatLastAgeCell = (cell) => {
  const value = cell.getValue();
  const el = document.createElement('span');
  el.className = 'dl-last-age';
  el.textContent = formatCompactRelativeAge(value);
  const full = formatCompactDateTime(value, '');
  if (full) el.title = full;
  return el;
};

const tableColumns = [
  {
    field: 'sourceLabel',
    title: 'Synapse source',
    titleShort: 'Synapse',
    headerFilter: 'input',
    minWidth: 160,
    widthGrow: 2,
  },
  {
    field: 'taliaTable',
    title: 'Talia table',
    titleShort: 'Talia',
    headerFilter: 'input',
    minWidth: 140,
    widthGrow: 2,
  },
  {
    field: 'consumerCount',
    title: 'Consumers',
    titleShort: '#',
    hozAlign: 'right',
    width: 90,
    headerFilter: 'number',
  },
  {
    field: 'topConsumers',
    title: 'Top consumers',
    titleShort: 'Used by',
    headerFilter: 'input',
    minWidth: 180,
    widthGrow: 2,
  },
  {
    field: 'usageCount',
    title: 'Refreshes',
    titleShort: 'Refs',
    hozAlign: 'right',
    width: 90,
    headerFilter: 'number',
    headerTooltip: 'Tracked data refreshes / fetches in the filter window',
  },
  {
    field: 'lastAt',
    title: 'Last refresh',
    titleShort: 'Last',
    width: 72,
    hozAlign: 'right',
    formatter: formatLastAgeCell,
  },
];

const componentColumns = [
  {
    field: 'title',
    title: 'Component',
    titleShort: 'Panel',
    headerFilter: 'input',
    minWidth: 160,
    widthGrow: 2,
  },
  {
    field: 'category',
    title: 'Category',
    titleShort: 'Cat',
    headerFilter: 'list',
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    width: 120,
  },
  {
    field: 'isKey',
    title: 'Key',
    titleShort: 'Key',
    width: 70,
    hozAlign: 'center',
    formatter: (cell) => {
      const row = cell.getRow()?.getData?.() || {};
      if (row.isKey) return 'Key';
      if (row.isSuggested) return 'Sug';
      return '';
    },
  },
  {
    field: 'coverageLabel',
    title: 'Coverage',
    titleShort: 'Cov',
    width: 120,
    headerFilter: 'list',
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    formatter: (cell) => {
      const row = cell.getRow()?.getData?.() || {};
      const el = document.createElement('span');
      el.className = row.coverageIssue ? 'dl-cov dl-cov--issue' : 'dl-cov';
      el.textContent = row.coverageLabel || '—';
      return el;
    },
  },
  {
    field: 'tableNames',
    title: 'Tables',
    titleShort: 'Tables',
    headerFilter: 'input',
    minWidth: 160,
    widthGrow: 2,
    formatter: (cell) => {
      const value = String(cell.getValue() || '');
      const count = Number(cell.getRow()?.getData()?.tableCount) || 0;
      const el = document.createElement('span');
      el.className = 'dl-table-cell';
      el.title = value;
      el.textContent = count ? `${count}: ${value}` : value;
      return el;
    },
  },
  {
    field: 'usageCount',
    title: 'Refreshes',
    titleShort: 'Refs',
    hozAlign: 'right',
    width: 90,
    headerFilter: 'number',
    headerTooltip: 'Tracked data refreshes / fetches in the filter window',
  },
  {
    field: 'rolesLabel',
    title: 'Roles',
    titleShort: 'Roles',
    headerFilter: 'input',
    minWidth: 120,
  },
  {
    field: 'lastAt',
    title: 'Last refresh',
    titleShort: 'Last',
    width: 72,
    hozAlign: 'right',
    formatter: formatLastAgeCell,
  },
];

const CoverageBadges = ({ row }) => (
  <span className="dl-badges" aria-label="Lineage status">
    {row.isKey ? <span className="dl-badge dl-badge--key">Key</span> : null}
    {row.isSuggested && !row.isKey ? (
      <span className="dl-badge dl-badge--suggested" title="Suggested from data refreshes in the last 4 weeks">
        Suggested
      </span>
    ) : null}
    {row.coverageIssue ? (
      <span className="dl-badge dl-badge--issue" title={row.coverageLabel || 'Coverage gap'}>
        Issue
      </span>
    ) : null}
    {!row.coverageIssue && row.coverageGap ? (
      <span className="dl-badge dl-badge--gap" title={row.coverageLabel || 'Coverage gap'}>
        Gap
      </span>
    ) : null}
  </span>
);

const LineageCard = ({ row, selected, orientation, onSelect }) => {
  const title = orientation === 'components' ? row.title : row.taliaTable;
  const meta = orientation === 'components'
    ? (row.tableNames || '—')
    : (row.sourceLabel || '—');
  const secondary = orientation === 'components'
    ? `${row.tableCount || 0} tables`
    : `${row.consumerCount || 0} consumers`;

  return (
    <button
      type="button"
      className={[
        'dl-card',
        `dl-card--intensity-${row.intensity || 'none'}`,
        selected ? 'is-selected' : '',
        row.coverageIssue ? 'dl-card--issue' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
      title={`${title}\n${meta}\n${secondary}${row.coverageLabel ? `\n${row.coverageLabel}` : ''}`}
    >
      <span className="dl-card__title-row">
        <span className="dl-card__title">{title}</span>
        <CoverageBadges row={row} />
      </span>
      <span className="dl-card__meta">{meta}</span>
      <span className="dl-card__meta">{secondary}</span>
      <span className="dl-card__usage">
        <strong>{row.usageCount || 0}</strong>
        {' '}
        refreshes
        {row.lastAt ? (
          <>
            {' · '}
            <span title={formatCompactDateTime(row.lastAt, '')}>
              {formatCompactRelativeAge(row.lastAt)}
            </span>
          </>
        ) : null}
      </span>
    </button>
  );
};

const DetailBody = ({
  detail,
  expanded = false,
  onToggleExpand,
  onSetKey,
  keySaving = false,
}) => {
  if (!detail) {
    return (
      <div className="dl-empty-side">
        <p className="dl-muted">Select a card or row to inspect Synapse → Talia → columns.</p>
      </div>
    );
  }

  const lineage = detail.lineage || detail.tables || [];
  const columnGroups = detail.columnGroups || [];
  const unmapped = detail.unmappedColumns || [];
  const keyTarget = detail.panelId || detail.componentKey || null;
  const canToggleKey = detail.kind === 'component' && keyTarget && typeof onSetKey === 'function';

  return (
    <div className={`talia-card talia-card--expandable dl-detail${expanded ? ' talia-card--expanded' : ''}${detail.coverageIssue ? ' dl-detail--issue' : ''}`}>
      <SubpanelExpandButton
        className="talia-card__expand-toggle"
        expanded={expanded}
        onToggle={onToggleExpand}
        label="details"
      />
      <header className="dl-detail__header talia-card__header">
        <div className="dl-detail__title-row">
          <h3 className="dl-detail__title talia-card__title">{detail.title}</h3>
          <CoverageBadges row={detail} />
        </div>
        <p className="dl-detail__subtitle">{detail.subtitle}</p>
        {canToggleKey ? (
          <label className="dl-key-toggle">
            <input
              type="checkbox"
              checked={Boolean(detail.isKey)}
              disabled={keySaving}
              onChange={(e) => onSetKey(keyTarget, e.target.checked)}
            />
            <span>Key panel</span>
          </label>
        ) : null}
      </header>
      <div className={`dl-detail__body${expanded ? ' dl-detail__body--expanded' : ''}`}>
        <div className="dl-detail__lead">
          {detail.coverageIssue ? (
            <div className="talia-callout talia-callout--warning dl-coverage-callout" role="status">
              Key panel lineage issue:
              {' '}
              {detail.coverageLabel || 'coverage gap'}
              . Highlighted for source remapping — not a runtime failure.
            </div>
          ) : null}
          {detail.summary?.length ? (
            <dl className="dl-summary">
              {detail.summary.map((item) => (
                <div key={item.label} className="dl-summary__item">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {detail.notes?.length ? (
            <>
              <p className="dl-section-label">Notes</p>
              <ul className="dl-detail-list">
                {detail.notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="dl-section-label">Lineage (Synapse → Talia)</p>
          {lineage.length ? (
            <ul className="dl-lineage">
              {lineage.map((edge) => (
                <li key={edge.taliaTable || edge}>
                  <span className="dl-lineage__source">{edge.sourceLabel || '—'}</span>
                  <span className="dl-lineage__arrow" aria-hidden="true">→</span>
                  <code className="dl-lineage__talia">{edge.taliaTable}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dl-muted">No table lineage mapped.</p>
          )}

          {detail.kind === 'table' && detail.consumers?.length ? (
            <>
              <p className="dl-section-label">Consumers</p>
              <ul className="dl-detail-list">
                {detail.consumers.map((c) => (
                  <li key={c.componentKey}>
                    {c.title}
                    {' '}
                    <span className="dl-muted">({c.openCount || 0} refreshes)</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className="dl-detail__columns">
          <p className="dl-section-label">Columns by table</p>
          {columnGroups.length ? (
            <div className="dl-column-groups">
              {columnGroups.map((group) => (
                <section key={group.table} className="dl-column-group">
                  <header className="dl-column-group__head">
                    <code>{group.table}</code>
                    {group.synapseSource ? (
                      <span className="dl-muted">{` ← ${group.synapseSource}`}</span>
                    ) : null}
                  </header>
                  <table className="dl-columns">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Provenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.columns.map((col) => (
                        <tr key={`${group.table}-${col.name}`}>
                          <td>
                            <code>{col.name}</code>
                            {col.label ? <span className="dl-field-label">{col.label}</span> : null}
                          </td>
                          <td>{col.provenance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          ) : (
            <p className="dl-muted">No table-attributed columns yet.</p>
          )}

          {unmapped.length ? (
            <section className="dl-column-group dl-column-group--unmapped">
              <header className="dl-column-group__head">Presenter / computed</header>
              <table className="dl-columns">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {unmapped.map((col) => (
                    <tr key={`unmapped-${col.name}`}>
                      <td>
                        <code>{col.name}</code>
                        {col.label ? <span className="dl-field-label">{col.label}</span> : null}
                      </td>
                      <td>{col.provenance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const DataLineagePresenter = ({
  rows = [],
  orientation = 'tables',
  display = 'grid',
  roleFilter = '',
  userFilter = '',
  recency = '30d',
  scopeFilter = 'used',
  categoryFilter = CATEGORY_FILTER_DEFAULT,
  categoryOptions = [],
  keyFilter = KEY_FILTER_DEFAULT,
  coverageFilter = COVERAGE_FILTER_DEFAULT,
  coverageSummary = null,
  userEmails = [],
  onRoleFilter,
  onUserFilter,
  onRecency,
  onScopeFilter,
  onCategoryFilter,
  onKeyFilter,
  onCoverageFilter,
  onSetKey,
  keySaving = false,
  selectedId,
  onSelect,
  detail,
  showFilters = true,
  showDetails = true,
  showProvenance = false,
  showColumnFilters = true,
  reportShellClassName = 'talia-report',
  usageError = null,
  usageLoading = false,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const rowsRef = useRef(rows);
  const onSelectRef = useRef(onSelect);
  const stageRef = useRef(null);
  const { expandedKey, toggleExpandedKey } = useSubpanelExpansion(null);
  const detailExpanded = expandedKey === 'detail';
  const [sideWidth, setSideWidth] = useState(SIDE_WIDTH_DEFAULT);

  rowsRef.current = rows;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!detail && detailExpanded) toggleExpandedKey('detail');
  }, [detail, detailExpanded, toggleExpandedKey]);

  const onResizeStart = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sideWidth;
    const stageWidth = stageRef.current?.getBoundingClientRect()?.width || 900;

    const onMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX;
      const next = Math.min(
        SIDE_WIDTH_MAX,
        Math.max(SIDE_WIDTH_MIN, startWidth + delta),
      );
      const maxAllowed = Math.max(SIDE_WIDTH_MIN, Math.floor(stageWidth * 0.65));
      setSideWidth(Math.min(next, maxAllowed));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [sideWidth]);

  const filtersLabel = useMemo(() => {
    const scope = SCOPE_OPTIONS.find((o) => o.id === scopeFilter)?.label || scopeFilter;
    const role = roleFilter || 'All roles';
    const user = userFilter || 'All users';
    const rec = RECENCY_OPTIONS.find((o) => o.id === recency)?.label || recency;
    let category = 'All categories';
    if (categoryFilter === CATEGORY_FILTER_APPLICATION) category = 'Application';
    else if (categoryFilter === CATEGORY_FILTER_ADMIN) category = 'Admin';
    else if (categoryFilter && categoryFilter !== CATEGORY_FILTER_ALL) category = categoryFilter;
    const key = KEY_FILTER_OPTIONS.find((o) => o.id === keyFilter)?.label || keyFilter;
    const cov = COVERAGE_FILTER_OPTIONS.find((o) => o.id === coverageFilter)?.label || coverageFilter;
    return `${scope} · ${category} · ${key} · ${cov} · ${role} · ${user} · ${rec}`;
  }, [scopeFilter, categoryFilter, keyFilter, coverageFilter, roleFilter, userFilter, recency]);

  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId: panelComponentId || 'data-lineage',
    getPayload: () => ({
      title: detail?.title ? `Data Lineage — ${detail.title}` : 'Data Lineage',
      html: buildDataLineageExportHtml({
        detail,
        listRows: rows,
        orientation,
        filtersLabel,
      }),
      columns: DATA_LINEAGE_EXPORT_COLUMNS,
      rows: buildDataLineageExportRows({
        detail,
        listRows: rows,
        orientation,
      }),
    }),
  }), [panelInstanceId, panelComponentId, detail, rows, orientation, filtersLabel]);

  const columns = useMemo(
    () => (orientation === 'components' ? componentColumns : tableColumns),
    [orientation],
  );

  const subtitle = useMemo(() => {
    const grain = orientation === 'components' ? 'components' : 'tables';
    const used = rows.filter((r) => (r.usageCount || 0) > 0).length;
    return `${rows.length} ${grain} · ${used} with refreshes in window${usageLoading ? ' · updating usage…' : ''}`;
  }, [rows, orientation, usageLoading]);

  // Rebuild Tabulator when orientation changes (different columns).
  useEffect(() => {
    if (display !== 'table') {
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
        tableBuiltRef.current = false;
      }
      return undefined;
    }

    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;
      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        if (instanceRef.current) {
          try { instanceRef.current.destroy(); } catch { /* noop */ }
          instanceRef.current = null;
        }

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: [],
          columns,
          initialSort: [{ column: 'usageCount', dir: 'desc' }],
          height: '100%',
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false,
          panelComponentId: panelComponentId || 'data-lineage',
          panelInstanceId: panelInstanceId || null,
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          const next = Array.isArray(rowsRef.current) ? rowsRef.current : [];
          const scroll = captureTableScroll(instanceRef.current);
          const refreshPromise = Promise.resolve(instanceRef.current.replaceData(next))
            .catch(() => { /* noop */ });
          afterTabulatorDataRefresh(instanceRef.current, refreshPromise, scroll);
        });

        instanceRef.current.on('rowClick', (_e, row) => {
          const data = row?.getData?.() || {};
          if (data.id) onSelectRef.current?.(data.id);
        });
      } catch (err) {
        console.error('[DataLineage] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
  }, [display, columns, panelComponentId, panelInstanceId]);

  useEffect(() => {
    const table = instanceRef.current;
    if (display !== 'table' || !table || !tableBuiltRef.current) return;
    const next = Array.isArray(rows) ? rows : [];
    const scroll = captureTableScroll(table);
    const refreshPromise = Promise.resolve(table.replaceData(next)).catch(() => { /* noop */ });
    afterTabulatorDataRefresh(table, refreshPromise, scroll);
  }, [rows, display]);

  useEffect(() => {
    const root = tableRef.current?.closest?.('.talia-report') || null;
    if (!root) return;
    root.classList.toggle('talia-column-filters-hidden', showColumnFilters === false);
  }, [showColumnFilters, display]);

  const shellClass = [
    'focus-panel',
    'data-lineage',
    reportShellClassName || 'talia-report',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={shellClass}
      role="region"
      aria-label="Data lineage"
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={panelComponentId || undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Data Lineage</h2>
          <p className="talia-report__subtitle">
            {subtitle}
            {' · '}
            {orientation === 'components' ? 'Components' : 'Tables'}
            {' / '}
            {display === 'table' ? 'Table' : 'Grid'}
            {' (Views)'}
          </p>
        </div>
      </header>

      {showFilters ? (
        <div className="talia-report-filters data-lineage__filters" aria-label="Data lineage filters">
          <div className="talia-report-filters__group talia-report-filters__group--inline">
            <label className="talia-report-filters__label" htmlFor="dl-scope">Data</label>
            <select
              id="dl-scope"
              className="talia-report-filters__input"
              value={scopeFilter}
              onChange={(e) => onScopeFilter?.(e.target.value)}
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          {orientation === 'components' ? (
            <>
              <div className="talia-report-filters__group talia-report-filters__group--inline">
                <label className="talia-report-filters__label" htmlFor="dl-category">Category</label>
                <select
                  id="dl-category"
                  className="talia-report-filters__input"
                  value={categoryFilter}
                  onChange={(e) => onCategoryFilter?.(e.target.value)}
                >
                  <option value={CATEGORY_FILTER_ALL}>All</option>
                  <option value={CATEGORY_FILTER_APPLICATION}>Application</option>
                  <option value={CATEGORY_FILTER_ADMIN}>Admin</option>
                  {categoryOptions
                    .filter((cat) => String(cat).trim().toLowerCase() !== 'admin')
                    .map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
              </div>
              <div className="talia-report-filters__group talia-report-filters__group--inline">
                <label className="talia-report-filters__label" htmlFor="dl-key">Key</label>
                <select
                  id="dl-key"
                  className="talia-report-filters__input"
                  value={keyFilter}
                  onChange={(e) => onKeyFilter?.(e.target.value)}
                >
                  {KEY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="talia-report-filters__group talia-report-filters__group--inline">
                <label className="talia-report-filters__label" htmlFor="dl-coverage">Coverage</label>
                <select
                  id="dl-coverage"
                  className="talia-report-filters__input"
                  value={coverageFilter}
                  onChange={(e) => onCoverageFilter?.(e.target.value)}
                >
                  {COVERAGE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          <div className="talia-report-filters__group talia-report-filters__group--inline">
            <label className="talia-report-filters__label" htmlFor="dl-role">Role</label>
            <select
              id="dl-role"
              className="talia-report-filters__input"
              value={roleFilter}
              onChange={(e) => onRoleFilter?.(e.target.value)}
            >
              <option value="">All roles</option>
              {ROLE_FILTER_OPTIONS.filter(Boolean).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="talia-report-filters__group talia-report-filters__group--inline">
            <label className="talia-report-filters__label" htmlFor="dl-user">User</label>
            <select
              id="dl-user"
              className="talia-report-filters__input"
              value={userFilter}
              onChange={(e) => onUserFilter?.(e.target.value)}
            >
              <option value="">All users</option>
              {userEmails.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>
          <div className="talia-report-filters__group talia-report-filters__group--inline">
            <label className="talia-report-filters__label" htmlFor="dl-recency">Recency</label>
            <select
              id="dl-recency"
              className="talia-report-filters__input"
              value={recency}
              onChange={(e) => onRecency?.(e.target.value)}
            >
              {RECENCY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {usageError ? (
        <div className="talia-callout" role="status">
          Usage aggregates unavailable:
          {' '}
          {usageError}
        </div>
      ) : null}

      {coverageSummary?.keyIssueCount > 0 ? (
        <div className="talia-callout talia-callout--warning" role="status">
          {coverageSummary.keyIssueCount}
          {' '}
          key panel
          {coverageSummary.keyIssueCount === 1 ? '' : 's'}
          {' '}
          with lineage gaps
          {coverageSummary.keyCount != null ? ` (${coverageSummary.keyCount} key total)` : ''}
          . Highlighted for source remapping — not a runtime failure.
        </div>
      ) : coverageSummary?.keyCount > 0 ? (
        <div className="talia-callout" role="status">
          {coverageSummary.keyCount}
          {' '}
          key panel
          {coverageSummary.keyCount === 1 ? '' : 's'}
          {' tracked'}
          {coverageSummary.suggestedCount
            ? ` · ${coverageSummary.suggestedCount} suggested from 4-week refreshes`
            : ''}
          .
        </div>
      ) : null}

      <main className="talia-report__content">
        <div
          ref={stageRef}
          className={[
            'dl-stage',
            showDetails ? '' : 'dl-stage--details-hidden',
            detailExpanded ? 'dl-stage--detail-expanded' : '',
          ].filter(Boolean).join(' ')}
          style={showDetails && !detailExpanded ? { '--dl-side-width': `${sideWidth}px` } : undefined}
        >
          <div className="dl-main">
            {display === 'grid' ? (
              <div className="dl-grid" role="list">
                {rows.map((row) => (
                  <LineageCard
                    key={row.id}
                    row={row}
                    orientation={orientation}
                    selected={row.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="dl-table-wrap">
                <div ref={tableRef} className="focus-panel__table" />
              </div>
            )}
          </div>

          {showDetails && !detailExpanded ? (
            <button
              type="button"
              className="dl-resize-handle"
              aria-label="Resize details panel"
              title="Drag to resize details"
              onPointerDown={onResizeStart}
            />
          ) : null}

          <ReportDataDetails visible={showDetails} className="dl-side">
            {detail ? (
              <DetailBody
                detail={detail}
                expanded={detailExpanded}
                onToggleExpand={() => toggleExpandedKey('detail')}
                onSetKey={onSetKey}
                keySaving={keySaving}
              />
            ) : (
              <div className="dl-empty-side">
                <p className="dl-muted">Select a card or row to inspect Synapse → Talia → columns.</p>
              </div>
            )}
          </ReportDataDetails>
        </div>

        <ReportProvenance visible={showProvenance}>
          <p>
            Primary edge is Synapse → Talia from
            {' '}
            <code>tableSources</code>
            {' '}
            (sync.config).
            {' '}
            <code>etl_table_parameters</code>
            {' '}
            is a Seaware/original reference only. Component → tables prefer registry
            {' '}
            <code>tables</code>
            , scraped
            {' '}
            <code>tableName</code>
            usages, then guarded prose. Columns come from panel overrides and the Tabulator
            field-usage catalog. Usage is tracked data refreshes (
            <code>kind=query</code>
            ) from
            {' '}
            <code>ui_activity_events</code>
            . See Documents
            {' '}
            <strong>D015</strong>
            .
          </p>
        </ReportProvenance>
      </main>
    </div>
  );
};

export default DataLineagePresenter;
