/**
 * Project Summary — written summary, architecture, plan, and risk graphic.
 * PDF and CSV leave through the dock export.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import ReportProvenance from '../../shared/ReportProvenance';
import TaliaBrandMark from '../../shared/TaliaBrandMark';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import { formatPlanDate, milestoneOffset } from '../../../lib/projectPlan';
import { extractOverviewParts, projectSummaryExportPayload } from '../../../lib/projectSummaryPrint';
import {
  RISK_BAND_LABELS,
  RISK_CATEGORY_LABELS,
  RISK_IMPACT_LABELS,
  RISK_LIKELIHOOD_LABELS,
  RISK_PROXIMITY_LABELS,
  RISK_RESPONSE_LABELS,
  RISK_SCALE,
  riskBand,
} from '../../../lib/riskRegister';
import './project-summary.css';

const formatTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const named = (map, value) => map?.[value] || (value == null || value === '' ? '' : String(value));

const PlanTimeline = ({ phases }) => (
  <div className="ps-plan" role="list" aria-label="Project plan">
    {(phases || []).map((phase) => (
      <div
        key={phase.code}
        role="listitem"
        className={`ps-phase ps-phase--${phase.code}${phase.current ? ' is-current' : ''}`}
        style={{ flexGrow: Math.max(Number(phase.share) || 0.12, 0.12) }}
      >
        <span className="ps-phase__label">{phase.label}</span>
        <span className="ps-phase__bar" aria-hidden="true">
          {(phase.milestones || []).map((marker) => {
            const offset = milestoneOffset(marker, phase);
            if (offset == null) return null;
            return (
              <span
                key={marker.id}
                className="ps-marker"
                style={{ left: `${offset * 100}%` }}
                title={`${marker.name} · ${formatPlanDate(marker.targetOn)}`}
              />
            );
          })}
        </span>
        <span className="ps-phase__date">{formatPlanDate(phase.targetOn) || 'No date'}</span>
        {phase.elements?.length ? (
          <span className="ps-phase__elements">{phase.elements.join(' · ')}</span>
        ) : null}
        {(phase.milestones || []).length ? (
          <span className="ps-phase__marks">
            {phase.milestones.map((marker) => (
              <span key={marker.id}>
                {marker.name}{marker.targetOn ? ` · ${formatPlanDate(marker.targetOn)}` : ''}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    ))}
  </div>
);

const RiskGraphic = ({ risks }) => {
  const byCell = useMemo(() => {
    const map = new Map();
    (risks || []).forEach((item) => {
      const key = `${item.likelihood}:${item.impact}`;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [risks]);
  const likelihoods = [...RISK_SCALE].reverse();

  return (
    <div className="ps-heat" role="img" aria-label="Risk register">
      <div />
      {RISK_SCALE.map((impact) => (
        <div key={`impact-${impact}`} className="ps-heat__axis ps-heat__axis--impact">{RISK_IMPACT_LABELS[impact]}</div>
      ))}
      {likelihoods.map((likelihood) => (
        <React.Fragment key={likelihood}>
          <div className="ps-heat__axis">{RISK_LIKELIHOOD_LABELS[likelihood]}</div>
          {RISK_SCALE.map((impact) => {
            const cellItems = (byCell.get(`${likelihood}:${impact}`) || [])
              .slice()
              .sort((a, b) => String(a.referenceCode).localeCompare(String(b.referenceCode), undefined, { numeric: true }));
            const band = riskBand(likelihood, impact);
            return (
              <div key={impact} className={`ps-heat__cell ps-band--${band}`}>
                {cellItems.map((item) => (
                  <span key={item.id || item.referenceCode} title={`${item.referenceCode} ${item.title}`}>
                    {item.referenceCode}
                  </span>
                ))}
              </div>
            );
          })}
        </React.Fragment>
      ))}
      <ul className="ps-heat__legend">
        {['low', 'medium', 'high', 'critical'].map((band) => (
          <li key={band}><i className={`ps-band--${band}`} />{RISK_BAND_LABELS[band]}</li>
        ))}
      </ul>
    </div>
  );
};

const RiskDetails = ({ risks }) => (
  <table className="ps-table">
    <thead>
      <tr>
        <th>Reference</th>
        <th>Risk</th>
        <th>Likelihood</th>
        <th>Impact</th>
        <th>Band</th>
        <th>Response</th>
        <th>Proximity</th>
        <th>Owner</th>
        <th>Treatment</th>
      </tr>
    </thead>
    <tbody>
      {(risks || []).map((item) => (
        <tr key={item.id || item.referenceCode}>
          <td>{item.referenceCode}</td>
          <td>
            <strong>{item.title}</strong>
            {item.category ? <span className="ps-meta">{named(RISK_CATEGORY_LABELS, item.category)}</span> : null}
            {item.statement ? <p>{item.statement}</p> : null}
          </td>
          <td>{named(RISK_LIKELIHOOD_LABELS, item.likelihood)}</td>
          <td>{named(RISK_IMPACT_LABELS, item.impact)}</td>
          <td>{named(RISK_BAND_LABELS, item.band)}</td>
          <td>{named(RISK_RESPONSE_LABELS, item.response)}</td>
          <td>{named(RISK_PROXIMITY_LABELS, item.proximity)}</td>
          <td>{item.owner || '—'}</td>
          <td>{item.treatment || '—'}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const CurrentWork = ({ items }) => (
  <ul className="ps-work">
    {(items || []).map((item) => {
      const meta = [item.statusLabel, item.area, item.priority, item.targetVersion, formatPlanDate(item.updatedAt)]
        .filter(Boolean)
        .join(' · ');
      return (
        <li key={item.id}>
          <strong>{item.title}</strong>
          {meta ? <span>{meta}</span> : null}
          {item.detail ? <p>{item.detail}</p> : null}
        </li>
      );
    })}
  </ul>
);

const ProjectSummaryPresenter = ({
  summary,
  brief,
  onRefresh,
  panelInstanceId,
  panelComponentId,
  showProvenance = false,
  reportShellClassName = '',
}) => {
  const generatedAt = formatTimestamp(summary?.generatedAt);
  const parts = useMemo(() => extractOverviewParts(summary?.content), [summary?.content]);
  const summaryRef = useRef(summary);
  const briefRef = useRef(brief);
  summaryRef.current = summary;
  briefRef.current = brief;

  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId: panelComponentId || 'project-summary',
    getPayload: () => projectSummaryExportPayload({
      summary: summaryRef.current,
      brief: briefRef.current,
    }),
  }));

  return (
    <div
      className={`focus-panel talia-report project-summary${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
      role="region"
      aria-label="Project summary"
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={panelComponentId || undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <TaliaBrandMark className="ps-brand" />
          <div>
            <h2 className="talia-report__title">{summary?.title || 'Project Summary'}</h2>
            <p className="talia-report__subtitle">
              Summary, architecture, plan, and risks
              {summary?.version ? ` · ${summary.version}` : ''}
              {generatedAt ? ` · Published ${generatedAt}` : ''}
            </p>
          </div>
        </div>
      </header>
      {onRefresh ? (
        <div className="talia-report__actions-bar" aria-label="Project summary actions">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      ) : null}
      <main className="talia-report__content talia-report__content--scroll">
        {parts.summary ? (
          <section className="ps-section" aria-label="Executive summary">
            <h3>Executive summary</h3>
            <div className="talia-card ps-prose" dangerouslySetInnerHTML={{ __html: parts.summary }} />
          </section>
        ) : (
          <p className="ps-empty">No written summary published yet.</p>
        )}
        {parts.achievements ? (
          <section className="ps-section" aria-label="What we have achieved">
            <h3>What we have achieved</h3>
            <div className="talia-card ps-prose" dangerouslySetInnerHTML={{ __html: `<ul>${parts.achievements}</ul>` }} />
          </section>
        ) : null}
        {parts.nextSteps ? (
          <section className="ps-section" aria-label="Next steps">
            <h3>Next steps</h3>
            <div className="talia-card ps-prose" dangerouslySetInnerHTML={{ __html: `<ul>${parts.nextSteps}</ul>` }} />
          </section>
        ) : null}
        {parts.svg ? (
          <section className="ps-section" aria-label="Architecture">
            <h3>High-level architecture</h3>
            {parts.intro ? <p className="ps-diagram-intro" dangerouslySetInnerHTML={{ __html: parts.intro }} /> : null}
            <div className="talia-card ps-diagram" dangerouslySetInnerHTML={{ __html: parts.svg }} />
            {parts.legend ? <div className="ps-legend arch-legend" dangerouslySetInnerHTML={{ __html: parts.legend }} /> : null}
          </section>
        ) : null}
        {brief?.phases?.length ? (
          <section className="ps-section" aria-label="Project plan">
            <h3>Project plan</h3>
            <div className="talia-card">
              <PlanTimeline phases={brief.phases} />
            </div>
          </section>
        ) : null}
        {brief?.recentWork?.length ? (
          <section className="ps-section" aria-label="Current work">
            <h3>Current work</h3>
            <div className="talia-card">
              <CurrentWork items={brief.recentWork} />
            </div>
          </section>
        ) : null}
        {brief?.risks?.length ? (
          <section className="ps-section" aria-label="Risk register">
            <h3>Risk register</h3>
            <div className="talia-card">
              <RiskGraphic risks={brief.risks} />
              <RiskDetails risks={brief.risks} />
            </div>
          </section>
        ) : null}
        <ReportProvenance visible={showProvenance}>
          <p>The summary and architecture are the published overview. The plan and the risk graphic are the current project record.</p>
        </ReportProvenance>
      </main>
    </div>
  );
};

export default ProjectSummaryPresenter;
