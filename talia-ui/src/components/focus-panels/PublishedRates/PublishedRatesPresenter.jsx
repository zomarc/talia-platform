/**
 * Published Rates Presentational Component
 * Pure UI component - receives data as props
 *
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes + CSS variables
 * - No custom sorting → Uses Tabulator initialSort
 * See CODING-STANDARDS.md for principles
 *
 * Layout: `talia-report` so global Title / Filters toggles apply. The Tabulator grid is the
 * primary surface — it stays mounted (header ≣ hides optional extras elsewhere; not the main table).
 */

import React, { useRef, useEffect } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';

const SELECT_EVENT = 'talia:publishedRates.select';
const CLEAR_EVENT = 'talia:publishedRates.clear';

const PUBLISHED_RATES_TABULATOR_COLUMNS = [
  {
    title: 'Snapshot Date',
    field: 'SNAPSHOT_DATE',
    width: 120,
    headerFilter: 'input',
    headerFilterPlaceholder: 'YYYY-MM-DD',
    formatter: (cell) => {
      const value = cell.getValue();
      if (!value) return '';
      return formatDayMon(value, '');
    }
  },
  {
    title: 'Sail Code',
    field: 'SAIL_CODE',
    width: 120,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Filter sail code...'
  },
  {
    title: 'Ship',
    field: 'SHIP_CODE',
    width: 80,
    headerFilter: 'list',
    headerFilterParams: {
      values: { '': 'All Ships', 'CJ': 'Celestyal Journey', 'CD': 'Celestyal Discovery' },
      clearable: true
    }
  },
  {
    title: 'Package',
    field: 'PACKAGE_NAME',
    widthGrow: 2,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Filter package...'
  },
  {
    title: 'Region',
    field: 'REGION',
    width: 120,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Filter region...'
  },
  {
    title: 'Rate Type',
    field: 'RATE_TYPE',
    width: 100,
    headerFilter: 'list',
    headerFilterParams: {
      values: { '': 'All Types', 'CUG': 'CUG', 'BAR': 'BAR', 'PROMO': 'PROMO' },
      clearable: true
    }
  },
  {
    title: 'Sail Days',
    field: 'SAIL_DAYS',
    hozAlign: 'center',
    width: 100,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Days',
    headerFilterFunc: '>=',
    headerFilterParams: {
      type: 'number'
    }
  },
  {
    title: 'Departure',
    field: 'DEPARTURE_DATE',
    width: 120,
    headerFilter: 'input',
    headerFilterPlaceholder: 'YYYY-MM-DD',
    formatter: (cell) => {
      const value = cell.getValue();
      if (!value) return '';
      return formatDayMon(value, '');
    }
  },
  {
    title: 'Cabin',
    field: 'CABIN_CATEGORY',
    width: 100,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Filter cabin...'
  },
  {
    title: 'Promo',
    field: 'PROMO_NAME',
    widthGrow: 2,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Filter promo...'
  },
  {
    title: 'Currency',
    field: 'CURRENCY_CODE',
    width: 80,
    headerFilter: 'list',
    headerFilterParams: {
      values: { '': 'All', 'EUR': 'EUR', 'USD': 'USD', 'GBP': 'GBP' },
      clearable: true
    }
  },
  {
    title: 'Fare',
    field: 'FARE_PER_PERSON',
    hozAlign: 'right',
    width: 100,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Min fare',
    headerFilterFunc: '>=',
    headerFilterParams: {
      type: 'number'
    },
    formatter: (cell) => {
      const value = cell.getValue();
      return value ? value.toLocaleString() : '';
    }
  },
  {
    title: 'Port Taxes',
    field: 'PORT_TAXES_SERVICES',
    hozAlign: 'right',
    width: 100,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Min taxes',
    headerFilterFunc: '>=',
    headerFilterParams: {
      type: 'number'
    },
    formatter: (cell) => {
      const value = cell.getValue();
      return value ? value.toLocaleString() : '';
    }
  },
  {
    title: 'Discount',
    field: 'DISCOUNT',
    hozAlign: 'right',
    width: 100,
    headerFilter: 'input',
    headerFilterPlaceholder: 'Min discount',
    headerFilterFunc: '>=',
    headerFilterParams: {
      type: 'number'
    },
    formatter: (cell) => {
      const value = cell.getValue();
      return value ? value.toLocaleString() : '';
    }
  }
];

const PublishedRatesPresenter = ({ data, selectedSailCode }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current) return;

      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        if (instanceRef.current) {
          try {
            instanceRef.current.destroy();
          } catch {
            /* noop */
          }
        }

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: data || [],
          columns: PUBLISHED_RATES_TABULATOR_COLUMNS,
          initialSort: [
            { column: 'SNAPSHOT_DATE', dir: 'desc' },
            { column: 'DEPARTURE_DATE', dir: 'asc' }
          ],
          height: '100%',
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false
        }));

        instanceRef.current.on('rowClick', (e, row) => {
          try {
            row?.select?.();
          } catch {
            /* noop */
          }
        });

        instanceRef.current.on('rowSelected', (row) => {
          const rowData = row.getData();
          window.dispatchEvent(
            new CustomEvent(SELECT_EVENT, {
              detail: {
                sail_code: rowData.SAIL_CODE,
                row_data: rowData,
                timestamp: new Date().toISOString()
              }
            })
          );
        });

        instanceRef.current.on('rowDeselected', () => {
          window.dispatchEvent(
            new CustomEvent(CLEAR_EVENT, {
              detail: {
                timestamp: new Date().toISOString()
              }
            })
          );
        });
      } catch (err) {
        console.error('[PublishedRates] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying PublishedRates table:', e);
        }
        instanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; `data` updates use replaceData below
  }, []);

  useEffect(() => {
    if (!instanceRef.current) return;
    try {
      instanceRef.current.replaceData(data || []);
    } catch (e) {
      console.warn('[PublishedRates] Error updating data:', e);
    }
  }, [data]);

  const rowCount = Array.isArray(data) ? data.length : 0;

  return (
    <div className="talia-report published-rates" role="region" aria-label="Published rates">
      <header className="talia-report__header published-rates__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Published Rates</h2>
          <p className="talia-report__subtitle">
            Sail: {selectedSailCode || 'None'} · {rowCount} row{rowCount === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      <main className="talia-report__content published-rates__content">
        <div ref={tableRef} className="published-rates__table talia-table" />
      </main>
    </div>
  );
};

export default PublishedRatesPresenter;
