/**
 * Seasonal Trading Pack presenter — clear stacked sections + PDF export.
 */

import React, { useEffect, useState } from 'react';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportSnapshot from '../../shared/ReportSnapshot';
import { exportSeasonalTradingPackPdf } from './exportSeasonalTradingPackPdf';
import { buildMonthOptions, RANGE_PRESETS } from './depMonthRange';

const fmtCell = (value, metric) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (metric === 'rev') {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(n) ? 0 : 1 });
};

const fmtEuroCompact = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `€${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `€${(n / 1e3).toFixed(0)}K`;
  return `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const MONTH_OPTIONS = buildMonthOptions();

const RANGE_PRESET_OPTIONS = [
  { value: RANGE_PRESETS.THIS_MONTH, label: 'This month' },
  { value: RANGE_PRESETS.NEXT_3, label: 'This month / next 3' },
  { value: RANGE_PRESETS.NEXT_6, label: 'This month / next 6' },
  { value: RANGE_PRESETS.FY_CORE, label: 'FY core (May–Mar)' },
  { value: RANGE_PRESETS.CUSTOM, label: 'Custom' },
];

const SeasonalTradingPackPresenter = ({
  data,
  loading = false,
  metric = 'rev',
  onMetricChange,
  rangePreset = RANGE_PRESETS.NEXT_3,
  onRangePresetChange,
  depMonthFrom,
  depMonthTo,
  onDepMonthFromChange,
  onDepMonthToChange,
  marketGroup = '',
  onMarketGroupChange,
  fyLabel,
  onFyLabelChange,
  panelInstanceId,
  panelComponentId,
}) => {
  const [exportError, setExportError] = useState(null);
  const componentKey = panelComponentId || 'seasonal-trading-pack';
  const { showSnapshot, showDetails, showFilters } = useReportShellOptions(
    componentKey,
    panelInstanceId
  );

  const matrix = metric === 'pax' ? data?.paxMatrix : data?.revMatrix;
  const narrativeBullets = data?.narrative?.bullets || [];
  const tradingBullets = data?.trading?.bullets || [];
  const marketMix = data?.trading?.marketMix || [];
  const methodology = data?.methodology || [];
  const last7 = data?.trading?.last7;
  const wow = data?.trading?.wow;
  const cumulative = data?.trading?.cumulative;
  const facts = data?.narrative?.facts;

  useEffect(() => {
    return registerPanelDataExport({
      panelInstanceId,
      panelComponentId: componentKey,
      getPayload: () => {
        const labels = matrix?.monthLabels || [];
        const rows = matrix?.rows || [];
        if (!rows.length) return null;
        const columns = [
          { field: 'metric', title: 'Metric' },
          ...labels.map((label, idx) => ({ field: `m${idx}`, title: label })),
          { field: 'total', title: 'Grand Total' },
        ];
        return {
          title: `Seasonal Trading Pack ${fyLabel || data?.fyLabel || ''}`.trim(),
          columns,
          rows: rows.map((row) => {
            const out = { metric: row.label, total: row.total };
            (row.values || []).forEach((value, idx) => {
              out[`m${idx}`] = value;
            });
            return out;
          }),
        };
      },
    });
  }, [componentKey, data?.fyLabel, fyLabel, matrix, panelInstanceId]);

  const metrics = [
    {
      key: 'booked',
      label: 'BOOKED',
      value: fmtEuroCompact(facts?.bookedRevTotal),
      hint: facts?.pctOfBudget != null ? `${facts.pctOfBudget}% of budget` : null,
      concern:
        (facts?.pctOfBudget != null && facts.pctOfBudget < 15)
        || (facts?.weeksOfFitPace != null && facts.weeksOfFitPace > 52),
    },
    {
      key: 'budget',
      label: 'BUDGET',
      value: fmtEuroCompact(facts?.budgetRevTotal),
      hint: data?.fyLabel || fyLabel || null,
    },
    {
      key: 'held',
      label: 'HELD (MR)',
      value: fmtEuroCompact(facts?.heldRevTotal),
      hint: facts?.reservedInclHeldPct != null
        ? `${facts.reservedInclHeldPct}% incl. held`
        : null,
    },
    {
      key: 'l7',
      label: 'LAST 7D',
      value: fmtEuroCompact(last7?.rev),
      hint: last7?.pax != null
        ? `${Number(last7.pax).toLocaleString()} pax`
        : null,
      concern: Number(facts?.toBuildRev) > 0 && Number(last7?.rev) === 0,
    },
    {
      key: 'pppd',
      label: 'PPPD 7D',
      value: last7?.pppd != null ? `€${last7.pppd}` : '—',
      hint: wow?.pppdPct != null
        ? `${wow.pppdPct > 0 ? '+' : ''}${wow.pppdPct}% vs prior`
        : null,
      concern: wow?.pppdPct != null && wow.pppdPct < -5,
    },
    {
      key: 'fit7',
      label: 'FIT 7D',
      value: fmtEuroCompact(last7?.fitRev),
      hint: last7?.fitPax != null
        ? `${Number(last7.fitPax).toLocaleString()} pax`
        : null,
      concern: Number(facts?.toBuildRev) > 0
        && (last7?.fitRev == null || Number(last7.fitRev) === 0),
    },
  ];

  const handleExportPdf = () => {
    setExportError(null);
    try {
      exportSeasonalTradingPackPdf(data, {
        metric,
        fyLabel,
        marketGroup,
      });
    } catch (err) {
      setExportError(err?.message || 'PDF export failed');
    }
  };

  return (
    <div
      className={`talia-report seasonal-trading-pack ${loading ? 'talia-report--loading' : ''}`}
    >
      <header className="talia-report__header">
        <h2 className="talia-report__title">Seasonal Trading Pack</h2>
        <p className="talia-report__subtitle">
          Week ending {data?.asOfDate || '—'} · FY {fyLabel || data?.fyLabel || '—'}
          {data?.currency ? ` · ${data.currency}` : ''}
          {marketGroup ? ` · ${marketGroup}` : ''}
          {cumulative?.pctOfBudget != null ? ` · ${cumulative.pctOfBudget}% of FY budget` : ''}
        </p>
      </header>

      <div
        className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
        aria-label="Trading pack filters"
      >
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">FY</span>
          <input
            className="talia-report-filters__input"
            type="text"
            value={fyLabel}
            onChange={(e) => onFyLabelChange?.(e.target.value)}
            aria-label="Fiscal year label"
          />
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Range</span>
          <select
            className="talia-report-filters__input"
            value={rangePreset}
            onChange={(e) => onRangePresetChange?.(e.target.value)}
            aria-label="Departure month range preset"
          >
            {RANGE_PRESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">From</span>
          <select
            className="talia-report-filters__input"
            value={depMonthFrom}
            onChange={(e) => onDepMonthFromChange?.(e.target.value)}
            aria-label="Departure month from"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={`from-${m}`} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">To</span>
          <select
            className="talia-report-filters__input"
            value={depMonthTo}
            onChange={(e) => onDepMonthToChange?.(e.target.value)}
            aria-label="Departure month to"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={`to-${m}`} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Market group</span>
          <select
            className="talia-report-filters__input"
            value={marketGroup || ''}
            onChange={(e) => onMarketGroupChange?.(e.target.value)}
            aria-label="Market group filter"
          >
            <option value="">All</option>
            {(data?.marketGroups || []).map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Metric</span>
          <select
            className="talia-report-filters__input"
            value={metric}
            onChange={(e) => onMetricChange?.(e.target.value)}
            aria-label="Matrix metric"
          >
            <option value="rev">Revenue (EUR)</option>
            <option value="pax">Passengers</option>
          </select>
        </label>
        <div className="talia-report-filters__group seasonal-trading-pack__export-group">
          <span className="talia-report-filters__label">Export</span>
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={handleExportPdf}
            disabled={!data}
            title="Print dialog — choose Save as PDF (no pop-up needed)"
          >
            Export PDF
          </button>
        </div>
        {exportError ? (
          <span className="seasonal-trading-pack__export-error" role="alert">{exportError}</span>
        ) : null}
      </div>

      <ReportSnapshot
        title={null}
        ariaLabel="Trading pack KPIs"
        visible={showSnapshot}
        items={metrics}
      />

      <main className="talia-report__content talia-report__content--scroll seasonal-trading-pack__content">
        {narrativeBullets.length ? (
          <section className="talia-callout seasonal-trading-pack__section seasonal-trading-pack__narrative" role="status">
            <h3 className="seasonal-trading-pack__section-title">Forward performance</h3>
            <ul className="seasonal-trading-pack__bullets">
              {narrativeBullets.slice(0, 8).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            {narrativeBullets.length > 8 ? (
              <p className="seasonal-trading-pack__more-note">
                +{narrativeBullets.length - 8} more points included in Export PDF / Details
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="seasonal-trading-pack__section" aria-label="Departure month matrix">
          <h3 className="seasonal-trading-pack__section-title">
            By Dep Month · {metric === 'pax' ? 'Pax' : 'Rev (EUR)'}
          </h3>
          <div className="seasonal-trading-pack__table-wrap">
            <table className="seasonal-trading-pack__table talia-table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {(matrix?.monthLabels || []).map((label) => (
                    <th key={label} scope="col">{label}</th>
                  ))}
                  <th scope="col">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {(matrix?.rows || []).map((row) => (
                  <tr
                    key={row.key}
                    className={row.pending ? 'seasonal-trading-pack__row--pending' : undefined}
                    title={row.pendingReason || undefined}
                  >
                    <th scope="row">{row.label}</th>
                    {(row.values || []).map((value, idx) => (
                      <td
                        key={`${row.key}-${idx}`}
                        className={row.concern?.[idx] ? 'seasonal-trading-pack__cell--concern' : undefined}
                      >
                        {fmtCell(value, metric)}
                      </td>
                    ))}
                    <td className={row.totalConcern ? 'seasonal-trading-pack__cell--concern' : undefined}>
                      {fmtCell(row.total, metric)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {tradingBullets.length ? (
          <section className="talia-callout seasonal-trading-pack__section" role="status">
            <h3 className="seasonal-trading-pack__section-title">Trading Performance</h3>
            <ul className="seasonal-trading-pack__bullets">
              {tradingBullets.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <ReportDataDetails
          visible={showDetails}
          as="section"
          className="seasonal-trading-pack__section seasonal-trading-pack__details"
          aria-label="Market mix and methodology"
        >
          {narrativeBullets.length > 8 ? (
            <>
              <h3 className="seasonal-trading-pack__section-title">Forward performance (full)</h3>
              <ul className="seasonal-trading-pack__bullets">
                {narrativeBullets.map((text) => (
                  <li key={`full-${text}`}>{text}</li>
                ))}
              </ul>
            </>
          ) : null}

          {marketMix.length ? (
            <>
              <h3 className="seasonal-trading-pack__section-title">Market mix · last 7 days</h3>
              <div className="seasonal-trading-pack__table-wrap seasonal-trading-pack__table-wrap--compact">
                <table className="seasonal-trading-pack__table talia-table">
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>Last 7d Rev</th>
                      <th>Prior 7d Rev</th>
                      <th>WoW %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketMix.map((row) => (
                      <tr key={row.market}>
                        <td>{row.market}</td>
                        <td>{fmtCell(row.last7Rev, 'rev')}</td>
                        <td>{fmtCell(row.prior7Rev, 'rev')}</td>
                        <td>{row.wowPct == null ? '—' : `${row.wowPct > 0 ? '+' : ''}${row.wowPct}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {methodology.length ? (
            <>
              <h3 className="seasonal-trading-pack__section-title">Methodology</h3>
              <ul className="seasonal-trading-pack__bullets">
                {methodology.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </>
          ) : null}
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default SeasonalTradingPackPresenter;
