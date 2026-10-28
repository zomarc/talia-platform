/**
 * Requirements Log Presenter — Tabulator + report shell.
 * Details (bottom) is either read-only selection card or the add/edit form — not both.
 * Density (Full/Compact) via shared VIEW_DENSITY, same as MSE / PE / GE.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import LinkedDocuments from '../../shared/LinkedDocuments';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  resolveViewValue,
  VIEW_COLUMN_FILTERS,
  VIEW_DENSITY,
  VIEW_DETAILS,
  VIEW_FILTERS,
  VIEW_PROVENANCE,
  VIEW_REQUIREMENTS_DISPLAY,
} from '../../../lib/componentOptionsCatalog';
import { payloadFromRows, registerPanelDataExport } from '../../../lib/panelDataExport';
import {
  bindTabulatorRowSelectionHandlers,
  COMMON_COLUMN_TYPES,
  getTabulatorOptions,
  initTabulator,
  captureTableScroll,
} from '../../../lib/tabulatorConfig';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import './requirements-log.css';

const SECTION_LABELS = {
  deliverable: 'Deliverable',
  external: 'External',
  question: 'Question',
};

const STATUS_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS = { p0: 'p0', p1: 'p1', p2: 'p2' };
const AREA_LABELS = { ui: 'ui', data: 'data', engine: 'engine', docs: 'docs', ops: 'ops' };
const SOURCE_LABELS = { manual: 'manual', plaud: 'plaud', cursor: 'cursor' };

const STATUS_PILL = {
  backlog: 'talia-pill--neutral',
  in_progress: 'talia-pill--warning',
  done: 'talia-pill--success',
  cancelled: 'talia-pill--neutral',
};

const PRIORITY_PILL = {
  p0: 'talia-pill--danger',
  p1: 'talia-pill--warning',
  p2: 'talia-pill--neutral',
};

export const EMPTY_REQUIREMENT_FORM = {
  id: null,
  section: 'deliverable',
  title: '',
  detail: '',
  status: 'backlog',
  priority: 'p1',
  area: '',
  targetVersion: '',
  taliaVersion: '',
  owner: '',
  source: 'manual',
  sourceRef: '',
  createdAt: null,
  updatedAt: null,
};

/** Keep in sync with registry.js RequirementsLogPanel.options */
const REGISTRY_OPTIONS = {
  views: [
    VIEW_DENSITY,
    VIEW_REQUIREMENTS_DISPLAY,
    VIEW_FILTERS,
    VIEW_COLUMN_FILTERS,
    { ...VIEW_DETAILS, default: true },
    VIEW_PROVENANCE,
  ],
  operations: [],
};

const formatPillCell = (value, label, toneClass) => {
  const el = document.createElement('span');
  el.className = `talia-pill ${toneClass || 'talia-pill--neutral'}`.trim();
  el.textContent = label || value || '—';
  return el;
};

const formatUpdated = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
};

const buildColumns = (isCompact) => {
  const statusCol = {
    field: 'status',
    title: 'Status',
    titleShort: 'St',
    width: isCompact ? 88 : 110,
    ...COMMON_COLUMN_TYPES.dropdown({ values: STATUS_LABELS }),
    formatter: (cell) => {
      const v = cell.getValue();
      return formatPillCell(v, STATUS_LABELS[v] || v, STATUS_PILL[v]);
    },
  };
  const priorityCol = {
    field: 'priority',
    title: 'Pri',
    titleShort: 'P',
    width: isCompact ? 52 : 56,
    hozAlign: 'center',
    ...COMMON_COLUMN_TYPES.dropdown({ values: PRIORITY_LABELS }),
    formatter: (cell) => {
      const v = cell.getValue();
      return formatPillCell(v, PRIORITY_LABELS[v] || v, PRIORITY_PILL[v]);
    },
  };

  if (isCompact) {
    return [
      priorityCol,
      statusCol,
      {
        field: 'title',
        title: 'Title',
        minWidth: 160,
        widthGrow: 3,
        headerFilter: 'input',
      },
      {
        field: 'targetVersion',
        title: 'Milestone',
        titleShort: 'Mile',
        width: 100,
        headerFilter: 'input',
      },
      {
        field: 'owner',
        title: 'Owner',
        width: 90,
        headerFilter: 'input',
      },
    ];
  }

  return [
    {
      field: 'section',
      title: 'Section',
      titleShort: 'Sec',
      width: 110,
      ...COMMON_COLUMN_TYPES.dropdown({ values: SECTION_LABELS }),
      formatter: (cell) => SECTION_LABELS[cell.getValue()] || cell.getValue() || '',
    },
    priorityCol,
    statusCol,
    {
      field: 'title',
      title: 'Title',
      minWidth: 220,
      widthGrow: 3,
      headerFilter: 'input',
    },
    {
      field: 'targetVersion',
      title: 'Milestone',
      titleShort: 'Mile',
      titleLong: 'Descriptive milestone (e.g. oct-5-demo)',
      width: 120,
      headerFilter: 'input',
    },
    {
      field: 'taliaVersion',
      title: 'Talia',
      titleShort: 'Ver',
      titleLong: 'Talia app version (e.g. 0.3.2)',
      width: 80,
      headerFilter: 'input',
    },
    {
      field: 'area',
      title: 'Area',
      width: 80,
      ...COMMON_COLUMN_TYPES.dropdown({ values: AREA_LABELS }),
    },
    {
      field: 'owner',
      title: 'Owner',
      width: 100,
      headerFilter: 'input',
    },
    {
      field: 'source',
      title: 'Source',
      width: 80,
      ...COMMON_COLUMN_TYPES.dropdown({ values: SOURCE_LABELS }),
    },
    {
      field: 'createdAt',
      title: 'Created',
      titleShort: 'Created',
      width: 140,
      formatter: (cell) => formatUpdated(cell.getValue()),
    },
    {
      field: 'updatedAt',
      title: 'Updated',
      titleShort: 'Updated',
      width: 140,
      formatter: (cell) => formatUpdated(cell.getValue()),
    },
  ];
};

const itemToForm = (data) => ({
  id: data?.id || null,
  section: data?.section || 'deliverable',
  title: data?.title || '',
  detail: data?.detail || '',
  status: data?.status || 'backlog',
  priority: data?.priority || 'p1',
  area: data?.area || '',
  targetVersion: data?.targetVersion || '',
  taliaVersion: data?.taliaVersion || '',
  owner: data?.owner || '',
  source: data?.source || 'manual',
  sourceRef: data?.sourceRef || '',
  createdAt: data?.createdAt || null,
  updatedAt: data?.updatedAt || null,
});

const PillChoice = ({ label, value, options, tones, onChange }) => (
  <div className="requirements-log__inline" role="group" aria-label={label}>
    <span className="requirements-log__inline-label">{label}</span>
    <div className="requirements-log__pills">
      {Object.entries(options).map(([key, text]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            className={`talia-pill ${tones[key] || 'talia-pill--neutral'}${selected ? ' is-selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onChange?.(key)}
          >
            {text}
          </button>
        );
      })}
    </div>
  </div>
);

const InlineField = ({ label, children }) => (
  <label className="requirements-log__inline">
    <span className="requirements-log__inline-label">{label}</span>
    {children}
  </label>
);

const STATUS_ORDER = ['backlog', 'in_progress', 'done', 'cancelled'];

const buildMilestoneBoard = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = String(row?.targetVersion || '').trim() || '(No milestone)';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === '(No milestone)') return 1;
      if (b === '(No milestone)') return -1;
      return a.localeCompare(b);
    })
    .map(([milestone, list]) => {
      const counts = { backlog: 0, in_progress: 0, done: 0, cancelled: 0 };
      list.forEach((row) => {
        const s = row.status;
        if (counts[s] != null) counts[s] += 1;
      });
      const sorted = [...list].sort((x, y) => {
        const px = x.priority || 'p9';
        const py = y.priority || 'p9';
        if (px !== py) return px.localeCompare(py);
        return String(x.title || '').localeCompare(String(y.title || ''));
      });
      return { milestone, counts, total: list.length, items: sorted };
    });
};

const BOARD_STATUS_SHORT = {
  backlog: 'Backlog',
  in_progress: 'Prog',
  done: 'Done',
  cancelled: 'Canx',
};

const MilestoneBoard = ({ items, selectedId, onSelect, onOpen }) => {
  const columns = useMemo(() => buildMilestoneBoard(items), [items]);
  if (!columns.length) {
    return <div className="requirements-log__board-empty">No items match the current filters.</div>;
  }
  return (
    <div className="requirements-log__board" role="list" aria-label="Milestone board">
      {columns.map((col) => (
        <section key={col.milestone} className="requirements-log__board-col talia-card" role="listitem">
          <header className="requirements-log__board-col-head">
            <strong>{col.milestone}</strong>
            <span>{col.total}</span>
          </header>
          <div className="requirements-log__board-counts" aria-label="Status summary">
            {STATUS_ORDER.map((status) => (
              <span
                key={status}
                className={`talia-pill requirements-log__board-pill ${STATUS_PILL[status]}${col.counts[status] ? '' : ' is-empty'}`}
                title={STATUS_LABELS[status]}
              >
                {BOARD_STATUS_SHORT[status]} {col.counts[status]}
              </span>
            ))}
          </div>
          <ul className="requirements-log__board-list">
            {col.items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`requirements-log__board-item${selectedId === row.id ? ' is-selected' : ''}`}
                  onClick={() => onSelect?.(row)}
                  onDoubleClick={() => onOpen?.(row)}
                  title={row.title}
                >
                  <span className={`talia-pill requirements-log__board-pill ${PRIORITY_PILL[row.priority] || 'talia-pill--neutral'}`}>
                    {row.priority || 'p1'}
                  </span>
                  <span
                    className={`talia-pill requirements-log__board-pill ${STATUS_PILL[row.status] || 'talia-pill--neutral'}`}
                    title={STATUS_LABELS[row.status] || row.status}
                  >
                    {BOARD_STATUS_SHORT[row.status] || row.status}
                  </span>
                  <span className="requirements-log__board-title">{row.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

const RequirementsLogPresenter = ({
  items = [],
  filterOptions = { milestones: [], taliaVersions: [], owners: [] },
  busy = false,
  message = null,
  includeDone = false,
  sectionFilter = 'all',
  statusFilter = 'all',
  priorityFilter = 'all',
  versionFilter = '',
  taliaVersionFilter = '',
  ownerFilter = '',
  editing = false,
  form = EMPTY_REQUIREMENT_FORM,
  onFormChange,
  onEditingChange,
  onIncludeDoneChange,
  onSectionFilterChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onVersionFilterChange,
  onTaliaVersionFilterChange,
  onOwnerFilterChange,
  onRefresh,
  onUpsert,
  onCycleStatus,
  onDelete,
  onExport,
  onImport,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const dataRef = useRef(items);
  const tableBuiltRef = useRef(false);
  const fileInputRef = useRef(null);
  const importModeRef = useRef('mergeById');
  const titleInputRef = useRef(null);
  const formChangeRef = useRef(onFormChange);
  const editingChangeRef = useRef(onEditingChange);

  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  formChangeRef.current = onFormChange;
  editingChangeRef.current = onEditingChange;

  const {
    reportShellClassName,
    showFilters,
    showDetails,
    showProvenance,
    isCompact,
    viewsState,
  } = useReportShellOptions(
    panelComponentId,
    panelInstanceId,
    REGISTRY_OPTIONS
  );

  dataRef.current = items;

  const display = resolveViewValue(viewsState, VIEW_REQUIREMENTS_DISPLAY) === 'board'
    ? 'board'
    : 'table';
  const showTable = display === 'table';

  const milestones = filterOptions.milestones || [];
  const taliaVersions = filterOptions.taliaVersions || [];
  const owners = filterOptions.owners || [];
  const columns = useMemo(() => buildColumns(Boolean(isCompact)), [isCompact]);

  const selected = useMemo(
    () => (selectedId ? items.find((r) => r.id === selectedId) : null),
    [items, selectedId]
  );

  useEffect(() => {
    if (!showTable) return undefined;
    let cancelled = false;
    let unbindRows = () => {};

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
          index: 'id',
          height: '100%',
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false,
          layout: 'fitColumns',
          initialSort: isCompact
            ? [{ column: 'title', dir: 'asc' }]
            : [{ column: 'updatedAt', dir: 'desc' }],
          panelComponentId: panelComponentId || 'requirements-log',
          panelInstanceId: panelInstanceId || null,
          exportTitle: 'Requirements Log',
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          const rows = Array.isArray(dataRef.current) ? dataRef.current : [];
          const scroll = captureTableScroll(instanceRef.current);
          const refreshPromise = Promise.resolve(instanceRef.current.replaceData(rows))
            .catch(() => { /* noop */ });
          afterTabulatorDataRefresh(instanceRef.current, refreshPromise, scroll);
        });

        unbindRows = bindTabulatorRowSelectionHandlers(instanceRef.current, {
          onSelect: (data) => {
            setSelectedId(data?.id || null);
            formChangeRef.current?.(itemToForm(data));
            editingChangeRef.current?.(false);
          },
          onOpen: (data) => {
            setSelectedId(data?.id || null);
            formChangeRef.current?.(itemToForm(data));
            editingChangeRef.current?.(true);
          },
        });
      } catch (err) {
        console.error('[RequirementsLog] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      try { unbindRows?.(); } catch { /* noop */ }
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
  }, [columns, isCompact, panelComponentId, panelInstanceId, showTable]);

  useEffect(() => {
    if (showTable) return undefined;
    return registerPanelDataExport({
      panelInstanceId,
      panelComponentId: panelComponentId || 'requirements-log',
      getPayload: () => payloadFromRows(
        'Requirements Log',
        [
          { field: 'section', title: 'Section' },
          { field: 'priority', title: 'Priority' },
          { field: 'status', title: 'Status' },
          { field: 'title', title: 'Title' },
          { field: 'detail', title: 'Detail' },
          { field: 'targetVersion', title: 'Milestone' },
          { field: 'taliaVersion', title: 'Talia version' },
          { field: 'area', title: 'Area' },
          { field: 'owner', title: 'Owner' },
          { field: 'source', title: 'Source' },
        ],
        (dataRef.current || []).map((item) => ({
          section: SECTION_LABELS[item.section] || item.section || '',
          priority: item.priority || '',
          status: STATUS_LABELS[item.status] || item.status || '',
          title: item.title || '',
          detail: item.detail || '',
          targetVersion: item.targetVersion || '',
          taliaVersion: item.taliaVersion || '',
          area: AREA_LABELS[item.area] || item.area || '',
          owner: item.owner || '',
          source: SOURCE_LABELS[item.source] || item.source || '',
        })),
      ),
    });
  }, [panelComponentId, panelInstanceId, showTable]);

  useEffect(() => {
    if (!showTable) return;
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    const rows = Array.isArray(items) ? items : [];
    const scroll = captureTableScroll(table);
    const refreshPromise = Promise.resolve(table.replaceData(rows)).catch(() => { /* noop */ });
    afterTabulatorDataRefresh(table, refreshPromise, scroll);
  }, [items, showTable]);

  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(() => titleInputRef.current?.focus?.(), 50);
    return () => window.clearTimeout(t);
  }, [editing, form?.id]);

  const patchForm = (patch) => {
    onFormChange?.({ ...(form || EMPTY_REQUIREMENT_FORM), ...patch });
  };

  const openNew = () => {
    setSelectedId(null);
    onFormChange?.({ ...EMPTY_REQUIREMENT_FORM });
    onEditingChange?.(true);
  };

  const startEdit = () => {
    if (selected) {
      onFormChange?.(itemToForm(selected));
      onEditingChange?.(true);
      return;
    }
    openNew();
  };

  const cancelEdit = () => {
    onEditingChange?.(false);
    if (selected) {
      onFormChange?.(itemToForm(selected));
    } else {
      onFormChange?.({ ...EMPTY_REQUIREMENT_FORM });
    }
  };

  const submitForm = async (e) => {
    e?.preventDefault?.();
    if (!form?.title?.trim()) return;
    setSaving(true);
    try {
      const input = {
        section: form.section,
        title: form.title.trim(),
        detail: form.detail.trim() || null,
        status: form.status,
        priority: form.priority,
        area: form.area || null,
        targetVersion: form.targetVersion.trim() || null,
        taliaVersion: form.taliaVersion.trim() || null,
        owner: form.owner.trim() || null,
        source: form.source || 'manual',
        sourceRef: form.sourceRef.trim() || null,
      };
      if (form.id) input.id = form.id;
      const saved = await onUpsert?.(input);
      const savedId = saved?.id || form.id;
      if (savedId) setSelectedId(savedId);
      onEditingChange?.(false);
      if (saved) onFormChange?.(itemToForm(saved));
    } catch {
      /* message shown by container */
    } finally {
      setSaving(false);
    }
  };

  const triggerImport = (mode) => {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onImport?.(file, importModeRef.current);
  };

  const detailsVisible = showDetails || editing;
  const metaBits = [
    SECTION_LABELS[form.section] || form.section,
    STATUS_LABELS[form.status] || form.status,
    form.priority,
    form.area || null,
    form.targetVersion || null,
    form.taliaVersion ? `Talia ${form.taliaVersion}` : null,
    form.owner ? `Owner ${form.owner}` : null,
    form.source || null,
    form.sourceRef || null,
    form.createdAt ? `Created ${formatUpdated(form.createdAt)}` : null,
    form.updatedAt ? `Updated ${formatUpdated(form.updatedAt)}` : null,
  ].filter(Boolean);

  return (
    <div
      className={`focus-panel talia-report requirements-log${isCompact ? ' requirements-log--compact' : ''}${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
      role="region"
      aria-label="Requirements Log"
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={panelComponentId || undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Requirements Log</h2>
          <p className="talia-report__subtitle">
            Instance task board · deliverables, external actions, open questions
            {items.length ? ` · ${items.length} shown` : ''}
          </p>
        </div>
      </header>

      <div
        className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
        aria-label="Requirements Log filters"
      >
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Section</span>
          <select
            className="talia-report-filters__input"
            value={sectionFilter}
            onChange={(e) => onSectionFilterChange?.(e.target.value)}
          >
            <option value="all">All</option>
            <option value="deliverable">Deliverable version</option>
            <option value="external">External actions</option>
            <option value="question">Open questions</option>
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Status</span>
          <select
            className="talia-report-filters__input"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange?.(e.target.value)}
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Priority</span>
          <select
            className="talia-report-filters__input"
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange?.(e.target.value)}
          >
            <option value="all">All</option>
            {Object.entries(PRIORITY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Milestone</span>
          <select
            className="talia-report-filters__input"
            value={versionFilter}
            onChange={(e) => onVersionFilterChange?.(e.target.value)}
          >
            <option value="">All</option>
            {milestones.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Talia version</span>
          <select
            className="talia-report-filters__input"
            value={taliaVersionFilter}
            onChange={(e) => onTaliaVersionFilterChange?.(e.target.value)}
          >
            <option value="">All</option>
            {taliaVersions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Owner</span>
          <select
            className="talia-report-filters__input"
            value={ownerFilter}
            onChange={(e) => onOwnerFilterChange?.(e.target.value)}
          >
            <option value="">All</option>
            {owners.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group requirements-log__filter--check">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => onIncludeDoneChange?.(e.target.checked)}
          />
          <span className="talia-report-filters__label">Include done / cancelled</span>
        </label>
      </div>

      {message ? (
        <div className="talia-callout" role="status">{message}</div>
      ) : null}

      <div className="talia-report__actions-bar" aria-label="Requirements Log actions">
        <button type="button" className="talia-btn talia-btn--primary" onClick={openNew} disabled={busy || editing}>
          Add item
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={startEdit}
          disabled={busy || editing || !selected}
        >
          Edit
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} disabled={busy}>
          Refresh
        </button>
        {selected && !editing ? (
          <>
            <button
              type="button"
              className="talia-btn talia-btn--secondary"
              onClick={() => onCycleStatus?.(selected)}
              disabled={busy}
              title="Advance backlog → in progress → done → cancelled"
            >
              Cycle status
            </button>
            <button
              type="button"
              className="talia-btn talia-btn--secondary"
              onClick={() => onDelete?.(selected.id)}
              disabled={busy}
            >
              Delete
            </button>
          </>
        ) : null}
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onExport} disabled={busy || !items.length}>
          Export JSON
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => triggerImport('mergeById')}
          disabled={busy}
        >
          Import (merge)
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => triggerImport('createNew')}
          disabled={busy}
        >
          Import (new ids)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="requirements-log__file"
          onChange={onFileChange}
        />
      </div>

      <main className="talia-report__content talia-report__content--scroll">
        {showTable ? (
          <div ref={tableRef} className="focus-panel__table requirements-log__table" />
        ) : (
          <MilestoneBoard
            items={items}
            selectedId={selectedId}
            onSelect={(row) => {
              setSelectedId(row?.id || null);
              onFormChange?.(itemToForm(row));
              onEditingChange?.(false);
            }}
            onOpen={(row) => {
              setSelectedId(row?.id || null);
              onFormChange?.(itemToForm(row));
              onEditingChange?.(true);
            }}
          />
        )}

        <ReportDataDetails visible={detailsVisible} className="requirements-log__details">
          {editing ? (
            <form
              className="requirements-log__editor talia-card"
              onSubmit={submitForm}
              aria-label={form?.id ? 'Edit requirement item' : 'New requirement item'}
            >
              <label className="requirements-log__title-field">
                <span className="requirements-log__inline-label">Title</span>
                <input
                  className="talia-report-filters__input"
                  ref={titleInputRef}
                  required
                  value={form.title}
                  onChange={(e) => patchForm({ title: e.target.value })}
                />
              </label>

              <div className="requirements-log__edit-row">
                <InlineField label="Section">
                  <select
                    className="talia-report-filters__input"
                    value={form.section}
                    onChange={(e) => patchForm({ section: e.target.value })}
                  >
                    <option value="deliverable">Deliverable</option>
                    <option value="external">External</option>
                    <option value="question">Question</option>
                  </select>
                </InlineField>
                <PillChoice
                  label="Status"
                  value={form.status}
                  options={STATUS_LABELS}
                  tones={STATUS_PILL}
                  onChange={(status) => patchForm({ status })}
                />
                <PillChoice
                  label="Priority"
                  value={form.priority}
                  options={PRIORITY_LABELS}
                  tones={PRIORITY_PILL}
                  onChange={(priority) => patchForm({ priority })}
                />
                <InlineField label="Area">
                  <select
                    className="talia-report-filters__input"
                    value={form.area}
                    onChange={(e) => patchForm({ area: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="ui">ui</option>
                    <option value="data">data</option>
                    <option value="engine">engine</option>
                    <option value="docs">docs</option>
                    <option value="ops">ops</option>
                  </select>
                </InlineField>
              </div>

              <div className="requirements-log__edit-row">
                <InlineField label="Milestone">
                  <input
                    className="talia-report-filters__input"
                    value={form.targetVersion}
                    placeholder="oct-5-demo"
                    list="requirements-log-form-milestones"
                    onChange={(e) => patchForm({ targetVersion: e.target.value })}
                  />
                  <datalist id="requirements-log-form-milestones">
                    {milestones.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </InlineField>
                <InlineField label="Talia">
                  <input
                    className="talia-report-filters__input"
                    value={form.taliaVersion}
                    placeholder="0.3.2"
                    list="requirements-log-form-talia-versions"
                    onChange={(e) => patchForm({ taliaVersion: e.target.value })}
                  />
                  <datalist id="requirements-log-form-talia-versions">
                    {taliaVersions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </InlineField>
                <InlineField label="Owner">
                  <input
                    className="talia-report-filters__input"
                    value={form.owner}
                    list="requirements-log-form-owners"
                    onChange={(e) => patchForm({ owner: e.target.value })}
                  />
                  <datalist id="requirements-log-form-owners">
                    {owners.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </InlineField>
              </div>

              <label className="requirements-log__detail-field">
                <span className="requirements-log__inline-label">Detail</span>
                <textarea
                  className="talia-report-filters__input requirements-log__textarea"
                  rows={isCompact ? 2 : 3}
                  value={form.detail}
                  onChange={(e) => patchForm({ detail: e.target.value })}
                />
              </label>

              <div className="requirements-log__form-actions">
                <button type="submit" className="talia-btn talia-btn--primary" disabled={saving || busy}>
                  {form?.id ? 'Update' : 'Create'}
                </button>
                <button type="button" className="talia-btn talia-btn--secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>

              <p className="requirements-log__edit-meta" aria-label="Item summary">
                {metaBits.join(' · ')}
              </p>
            </form>
          ) : selected ? (
            <article className="talia-card requirements-log__view" aria-label={selected.title}>
              <div className="requirements-log__view-head">
                <div className="requirements-log__view-pills">
                  <span className={`talia-pill ${PRIORITY_PILL[selected.priority] || 'talia-pill--neutral'}`}>
                    {selected.priority}
                  </span>
                  <span className={`talia-pill ${STATUS_PILL[selected.status] || 'talia-pill--neutral'}`}>
                    {STATUS_LABELS[selected.status] || selected.status}
                  </span>
                  <span className="requirements-log__view-meta">
                    {SECTION_LABELS[selected.section] || selected.section}
                    {selected.targetVersion ? ` · ${selected.targetVersion}` : ''}
                    {selected.taliaVersion ? ` · Talia ${selected.taliaVersion}` : ''}
                  </span>
                </div>
                <button type="button" className="talia-btn talia-btn--secondary" onClick={startEdit} disabled={busy}>
                  Edit
                </button>
              </div>
              <h3 className="requirements-log__view-title">{selected.title}</h3>
              {selected.detail ? <p className="requirements-log__detail">{selected.detail}</p> : null}
              <LinkedDocuments targetKind="requirement" targetId={selected.id} />
              <p className="requirements-log__meta">
                {[
                  selected.area,
                  selected.owner ? `Owner ${selected.owner}` : null,
                  selected.source,
                  selected.sourceRef,
                  selected.createdAt ? `Created ${formatUpdated(selected.createdAt)}` : null,
                  selected.updatedAt ? `Updated ${formatUpdated(selected.updatedAt)}` : null,
                ].filter(Boolean).join(' · ') || '—'}
              </p>
            </article>
          ) : (
            <div className="talia-card">
              <p>Select a row for detail, or Add item to create one.</p>
            </div>
          )}
        </ReportDataDetails>

        <ReportProvenance visible={showProvenance}>
          <p>
            Rows live in <code>public.talia_requirement_item</code>.
            Use tab Options → <strong>Density</strong> (Full/Compact) and <strong>Display</strong> (Table/Board).
            Board groups by milestone with status counts for a quick Plaud follow-up scan.
          </p>
        </ReportProvenance>
      </main>
    </div>
  );
};

export default RequirementsLogPresenter;
