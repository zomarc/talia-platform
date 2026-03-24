import React, { useEffect, useMemo, useRef } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import {
  MAX_MODEL_BOOKINGS,
  MAX_MODEL_GUESTS,
  safeBookingInt,
  formatBookingInt,
} from '../../../lib/bookingProfileNumbers';

/**
 * MODEL point grid using shared Tabulator rules (initTabulator + getTabulatorOptions).
 * Unmount when parent hides “details” so the instance is destroyed.
 */
const BookingModelPointsTabulator = ({ rows, canEdit, onUpdateCell }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const onUpdateRef = useRef(onUpdateCell);
  const tableDataRef = useRef([]);
  onUpdateRef.current = onUpdateCell;

  const tableData = useMemo(
    () =>
      (rows || []).map((row, index) => ({
        _rowIndex: index,
        weekLabel: row.weekLabel,
        weeksUntilSailing: row.weeksUntilSailing ?? 0,
        actualBookings: safeBookingInt(row.actualBookings ?? 0, MAX_MODEL_BOOKINGS),
        actualGuests: safeBookingInt(row.actualGuests ?? 0, MAX_MODEL_GUESTS),
        targetBookings: safeBookingInt(row.targetBookings ?? 0, MAX_MODEL_BOOKINGS),
        targetGuests: safeBookingInt(row.targetGuests ?? 0, MAX_MODEL_GUESTS),
      })),
    [rows]
  );

  tableDataRef.current = tableData;

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const Tabulator = await initTabulator();
      if (!tableRef.current || cancelled) return;

      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }

      const numEditor = (max) => ({
        editor: canEdit ? 'number' : false,
        ...(canEdit
          ? {
              editorParams: { min: 0, max, step: 1 },
            }
          : {}),
      });

      const columns = [
        { title: 'Week', field: 'weekLabel', width: 100, headerSort: true },
        {
          title: 'REAL Bookings',
          field: 'actualBookings',
          hozAlign: 'right',
          width: 130,
          formatter: (cell) => formatBookingInt(cell.getValue()),
          headerSort: true,
        },
        {
          title: 'MODEL Bookings',
          field: 'targetBookings',
          hozAlign: 'right',
          width: 140,
          ...numEditor(MAX_MODEL_BOOKINGS),
          formatter: (cell) => formatBookingInt(cell.getValue()),
          headerSort: true,
        },
        {
          title: 'REAL Guests',
          field: 'actualGuests',
          hozAlign: 'right',
          width: 120,
          formatter: (cell) => formatBookingInt(cell.getValue()),
          headerSort: true,
        },
        {
          title: 'MODEL Guests',
          field: 'targetGuests',
          hozAlign: 'right',
          width: 130,
          ...numEditor(MAX_MODEL_GUESTS),
          formatter: (cell) => formatBookingInt(cell.getValue()),
          headerSort: true,
        },
      ];

      instanceRef.current = new Tabulator(
        tableRef.current,
        getTabulatorOptions({
          data: tableDataRef.current,
          columns,
          height: 320,
          selectableRows: false,
          reactiveData: false,
          movableColumns: true,
          resizableColumns: true,
          initialSort: [{ column: 'weekLabel', dir: 'asc' }],
        })
      );

      instanceRef.current.on('cellEdited', (cell) => {
        if (!canEdit) return;
        const field = cell.getField();
        if (field !== 'targetBookings' && field !== 'targetGuests') return;
        const data = cell.getRow().getData();
        const idx = data._rowIndex;
        if (typeof idx !== 'number') return;
        const max = field === 'targetGuests' ? MAX_MODEL_GUESTS : MAX_MODEL_BOOKINGS;
        const next = safeBookingInt(cell.getValue(), max);
        onUpdateRef.current?.(idx, field, next);
      });
    };

    boot();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }
    };
  }, [canEdit]);

  useEffect(() => {
    if (!instanceRef.current) return;
    try {
      instanceRef.current.replaceData(tableData);
    } catch {
      // ignore
    }
  }, [tableData]);

  return (
    <div className="booking-profile-editor-simple__tabulator-host">
      <div ref={tableRef} className="booking-profile-editor-simple__tabulator-el" />
    </div>
  );
};

export default BookingModelPointsTabulator;
