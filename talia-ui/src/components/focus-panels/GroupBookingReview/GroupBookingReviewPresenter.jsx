import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTabulatorOptions, initTabulator } from '../../../lib/tabulatorConfig';

const formatCount = (value) => Number(value || 0).toLocaleString('en-US');

const GroupBookingReviewPresenter = ({
  rows,
  summary,
  context,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [kindFilter, setKindFilter] = useState('all');

  const filteredRows = useMemo(() => {
    if (kindFilter === 'all') return rows;
    if (kindFilter === 'group') return rows.filter((row) => row.booking_kind === 'GROUP');
    return rows.filter((row) => row.booking_kind === 'REAL');
  }, [kindFilter, rows]);

  const columns = useMemo(() => ([
    {
      title: 'Kind',
      field: 'booking_kind_label',
      width: 120,
      headerSort: false,
      formatter: (cell) => {
        const value = String(cell.getValue() || '');
        if (value === 'Group pending') return '<span class="dm-status-badge dm-status-badge--warning">Group</span>';
        return '<span class="dm-status-badge dm-status-badge--success">Real</span>';
      },
    },
    { title: 'Res ID', field: 'res_id', width: 100, hozAlign: 'right' },
    { title: 'Sail', field: 'sail_code', width: 116, headerFilter: 'input' },
    { title: 'Ship', field: 'ship', width: 82, headerFilter: 'input' },
    { title: 'Status', field: 'res_status', width: 100, headerFilter: 'list', headerFilterParams: { valuesLookup: true, clearable: true } },
    { title: 'Prob %', field: 'res_probability', width: 88, hozAlign: 'right', formatter: (cell) => Number(cell.getValue() || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) },
    { title: 'Guests', field: 'guest_count', width: 84, hozAlign: 'right', formatter: (cell) => Number(cell.getValue() || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
    { title: 'Cabin', field: 'cabin_category', width: 94, headerFilter: 'input' },
    { title: 'From', field: 'sail_from_date', width: 96 },
    { title: 'To', field: 'sail_to_date', width: 96 },
    { title: 'Gross', field: 'gross_ticket_revenue', width: 108, hozAlign: 'right', formatter: (cell) => Number(cell.getValue() || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
    { title: 'Net', field: 'net_ticket_revenue', width: 108, hozAlign: 'right', formatter: (cell) => Number(cell.getValue() || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
  ]), []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!tableRef.current || cancelled) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: [],
        columns,
        index: 'id',
        height: '100%',
        pagination: false,
        selectableRows: false,
      }));
    };
    init();
    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }
    };
  }, [columns]);

  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.replaceData(filteredRows || []);
  }, [filteredRows]);

  return (
    <div className="focus-panel talia-report">
      <header className="talia-report__header">
        <div>
          <h2 className="talia-report__title">Group vs Real Bookings</h2>
          <p className="talia-report__subtitle">
            Direct GraphQL reservations query · selected scope: {context?.sailCode || context?.ship || 'all'}
          </p>
        </div>
      </header>
      <div className="talia-callout">
        Total {formatCount(summary?.total)} · Group pending {formatCount(summary?.groupCount)} · Real {formatCount(summary?.realCount)}
      </div>
      <div className="talia-report__controls" aria-label="Group booking view controls">
        <button
          type="button"
          className={`talia-btn talia-btn--secondary ${kindFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`talia-btn talia-btn--secondary ${kindFilter === 'group' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('group')}
        >
          Group pending
        </button>
        <button
          type="button"
          className={`talia-btn talia-btn--secondary ${kindFilter === 'real' ? 'is-active' : ''}`}
          onClick={() => setKindFilter('real')}
        >
          Real booking
        </button>
      </div>
      <div ref={tableRef} className="focus-panel__table" />
    </div>
  );
};

export default GroupBookingReviewPresenter;
