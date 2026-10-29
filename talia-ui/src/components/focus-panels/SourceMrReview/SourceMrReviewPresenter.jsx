/**
 * Source MR effectiveness — readable comparison of source MR, Talia MR, and named guests.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { SHIP_FILTER_ALL } from '../../../hooks/useGlobalShipFilter';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { resolveViewValue, VIEW_SOURCE_MR_MONTH } from '../../../lib/componentOptionsCatalog';
import { summariseExposure } from '../../../lib/sourceMrExposure';
import {
  applyAxisLabelVisibility,
  getChartColors,
  getChartOptions,
  getSeriesColors,
} from '../../../lib/chartConfig';
import { formatDayMonYear, formatMonYear } from '../../../lib/dateFormat';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import { buildSourceMrReviewExport } from '../../../lib/sourceMrReviewPrint';
import { captureSourceMrPrintCharts } from '../../../lib/sourceMrReviewPrintCharts';
import HoverPreview from '../../shared/HoverPreview';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import ReportSnapshot from '../../shared/ReportSnapshot';
import './source-mr-review.css';

Chart.register(...registerables);

const ITEM_COPY = {
  Through: 'Last day this warehouse extract was updated. Sailings after this date are not an outcome yet.',
  Groups: 'Current groups in the extract, one row each.',
  'Quote source': 'Guests the source MR expected on quotes that had already sailed. Requested guests times the source rate.',
  'Quote Talia': 'Guests Talia MR expected for those same quotes. Talia MR uses named guests, with a small adjustment from the source rate.',
  'Quote named': 'Guests actually named on quotes that had already sailed.',
  Status: 'Quote, open, booked, and the other group states in the extract.',
  Requested: 'Guests the group asked for.',
  Source: 'Requested guests times the source materialisation rate.',
  Talia: 'Requested guests times Talia MR. Talia MR is calculated on its own.',
  Difference: 'Source expected minus Talia expected. Guests the source rate counted above Talia MR.',
  'Source above Talia': 'Guests the source rate counted that Talia MR did not. This is the exposure of controlling on the source rate.',
  'Source above named': 'Source expected minus guests who were actually named. Positive means the source rate counted guests who did not sail. Negative means the source rate was short of the outcome.',
  Exposure: 'On sailed groups, how many extra guests the source rate counted compared with Talia MR.',
  Named: 'Guests named on the group. For sailings that had departed, this is the outcome.',
  'Source MR': 'The rate stored on the group header, grouped into bands.',
  Realised: 'Named guests divided by requested guests.',
  Month: 'Departure month of the sailing.',
  Owner: 'Whether the allocation is a group hold or FIT.',
  Allocations: 'Inventory allocation rows in the extract.',
  Owners: 'Distinct groups or bookings those allocation rows belong to.',
  'Average probability': 'Mean probability on the allocation. Group holds sit below the header rate. FIT sits at 100%.',
  Changed: 'The day that version of the group header was saved.',
  Guests: 'Requested guests on that version of the header.',
  Manual: 'Whether someone set the probability by hand.',
  'Source expected': 'Requested guests times the source rate for this group.',
  'Talia expected': 'Requested guests times Talia MR for this group.',
  'Talia MR': 'Independent materialisation. Named over requested, then a small adjustment from the source rate.',
};

const FILTERS = [
  { id: 'QT', label: 'Quote' },
  { id: 'OF', label: 'Open' },
  { id: 'BK', label: 'Booked' },
];

const formatInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-GB');
};

const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rate = n > 1 ? n / 100 : n;
  return `${Math.round(rate * 100)}%`;
};

const formatWhen = (value) => formatDayMonYear(value, '—');

const formatSigned = (value) => {
  const n = Math.round(Number(value) || 0);
  const text = Math.abs(n).toLocaleString('en-GB');
  if (n < 0) return `−${text}`;
  return text;
};

const DataTable = ({ columns, rows, showTooltip, onTip }) => (
  <div className="source-mr-review__table-wrap">
    <table className="source-mr-review__table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              onMouseEnter={(event) => {
                if (!showTooltip) return;
                onTip?.(column, event.currentTarget.getBoundingClientRect());
              }}
              onMouseLeave={() => onTip?.(null, null)}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, rowIndex) => (
          <tr key={`${cells[0]}-${rowIndex}`}>
            {cells.map((cell, index) => (
              <td key={`${rowIndex}-${index}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const gapGuests = (source, talia) => Math.round((Number(source) || 0) - (Number(talia) || 0));

const SourceMrGapChart = ({ rows, showLegends, showAxisLabels, showTooltip }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rows.length) return undefined;
    const colors = getSeriesColors();
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [
          {
            label: 'Source expected',
            data: rows.map((row) => Math.round(Number(row.sailedSourceExpectedGuests) || 0)),
            backgroundColor: colors[0],
            borderColor: colors[0],
            borderWidth: 1,
          },
          {
            label: 'Talia expected',
            data: rows.map((row) => Math.round(Number(row.sailedTaliaExpectedGuests) || 0)),
            backgroundColor: colors[1],
            borderColor: colors[1],
            borderWidth: 1,
          },
        ],
      },
      options: applyAxisLabelVisibility(getChartOptions.bar({
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: showLegends !== false,
            position: 'top',
            align: 'start',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              color: getChartColors().text,
            },
          },
          tooltip: {
            enabled: showTooltip !== false,
            callbacks: {
              footer: (items) => {
                const row = rows[items?.[0]?.dataIndex];
                if (!row) return '';
                const gap = gapGuests(row.sailedSourceExpectedGuests, row.sailedTaliaExpectedGuests);
                return `Difference ${gap.toLocaleString('en-GB')}`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: 'Status' } },
          y: { beginAtZero: true, title: { display: true, text: 'Expected guests' } },
        },
      }), showAxisLabels),
    });
    return () => chart.destroy();
  }, [rows, showAxisLabels, showLegends, showTooltip]);

  return (
    <div className="source-mr-review__chart" aria-label="Source expected guests against Talia expected guests">
      <canvas ref={canvasRef} />
    </div>
  );
};

const SourceMrMonthChart = ({ rows, showLegends, showAxisLabels, showTooltip }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rows.length) return undefined;
    const colors = getSeriesColors();
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => formatMonYear(`${row.month}-01`, row.month)),
        datasets: [
          {
            label: 'Source expected',
            data: rows.map((row) => Math.round(Number(row.sourceExpectedGuests) || 0)),
            backgroundColor: colors[0],
            borderColor: colors[0],
            borderWidth: 1,
          },
          {
            label: 'Talia expected',
            data: rows.map((row) => Math.round(Number(row.taliaExpectedGuests) || 0)),
            backgroundColor: colors[1],
            borderColor: colors[1],
            borderWidth: 1,
          },
          {
            label: 'Named',
            data: rows.map((row) => Math.round(Number(row.namedGuests) || 0)),
            backgroundColor: colors[2],
            borderColor: colors[2],
            borderWidth: 1,
          },
        ],
      },
      options: applyAxisLabelVisibility(getChartOptions.bar({
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: showLegends !== false,
            position: 'top',
            align: 'start',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              color: getChartColors().text,
            },
          },
          tooltip: { enabled: showTooltip !== false },
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: 'Guests' } },
          y: { title: { display: true, text: 'Sail month' } },
        },
      }), showAxisLabels),
    });
    return () => chart.destroy();
  }, [rows, showAxisLabels, showLegends, showTooltip]);

  return (
    <div
      className="source-mr-review__chart source-mr-review__chart--month"
      style={{ height: `${Math.max(12, rows.length * 1.75)}rem` }}
      aria-label="Source expected, Talia expected, and named guests by sail month"
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

const SourceMrReviewPresenter = ({
  review,
  statusFilter,
  onStatusFilter,
  shipChoice = 'global',
  onShipChoice,
  globalShip = SHIP_FILTER_ALL,
  dateFrom = '',
  dateTo = '',
  datesFollowGlobal = true,
  onDateFrom,
  onDateTo,
  onFollowGlobal,
  onExtractWindow,
  criteriaSummary = '',
  followingGlobal = true,
  outsideExtract = false,
  cutsHistory = false,
  selectedGroup,
  history = [],
  onSelectGroup,
  sailMatch,
  onOpenSailing,
  panelInstanceId,
  panelComponentId,
}) => {
  const {
    showSnapshot,
    showDetails,
    showProvenance,
    showFilters,
    showGraph,
    showTooltip,
    showLegends,
    showAxisLabels,
    viewsState,
    hydrated,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId, panelInstanceId);
  const showMonthGraph = hydrated === true
    && resolveViewValue(viewsState, VIEW_SOURCE_MR_MONTH) === true;
  const [tip, setTip] = useState(null);
  const tipLabelRef = useRef(null);

  const showItemTip = (label, rect) => {
    const text = ITEM_COPY[label];
    if (!showTooltip || !text || !rect) {
      if (tipLabelRef.current) {
        tipLabelRef.current = null;
        setTip(null);
      }
      return;
    }
    if (tipLabelRef.current === label) return;
    tipLabelRef.current = label;
    setTip({ label, text, rect });
  };

  const statuses = review?.statuses || [];
  const quoteStatus = statuses.find((row) => row.status === 'QT');
  const statusLabel = FILTERS.find((option) => option.id === statusFilter)?.label || statusFilter;
  const sailed = useMemo(
    () => (review?.statuses || []).filter((row) => row.sailedGroups > 0),
    [review]
  );
  const open = statuses.filter((row) => row.openGroups > 0);
  const bands = (review?.bands || []).filter((row) => row.status === statusFilter);
  const months = (review?.months || []).filter((row) => row.status === statusFilter);
  const exposure = summariseExposure(statuses);
  const statusExposure = summariseExposure(statuses.filter((row) => row.status === statusFilter));
  const quoteExposure = summariseExposure(statuses.filter((row) => row.status === 'QT'));
  const ships = review?.ships || [];
  const globalShipLabel = !globalShip || globalShip === SHIP_FILTER_ALL ? 'All ships' : globalShip;
  const probabilities = new Set(history.map((point) => point.probability).filter((value) => value != null));

  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId,
    getPayload: () => {
      let charts = [];
      try {
        charts = captureSourceMrPrintCharts({
          sailed,
          months: months.map((row) => ({
            ...row,
            label: formatMonYear(`${row.month}-01`, row.month),
          })),
          monthTitle: `${statusLabel} by sail month`,
          includeStatus: Boolean(showGraph && sailed.length),
          includeMonth: Boolean(showMonthGraph && months.length),
          showLegends,
          showAxisLabels,
        });
      } catch {
        charts = [];
      }
      return buildSourceMrReviewExport({
        review,
        statusFilter,
        selectedGroup,
        history,
        includeDetails: showDetails,
        charts,
      });
    },
  }), [
    history,
    months,
    panelComponentId,
    panelInstanceId,
    review,
    sailed,
    selectedGroup,
    showAxisLabels,
    showDetails,
    showGraph,
    showLegends,
    showMonthGraph,
    statusFilter,
    statusLabel,
  ]);

  return (
    <div className={`focus-panel talia-report source-mr-review${showTooltip ? ' source-mr-review--tips' : ''}${reportShellClassName ? ` ${reportShellClassName}` : ''}`} role="region" aria-label="Source MR effectiveness">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Source MR effectiveness</h2>
          <p className="talia-report__subtitle">Source rate, Talia MR, and named guests</p>
        </div>
      </header>

      <div className="talia-callout" role="note">
        The extract stops on {formatWhen(review?.feedThrough)}.
        Sailed quotes were held at the source rate for {formatInt(quoteStatus?.sailedSourceExpectedGuests)} guests.
        Talia MR expected {formatInt(quoteStatus?.sailedTaliaExpectedGuests)}.
        Named guests were {formatInt(quoteStatus?.sailedNamedGuests)}.
      </div>

      {showFilters ? (
        <div className="talia-report-filters" aria-label="Status, ship, and date filters">
          <div className="talia-report-filters__group source-mr-review__criteria">
            <span className="talia-report-filters__label">Global</span>
            <span>{criteriaSummary} · Ship {globalShipLabel}</span>
          </div>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Status</span>
            <select
              className="talia-report-filters__input"
              value={statusFilter}
              onChange={(event) => onStatusFilter(event.target.value)}
            >
              {FILTERS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Ship</span>
            <select
              className="talia-report-filters__input"
              value={shipChoice === 'global' ? 'global' : (shipChoice === SHIP_FILTER_ALL ? 'all' : shipChoice)}
              onChange={(event) => onShipChoice?.(event.target.value === 'all' ? SHIP_FILTER_ALL : event.target.value)}
              title={shipChoice === 'global' ? 'Following the header ship' : 'Local ship. Does not change the header.'}
            >
              <option value="global">Follow global ({globalShipLabel})</option>
              <option value="all">All ships</option>
              {ships.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">From</span>
            <input
              type="date"
              className="talia-report-filters__input"
              value={dateFrom || ''}
              onChange={(event) => onDateFrom?.(event.target.value)}
              title={datesFollowGlobal ? 'Following the header dates. Change this to override them.' : 'Local departure from. Does not change the header.'}
            />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">To</span>
            <input
              type="date"
              className="talia-report-filters__input"
              value={dateTo || ''}
              onChange={(event) => onDateTo?.(event.target.value)}
              title={datesFollowGlobal ? 'Following the header dates. Change this to override them.' : 'Local departure to. Does not change the header.'}
            />
          </label>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onExtractWindow}>
            Extract window
          </button>
          {followingGlobal ? null : (
            <button type="button" className="talia-btn talia-btn--secondary" onClick={onFollowGlobal}>
              Follow global
            </button>
          )}
          {outsideExtract ? (
            <p className="source-mr-review__filter-note">
              These dates do not overlap the extract ({formatWhen(review?.sailDateMin)} – {formatWhen(review?.sailDateMax)}). Extract window replaces the header dates for this panel.
            </p>
          ) : null}
          {!outsideExtract && cutsHistory ? (
            <p className="source-mr-review__filter-note">
              Header dates start after the extract was taken on {formatWhen(review?.feedThrough)}, so earlier sailings are hidden. Extract window shows them without changing the header.
            </p>
          ) : null}
          {!outsideExtract && !followingGlobal ? (
            <p className="source-mr-review__filter-note">Local ship or dates. The header criteria stay as they are.</p>
          ) : null}
        </div>
      ) : null}

      <div
        onMouseOver={(event) => {
          const metric = event.target.closest?.('.talia-metric');
          if (!metric) return;
          const label = metric.querySelector('.talia-metric__label')?.textContent?.trim();
          showItemTip(label, metric.getBoundingClientRect());
        }}
        onMouseLeave={() => showItemTip(null, null)}
      >
        <ReportSnapshot
          visible={showSnapshot}
          items={[
            { key: 'feed', label: 'Through', value: formatWhen(review?.feedThrough) },
            { key: 'groups', label: 'Groups', value: formatInt(review?.groupCount) },
            {
              key: 'source',
              label: 'Quote source',
              value: formatInt(quoteStatus?.sailedSourceExpectedGuests),
              hint: `${formatInt(quoteStatus?.sailedRequestedGuests)} requested`,
            },
            { key: 'talia', label: 'Quote Talia', value: formatInt(quoteStatus?.sailedTaliaExpectedGuests) },
            {
              key: 'exposure',
              label: 'Exposure',
              value: formatSigned(quoteExposure.sourceAboveTalia),
              hint: 'source − Talia, sailed quotes',
            },
            {
              key: 'named',
              label: 'Quote named',
              value: formatInt(quoteStatus?.sailedNamedGuests),
              tone: (quoteStatus?.sailedNamedGuests || 0) === 0 ? 'negative' : 'neutral',
            },
          ]}
        />
      </div>

      <div className="source-mr-review__body">
      <main className="talia-report__content talia-report__content--scroll">
        <section className="source-mr-review__section" aria-label="Exposure of the source rate">
          <h3 className="source-mr-review__heading">Exposure on sailed groups</h3>
          <p className="source-mr-review__lead">
            Source above Talia is the extra guests the source rate counted. Source above named compares that count with guests who were actually named.
            A negative figure means the source rate was short of the outcome. This extract has no fare, so the exposure is in guests.
          </p>
          {(review?.groupCount || 0) === 0 ? (
            <p className="source-mr-review__lead">No groups in the current ship and dates. Extract window shows the whole historic extract.</p>
          ) : (
            <DataTable
              columns={['Scope', 'Groups', 'Source', 'Talia', 'Named', 'Source above Talia', 'Source above named']}
              rows={[
                [
                  'All departed',
                  formatInt(exposure.groups),
                  formatInt(exposure.source),
                  formatInt(exposure.talia),
                  formatInt(exposure.named),
                  formatSigned(exposure.sourceAboveTalia),
                  formatSigned(exposure.sourceAboveNamed),
                ],
                [
                  statusLabel,
                  formatInt(statusExposure.groups),
                  formatInt(statusExposure.source),
                  formatInt(statusExposure.talia),
                  formatInt(statusExposure.named),
                  formatSigned(statusExposure.sourceAboveTalia),
                  formatSigned(statusExposure.sourceAboveNamed),
                ],
              ]}
              showTooltip={showTooltip}
              onTip={showItemTip}
            />
          )}
        </section>

        {showGraph && sailed.length ? (
          <section className="source-mr-review__section" aria-label="Source MR against Talia MR">
            <h3 className="source-mr-review__heading">Source expected against Talia expected</h3>
            <p className="source-mr-review__lead">
              Sailings that had already departed. The gap between the bars is source expected minus Talia expected.
            </p>
            <SourceMrGapChart
              rows={sailed}
              showLegends={showLegends}
              showAxisLabels={showAxisLabels}
              showTooltip={showTooltip}
            />
          </section>
        ) : null}

        {showMonthGraph ? (
          <section className="source-mr-review__section" aria-label={`${statusLabel} by sail month chart`}>
            <h3 className="source-mr-review__heading">{statusLabel} by sail month</h3>
            <p className="source-mr-review__lead">
              Source expected, Talia expected, and named guests for each departure month.
            </p>
            {months.length ? (
              <SourceMrMonthChart
                rows={months}
                showLegends={showLegends}
                showAxisLabels={showAxisLabels}
                showTooltip={showTooltip}
              />
            ) : (
              <p className="source-mr-review__lead">No departed {statusLabel.toLowerCase()} sailings in these dates.</p>
            )}
          </section>
        ) : null}

        <section className="source-mr-review__section" aria-label="Sailings that departed before the extract ended">
          <h3 className="source-mr-review__heading">Sailings that departed before the extract ended</h3>
          <p className="source-mr-review__lead">Requested guests times the rate. Difference is source expected minus Talia expected. Named is what actually sailed.</p>
          <DataTable
            columns={['Status', 'Groups', 'Requested', 'Source', 'Talia', 'Difference', 'Named']}
            rows={sailed.map((row) => [
              row.label,
              formatInt(row.sailedGroups),
              formatInt(row.sailedRequestedGuests),
              formatInt(row.sailedSourceExpectedGuests),
              formatInt(row.sailedTaliaExpectedGuests),
              formatInt(gapGuests(row.sailedSourceExpectedGuests, row.sailedTaliaExpectedGuests)),
              formatInt(row.sailedNamedGuests),
            ])}
            showTooltip={showTooltip}
            onTip={showItemTip}
          />
        </section>

        <section className="source-mr-review__section" aria-label="Groups still open at the end of the extract">
          <h3 className="source-mr-review__heading">Still open when the extract stopped</h3>
          <p className="source-mr-review__lead">These sailings had not departed. Named guests are not an outcome yet.</p>
          <DataTable
            columns={['Status', 'Groups', 'Requested', 'Source', 'Talia']}
            rows={open.map((row) => [
              row.label,
              formatInt(row.openGroups),
              formatInt(row.openRequestedGuests),
              formatInt(row.openSourceExpectedGuests),
              formatInt(row.openTaliaExpectedGuests),
            ])}
            showTooltip={showTooltip}
            onTip={showItemTip}
          />
        </section>

        <section className="source-mr-review__section" aria-label={`${statusLabel} calibration`}>
          <h3 className="source-mr-review__heading">{statusLabel} calibration</h3>
          <p className="source-mr-review__lead">Named guests divided by requested guests, inside each source MR band.</p>
          <DataTable
            columns={['Source MR', 'Groups', 'Requested', 'Named', 'Realised', 'Source', 'Talia']}
            rows={bands.map((row) => [
              row.band,
              formatInt(row.groups),
              formatInt(row.requestedGuests),
              formatInt(row.namedGuests),
              formatPct(row.realisedRate),
              formatInt(row.sourceExpectedGuests),
              formatInt(row.taliaExpectedGuests),
            ])}
            showTooltip={showTooltip}
            onTip={showItemTip}
          />
        </section>

        <section className="source-mr-review__section" aria-label={`${statusLabel} by sail month`}>
          <h3 className="source-mr-review__heading">{statusLabel} by sail month</h3>
          <p className="source-mr-review__lead">Source expected, Talia expected, and named guests for each departure month.</p>
          <DataTable
            columns={['Month', 'Requested', 'Source', 'Talia', 'Named']}
            rows={months.map((row) => [
              formatMonYear(`${row.month}-01`, row.month),
              formatInt(row.requestedGuests),
              formatInt(row.sourceExpectedGuests),
              formatInt(row.taliaExpectedGuests),
              formatInt(row.namedGuests),
            ])}
            showTooltip={showTooltip}
            onTip={showItemTip}
          />
        </section>

        {(review?.allocations || []).length ? (
          <section className="source-mr-review__section" aria-label="Header rate versus allocation rate">
            <h3 className="source-mr-review__heading">Header rate versus allocation rate</h3>
            <p className="source-mr-review__lead">Average probability on the inventory allocation, next to the group header rate.</p>
            <DataTable
              columns={['Owner', 'Allocations', 'Owners', 'Average probability']}
              rows={review.allocations.map((row) => [
                row.ownerType,
                formatInt(row.allocationRows),
                formatInt(row.owners),
                formatPct(row.avgProbability),
              ])}
              showTooltip={showTooltip}
              onTip={showItemTip}
            />
          </section>
        ) : null}

        <ReportProvenance visible={showProvenance}>
          <p>
            Current groups come from <code>stg.SW_ETL_GROUPS</code>, version history from
            <code> stg.SW_ETL_GROUP_HEADER</code>, ship and sail from one
            <code> stg.SW_ETL_GROUP_SHIP_REQUEST</code> row per current group, allocation rates from
            <code> stg.SW_ETL_SAIL_INVENTORY_DATA_ALLOC</code>, and load dates from GRP rows of
            <code> stg.SW_ETL_EXTRACT_LOAD</code>. Agency names, agent contacts, and comments are not synced.
            Expected guests are requested guests times the rate. <code>GROUP_ExpectedAddition</code> is stored and not used as a guest count.
            Talia MR is the Groups Explorer model: named over requested, with a mild source adjustment. It does not copy the source rate.
          </p>
        </ReportProvenance>
      </main>
        <ReportDataDetails className="source-mr-review__details" visible={showDetails}>
          <article className="talia-card source-mr-review__card" aria-label={`Group ${selectedGroup?.groupId || ''}`}>
            <header className="source-mr-review__card-header">
              <strong>Group {selectedGroup?.groupId || '—'}</strong>
              <span>
                {selectedGroup?.shipCode || '—'}
                {' · '}
                {formatWhen(selectedGroup?.sailDateFrom)}
                {selectedGroup?.sailDateTo ? ` – ${formatWhen(selectedGroup.sailDateTo)}` : ''}
              </span>
            </header>
            <p className="source-mr-review__lead">
              {selectedGroup?.groupId === review?.candidate?.groupId
                ? 'A quote of 40–120 guests that sailed inside the extract, with source MR at least 90% and nobody named. This is the one restated on the most separate days.'
                : 'A large quote from the same extract. The test case is the 40–120 guest band.'}
              {probabilities.size === 1 ? ` Source MR stayed at ${formatPct([...probabilities][0])} across ${history.length} versions.` : ''}
            </p>
            <DataTable
              columns={['Requested', 'Named', 'Source MR', 'Talia MR', 'Source expected', 'Talia expected']}
              rows={[[
                formatInt(selectedGroup?.requestedGuests),
                formatInt(selectedGroup?.namedGuests),
                formatPct(selectedGroup?.sourceMr),
                formatPct(selectedGroup?.taliaMr),
                formatInt(selectedGroup?.sourceExpectedGuests),
                formatInt(selectedGroup?.taliaExpectedGuests),
              ]]}
              showTooltip={showTooltip}
              onTip={showItemTip}
            />
            {sailMatch ? (
              <button type="button" className="talia-btn talia-btn--secondary" onClick={onOpenSailing}>
                Open {sailMatch.sailCode} in the current book
              </button>
            ) : (
              <p className="source-mr-review__lead">This sailing is outside the current book, so it is not sent as a sail selection.</p>
            )}
            <h4 className="source-mr-review__heading">Other large quotes</h4>
            <ul className="source-mr-review__quotes">
              {(review?.notableQuotes || []).map((row) => (
                <li key={row.groupId}>
                  <button
                    type="button"
                    className={row.groupId === selectedGroup?.groupId ? 'is-selected' : ''}
                    onClick={() => onSelectGroup(row)}
                  >
                    {row.groupId} · {row.shipCode || '—'} · {formatWhen(row.sailDateFrom)} · {formatInt(row.requestedGuests)} requested · source {formatPct(row.sourceMr)}
                  </button>
                </li>
              ))}
            </ul>
            <h4 className="source-mr-review__heading">Probability history</h4>
            <DataTable
              columns={['Changed', 'Status', 'Guests', 'Source MR', 'Manual']}
              rows={history.map((point) => [
                formatWhen(point.changedDate),
                point.status || '—',
                formatInt(point.requestedGuests),
                formatPct(point.probability),
                point.manual ? 'Yes' : 'No',
              ])}
              showTooltip={showTooltip}
              onTip={showItemTip}
            />
          </article>
        </ReportDataDetails>
      </div>
      <HoverPreview
        open={Boolean(showTooltip && tip)}
        anchorRect={tip?.rect || null}
        placement="bottom"
        onRequestClose={() => showItemTip(null, null)}
      >
        {tip ? (
          <p className="source-mr-review__tip">
            <strong>{tip.label}</strong>
            {tip.text}
          </p>
        ) : null}
      </HoverPreview>
    </div>
  );
};

export default SourceMrReviewPresenter;
