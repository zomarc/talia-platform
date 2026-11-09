/**
 * Talia MR — graphical steps, sources, and issues.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  applyAxisLabelVisibility,
  getChartColors,
  getChartOptions,
  getSeriesColors,
} from '../../../lib/chartConfig';
import { formatMrPctPrecise } from '../GroupsExplorer/groupsMaterialisation';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import { TALIA_MR_ISSUES, TALIA_MR_LEAD, TALIA_MR_SOURCES } from '../../../lib/taliaMrMethod';
import { buildTaliaMrMethodExport } from '../../../lib/taliaMrMethodPrint';
import { captureTaliaMrPrintChart } from '../../../lib/taliaMrMethodPrintCharts';
import HoverPreview from '../../shared/HoverPreview';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import ReportSnapshot from '../../shared/ReportSnapshot';
import './talia-mr-method.css';

Chart.register(...registerables);

const ITEM_COPY = {
  Requested: 'Guests the group asked for. Expected guests are this number times the rate.',
  Named: 'Guests already booked by name. Before departure this is progress. After departure it is the outcome.',
  'Source MR': 'The stored materialisation rate. It can nudge Talia MR. It is not copied.',
  'Talia MR': 'The independent rate after the prior, the named guests, the offer cut, and the source nudge.',
  'Source expected': 'Requested guests times the source rate.',
  'Talia expected': 'Requested guests times Talia MR.',
};

const formatInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-GB');
};

const formatEur = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
};

const StepChart = ({ steps, sourceRate, showLegends, showAxisLabels, showTooltip }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !steps?.length) return undefined;
    const colors = getSeriesColors();
    const ink = getChartColors();
    const labels = steps.map((item) => item.title);
    const sourcePct = sourceRate == null ? null : Math.round(Number(sourceRate) * 1000) / 10;
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Rate after this step',
            data: steps.map((item) => Math.round((Number(item.rate) || 0) * 1000) / 10),
            backgroundColor: colors[1] || colors[0],
            borderColor: colors[1] || colors[0],
            borderWidth: 1,
            order: 2,
          },
          ...(sourcePct == null ? [] : [{
            type: 'line',
            label: 'Source rate',
            data: labels.map(() => sourcePct),
            borderColor: colors[0],
            backgroundColor: colors[0],
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [6, 4],
            order: 1,
          }]),
        ],
      },
      options: applyAxisLabelVisibility(getChartOptions.bar({
        layout: { padding: { right: 8, left: 4 } },
        plugins: {
          legend: {
            display: showLegends,
            position: 'top',
            align: 'start',
            labels: { color: ink.text },
          },
          tooltip: {
            enabled: showTooltip,
            callbacks: {
              label: (item) => `${item.parsed.y}%`,
              afterBody: (items) => {
                const step = steps[items?.[0]?.dataIndex];
                return step?.sentence ? [step.sentence] : [];
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Step' },
            ticks: { maxRotation: 0, autoSkip: false },
          },
          y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: 'Rate (%)' },
          },
        },
      }), showAxisLabels),
    });
    return () => chart.destroy();
  }, [steps, sourceRate, showLegends, showAxisLabels, showTooltip]);

  return (
    <div className="talia-mr-method__chart">
      <canvas ref={canvasRef} aria-label="Talia MR after each step" />
    </div>
  );
};

const TaliaMrMethodPresenter = ({
  cases = [],
  worked = null,
  subtitle = '',
  modelId = 'MR01',
  mr01PresetId = 'default',
  usingIllustrations = true,
  loading = false,
  error = null,
  onPick,
  onRetry,
  panelInstanceId,
  panelComponentId,
}) => {
  const {
    showSnapshot,
    showDetails,
    showFilters,
    showProvenance,
    showGraph,
    showTooltip,
    showLegends,
    showAxisLabels,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId, panelInstanceId);

  const [tip, setTip] = useState(null);
  const explanation = worked?.explanation;
  const steps = explanation?.steps || [];
  const sharpest = (worked?.issues || []).find((item) => item.tone === 'concern') || worked?.issues?.[0] || null;

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
      const chart = showGraph
        ? captureTaliaMrPrintChart({
          steps,
          sourceRate: explanation?.source_mr,
          showLegends,
          showAxisLabels,
        })
        : null;
      const html = buildTaliaMrMethodExport({
        subtitle,
        worked,
        charts: chart ? [chart] : [],
      });
      return {
        title: 'Talia MR',
        html,
        columns: [
          { field: 'section', title: 'Section' },
          { field: 'item', title: 'Item' },
          { field: 'detail', title: 'Detail' },
        ],
        rows: [
          ...steps.map((item) => ({
            section: 'Step',
            item: item.title,
            detail: item.sentence,
          })),
          ...TALIA_MR_SOURCES.map((item) => ({
            section: item.scope,
            item: item.name,
            detail: `${item.usedFor}. ${item.why}`,
          })),
          ...(worked?.issues || []).map((item) => ({
            section: 'Issue',
            item: item.title,
            detail: item.text,
          })),
          ...TALIA_MR_ISSUES.map((item) => ({
            section: 'Issue',
            item: item.title,
            detail: item.text,
          })),
        ],
      };
    },
  }), [
    panelInstanceId,
    panelComponentId,
    subtitle,
    worked,
    steps,
    explanation,
    showGraph,
    showLegends,
    showAxisLabels,
  ]);

  const revenue = formatEur(worked?.groupValueEur);

  return (
    <article className={['focus-panel', 'talia-report', 'talia-mr-method', reportShellClassName].filter(Boolean).join(' ')}>
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Talia MR · {modelId}</h2>
          <p className="talia-report__subtitle">
            {subtitle}
            {modelId === 'MR01' && mr01PresetId && mr01PresetId !== 'default'
              ? ` Preset: ${mr01PresetId}.`
              : ''}
          </p>
        </div>
      </header>

      {showFilters ? (
        <div className="talia-report-filters" aria-label="Worked example">
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">{usingIllustrations ? 'Example' : 'Group'}</span>
            <select
              className="talia-report-filters__input"
              value={worked?.id || ''}
              onChange={(event) => onPick?.(event.target.value)}
            >
              {cases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {item.status}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {loading ? <div className="talia-callout" role="status">Loading groups for the selected sailing.</div> : null}
      {error ? (
        <div className="talia-callout talia-callout--warning" role="alert">
          The selected sailing could not be loaded.
          {onRetry ? <button type="button" className="talia-btn talia-btn--secondary" onClick={onRetry}>Retry</button> : null}
        </div>
      ) : null}
      {sharpest ? (
        <div className="talia-callout" role="note">
          <strong>{sharpest.title}. </strong>
          {sharpest.text}
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
            { key: 'requested', label: 'Requested', value: formatInt(explanation?.requested) },
            { key: 'named', label: 'Named', value: formatInt(explanation?.reserved) },
            { key: 'source', label: 'Source MR', value: formatMrPctPrecise(explanation?.source_mr) },
            { key: 'talia', label: 'Talia MR', value: formatMrPctPrecise(explanation?.talia_mr) },
            { key: 'sourceExpected', label: 'Source expected', value: formatInt(explanation?.sourceExpected) },
            { key: 'taliaExpected', label: 'Talia expected', value: formatInt(explanation?.taliaExpected) },
          ]}
        />
      </div>

      <div className="talia-mr-method__body">
        <main className="talia-report__content talia-report__content--scroll">
          <section className="talia-mr-method__section" aria-label="Why the calculation is this way">
            <h3 className="talia-mr-method__heading">Why the calculation is this way</h3>
            <p className="talia-mr-method__lead">{TALIA_MR_LEAD}</p>
            {worked?.note ? <p className="talia-mr-method__note">{worked.note}</p> : null}
          </section>

          {showGraph && steps.length ? (
            <section className="talia-mr-method__section" aria-label="Rate after each step">
              <h3 className="talia-mr-method__heading">Rate after each step</h3>
              <StepChart
                steps={steps}
                sourceRate={explanation?.source_mr}
                showLegends={showLegends}
                showAxisLabels={showAxisLabels}
                showTooltip={showTooltip}
              />
            </section>
          ) : null}

          <section className="talia-mr-method__section" aria-label="Calculation steps">
            <h3 className="talia-mr-method__heading">
              {worked ? `${worked.title} · ${worked.sailing}` : 'Steps'}
            </h3>
            <ol className="talia-mr-method__steps">
              {steps.map((item) => (
                <li
                  key={item.id}
                  className={item.applied ? 'talia-mr-method__step talia-mr-method__step--applied' : 'talia-mr-method__step'}
                >
                  <p className="talia-mr-method__step-title">
                    <span>{item.title}</span>
                    <span>{formatMrPctPrecise(item.rate)}</span>
                  </p>
                  <p>{item.sentence}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="talia-mr-method__section" aria-label="Sources">
            <h3 className="talia-mr-method__heading">Sources</h3>
            <table className="talia-mr-method__table">
              <thead>
                <tr>
                  <th>Where</th>
                  <th>Source</th>
                  <th>Why it is used</th>
                </tr>
              </thead>
              <tbody>
                {TALIA_MR_SOURCES.map((item) => (
                  <tr key={item.id}>
                    <td>{item.scope}</td>
                    <td>{item.name}</td>
                    <td>{item.usedFor}. {item.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="talia-mr-method__section" aria-label="Issues">
            <h3 className="talia-mr-method__heading">Issues</h3>
            <ul className="talia-mr-method__issues">
              {(worked?.issues || []).map((item) => (
                <li key={item.id}><strong>{item.title}. </strong>{item.text}</li>
              ))}
              {TALIA_MR_ISSUES.map((item) => (
                <li key={item.id}><strong>{item.title}. </strong>{item.text}</li>
              ))}
            </ul>
          </section>

          <ReportProvenance visible={showProvenance}>
            <p>
              A sailing selection arrives as talia:sail.select. The group rows are the reservation for that sail code.
              The worked examples, when nothing is selected, are group 28657 and group 55576 from stg.SW_ETL_GROUPS,
              stg.SW_ETL_GROUP_HEADER, and stg.SW_ETL_GROUP_SHIP_REQUEST, frozen on 10 February 2025.
              Active model {modelId}. MR01 is explainTaliaMaterialisation (Views → MR model / MR01 preset).
              The source rate is never copied as the published result.
            </p>
          </ReportProvenance>
        </main>

        <ReportDataDetails visible={showDetails} as="aside" className="talia-mr-method__details">
          <section className="talia-mr-method__card talia-card">
            <h3 className="talia-mr-method__heading">{worked?.title || 'Example'}</h3>
            <p className="talia-mr-method__note">{worked?.sailing}</p>
            <table className="talia-mr-method__table">
              <tbody>
                <tr><th>Status</th><td>{worked?.status || '—'}</td></tr>
                <tr><th>Requested</th><td>{formatInt(explanation?.requested)}</td></tr>
                <tr><th>Named</th><td>{formatInt(explanation?.reserved)}</td></tr>
                <tr><th>Source MR</th><td>{formatMrPctPrecise(explanation?.source_mr)}</td></tr>
                <tr><th>Talia MR</th><td>{formatMrPctPrecise(explanation?.talia_mr)}</td></tr>
                <tr><th>Steps applied</th><td>{steps.filter((item) => item.applied && item.id !== 'result').map((item) => item.title).join(', ') || '—'}</td></tr>
                {revenue ? <tr><th>Ticket revenue</th><td>{revenue}. Not an input to the rate.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </ReportDataDetails>
      </div>

      <HoverPreview open={Boolean(tip)} anchorRect={tip?.rect || null}>
        {tip ? (
          <div>
            <strong>{tip.label}</strong>
            <p>{tip.body}</p>
          </div>
        ) : null}
      </HoverPreview>
    </article>
  );
};

export default TaliaMrMethodPresenter;
