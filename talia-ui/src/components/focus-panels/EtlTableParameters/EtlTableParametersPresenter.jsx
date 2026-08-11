/**
 * ETL Table Parameters Presenter — read-only Tabulator of upstream source→target mappings.
 */

import React, { useEffect, useRef, useState } from 'react';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';
import { getTabulatorOptions, initTabulator, captureTableScroll } from '../../../lib/tabulatorConfig';

const COLUMNS = [
  {
    field: 'etl_id',
    title: 'ETL ID',
    titleShort: 'ID',
    titleLong: 'Upstream ETL parameter id',
    width: 72,
    hozAlign: 'right',
    headerFilter: 'input',
  },
  {
    field: 'source_schema',
    title: 'Source Schema',
    titleShort: 'Src Sch',
    titleLong: 'Source schema',
    headerFilter: 'list',
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    minWidth: 100,
  },
  {
    field: 'source_tablename',
    title: 'Source Table',
    titleShort: 'Source',
    titleLong: 'Source table name',
    headerFilter: 'input',
    minWidth: 180,
    widthGrow: 2,
  },
  {
    field: 'target_schema',
    title: 'Target Schema',
    titleShort: 'Tgt Sch',
    titleLong: 'Target schema',
    headerFilter: 'list',
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    minWidth: 100,
  },
  {
    field: 'target_tablename',
    title: 'Target Table',
    titleShort: 'Target',
    titleLong: 'Target table name',
    headerFilter: 'input',
    minWidth: 180,
    widthGrow: 2,
  },
  {
    field: 'load_type',
    title: 'Load Type',
    titleShort: 'Load',
    titleLong: 'Load type',
    headerFilter: 'list',
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    minWidth: 100,
  },
  {
    field: 'upsert_id',
    title: 'Upsert ID',
    titleShort: 'Upsert',
    titleLong: 'Upsert key column',
    headerFilter: 'input',
    minWidth: 140,
  },
  {
    field: 'storeproc',
    title: 'Stored Procedure',
    titleShort: 'Proc',
    titleLong: 'Stored procedure',
    headerFilter: 'input',
    minWidth: 200,
    widthGrow: 2,
  },
  {
    field: 'schema_overwrite_flag',
    title: 'Schema Overwrite',
    titleShort: 'Ow',
    titleLong: 'Schema overwrite flag',
    headerFilter: 'list',
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    width: 72,
  },
  {
    field: 'sp_flag',
    title: 'SP Flag',
    titleShort: 'SP',
    titleLong: 'Stored procedure flag',
    headerFilter: 'list',
    headerFilterParams: { valuesLookup: true, autocomplete: true },
    width: 64,
  },
];

const EtlTableParametersPresenter = ({
  data = [],
  onRefresh,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const dataRef = useRef(data);
  const tableBuiltRef = useRef(false);
  const [rowCount, setRowCount] = useState(Array.isArray(data) ? data.length : 0);

  dataRef.current = data;

  // Init Tabulator once — never rebuild when data or tableInitialized changes.
  useEffect(() => {
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
          columns: COLUMNS,
          initialSort: [{ column: 'etl_id', dir: 'asc' }],
          height: '100%',
          selectableRows: false,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          panelComponentId: panelComponentId || 'etl-table-parameters-panel',
          panelInstanceId: panelInstanceId || null,
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          const rows = Array.isArray(dataRef.current) ? dataRef.current : [];
          const scroll = captureTableScroll(instanceRef.current);
          const refreshPromise = Promise.resolve(instanceRef.current.replaceData(rows))
            .catch(() => { /* noop */ })
            .finally(() => {
              setRowCount(rows.length);
            });
          afterTabulatorDataRefresh(instanceRef.current, refreshPromise, scroll);
        });
      } catch (err) {
        console.error('[EtlTableParameters] Error initializing table:', err);
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
  }, []);

  useEffect(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    const rows = Array.isArray(data) ? data : [];
    const scroll = captureTableScroll(table);
    const refreshPromise = Promise.resolve(table.replaceData(rows))
      .catch((err) => {
        console.warn('[EtlTableParameters] Error updating data:', err);
      })
      .finally(() => {
        setRowCount(rows.length);
      });
    afterTabulatorDataRefresh(table, refreshPromise, scroll);
  }, [data]);

  return (
    <div
      className="focus-panel talia-report"
      role="region"
      aria-label="ETL table parameters"
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={panelComponentId || undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">ETL Table Parameters</h2>
          <p className="talia-report__subtitle">
            Upstream source→target mappings from config.ETL_Table_Parameters
            {rowCount ? ` · ${rowCount} rows` : ''}
          </p>
        </div>
      </header>

      {onRefresh ? (
        <div className="talia-report__actions-bar" aria-label="ETL table parameters actions">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      ) : null}

      <main className="talia-report__content">
        <div ref={tableRef} className="focus-panel__table" />
      </main>
    </div>
  );
};

export default EtlTableParametersPresenter;
