/**
 * Agency Presenter — Tabulator table for dwh.Dim_Agency
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';
import {
  AGENCY_CLEAR_EVENT,
  AGENCY_SELECT_EVENT,
  emitAgencyClear,
  emitAgencySelect,
} from '../../../lib/eventBus';
import {
  createReferenceRowFormatter,
  refreshReferenceRowClasses,
} from '../../../lib/tabulatorReferenceSelection';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import ReportDataDetails from '../../shared/ReportDataDetails';
import { AGENCY_SELECTION_MODES } from './agencyDirectoryContext';

const FILTER_FIELDS = [
  ['agency_type', 'Type'],
  ['market', 'Market'],
  ['country', 'Country'],
  ['status', 'Status'],
];

const EMPTY_FILTERS = Object.freeze({
  agency_type: '',
  market: '',
  country: '',
  status: '',
});

const buildSelectValues = (rows, field) => {
  const values = [...new Set(
    (rows || [])
      .map((row) => row?.[field])
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value))
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return values.reduce((acc, value) => {
    acc[value] = value;
    return acc;
  }, { '': 'All' });
};

const AGENCY_COLUMNS = [
  {
    field: 'agency_id',
    title: 'Agency ID',
    hozAlign: 'right',
    headerFilter: 'input'
  },
  {
    field: 'agency_name',
    title: 'Agency Name',
    headerFilter: 'input',
    minWidth: 220
  },
  {
    field: 'agency_type',
    title: 'Type',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true
    }
  },
  {
    field: 'market',
    title: 'Market',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true
    }
  },
  {
    field: 'country_code',
    title: 'Country Code',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true
    }
  },
  {
    field: 'country',
    title: 'Country',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true
    }
  },
  {
    field: 'state_code',
    title: 'State',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true
    }
  },
  {
    field: 'status',
    title: 'Status',
    headerFilter: 'list',
    headerFilterParams: {
      values: {
        '': 'All',
        Active: 'Active',
        Inactive: 'Inactive'
      },
      clearable: true
    }
  },
  {
    field: 'default_currency',
    title: 'Currency',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true
    }
  },
  {
    field: 'agency_code',
    title: 'Agency Code',
    headerFilter: 'input'
  },
  {
    field: 'parent_agency_id',
    title: 'Parent ID',
    hozAlign: 'right',
    headerFilter: 'input'
  },
  {
    field: 'contact_name',
    title: 'Contact',
    headerFilter: 'input'
  },
  {
    field: 'commission',
    title: 'Commission %',
    hozAlign: 'right',
    headerFilter: 'number',
    headerFilterParams: { min: 0, step: 0.1 }
  },
  {
    field: 'sfdc_owner_name',
    title: 'SFDC Owner',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true
    }
  },
  {
    field: 'address_city',
    title: 'City',
    headerFilter: 'input'
  }
];

const AgencyPresenter = ({
  data,
  totalAgencyCount = 0,
  onRefresh,
  onClearReservationLink,
  onClearSailLink,
  panelInstanceId,
  panelComponentId,
  selectionMode = AGENCY_SELECTION_MODES.ALL,
  scopeLoading = false,
  selectedAgencyId = null,
  selectedReservationId = null,
  selectedSailCodes = [],
  selectedReferenceSailCode = null,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const suppressSelectionEventsRef = useRef(false);
  const activeAgencyIdRef = useRef(selectedAgencyId ? String(selectedAgencyId) : null);
  const [recordCount, setRecordCount] = useState(data?.length || 0);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showTable] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: panelComponentId || 'agency-directory',
  });

  const totalCount = selectionMode === AGENCY_SELECTION_MODES.ALL
    ? (data?.length || 0)
    : totalAgencyCount;
  const activeFilterCount = FILTER_FIELDS.filter(([field]) => filters[field]).length;
  const linkedAgencyName = useMemo(() => {
    if (selectionMode !== AGENCY_SELECTION_MODES.RESERVATION || !selectedAgencyId || !data?.length) {
      return null;
    }
    const match = data.find((row) => String(row?.agency_id) === String(selectedAgencyId));
    return match?.agency_name || null;
  }, [data, selectedAgencyId, selectionMode]);
  const sailScopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length === 1 ? selectedSailCodes[0] : null);

  const filterOptions = useMemo(
    () => Object.fromEntries(FILTER_FIELDS.map(([field]) => [field, buildSelectValues(data, field)])),
    [data]
  );

  const filteredData = useMemo(() => {
    const rows = data || [];
    return rows.filter((row) => FILTER_FIELDS.every(([field]) => {
      const filterValue = filters[field];
      if (!filterValue) return true;
      return String(row?.[field] ?? '') === filterValue;
    }));
  }, [data, filters]);

  const isReferenceAgencyRow = useCallback((rowData) => {
    const activeId = activeAgencyIdRef.current;
    if (activeId == null || activeId === '') return false;
    return String(rowData?.agency_id) === String(activeId);
  }, []);

  const applyReferenceHighlight = useCallback(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    refreshReferenceRowClasses(table, isReferenceAgencyRow);
  }, [isReferenceAgencyRow]);

  const focusLinkedAgency = useCallback(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current || !activeAgencyIdRef.current) return;
    applyReferenceHighlight();
    const rows = table.getRows?.() || [];
    const match = rows.find((row) => isReferenceAgencyRow(row.getData?.()));
    match?.scrollTo?.();
  }, [applyReferenceHighlight, isReferenceAgencyRow]);

  useEffect(() => {
    if (selectionMode !== AGENCY_SELECTION_MODES.RESERVATION || !selectedAgencyId) return;
    activeAgencyIdRef.current = String(selectedAgencyId);
    setFilters((previous) => (
      FILTER_FIELDS.some(([field]) => previous[field]) ? { ...EMPTY_FILTERS } : previous
    ));
    focusLinkedAgency();
  }, [focusLinkedAgency, selectedAgencyId, selectionMode]);

  useEffect(() => {
    const handleSelect = (event) => {
      const id = event?.detail?.agency_id ?? event?.detail?.row_data?.agency_id;
      if (id == null || id === '') return;
      activeAgencyIdRef.current = String(id);
      focusLinkedAgency();
    };
    const handleClear = () => {
      activeAgencyIdRef.current = null;
      applyReferenceHighlight();
    };

    window.addEventListener(AGENCY_SELECT_EVENT, handleSelect);
    window.addEventListener(AGENCY_CLEAR_EVENT, handleClear);

    const persistedId = window.lastAgencySelectEvent?.detail?.agency_id
      ?? window.lastAgencySelectEvent?.detail?.row_data?.agency_id;
    if (persistedId != null && persistedId !== '') {
      activeAgencyIdRef.current = String(persistedId);
    }

    return () => {
      window.removeEventListener(AGENCY_SELECT_EVENT, handleSelect);
      window.removeEventListener(AGENCY_CLEAR_EVENT, handleClear);
    };
  }, [applyReferenceHighlight, focusLinkedAgency]);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;

      if (instanceRef.current) {
        suppressSelectionEventsRef.current = true;
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }

      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: [],
        columns: AGENCY_COLUMNS,
        initialSort: [{ column: 'agency_name', dir: 'asc' }],
        height: '100%',
        selectableRows: 1,
        headerFilterLiveFilter: true,
        headerFilterLiveFilterDelay: 300,
        movableColumns: true,
        rowFormatter: createReferenceRowFormatter(isReferenceAgencyRow),
        panelComponentId: panelComponentId || 'agency-directory',
      }));

      instanceRef.current.on('tableBuilt', () => {
        tableBuiltRef.current = true;
        focusLinkedAgency();
      });

      instanceRef.current.on('rowClick', (_event, row) => {
        try { row?.select?.(); } catch { /* noop */ }
      });

      instanceRef.current.on('rowSelectionChanged', (selectedData) => {
        if (suppressSelectionEventsRef.current) return;
        const rec = selectedData?.[0];
        if (rec) {
          activeAgencyIdRef.current = String(rec.agency_id);
          applyReferenceHighlight();
          emitAgencySelect({
            agency_id: rec.agency_id,
            row_data: rec,
            panelInstanceId,
            panelComponentId,
            timestamp: new Date().toISOString()
          });
        } else {
          activeAgencyIdRef.current = null;
          applyReferenceHighlight();
          emitAgencyClear({ timestamp: new Date().toISOString() });
        }
      });

      instanceRef.current.on('dataLoaded', (loadedData) => {
        setRecordCount(loadedData.length);
        focusLinkedAgency();
      });
    };

    initTable();

    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      suppressSelectionEventsRef.current = true;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
  }, [
    applyReferenceHighlight,
    focusLinkedAgency,
    isReferenceAgencyRow,
    panelComponentId,
    panelInstanceId,
  ]);

  useEffect(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    suppressSelectionEventsRef.current = true;
    const refreshPromise = Promise.resolve(table.replaceData(filteredData))
      .catch(() => { /* noop */ })
      .finally(() => {
        suppressSelectionEventsRef.current = false;
        setRecordCount(filteredData.length);
        focusLinkedAgency();
      });
    afterTabulatorDataRefresh(table, refreshPromise);
  }, [filteredData, focusLinkedAgency]);

  const subtitle = scopeLoading
    ? `Updating agencies for ${sailScopeLabel || 'selected sailing'}...`
    : selectionMode === AGENCY_SELECTION_MODES.RESERVATION
      ? `${recordCount.toLocaleString()} linked from reservation`
      : selectionMode === AGENCY_SELECTION_MODES.SAIL
        ? `${recordCount.toLocaleString()} agencies selling ${sailScopeLabel || 'selected sailing'}`
        : activeFilterCount > 0
          ? `${recordCount.toLocaleString()} of ${totalCount.toLocaleString()} agencies`
          : `${recordCount.toLocaleString()} agencies from dwh.Dim_Agency`;

  return (
    <div className="focus-panel talia-report agency-directory-panel" role="region" aria-label="Agency directory">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Agency Directory</h2>
          <p className="talia-report__subtitle">{subtitle}</p>
        </div>
      </header>

      <div className="agency-directory-panel__filters talia-report-filters">
        {selectionMode === AGENCY_SELECTION_MODES.RESERVATION ? (
          <div className="ms-berth-criteria" aria-label="Linked reservation criteria">
            {selectedReservationId ? (
              <div className="ms-berth-criteria__item">
                <span className="ms-berth-criteria__label">Reservation</span>
                <span className="ms-berth-criteria__value">{selectedReservationId}</span>
              </div>
            ) : null}
            <div className="ms-berth-criteria__item">
              <span className="ms-berth-criteria__label">Agency ID</span>
              <span className="ms-berth-criteria__value">{selectedAgencyId}</span>
            </div>
            {linkedAgencyName ? (
              <div className="ms-berth-criteria__item">
                <span className="ms-berth-criteria__label">Agency</span>
                <span className="ms-berth-criteria__value">{linkedAgencyName}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="talia-btn talia-btn--ghost ms-berth-criteria__clear"
              onClick={() => onClearReservationLink?.()}
            >
              Clear
            </button>
          </div>
        ) : null}
        {selectionMode === AGENCY_SELECTION_MODES.SAIL ? (
          <div className="ms-berth-criteria" aria-label="Linked sailing criteria">
            {sailScopeLabel ? (
              <div className="ms-berth-criteria__item">
                <span className="ms-berth-criteria__label">Reference sail</span>
                <span className="ms-berth-criteria__value">{sailScopeLabel}</span>
              </div>
            ) : null}
            {selectedSailCodes.length > 1 ? (
              <div className="ms-berth-criteria__item">
                <span className="ms-berth-criteria__label">Sail codes</span>
                <span className="ms-berth-criteria__value">{selectedSailCodes.join(', ')}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="talia-btn talia-btn--ghost ms-berth-criteria__clear"
              onClick={() => onClearSailLink?.()}
            >
              Clear
            </button>
          </div>
        ) : null}
        {FILTER_FIELDS.map(([field, label]) => (
          <label key={field} className="agency-directory-panel__filter talia-report-filters__group">
            <span className="talia-report-filters__label">{label}</span>
            <select
              className="talia-report-filters__input"
              value={filters[field] || ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, [field]: event.target.value }))}
            >
              {Object.entries(filterOptions[field] || { '': 'All' }).map(([value, text]) => (
                <option key={`${field}-${value || 'all'}`} value={value}>{text}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {onRefresh ? (
        <div className="talia-report__actions-bar" aria-label="Agency directory actions">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      ) : null}

      <main className="talia-report__content">
        <ReportDataDetails visible={showTable} className="agency-directory-panel__data-details">
          <div ref={tableRef} className="talia-table" role="grid" aria-rowcount={recordCount} />
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default AgencyPresenter;
