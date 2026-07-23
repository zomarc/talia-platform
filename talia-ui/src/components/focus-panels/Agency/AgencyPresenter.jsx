/**
 * Agency Presenter — Tabulator table for selection-scoped agencies.
 * Column filters only (headerFilter). Linked sail/reservation criteria are read-only.
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
import { AGENCY_SELECTION_MODES } from './agencyDirectoryContext';

const AGENCY_COLUMNS = [
  {
    field: 'agency_id',
    title: 'Agency ID',
    titleShort: 'Agcy',
    titleLong: 'Agency ID',
    hozAlign: 'right',
    headerFilter: 'input',
  },
  {
    field: 'agency_name',
    title: 'Agency Name',
    titleShort: 'Agency',
    titleLong: 'Agency Name',
    headerFilter: 'input',
    minWidth: 220,
  },
  {
    field: 'agency_type',
    title: 'Type',
    titleShort: 'Type',
    titleLong: 'Agency Type',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true,
    },
  },
  {
    field: 'market',
    title: 'Market',
    titleShort: 'Mkt',
    titleLong: 'Market',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true,
    },
  },
  {
    field: 'country_code',
    title: 'Country Code',
    titleShort: 'CC',
    titleLong: 'Country Code',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true,
    },
  },
  {
    field: 'country',
    title: 'Country',
    titleShort: 'Country',
    titleLong: 'Country',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true,
    },
  },
  {
    field: 'state_code',
    title: 'State',
    titleShort: 'State',
    titleLong: 'State / Province',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true,
    },
  },
  {
    field: 'status',
    title: 'Status',
    titleShort: 'Status',
    titleLong: 'Status',
    headerFilter: 'list',
    headerFilterParams: {
      values: {
        '': 'All',
        Active: 'Active',
        Inactive: 'Inactive',
      },
      clearable: true,
    },
  },
  {
    field: 'default_currency',
    title: 'Currency',
    titleShort: 'Curr',
    titleLong: 'Default Currency',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true,
    },
  },
  {
    field: 'agency_code',
    title: 'Agency Code',
    titleShort: 'Code',
    titleLong: 'Agency Code',
    headerFilter: 'input',
  },
  {
    field: 'parent_agency_id',
    title: 'Parent ID',
    titleShort: 'Parent',
    titleLong: 'Parent Agency ID',
    hozAlign: 'right',
    headerFilter: 'input',
  },
  {
    field: 'contact_name',
    title: 'Contact',
    titleShort: 'Contact',
    titleLong: 'Contact Name',
    headerFilter: 'input',
  },
  {
    field: 'commission',
    title: 'Commission %',
    titleShort: 'Comm%',
    titleLong: 'Commission %',
    hozAlign: 'right',
    headerFilter: 'number',
    headerFilterParams: { min: 0, step: 0.1 },
  },
  {
    field: 'sfdc_owner_name',
    title: 'SFDC Owner',
    titleShort: 'Owner',
    titleLong: 'SFDC Owner',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true,
      clearable: true,
    },
  },
  {
    field: 'address_city',
    title: 'City',
    titleShort: 'City',
    titleLong: 'City',
    headerFilter: 'input',
  },
];

const AgencyPresenter = ({
  data,
  panelInstanceId,
  panelComponentId,
  selectionMode = AGENCY_SELECTION_MODES.NONE,
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
  const dataRef = useRef(data);
  const activeAgencyIdRef = useRef(selectedAgencyId ? String(selectedAgencyId) : null);
  const isReferenceAgencyRowRef = useRef(() => false);
  const panelInstanceIdRef = useRef(panelInstanceId);
  const panelComponentIdRef = useRef(panelComponentId);
  const [recordCount, setRecordCount] = useState(data?.length || 0);

  dataRef.current = data;
  panelInstanceIdRef.current = panelInstanceId;
  panelComponentIdRef.current = panelComponentId;

  const linkedAgencyName = useMemo(() => {
    if (selectionMode !== AGENCY_SELECTION_MODES.RESERVATION || !selectedAgencyId || !data?.length) {
      return null;
    }
    const match = data.find((row) => String(row?.agency_id) === String(selectedAgencyId));
    return match?.agency_name || null;
  }, [data, selectedAgencyId, selectionMode]);

  const sailScopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length === 1 ? selectedSailCodes[0] : null);

  const isReferenceAgencyRow = useCallback((rowData) => {
    const activeId = activeAgencyIdRef.current;
    if (activeId == null || activeId === '') return false;
    return String(rowData?.agency_id) === String(activeId);
  }, []);
  isReferenceAgencyRowRef.current = isReferenceAgencyRow;

  const applyReferenceHighlight = useCallback(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    refreshReferenceRowClasses(table, isReferenceAgencyRowRef.current);
  }, []);

  const focusLinkedAgency = useCallback(() => {
    if (!activeAgencyIdRef.current) return;
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    applyReferenceHighlight();
    const rows = table.getRows?.() || [];
    const match = rows.find((row) => isReferenceAgencyRowRef.current(row.getData?.()));
    match?.scrollTo?.();
  }, [applyReferenceHighlight]);

  const applyReferenceHighlightRef = useRef(applyReferenceHighlight);
  const focusLinkedAgencyRef = useRef(focusLinkedAgency);
  applyReferenceHighlightRef.current = applyReferenceHighlight;
  focusLinkedAgencyRef.current = focusLinkedAgency;

  useEffect(() => {
    if (selectionMode === AGENCY_SELECTION_MODES.RESERVATION && selectedAgencyId) {
      activeAgencyIdRef.current = String(selectedAgencyId);
      focusLinkedAgencyRef.current();
      return;
    }
    if (selectionMode !== AGENCY_SELECTION_MODES.RESERVATION) {
      // Keep agency-select highlight if user clicked a row; clear reservation-driven id when leaving that mode.
      if (!window.lastAgencySelectEvent) {
        activeAgencyIdRef.current = null;
        applyReferenceHighlightRef.current();
      }
    }
  }, [selectedAgencyId, selectionMode]);

  useEffect(() => {
    const handleSelect = (event) => {
      const id = event?.detail?.agency_id ?? event?.detail?.row_data?.agency_id;
      if (id == null || id === '') return;
      activeAgencyIdRef.current = String(id);
      focusLinkedAgencyRef.current();
    };
    const handleClear = () => {
      activeAgencyIdRef.current = null;
      applyReferenceHighlightRef.current();
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
  }, []);

  // Init Tabulator once — never rebuild on data/callback identity changes.
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
        rowFormatter: createReferenceRowFormatter((rowData) => isReferenceAgencyRowRef.current(rowData)),
        panelComponentId: panelComponentIdRef.current || 'agency-directory',
      }));

      instanceRef.current.on('tableBuilt', () => {
        tableBuiltRef.current = true;
        const rows = Array.isArray(dataRef.current) ? dataRef.current : [];
        suppressSelectionEventsRef.current = true;
        const refreshPromise = Promise.resolve(instanceRef.current.replaceData(rows))
          .catch(() => { /* noop */ })
          .finally(() => {
            suppressSelectionEventsRef.current = false;
            setRecordCount(rows.length);
            if (activeAgencyIdRef.current) focusLinkedAgencyRef.current();
          });
        afterTabulatorDataRefresh(instanceRef.current, refreshPromise);
      });

      instanceRef.current.on('rowClick', (_event, row) => {
        try { row?.select?.(); } catch { /* noop */ }
      });

      instanceRef.current.on('rowSelectionChanged', (selectedData) => {
        if (suppressSelectionEventsRef.current) return;
        const rec = selectedData?.[0];
        if (rec) {
          activeAgencyIdRef.current = String(rec.agency_id);
          applyReferenceHighlightRef.current();
          emitAgencySelect({
            agency_id: rec.agency_id,
            row_data: rec,
            panelInstanceId: panelInstanceIdRef.current,
            panelComponentId: panelComponentIdRef.current,
            timestamp: new Date().toISOString(),
          });
        } else {
          activeAgencyIdRef.current = null;
          applyReferenceHighlightRef.current();
          emitAgencyClear({ timestamp: new Date().toISOString() });
        }
      });

      instanceRef.current.on('dataLoaded', (loadedData) => {
        setRecordCount(loadedData.length);
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
  }, []);

  useEffect(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    const rows = Array.isArray(data) ? data : [];
    suppressSelectionEventsRef.current = true;
    const refreshPromise = Promise.resolve(table.replaceData(rows))
      .catch(() => { /* noop */ })
      .finally(() => {
        suppressSelectionEventsRef.current = false;
        setRecordCount(rows.length);
        if (selectionMode === AGENCY_SELECTION_MODES.RESERVATION && activeAgencyIdRef.current) {
          focusLinkedAgencyRef.current();
        }
      });
    afterTabulatorDataRefresh(table, refreshPromise);
  }, [data, selectionMode]);

  const subtitle = (() => {
    if (scopeLoading) {
      return `Updating agencies for ${sailScopeLabel || 'selected sailing'}...`;
    }
    if (selectionMode === AGENCY_SELECTION_MODES.RESERVATION) {
      return `${recordCount.toLocaleString()} linked from reservation`;
    }
    if (selectionMode === AGENCY_SELECTION_MODES.SAIL) {
      if (recordCount === 0) {
        return `No agencies with reservations for ${sailScopeLabel || 'selected sailing'}`;
      }
      return `${recordCount.toLocaleString()} agencies selling ${sailScopeLabel || 'selected sailing'}`;
    }
    return 'Select a sailing or reservation to list agencies';
  })();

  const showReservationCriteria = selectionMode === AGENCY_SELECTION_MODES.RESERVATION;
  const showSailCriteria = selectionMode === AGENCY_SELECTION_MODES.SAIL;

  return (
    <div className="focus-panel talia-report agency-directory-panel" role="region" aria-label="Agency directory">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Agency Directory</h2>
          <p className="talia-report__subtitle">{subtitle}</p>
        </div>
      </header>

      {(showReservationCriteria || showSailCriteria) ? (
        <div className="agency-directory-panel__filters talia-report-filters">
          {showReservationCriteria ? (
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
            </div>
          ) : null}
          {showSailCriteria ? (
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
            </div>
          ) : null}
        </div>
      ) : null}

      <main className="talia-report__content">
        <div ref={tableRef} className="talia-table" role="grid" aria-rowcount={recordCount} />
      </main>
    </div>
  );
};

export default AgencyPresenter;
