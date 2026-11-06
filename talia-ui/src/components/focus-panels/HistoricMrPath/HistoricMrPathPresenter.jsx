/**
 * Historic MR path — month comparison, highlight list, and one group's change days.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { SHIP_FILTER_ALL } from '../../../hooks/useGlobalShipFilter';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';
import { resolveViewValue, VIEW_ASSUMPTIONS, VIEW_HISTORIC_MR_PATH } from '../../../lib/componentOptionsCatalog';
import {
  applyAxisLabelVisibility,
  getChartColors,
  getChartOptions,
  getSeriesColors,
} from '../../../lib/chartConfig';
import { formatDayMonYear, formatMonYear } from '../../../lib/dateFormat';
import { PLANNING_ASSUMPTION, planningValue } from '../../../lib/historicMrPath';
import { rescorePathDays, rescorePathPayload } from '../../../lib/mrPathRescore.js';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import { buildHistoricMrPathExport } from '../../../lib/historicMrPathPrint';
import { captureHistoricMrPathCharts } from '../../../lib/historicMrPathPrintCharts';
import { formatMrPctPrecise } from '../GroupsExplorer/groupsMaterialisation';
import HoverPreview from '../../shared/HoverPreview';
import ReportDataDetails from '../../shared/ReportDataDetails';
import SubpanelExpandButton from '../../shared/SubpanelExpandButton';
import ReportProvenance from '../../shared/ReportProvenance';
import ReportSnapshot from '../../shared/ReportSnapshot';
import './historic-mr-path.css';

Chart.register(...registerables);

const ITEM_COPY = {
  Through: 'Last day this warehouse extract was updated. Sailings after this date are not an outcome.',
  Sailed: 'Groups whose sail date is on or before that day.',
  'Source expected': 'Requested guests times the source rate held on the last change before departure.',
  'Talia expected': 'Requested guests times Talia MR for that same hold, using as-of named guests only (0 when the header version has none).',
  Named: 'Guests named on the final group row, unless the header version already carries a named count.',
  'Source above named': 'Guests the source rate counted above the guests who were named.',
  'Planning value': 'That guest gap times the euro amount typed in the filter. Not a fare from the book.',
};

const formatInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-GB');
};

const formatEuros = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
};

const GuestChart = ({ rows, showLegends, showAxisLabels, showTooltip, label, expanded = false }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rows.length) return undefined;
    const colors = getSeriesColors();
    const ink = getChartColors();
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [
          { label: 'Source expected', data: rows.map((row) => row.source), backgroundColor: colors[0], borderColor: colors[0], borderWidth: 1 },
          { label: 'Talia expected', data: rows.map((row) => row.talia), backgroundColor: colors[1] || colors[0], borderColor: colors[1] || colors[0], borderWidth: 1 },
          { label: 'Named', data: rows.map((row) => row.named), backgroundColor: colors[2] || colors[0], borderColor: colors[2] || colors[0], borderWidth: 1 },
        ],
      },
      options: applyAxisLabelVisibility(getChartOptions.bar({
        plugins: {
          legend: { display: showLegends, position: 'top', align: 'start', labels: { color: ink.text } },
          tooltip: { enabled: showTooltip },
        },
        scales: {
          x: { title: { display: true, text: label }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, title: { display: true, text: 'Guests' } },
        },
      }), showAxisLabels),
    });
    const frame = requestAnimationFrame(() => chart.resize());
    return () => {
      cancelAnimationFrame(frame);
      chart.destroy();
    };
  }, [rows, showLegends, showAxisLabels, showTooltip, label, expanded]);

  return (
    <div className="historic-mr-path__chart">
      <canvas ref={canvasRef} aria-label={label} />
    </div>
  );
};

const RangeChart = ({ source, talia, named, showAxisLabels, showTooltip, expanded }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const colors = getSeriesColors();
    const ink = getChartColors();
    const swatches = [colors[0], colors[1] || colors[0], colors[2] || colors[0]];
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Source expected', 'Talia expected', 'Named'],
        datasets: [{
          label: 'Guests',
          data: [source, talia, named],
          backgroundColor: swatches,
          borderColor: swatches,
          borderWidth: 1,
        }],
      },
      options: applyAxisLabelVisibility(getChartOptions.bar({
        indexAxis: 'y',
        plugins: {
          legend: { display: false, labels: { color: ink.text } },
          tooltip: { enabled: showTooltip },
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: 'Guests' } },
          y: { ticks: { autoSkip: false, color: ink.text } },
        },
      }), showAxisLabels),
    });
    const frame = requestAnimationFrame(() => chart.resize());
    return () => {
      cancelAnimationFrame(frame);
      chart.destroy();
    };
  }, [source, talia, named, showAxisLabels, showTooltip, expanded]);

  return (
    <div className="historic-mr-path__chart historic-mr-path__chart--range">
      <canvas ref={canvasRef} aria-label="Source expected, Talia expected, and named guests for this range" />
    </div>
  );
};

const ExpandableSection = ({ sectionKey, label, expandedKey, onToggle, children, ariaLabel }) => (
  <section
    className={`historic-mr-path__section talia-card--expandable${expandedKey === sectionKey ? ' talia-card--expanded' : ''}`}
    aria-label={ariaLabel || label}
  >
    <SubpanelExpandButton
      className="talia-card__expand-toggle"
      expanded={expandedKey === sectionKey}
      onToggle={() => onToggle(sectionKey)}
      label={label}
    />
    {children}
  </section>
);

const HistoricMrPathPresenter = ({
  path,
  series,
  selectedGroup,
  onSelectGroup,
  shipChoice,
  ships = [],
  onShipChoice,
  globalShip,
  dateFrom,
  dateTo,
  datesFollowGlobal,
  onDateFrom,
  onDateTo,
  onUseHeaderDates,
  onSailedWindow,
  onFullHistory,
  criteriaSummary,
  cutsHistory,
  planningRate,
  onPlanningRate,
  panelInstanceId,
  panelComponentId,
}) => {
  const {
    viewsState,
    hydrated,
    showSnapshot,
    showDetails,
    showFilters,
    showProvenance,
    showGraph,
    showTooltip,
    showLegends,
    showAxisLabels,
    useSourceNudge,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId, panelInstanceId);
  const showPath = hydrated === true && resolveViewValue(viewsState, VIEW_HISTORIC_MR_PATH) === true;
  const showAssumptions = hydrated === true && resolveViewValue(viewsState, VIEW_ASSUMPTIONS) !== false;
  const { expandedKey, toggleExpandedKey } = useSubpanelExpansion(null);
  const [tip, setTip] = useState(null);
  const displayPath = useMemo(
    () => rescorePathPayload(path, { useSourceNudge }),
    [path, useSourceNudge]
  );
  const displaySeries = useMemo(
    () => rescorePathDays(series, { useSourceNudge }),
    [series, useSourceNudge]
  );
  const planning = planningValue(displayPath?.sourceExpectedGuests, displayPath?.namedGuests, planningRate);
  const selectedScored = useMemo(() => {
    if (!selectedGroup) return null;
    if (!useSourceNudge) return selectedGroup;
    return (displayPath?.groups || []).find((row) => row.groupId === selectedGroup.groupId) || selectedGroup;
  }, [selectedGroup, displayPath, useSourceNudge]);
  const groupPlanning = planningValue(selectedScored?.sourceExpectedGuests, selectedScored?.namedGuests, planningRate);
  const assumptions = [...(displayPath?.assumptions || []), PLANNING_ASSUMPTION];
  const months = useMemo(() => (displayPath?.months || []).map((row) => ({
    ...row,
    label: formatMonYear(`${row.month}-01`, row.month),
    source: row.sourceExpectedGuests,
    talia: row.taliaExpectedGuests,
    named: row.namedGuests,
  })), [displayPath]);
  const days = useMemo(() => (displaySeries?.days || []).slice(-24).map((row) => ({
    ...row,
    label: formatDayMonYear(row.changedDate, row.changedDate),
    source: row.sourceExpectedGuests,
    talia: row.taliaExpectedGuests,
    named: row.namedGuests,
  })), [displaySeries]);
  const globalShipLabel = !globalShip || globalShip === SHIP_FILTER_ALL ? 'All' : globalShip;
  const sourceAboveNamed = Math.round((displayPath?.sourceExpectedGuests || 0) - (displayPath?.namedGuests || 0));
  const sourceAboveTalia = Math.round((displayPath?.sourceExpectedGuests || 0) - (displayPath?.taliaExpectedGuests || 0));
  const sectionOpen = (key) => {
    if (key === 'assumptions') return showAssumptions;
    if (key === 'range') return Boolean(showGraph && displayPath);
    if (key === 'months') return Boolean(showGraph && months.length);
    if (key === 'path') return Boolean(showPath && days.length);
    if (key === 'detail') return showDetails;
    return key === 'monthTable' || key === 'highlights';
  };
  const openKey = sectionOpen(expandedKey) ? expandedKey : null;

  const showItemTip = (label, rect) => {
    if (!showTooltip || !label || !ITEM_COPY[label] || !rect) {
      setTip(null);
      return;
    }
    setTip({ label, body: ITEM_COPY[label], rect });
  };

  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId,
    getPayload: () => {
      const charts = captureHistoricMrPathCharts({
        months,
        days,
        range: {
          source: displayPath?.sourceExpectedGuests,
          talia: displayPath?.taliaExpectedGuests,
          named: displayPath?.namedGuests,
        },
        includeMonths: showGraph,
        includeRange: showGraph,
        includePath: showPath,
        showLegends,
        showAxisLabels,
      });
      return {
        title: 'Historic MR path',
        html: buildHistoricMrPathExport({
          path: displayPath,
          series: showPath ? displaySeries : null,
          planning,
          charts,
          includeAssumptions: showAssumptions,
        }),
        columns: [
          { field: 'section', title: 'Section' },
          { field: 'item', title: 'Item' },
          { field: 'detail', title: 'Detail' },
        ],
        rows: [
          ...(showAssumptions ? assumptions.map((item) => ({ section: 'Assumption', item, detail: item })) : []),
          ...months.map((row) => ({
            section: 'Month',
            item: row.label,
            detail: `Source ${row.source}, Talia ${row.talia}, named ${row.named}, highlight gap ${row.qualifyingGap}`,
          })),
          ...(displayPath?.highlights || []).map((row) => ({
            section: 'Highlight',
            item: row.groupId,
            detail: `${row.shipCode || ''} ${row.sailDateFrom || ''} source ${row.sourceExpectedGuests} talia ${row.taliaExpectedGuests} named ${row.namedGuests}`,
          })),
        ],
      };
    },
  }), [
    panelInstanceId,
    panelComponentId,
    displayPath,
    displaySeries,
    months,
    days,
    assumptions,
    planning,
    showGraph,
    showPath,
    showAssumptions,
    showLegends,
    showAxisLabels,
  ]);

  return (
    <article className={['focus-panel', 'talia-report', 'historic-mr-path', reportShellClassName].filter(Boolean).join(' ')}>
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Historic MR path</h2>
          <p className="talia-report__subtitle">
            {displayPath?.namesFromHistory
              ? 'Talia MR uses the named guests stored on each header version.'
              : 'Header versions here have no as-of named count: booked holds use requested size as evidence; quotes and offers stay at 0 named. Final named is for judging the path only.'}
          </p>
        </div>
      </header>

      {showFilters ? (
        <div className="talia-report-filters" aria-label="Ship, dates, and planning value">
          <div className="talia-report-filters__group">
            <span className="talia-report-filters__label">Header</span>
            <span>{criteriaSummary} · Ship {globalShipLabel}</span>
          </div>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Ship</span>
            <select
              className="talia-report-filters__input"
              value={shipChoice === 'global' ? 'global' : (shipChoice === SHIP_FILTER_ALL ? 'all' : shipChoice)}
              onChange={(event) => onShipChoice?.(event.target.value === 'all' ? SHIP_FILTER_ALL : event.target.value)}
            >
              <option value="global">Follow global ({globalShipLabel})</option>
              <option value="all">All ships</option>
              {ships.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">From</span>
            <input type="date" className="talia-report-filters__input" value={dateFrom || ''} onChange={(event) => onDateFrom?.(event.target.value)} />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">To</span>
            <input type="date" className="talia-report-filters__input" value={dateTo || ''} onChange={(event) => onDateTo?.(event.target.value)} />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">€ / guest</span>
            <input
              type="text"
              inputMode="decimal"
              className="talia-report-filters__input"
              placeholder="Planning rate"
              value={planningRate}
              onChange={(event) => onPlanningRate?.(event.target.value)}
              aria-label="Planning euros per guest"
            />
          </label>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onFullHistory}>Full sailed history</button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onUseHeaderDates}>Use header dates</button>
          {datesFollowGlobal ? null : (
            <p className="historic-mr-path__filter-note">
              {dateFrom || dateTo
                ? 'Limited to these sail dates. Full sailed history clears them without changing the header.'
                : 'Showing every sailed group in the extract. Header dates are not applied.'}
            </p>
          )}
          {cutsHistory ? (
            <p className="historic-mr-path__filter-note">
              Header dates start after {formatDayMonYear(displayPath?.feedThrough, 'the extract')}, so sailed history is hidden. Full sailed history shows it without changing the header.
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        onMouseOver={(event) => {
          const metric = event.target.closest?.('.talia-metric');
          if (!metric) return;
          showItemTip(metric.querySelector('.talia-metric__label')?.textContent?.trim(), metric.getBoundingClientRect());
        }}
        onMouseLeave={() => showItemTip(null, null)}
      >
        <ReportSnapshot
          visible={showSnapshot}
          items={[
            { key: 'through', label: 'Through', value: formatDayMonYear(displayPath?.feedThrough, '—') },
            { key: 'sailed', label: 'Sailed', value: formatInt(displayPath?.sailedGroupCount) },
            { key: 'source', label: 'Source expected', value: formatInt(displayPath?.sourceExpectedGuests) },
            { key: 'talia', label: 'Talia expected', value: formatInt(displayPath?.taliaExpectedGuests) },
            { key: 'named', label: 'Named', value: formatInt(displayPath?.namedGuests) },
            { key: 'gap', label: 'Source above named', value: formatInt(sourceAboveNamed), hint: `source above Talia ${formatInt(sourceAboveTalia)}` },
            { key: 'value', label: 'Planning value', value: planning ? formatEuros(planning.euros) : '—' },
          ]}
        />
      </div>

      <div className={`historic-mr-path__body${openKey === 'detail' ? ' historic-mr-path__body--detail' : ''}${openKey && openKey !== 'detail' ? ' historic-mr-path__body--focused' : ''}`}>
        <main className={`talia-report__content talia-report__content--scroll${openKey && openKey !== 'detail' ? ' historic-mr-path__content--focused' : ''}`}>
          {showAssumptions ? (
            <ExpandableSection sectionKey="assumptions" label="assumptions" expandedKey={openKey} onToggle={toggleExpandedKey} ariaLabel="Assumptions">
              <h3 className="historic-mr-path__heading">Assumptions</h3>
              <ul className="historic-mr-path__assumptions">
                {assumptions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </ExpandableSection>
          ) : null}

          {showGraph && displayPath ? (
            <ExpandableSection sectionKey="range" label="this range" expandedKey={openKey} onToggle={toggleExpandedKey} ariaLabel="Source expected, Talia expected, and named guests for this range">
              <h3 className="historic-mr-path__heading">This range</h3>
              <p className="historic-mr-path__lead">
                Source expected, Talia expected, and the named result for the sailings in the current filter.
              </p>
              <RangeChart
                source={Math.round(Number(displayPath.sourceExpectedGuests) || 0)}
                talia={Math.round(Number(displayPath.taliaExpectedGuests) || 0)}
                named={Math.round(Number(displayPath.namedGuests) || 0)}
                showAxisLabels={showAxisLabels}
                showTooltip={showTooltip}
                expanded={openKey === 'range'}
              />
            </ExpandableSection>
          ) : null}

          {showGraph && months.length ? (
            <ExpandableSection sectionKey="months" label="sail month chart" expandedKey={openKey} onToggle={toggleExpandedKey} ariaLabel="Source, Talia, and named guests by sail month">
              <h3 className="historic-mr-path__heading">By sail month</h3>
              <p className="historic-mr-path__lead">
                Source and Talia are the hold on the last change before departure. Named is the outcome. A month is marked when the highlighted quote and open-offer gap is at least 2,000 guests.
              </p>
              <GuestChart rows={months} showLegends={showLegends} showAxisLabels={showAxisLabels} showTooltip={showTooltip} label="Sail month" expanded={openKey === 'months'} />
            </ExpandableSection>
          ) : null}

          <ExpandableSection sectionKey="monthTable" label="sail months" expandedKey={openKey} onToggle={toggleExpandedKey} ariaLabel="Sail months">
            <h3 className="historic-mr-path__heading">Sail months</h3>
            <div className="historic-mr-path__table-wrap">
              <table className="historic-mr-path__table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Groups</th>
                    <th className="num">Source</th>
                    <th className="num">Talia</th>
                    <th className="num">Named</th>
                    <th className="num">Highlight gap</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((row) => (
                    <tr key={row.month}>
                      <td>{row.label}{row.highlighted ? ' · highlighted' : ''}</td>
                      <td className="num">{formatInt(row.groups)}</td>
                      <td className="num">{formatInt(row.source)}</td>
                      <td className="num">{formatInt(row.talia)}</td>
                      <td className="num">{formatInt(row.named)}</td>
                      <td className="num">{formatInt(row.qualifyingGap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ExpandableSection>

          <ExpandableSection sectionKey="highlights" label="groups that could have been held differently" expandedKey={openKey} onToggle={toggleExpandedKey} ariaLabel="Groups that could have been held differently">
            <h3 className="historic-mr-path__heading">Could have been held differently</h3>
            <p className="historic-mr-path__lead">
              Quotes and open offers held on more than one day, where the source rate counted at least 10 guests above the names and sat at least 15 points above Talia MR. Largest guest gap first.
            </p>
            <div className="historic-mr-path__table-wrap">
              <table className="historic-mr-path__table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Ship</th>
                    <th>Sail</th>
                    <th className="num">Days</th>
                    <th className="num">Source</th>
                    <th className="num">Talia</th>
                    <th className="num">Named</th>
                  </tr>
                </thead>
                <tbody>
                  {(displayPath?.highlights || []).map((row) => (
                    <tr
                      key={row.groupId}
                      className={row.groupId === selectedGroup?.groupId ? 'historic-mr-path__row is-selected' : 'historic-mr-path__row'}
                      onClick={() => onSelectGroup?.(row)}
                    >
                      <td>{row.groupId}</td>
                      <td>{row.shipCode}</td>
                      <td>{formatDayMonYear(row.sailDateFrom, '')}</td>
                      <td className="num">{formatInt(row.changeDays)}</td>
                      <td className="num">{formatInt(row.sourceExpectedGuests)}</td>
                      <td className="num">{formatInt(row.taliaExpectedGuests)}</td>
                      <td className="num">{formatInt(row.namedGuests)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ExpandableSection>

          {showPath && days.length ? (
            <ExpandableSection sectionKey="path" label="group path" expandedKey={openKey} onToggle={toggleExpandedKey} ariaLabel="Change days for the selected group">
              <h3 className="historic-mr-path__heading">
                Group {displaySeries?.groupId} · {formatDayMonYear(displaySeries?.sailDateFrom, '')}
              </h3>
              <p className="historic-mr-path__note">
                {displaySeries?.namesFromHistory
                  ? 'Each day uses the named guests stored on that header version.'
                  : 'Missing named on header: BK uses requested; QT/OF stay at 0. Days after departure are left out.'}
                {displaySeries?.days?.length > 24 ? ' The chart shows the latest 24 change days.' : ''}
              </p>
              <GuestChart rows={days} showLegends={showLegends} showAxisLabels={showAxisLabels} showTooltip={showTooltip} label="Change day" expanded={openKey === 'path'} />
            </ExpandableSection>
          ) : null}

          <ReportProvenance visible={showProvenance}>
            <p>
              Holds come from stg.SW_ETL_GROUP_HEADER, collapsed to one row per change day, joined to stg.SW_ETL_GROUPS for the final named count and to stg.SW_ETL_GROUP_SHIP_REQUEST for the ship.
              A sailing selection arrives as talia:sail.select and narrows this report to that ship and sail date.
              {displayPath?.namesFromHistory
                ? ' Header versions include n_of_delegate_guests, so Talia MR uses that day\'s names.'
                : ' n_of_delegate_guests on the header is empty: BK uses requested as booked evidence; QT/OF stay at 0 named.'}
            </p>
          </ReportProvenance>
        </main>

        <ReportDataDetails visible={showDetails} as="aside" className="historic-mr-path__details">
          <section className={`historic-mr-path__card talia-card talia-card--expandable${openKey === 'detail' ? ' talia-card--expanded' : ''}`}>
            <SubpanelExpandButton
              className="talia-card__expand-toggle"
              expanded={openKey === 'detail'}
              onToggle={() => toggleExpandedKey('detail')}
              label="highlight"
            />
            <h3 className="historic-mr-path__heading">{selectedScored ? `Group ${selectedScored.groupId}` : 'Highlight'}</h3>
            {selectedScored ? (
              <table className="historic-mr-path__table">
                <tbody>
                  <tr><th>Ship</th><td>{selectedScored.shipCode} · {formatDayMonYear(selectedScored.sailDateFrom, '')}</td></tr>
                  <tr><th>Hold</th><td>{selectedScored.status} on {formatDayMonYear(selectedScored.holdDate, '')}</td></tr>
                  <tr><th>Days</th><td>{formatInt(selectedScored.changeDays)}{selectedScored.manual ? ' · manual rate' : ''}</td></tr>
                  <tr><th>Source MR</th><td>{formatMrPctPrecise(selectedScored.sourceMr)}</td></tr>
                  <tr><th>Talia MR</th><td>{formatMrPctPrecise(selectedScored.taliaMr)}</td></tr>
                  <tr><th>Requested</th><td>{formatInt(selectedScored.requestedGuests)}</td></tr>
                  <tr><th>Named</th><td>{formatInt(selectedScored.namedGuests)}</td></tr>
                  <tr><th>Guest gap</th><td>{formatInt(selectedScored.sourceExpectedGuests - selectedScored.namedGuests)} source above named</td></tr>
                  {groupPlanning ? <tr><th>Planning value</th><td>{formatEuros(groupPlanning.euros)} at {formatInt(groupPlanning.eurosPerGuest)} per guest</td></tr> : null}
                </tbody>
              </table>
            ) : (
              <p className="historic-mr-path__note">No quote or open offer in this window meets the highlight rule.</p>
            )}
            <p className="historic-mr-path__note">
              {showPath
                ? 'Group path is on. The chart uses the latest 24 change days when a group has more.'
                : 'Turn on Group path in the panel options to see each change day.'}
            </p>
          </section>
        </ReportDataDetails>
      </div>

      <HoverPreview open={Boolean(tip)} anchorRect={tip?.rect || null}>
        {tip ? <div><strong>{tip.label}</strong><p>{tip.body}</p></div> : null}
      </HoverPreview>
    </article>
  );
};

export default HistoricMrPathPresenter;
