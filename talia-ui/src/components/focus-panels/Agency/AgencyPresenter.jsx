/**
 * Agency Presenter — Tabulator table for dwh.Dim_Agency
 */

import React, { useEffect, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { emitAgencyClear, emitAgencySelect } from '../../../lib/eventBus';

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

const AgencyPresenter = ({ data, onRefresh, panelInstanceId, panelComponentId }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [recordCount, setRecordCount] = useState(data?.length || 0);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;

      if (instanceRef.current) {
        instanceRef.current.destroy();
      }

      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: data || [],
        columns: AGENCY_COLUMNS,
        initialSort: [{ column: 'agency_name', dir: 'asc' }],
        height: '100%',
        selectableRows: 1,
        pagination: true,
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100, 200],
        headerFilterLiveFilter: true,
        headerFilterLiveFilterDelay: 300,
        movableColumns: true,
        rowClick: (_event, row) => {
          try { row?.select?.(); } catch { /* noop */ }
        },
        rowSelectionChanged: (selectedData) => {
          const rec = selectedData?.[0];
          if (rec) {
            emitAgencySelect({
              agency_id: rec.agency_id,
              row_data: rec,
              panelInstanceId,
              panelComponentId,
              timestamp: new Date().toISOString()
            });
          } else {
            emitAgencyClear({ timestamp: new Date().toISOString() });
          }
        },
        dataLoaded: (loadedData) => {
          setRecordCount(loadedData.length);
        }
      }));
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [panelComponentId, panelInstanceId]);

  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.replaceData(data || []);
    setRecordCount(data?.length || 0);
  }, [data]);

  return (
    <div className="talia-report" role="region" aria-label="Agency directory">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Agency Directory</h2>
          <p className="talia-report__subtitle">
            {recordCount.toLocaleString()} agencies from dwh.Dim_Agency
          </p>
        </div>
        {onRefresh ? (
          <div className="talia-report__header-right">
            <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
              Refresh
            </button>
          </div>
        ) : null}
      </header>
      <main className="talia-report__content">
        <div ref={tableRef} className="talia-table" role="grid" aria-rowcount={recordCount} />
      </main>
    </div>
  );
};

export default AgencyPresenter;
