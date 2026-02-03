import React, { useEffect, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';

const columns = [
  { title: 'Sail ID', field: 'sail_id', width: 100, headerFilter: 'input' },
  { title: 'Sail Code', field: 'sail_code', width: 120, headerFilter: 'input' },
  { title: 'Ship', field: 'ship_name', width: 150, headerFilter: 'input' },
  { title: 'Package', field: 'package_name', widthGrow: 2, headerFilter: 'input' },
  { title: 'Cabin Category', field: 'cabin_category', width: 120, headerFilter: 'input' },
  { title: 'Total Cabins', field: 'total_cabins', hozAlign: 'right', width: 100, headerFilter: 'input' },
  { title: 'Occupied', field: 'occupied_cabins', hozAlign: 'right', width: 100, headerFilter: 'input' },
  { title: 'Remaining', field: 'remaining_cabins', hozAlign: 'right', width: 100, headerFilter: 'input' }
];

/**
 * SailingByCabinCategoryPresenter - Tabulator table for cabin occupancy
 *
 * @param {Object} props
 * @param {Array} props.data - Table rows
 * @param {Object|null} props.context - Selection context
 */
const SailingByCabinCategoryPresenter = ({ data, context }) => {
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
        pagination: true,
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100, 200],
        dataLoaded: (loadedData) => setRecordCount(loadedData.length)
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

  const contextLabel = context?.sail_code || context?.row_data?.sail_code || (typeof context === 'string' ? context : null);

  return (
    <div className="talia-report" role="region" aria-label="Cabin category occupancy">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Cabin Category Occupancy</h2>
          <p className="talia-report__subtitle">
            {contextLabel ? `Sail ${contextLabel}` : 'Select a sail to filter'}
          </p>
        </div>
      </header>
      <main className="talia-report__content">
        <div ref={tableRef} className="talia-table" role="grid" aria-rowcount={recordCount} />
      </main>
      <footer className="talia-report__footer">
        <span>{recordCount.toLocaleString()} records</span>
        <span>{contextLabel ? `Filtered by ${contextLabel}` : 'No selection'}</span>
      </footer>
    </div>
  );
};

export default SailingByCabinCategoryPresenter;
