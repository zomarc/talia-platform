/**
 * Capacity Validation Presenter — Tabulator comparison of capacity sources.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';
import { formatDayMon } from '../../../lib/dateFormat';
import { getTabulatorOptions, initTabulator } from '../../../lib/tabulatorConfig';

const numberFormatter = (cell) => {
  const value = cell.getValue();
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
};

const deltaFormatter = (cell) => {
  const value = cell.getValue();
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString()}`;
};

const CapacityValidationPresenter = ({
  row,
  hasSailSelection,
  scopeLoading = false,
  selectedSailCodes = [],
  selectedReferenceSailCode = null,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);

  const rows = useMemo(() => (row ? [row] : []), [row]);

  const columns = useMemo(() => ([
    { field: 'reference_sail_code', title: 'Reference Sail', minWidth: 120, headerFilter: 'input' },
    { field: 'sail_codes', title: 'Sail Codes', minWidth: 160, headerFilter: 'input' },
    { field: 'ship_code', title: 'Ship', width: 70 },
    {
      field: 'sail_date_from',
      title: 'Departs',
      width: 90,
      formatter: (cell) => formatDayMon(cell.getValue(), ''),
    },
    { field: 'package_name', title: 'Package', minWidth: 140 },
    {
      field: 'physical_berth_capacity',
      title: 'Physical Berths',
      titleLong: 'Peak ship_day_berth_status.berth_capacity',
      hozAlign: 'right',
      formatter: numberFormatter,
      minWidth: 110,
    },
    {
      field: 'cabin_availability_total_cabins',
      title: 'Cabin Avail Cabins',
      titleLong: 'Sum cabin_availability.total_cabins by category',
      hozAlign: 'right',
      formatter: numberFormatter,
      minWidth: 120,
    },
    {
      field: 'inventory_status_capacity',
      title: 'Inventory Day Cap',
      titleLong: 'Peak inventory_status_by_day.capacity',
      hozAlign: 'right',
      formatter: numberFormatter,
      minWidth: 120,
    },
    {
      field: 'ship_pax_capacity',
      title: 'Ship Nameplate',
      titleLong: 'ship.ship_pax_capacity',
      hozAlign: 'right',
      formatter: numberFormatter,
      minWidth: 110,
    },
    {
      field: 'sold_guests',
      title: 'Sold Guests',
      titleLong: 'Sum reservation_current_state.guest_count',
      hozAlign: 'right',
      formatter: numberFormatter,
      minWidth: 100,
    },
    {
      field: 'delta_physical_vs_nameplate',
      title: 'Δ Phys−Name',
      hozAlign: 'right',
      formatter: deltaFormatter,
      minWidth: 100,
    },
    {
      field: 'delta_physical_vs_inventory',
      title: 'Δ Phys−Inv',
      hozAlign: 'right',
      formatter: deltaFormatter,
      minWidth: 100,
    },
    {
      field: 'delta_guests_vs_physical',
      title: 'Δ Guests−Phys',
      hozAlign: 'right',
      formatter: deltaFormatter,
      minWidth: 110,
    },
  ]), []);

  useEffect(() => {
    let cancelled = false;
    const initTable = async () => {
      if (!tableRef.current) return;
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
          height: '100%',
          selectableRows: false,
          pagination: false,
          panelComponentId: panelComponentId || 'capacity-validation',
        }));
        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          afterTabulatorDataRefresh(
            instanceRef.current,
            instanceRef.current.replaceData(rows)
          );
        });
      } catch (error) {
        console.error('[CapacityValidation] Failed to init table', error);
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
  }, [columns, panelComponentId]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    afterTabulatorDataRefresh(
      instanceRef.current,
      instanceRef.current.replaceData(rows)
    );
  }, [rows]);

  const scopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length ? selectedSailCodes.join(', ') : null);

  return (
    <div className="focus-panel talia-report capacity-validation" role="region" aria-label="Capacity validation">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Capacity Validation</h2>
          <p className="talia-report__subtitle">
            {hasSailSelection
              ? `Source capacity check for ${scopeLabel}`
              : 'Select a sailing in Master Sailing Explorer'}
          </p>
        </div>
      </header>
      <div className="talia-callout capacity-validation__callout">
        Data-check panel (not a user report). Compares physical berths, cabin availability,
        inventory-by-day, ship nameplate, and sold guests. Physical figures use peak day —
        never sum master + segment berths.
      </div>
      <main className="talia-report__content capacity-validation__content">
        {!hasSailSelection && (
          <p className="focus-panel-empty__detail">No sailing selected.</p>
        )}
        {hasSailSelection && scopeLoading && (
          <p className="focus-panel-empty__detail">Loading capacity sources…</p>
        )}
        <div
          ref={tableRef}
          className="focus-panel__table capacity-validation__table"
          hidden={!hasSailSelection || scopeLoading}
        />
        {hasSailSelection && !scopeLoading && row?.note && (
          <p className="talia-callout capacity-validation__note">{row.note}</p>
        )}
      </main>
    </div>
  );
};

export default CapacityValidationPresenter;
