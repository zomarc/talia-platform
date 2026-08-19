/**
 * Competitor Benchmark presenter — RateGain DWH view, not stg.COMPETITOR.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';
import { ReportTableOrRecord } from '../../shared/ReportRecordForm';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import ReportDataDetails from '../../shared/ReportDataDetails';

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatNumber = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const CompetitorBenchmarkPresenter = ({
  rows = [],
  hasSailSelection = false,
  scopeLoading = false,
  sailDateFrom = null,
  durationDays = null,
  rowCount = 0,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const { showDetails, reportShellClassName } = useReportShellOptions(
    panelComponentId || 'competitor-benchmark',
    panelInstanceId
  );

  const columns = useMemo(() => ([
    { field: 'cruise_line_name', title: 'Cruise line', width: 140, headerFilter: 'input' },
    { field: 'source_ship_name', title: 'Ship', width: 140, headerFilter: 'input' },
    {
      field: 'departure_date',
      title: 'Depart',
      width: 100,
      formatter: (cell) => formatDayMon(cell.getValue(), '') || '—',
    },
    {
      field: 'cruise_duration',
      title: 'Nts',
      hozAlign: 'right',
      width: 64,
      formatter: (cell) => formatNumber(cell.getValue()),
    },
    { field: 'cabin_type', title: 'Cabin', width: 100, headerFilter: 'list', headerFilterParams: { valuesLookup: true } },
    {
      field: 'total_rate_pp_eur',
      title: 'Rate EUR',
      hozAlign: 'right',
      width: 100,
      formatter: (cell) => formatMoney(cell.getValue()),
    },
    {
      field: 'pppd',
      title: 'PPPD',
      hozAlign: 'right',
      width: 80,
      formatter: (cell) => formatNumber(cell.getValue(), 1),
    },
    { field: 'source_destination', title: 'Destination', width: 120, headerFilter: 'input' },
    { field: 'source_market', title: 'Mkt', width: 72 },
    { field: 'itinerary_code', title: 'Itinerary', width: 180 },
    { field: 'three_port_match', title: '3-port', width: 72 },
    { field: 'rate_type', title: 'Rate type', width: 90 },
    { field: 'currency_code', title: 'Cur', width: 64 },
  ]), []);

  useEffect(() => {
    let cancelled = false;
    const initTable = async () => {
      if (!tableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        instanceRef.current.replaceData(rows);
        return;
      }
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: rows,
        columns,
        layout: 'fitDataFill',
        placeholder: hasSailSelection
          ? (scopeLoading ? 'Loading benchmark…' : 'No benchmark offers for this departure month')
          : 'Select a sailing to load competitor benchmark',
        panelInstanceId,
        panelComponentId: panelComponentId || 'competitor-benchmark',
        exportTitle: 'Competitor Benchmark',
      }));
    };
    initTable();
    return () => {
      cancelled = true;
    };
  }, [columns, hasSailSelection, panelComponentId, panelInstanceId, rows, scopeLoading]);

  useEffect(() => () => {
    instanceRef.current?.destroy?.();
    instanceRef.current = null;
  }, []);

  const subtitle = [
    sailDateFrom ? formatDayMon(sailDateFrom, '') : null,
    durationDays ? `${durationDays} nt ±2` : null,
    `${(rows || []).length.toLocaleString()} offers`,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`focus-panel talia-report competitor-benchmark${reportShellClassName ? ` ${reportShellClassName}` : ''}`} role="region" aria-label="Competitor benchmark">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Competitor Benchmark</h2>
          <p className="talia-report__subtitle">{subtitle || 'Select a sailing'}</p>
        </div>
      </header>

      <div className="talia-callout" role="note">
        RateGain / DWH <code>vw_Competitor_Benchmarking</code> — latest snapshot, departure month of the
        selected voyage. Separate from Competitor Pricing (<code>stg.COMPETITOR</code>). Competitor
        ship codes are not Celestyal <code>inventory_item.ship_code</code>.
      </div>

      <main className="talia-report__content">
        <ReportTableOrRecord>
          <div ref={tableRef} className="tabulator" />
        </ReportTableOrRecord>
      </main>

      <ReportDataDetails visible={showDetails}>
        <p>
          Fetched {rowCount.toLocaleString()} latest-snapshot rows for the departure month
          {durationDays ? `, then kept duration within ±2 of ${durationDays} nights` : ''}.
          Sync: <code>competitor_benchmark</code> ← <code>dwh.vw_Competitor_Benchmarking</code>.
        </p>
      </ReportDataDetails>
    </div>
  );
};

export default CompetitorBenchmarkPresenter;
