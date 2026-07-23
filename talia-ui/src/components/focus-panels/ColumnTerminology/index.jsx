import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import { getTabulatorOptions, initTabulator } from '../../../lib/tabulatorConfig';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import usePanelDetailsVisibility from '../../../hooks/usePanelDetailsVisibility';
import ReportDataDetails from '../../shared/ReportDataDetails';
import {
  getGlobalTabulatorDictionaryRows,
  getObservedTabulatorFieldRows,
  setGlobalTabulatorLabelOverrides,
} from '../../../lib/tabulatorColumnLabelDictionary';
import { getAppTabulatorFieldComponents, getAppTabulatorFieldUsageRows } from '../../../lib/tabulatorFieldUsageCatalog';
import { formatCompactDateTime, formatRelativeTime } from '../../../lib/dateFormat';
import {
  COLUMN_TERMINOLOGY_DEFINITIONS_QUERY,
  SAVE_COLUMN_TERMINOLOGY_DEFINITIONS_MUTATION,
} from '../../../graphql/taliaColumnTerminologyOperations';

const mapDefinitionsByField = (definitions = []) => {
  const mapped = {};
  (Array.isArray(definitions) ? definitions : []).forEach((entry) => {
    const field = String(entry?.field || '').trim();
    if (!field) return;
    mapped[field] = {
      shortLabel: String(entry?.shortLabel || '').trim(),
      longLabel: String(entry?.longLabel || '').trim(),
      userDefinition: String(entry?.userDefinition || '').trim(),
      adminDefinition: String(entry?.adminDefinition || '').trim(),
      updatedAt: entry?.updatedAt || null,
      updatedBy: entry?.updatedBy || null,
    };
  });
  return mapped;
};

const fallbackShortLabel = (field = '') => {
  const key = String(field || '').trim();
  if (!key) return '';
  const token = key.split(/[_\s]+/).filter(Boolean).map((part) => part.slice(0, 3)).join(' ');
  return token || key;
};

const fallbackLongLabel = (field = '') => {
  const key = String(field || '').trim();
  if (!key) return '';
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const buildRow = (field, {
  short = '',
  long = '',
  status = 'missing',
  seenCount = 0,
  latestTitle = '',
  components = [],
  notes = {},
} = {}) => {
  const appComponents = getAppTabulatorFieldComponents(field);
  return {
    field,
    short: notes.shortLabel || short || fallbackShortLabel(field),
    long: notes.longLabel || long || fallbackLongLabel(field),
    status,
    seenCount,
    latestTitle,
    components,
    componentCount: components.length,
    appComponents,
    appComponentCount: appComponents.length,
    userDefinition: notes.userDefinition || '',
    adminDefinition: notes.adminDefinition || '',
    updatedAt: notes.updatedAt || '',
    updatedBy: notes.updatedBy || '',
  };
};

const buildTerminologyRows = (definitionsByField = {}) => {
  const dictionaryRows = getGlobalTabulatorDictionaryRows();
  const observedRows = getObservedTabulatorFieldRows();
  const observedByField = new Map(observedRows.map((row) => [row.field, row]));
  const mergedByField = new Map();

  dictionaryRows.forEach((row) => {
    const observed = observedByField.get(row.field);
    mergedByField.set(row.field, buildRow(row.field, {
      short: row.short,
      long: row.long,
      status: row.status,
      seenCount: observed?.seenCount || 0,
      latestTitle: observed?.latestTitle || '',
      components: Array.isArray(observed?.components) ? observed.components : [],
      notes: definitionsByField[row.field] || {},
    }));
  });

  observedRows.forEach((row) => {
    if (mergedByField.has(row.field)) return;
    mergedByField.set(row.field, buildRow(row.field, {
      short: row.short,
      long: row.long,
      status: row.status,
      seenCount: row.seenCount || 0,
      latestTitle: row.latestTitle || '',
      components: Array.isArray(row.components) ? row.components : [],
      notes: definitionsByField[row.field] || {},
    }));
  });

  getAppTabulatorFieldUsageRows().forEach((row) => {
    if (mergedByField.has(row.field)) return;
    mergedByField.set(row.field, buildRow(row.field, {
      status: 'missing',
      notes: definitionsByField[row.field] || {},
    }));
  });

  Object.keys(definitionsByField).forEach((field) => {
    if (mergedByField.has(field)) return;
    mergedByField.set(field, buildRow(field, {
      status: 'missing',
      notes: definitionsByField[field] || {},
    }));
  });

  return Array.from(mergedByField.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'missing' ? -1 : 1;
    return a.field.localeCompare(b.field);
  });
};

const ColumnTerminologyPanel = ({ panelInstanceId, panelComponentId }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const allowed = canAccessPrivilegedPanels(role);
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [definitionsByField, setDefinitionsByField] = useState({});
  const [dirtyFields, setDirtyFields] = useState(() => new Set());
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [savingDefinitions, setSavingDefinitions] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId,
    fallback: true,
  });

  const rows = useMemo(() => {
    void refreshNonce;
    return buildTerminologyRows(definitionsByField);
  }, [definitionsByField, refreshNonce]);
  const missingCount = useMemo(
    () => rows.filter((row) => row.status === 'missing').length,
    [rows]
  );
  const definedCount = useMemo(
    () => rows.filter((row) => row.short || row.long || row.userDefinition || row.adminDefinition).length,
    [rows]
  );
  const selectedRow = useMemo(
    () => rows.find((row) => row.field === selectedField) || null,
    [rows, selectedField]
  );

  const selectFieldFromTabulatorRow = (row) => {
    const field = String(row?.getData?.()?.field || '').trim();
    if (!field) return;
    setSelectedField(field);
  };

  const loadDefinitions = async () => {
    setLoadingDefinitions(true);
    setSaveError('');
    try {
      const payload = await trackedFetchGraphql({
        query: COLUMN_TERMINOLOGY_DEFINITIONS_QUERY,
        component: panelComponentId || 'ColumnTerminologyPanel',
        purpose: 'Load shared column terminology definitions',
        tableName: 'config_setting',
      });
      const definitions = payload?.columnTerminologyDefinitions || [];
      const mapped = mapDefinitionsByField(definitions);
      setDefinitionsByField(mapped);
      setDirtyFields(new Set());
      setGlobalTabulatorLabelOverrides(definitions);
    } catch (error) {
      setSaveError(error?.message || String(error));
    } finally {
      setLoadingDefinitions(false);
    }
  };

  const toDefinitionPayload = (row) => ({
    field: String(row?.field || '').trim(),
    shortLabel: String(row?.short || '').trim(),
    longLabel: String(row?.long || '').trim(),
    userDefinition: String(row?.userDefinition || '').trim(),
    adminDefinition: String(row?.adminDefinition || '').trim(),
  });

  const saveDefinitions = async ({ onlyField = null } = {}) => {
    setSavingDefinitions(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const targetField = String(onlyField || '').trim();
      const dataRows = (Array.isArray(rows) ? rows : []).filter((row) => {
        const field = String(row?.field || '').trim();
        if (!field) return false;
        if (targetField) return field === targetField;
        return dirtyFields.has(field);
      });
      const definitions = dataRows
        .map(toDefinitionPayload)
        .filter((row) => row.field && (row.shortLabel || row.longLabel || row.userDefinition || row.adminDefinition));
      if (!definitions.length) {
        setSaveMessage(targetField ? 'No changes to save for this field' : 'No edited fields to save');
        window.setTimeout(() => setSaveMessage(''), 2000);
        return;
      }
      const payload = await trackedFetchGraphql({
        query: SAVE_COLUMN_TERMINOLOGY_DEFINITIONS_MUTATION,
        variables: { definitions },
        component: panelComponentId || 'ColumnTerminologyPanel',
        purpose: 'Save shared column terminology definitions',
        tableName: 'config_setting',
      });
      const saved = payload?.saveColumnTerminologyDefinitions || [];
      setDefinitionsByField(mapDefinitionsByField(saved));
      setDirtyFields((previous) => {
        const next = new Set(previous);
        definitions.forEach((entry) => next.delete(entry.field));
        return next;
      });
      setGlobalTabulatorLabelOverrides(saved);
      setSaveMessage(
        targetField
          ? `Saved ${targetField}`
          : `Saved ${definitions.length} edited field${definitions.length === 1 ? '' : 's'}`
      );
      window.setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      setSaveError(error?.message || String(error));
    } finally {
      setSavingDefinitions(false);
    }
  };

  const updateSelectedDefinition = (key, value) => {
    if (!selectedField) return;
    setDirtyFields((previous) => {
      const next = new Set(previous);
      next.add(selectedField);
      return next;
    });
    setDefinitionsByField((previous) => {
      const current = previous[selectedField] || {};
      return {
        ...previous,
        [selectedField]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const columns = useMemo(() => ([
    { field: 'status', titleShort: 'St', titleLong: 'Dictionary status', width: 90, headerSort: false },
    { field: 'field', titleShort: 'Field', titleLong: 'Raw field name', minWidth: 170, headerFilter: 'input' },
    { field: 'short', titleShort: 'Short', titleLong: 'Short header label', minWidth: 110, headerFilter: 'input' },
    { field: 'long', titleShort: 'Long', titleLong: 'Long header label / tooltip', minWidth: 220, headerFilter: 'input' },
    { field: 'appComponentCount', titleShort: 'App', titleLong: 'Components using this field in the application (static catalog)', width: 80, hozAlign: 'right' },
    { field: 'componentCount', titleShort: 'Ses', titleLong: 'Components observed using this field in this session', width: 80, hozAlign: 'right' },
    { field: 'seenCount', titleShort: 'Seen', titleLong: 'Observed usage count in this session', width: 80, hozAlign: 'right' },
    { field: 'latestTitle', titleShort: 'Latest Title', titleLong: 'Latest raw title seen in component', minWidth: 160, headerFilter: 'input' },
    {
      field: 'updatedAt',
      titleShort: 'Updated',
      titleLong: 'Last update (relative). Full time in Field details.',
      minWidth: 110,
      formatter: (cell) => formatRelativeTime(cell.getValue(), ''),
      tooltip: (_event, cell) => formatCompactDateTime(cell.getValue(), ''),
    },
  ]), []);

  useEffect(() => {
    if (!allowed) return;
    loadDefinitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (!rows.length) {
      if (selectedField) setSelectedField('');
      return;
    }
    if (!selectedField || !rows.some((row) => row.field === selectedField)) {
      setSelectedField(rows[0].field);
    }
  }, [rows, selectedField]);

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    const init = async () => {
      if (!tableRef.current || cancelled) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }
      const table = new Tabulator(tableRef.current, getTabulatorOptions({
        data: [],
        columns,
        index: 'field',
        height: '100%',
        pagination: false,
        panelComponentId: panelComponentId || 'ColumnTerminologyPanel',
        selectableRows: 1,
      }));
      table.on('rowClick', (_event, row) => {
        selectFieldFromTabulatorRow(row);
      });
      table.on('rowSelectionChanged', (_data, selectedRows) => {
        const firstRow = Array.isArray(selectedRows) && selectedRows.length ? selectedRows[0] : null;
        if (!firstRow) return;
        selectFieldFromTabulatorRow(firstRow);
      });
      table.on('cellClick', (_event, cell) => {
        const row = cell?.getRow?.();
        if (!row) return;
        selectFieldFromTabulatorRow(row);
      });
      instanceRef.current = table;
    };
    init();
    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }
    };
  }, [allowed, columns, panelComponentId]);

  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.replaceData(rows || []);
  }, [rows]);

  useEffect(() => {
    if (!instanceRef.current || !selectedField) return;
    try {
      instanceRef.current.deselectRow();
      instanceRef.current.selectRow(selectedField);
    } catch {
      // no-op
    }
  }, [selectedField, rows]);

  if (!allowed) {
    return (
      <div className="talia-unavailable">
        Column Terminology requires ADMIN or SUPER_USER privileges.
      </div>
    );
  }

  return (
    <div className="focus-panel talia-report" role="region" aria-label="Column terminology dictionary">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Column Terminology</h2>
          <p className="talia-report__subtitle">
            Shared short/long labels. App = static panel usage catalog; Ses/Seen = this browser session.
          </p>
        </div>
      </header>
      <div className="talia-callout">
        Missing dictionary mappings: {missingCount}. App counts come from a scanned catalog
        (`npm run build:field-usage`). Ses updates when you open panels, then Refresh coverage.
      </div>
      <div className="talia-callout">
        Defined notes: {definedCount}. Edit short/long labels and definitions in Field details, then Save definitions.
      </div>
      {saveError ? <div className="talia-error">{saveError}</div> : null}
      <div className="talia-report__actions-bar" aria-label="Column terminology actions">
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          title="Re-read which fields/components were observed after opening panels in this browser session"
          onClick={() => setRefreshNonce((value) => value + 1)}
        >
          Refresh coverage
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          title="Discard unsaved edits and reload short/long/definition rows from the server"
          onClick={loadDefinitions}
          disabled={loadingDefinitions}
        >
          {loadingDefinitions ? 'Loading...' : 'Reload definitions'}
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--primary"
          title="Persist only fields edited in this session"
          onClick={() => saveDefinitions()}
          disabled={savingDefinitions || dirtyFields.size === 0}
        >
          {savingDefinitions ? 'Saving...' : 'Save definitions'}
        </button>
        {saveMessage ? <span>{saveMessage}</span> : null}
      </div>
      <main className={`talia-report__content column-terminology__content ${showDetails ? '' : 'column-terminology__content--details-hidden'}`.trim()}>
        <div
          ref={tableRef}
          className="focus-panel__table column-terminology__table"
          data-panel-instance-id={panelInstanceId || ''}
          data-panel-component-id={panelComponentId || 'column-terminology'}
        />
        <ReportDataDetails visible={showDetails} as="section" className="column-terminology__details" aria-label="Field details editor">
          <h3 className="column-terminology__details-title">Field details</h3>
          {!selectedRow ? (
            <div>Select a field row to edit labels and definitions.</div>
          ) : (
            <div className="column-terminology__details-body">
              <div className="column-terminology__details-meta">
                <span className="column-terminology__details-field-name">{selectedRow.field}</span>
                <span className="column-terminology__details-status">{selectedRow.status}</span>
              </div>
              <div className="column-terminology__details-grid">
                <label className="column-terminology__details-field">
                  <span>Short</span>
                  <input
                    type="text"
                    className="talia-input"
                    value={selectedRow.short || ''}
                    onChange={(event) => updateSelectedDefinition('shortLabel', event.target.value)}
                  />
                </label>
                <label className="column-terminology__details-field">
                  <span>Long</span>
                  <input
                    type="text"
                    className="talia-input"
                    value={selectedRow.long || ''}
                    onChange={(event) => updateSelectedDefinition('longLabel', event.target.value)}
                  />
                </label>
              </div>
              <label className="column-terminology__details-field">
                <span>User definition</span>
                <textarea
                  className="talia-input"
                  rows={2}
                  value={selectedRow.userDefinition || ''}
                  onChange={(event) => updateSelectedDefinition('userDefinition', event.target.value)}
                />
              </label>
              <label className="column-terminology__details-field">
                <span>Admin/Dev definition</span>
                <textarea
                  className="talia-input"
                  rows={2}
                  value={selectedRow.adminDefinition || ''}
                  onChange={(event) => updateSelectedDefinition('adminDefinition', event.target.value)}
                />
              </label>
              <div className="column-terminology__components">
                <div className="column-terminology__components-title">
                  In application ({selectedRow.appComponentCount || 0})
                </div>
                {Array.isArray(selectedRow.appComponents) && selectedRow.appComponents.length ? (
                  <ul className="column-terminology__components-list">
                    {selectedRow.appComponents.map((componentId) => (
                      <li key={`app-${componentId}`}>{componentId}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="column-terminology__components-empty">
                    Not found in the static panel catalog. Regenerate with `npm run build:field-usage` after adding columns.
                  </div>
                )}
              </div>
              <div className="column-terminology__components">
                <div className="column-terminology__components-title">
                  Observed this session ({selectedRow.componentCount || 0})
                </div>
                {Array.isArray(selectedRow.components) && selectedRow.components.length ? (
                  <ul className="column-terminology__components-list">
                    {selectedRow.components.map((componentId) => (
                      <li key={`ses-${componentId}`}>{componentId}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="column-terminology__components-empty">
                    Not observed yet in this session. Open panels that use this field, then Refresh coverage.
                  </div>
                )}
              </div>
              {(selectedRow.updatedAt || selectedRow.updatedBy) ? (
                <div className="column-terminology__details-saved">
                  Last saved: {formatCompactDateTime(selectedRow.updatedAt, selectedRow.updatedAt || '-')}
                  {selectedRow.updatedBy ? ` by ${selectedRow.updatedBy}` : ''}
                  {selectedRow.updatedAt ? ` (${formatRelativeTime(selectedRow.updatedAt)})` : ''}
                </div>
              ) : null}
              <div className="talia-report__actions-bar" aria-label="Field detail actions">
                <button
                  type="button"
                  className="talia-btn talia-btn--primary"
                  onClick={() => saveDefinitions({ onlyField: selectedField })}
                  disabled={savingDefinitions || !selectedField || !dirtyFields.has(selectedField)}
                >
                  {savingDefinitions ? 'Saving...' : 'Save this update'}
                </button>
                {saveMessage ? <span>{saveMessage}</span> : null}
              </div>
            </div>
          )}
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default ColumnTerminologyPanel;
