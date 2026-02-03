import React, { useEffect, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { emitSailClear, emitSailSelect } from '../../../lib/eventBus';

const columns = [
  {
    field: 'sail_id',
    title: 'Sail ID',
    formatter: (cell) => {
      const value = cell.getValue();
      return value ? Math.floor(value).toString() : '';
    },
    headerFilter: 'input'
  },
  {
    field: 'sail_code',
    title: 'Sail Code',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true
    }
  },
  {
    field: 'ship_name',
    title: 'Ship',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true
    }
  },
  {
    field: 'package_name',
    title: 'Package',
    headerFilter: 'input'
  },
  {
    field: 'package_type',
    title: 'Package Type',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true
    }
  },
  {
    field: 'geog_area_code',
    title: 'Geographic Area',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true
    }
  },
  {
    field: 'sail_days',
    title: 'Sail Days',
    hozAlign: 'center',
    headerFilter: 'number',
    headerFilterParams: {
      min: 0,
      step: 1
    }
  },
  {
    field: 'sail_date_from',
    title: 'Sail Date',
    formatter: (cell) => {
      const value = cell.getValue();
      return value ? new Date(value).toLocaleDateString() : '';
    },
    headerFilter: 'input'
  },
  {
    field: 'port_from',
    title: 'Port From',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true
    }
  },
  {
    field: 'port_to',
    title: 'Port To',
    headerFilter: 'list',
    headerFilterParams: {
      valuesLookup: true,
      autocomplete: true
    }
  },
  {
    field: 'is_active',
    title: 'Active',
    hozAlign: 'center',
    headerFilter: 'list',
    headerFilterParams: {
      values: {
        '': 'All',
        Y: 'Yes',
        N: 'No'
      },
      clearable: true
    }
  }
];

/**
 * SimpleTablePresenter - Presentational Tabulator table
 *
 * @param {Object} props
 * @param {Array} props.data - Table data
 */
const SimpleTablePresenter = ({ data }) => {
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
        columns,
        layout: 'fitData',
        initialSort: [{ column: 'sail_date_from', dir: 'desc' }],
        pagination: false,
        rowClick: (event, row) => {
          try { row?.select?.(); } catch {}
        },
        rowSelectionChanged: (selectedData) => {
          const rec = selectedData && selectedData[0];
          if (rec) {
            emitSailSelect({
              sail_code: rec.sail_code,
              row_data: rec,
              timestamp: new Date().toISOString()
            });
          } else {
            emitSailClear({ timestamp: new Date().toISOString() });
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
  }, []);

  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.replaceData(data || []);
    setRecordCount(data?.length || 0);
  }, [data]);

  return (
    <div className="talia-report" role="region" aria-label="Master sail table">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Master Sail Table</h2>
          <p className="talia-report__subtitle">Select a sail to drive linked panels</p>
        </div>
      </header>
      <main className="talia-report__content">
        <div ref={tableRef} className="talia-table" role="grid" aria-rowcount={recordCount} />
      </main>
      <footer className="talia-report__footer">
        <span>{recordCount.toLocaleString()} records</span>
        <span>Updated {new Date().toLocaleDateString()}</span>
      </footer>
    </div>
  );
};

export default SimpleTablePresenter;
