/**
 * Project plan presenter — phase timeline, linked records, and milestone dates.
 */

import React, { useMemo } from 'react';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import { formatPlanDate, milestoneOffset, phaseSpans } from '../../../lib/projectPlan';
import './project-plan.css';

const Field = ({ label, children }) => (
  <label className="pp-field">
    <span className="pp-field__label">{label}</span>
    {children}
  </label>
);

const RecordList = ({ title, rows }) => (
  <section className="pp-detail__group">
    <h3>{title}</h3>
    {rows.length ? (
      <ul>
        {rows.map((row) => <li key={row.id}>{row.label}</li>)}
      </ul>
    ) : (
      <p className="pp-detail__empty">None linked</p>
    )}
  </section>
);

const ProjectPlanPresenter = ({
  panelInstanceId,
  panelComponentId,
  reportShellClassName,
  showDetails,
  showProvenance,
  phases,
  milestones,
  phaseMilestones,
  unplaced,
  phaseCode,
  selectedMilestoneId,
  linked,
  draft,
  busy,
  message,
  onSelectPhase,
  onSelectMilestone,
  onPhaseDate,
  onMilestoneChange,
  onDraftChange,
  onSave,
  onRefresh,
}) => {
  const spans = useMemo(() => phaseSpans(phases, milestones), [phases, milestones]);
  const phase = spans.find((item) => item.code === phaseCode) || spans[0];
  const selectedMilestone = (milestones || []).find((item) => item.id === selectedMilestoneId) || null;
  const datedCount = milestones.filter((item) => item.targetOn).length
    + phases.filter((item) => item.targetOn).length;

  const matrixRows = (linked?.matrix || []).map((item) => ({
    id: item.id,
    label: `${item.referenceCode} ${item.shortName || item.name || ''} · ${item.element}`.trim(),
  }));
  const requirementRows = (linked?.requirements || []).map((item) => ({
    id: item.id,
    label: item.targetVersion ? `${item.title} · ${item.targetVersion}` : item.title,
  }));
  const riskRows = (linked?.risks || []).map((item) => ({
    id: item.id,
    label: `${item.referenceCode} ${item.title}`,
  }));
  const documentRows = (linked?.documents || []).map((item) => ({
    id: item.id,
    label: `${item.referenceCode} ${item.title}`,
  }));

  return (
    <div
      className={`focus-panel talia-report project-plan${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
      role="region"
      aria-label="Project plan"
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={panelComponentId || undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Project plan</h2>
          <p className="talia-report__subtitle">
            Phases follow the matrix · milestones are requirement target versions
            {datedCount ? ` · ${datedCount} dated` : ' · set a target date to place the timeline'}
          </p>
        </div>
      </header>

      <div className="talia-report__actions-bar">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} disabled={busy}>Refresh</button>
      </div>

      {message ? <p className="talia-callout">{message}</p> : null}

      <div className="talia-report__content">
        <div className="pp-timeline" role="list" aria-label="Phases">
          {spans.map((span) => {
            const markers = (milestones || []).filter((item) => item.phaseCode === span.code);
            const selected = span.code === phaseCode && !selectedMilestoneId;
            return (
              <button
                key={span.code}
                type="button"
                role="listitem"
                className={`pp-phase pp-phase--${span.code}${selected ? ' is-selected' : ''}`}
                style={{ flexGrow: Math.max(span.share, 0.12) }}
                onClick={() => onSelectPhase(span.code)}
              >
                <span className="pp-phase__label">{span.label}</span>
                <span className="pp-phase__bar" aria-hidden="true">
                  {markers.map((marker) => {
                    const offset = milestoneOffset(marker, span);
                    if (offset == null) return null;
                    return (
                      <span
                        key={marker.id}
                        className={`pp-marker${marker.id === selectedMilestoneId ? ' is-selected' : ''}`}
                        style={{ left: `${offset * 100}%` }}
                        title={`${marker.name} · ${formatPlanDate(marker.targetOn)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectMilestone(marker);
                        }}
                      />
                    );
                  })}
                </span>
                <span className="pp-phase__date">{formatPlanDate(span.targetOn) || 'No date'}</span>
                <span className="pp-phase__marks">
                  {markers.map((marker) => (
                    <span
                      key={marker.id}
                      className={marker.id === selectedMilestoneId ? 'is-selected' : ''}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectMilestone(marker);
                      }}
                    >
                      {marker.name}{marker.targetOn ? ` · ${formatPlanDate(marker.targetOn)}` : ''}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {unplaced.length ? (
          <div className="pp-unplaced">
            <span>Not on a phase</span>
            {unplaced.map((marker) => (
              <button
                key={marker.id}
                type="button"
                className={marker.id === selectedMilestoneId ? 'is-selected' : ''}
                onClick={() => onSelectMilestone(marker)}
              >
                {marker.name}
              </button>
            ))}
          </div>
        ) : null}

        <article className="pp-detail" aria-label={phase ? `${phase.label} linked records` : 'Linked records'}>
          <header>
            <strong>
              {selectedMilestone && !selectedMilestone.phaseCode ? 'Not placed' : (phase?.label || 'Phase')}
            </strong>
            {selectedMilestone ? (
              <span>{selectedMilestone.name}</span>
            ) : (
              <span>Everything linked to this phase</span>
            )}
          </header>
          <div className="pp-detail__grid">
            <RecordList title="Functionality matrix" rows={matrixRows} />
            <RecordList title="Requirements" rows={requirementRows} />
            <RecordList title="Risks" rows={riskRows} />
            <RecordList title="Documents" rows={documentRows} />
          </div>
        </article>
      </div>

      <ReportDataDetails visible={showDetails}>
        {phase ? (
          <form className="talia-card pp-form" onSubmit={onSave}>
            <Field label={`${phase.label} target`}>
              <input
                type="date"
                value={phase.targetOn || ''}
                onChange={(event) => onPhaseDate(event.target.value)}
              />
            </Field>
            <div className="pp-form__milestones">
              <span className="pp-field__label">Milestones</span>
              {phaseMilestones.map((marker) => (
                <div key={marker.id} className={`pp-form__row${marker.id === selectedMilestoneId ? ' is-selected' : ''}`}>
                  <span>{marker.name}</span>
                  <select
                    value={marker.phaseCode || ''}
                    aria-label={`${marker.name} phase`}
                    onChange={(event) => onMilestoneChange(marker.id, { phaseCode: event.target.value || null })}
                  >
                    <option value="">Not placed</option>
                    {spans.map((span) => <option key={span.code} value={span.code}>{span.label}</option>)}
                  </select>
                  <input
                    type="date"
                    aria-label={`${marker.name} target`}
                    value={marker.targetOn || ''}
                    onChange={(event) => onMilestoneChange(marker.id, { targetOn: event.target.value })}
                  />
                </div>
              ))}
              {selectedMilestoneId && !phaseMilestones.some((item) => item.id === selectedMilestoneId) ? (
                <div className="pp-form__row is-selected">
                  <span>{milestones.find((item) => item.id === selectedMilestoneId)?.name}</span>
                  <select
                    value={milestones.find((item) => item.id === selectedMilestoneId)?.phaseCode || ''}
                    aria-label="Milestone phase"
                    onChange={(event) => onMilestoneChange(selectedMilestoneId, { phaseCode: event.target.value || null })}
                  >
                    <option value="">Not placed</option>
                    {spans.map((span) => <option key={span.code} value={span.code}>{span.label}</option>)}
                  </select>
                  <input
                    type="date"
                    aria-label="Milestone target"
                    value={milestones.find((item) => item.id === selectedMilestoneId)?.targetOn || ''}
                    onChange={(event) => onMilestoneChange(selectedMilestoneId, { targetOn: event.target.value })}
                  />
                </div>
              ) : null}
              <div className="pp-form__row">
                <input
                  value={draft.name}
                  placeholder="New milestone"
                  aria-label="New milestone"
                  onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                />
                <select
                  value={draft.phaseCode || phase.code}
                  aria-label="New milestone phase"
                  onChange={(event) => onDraftChange({ ...draft, phaseCode: event.target.value })}
                >
                  {spans.map((span) => <option key={span.code} value={span.code}>{span.label}</option>)}
                </select>
                <input
                  type="date"
                  aria-label="New milestone target"
                  value={draft.targetOn}
                  onChange={(event) => onDraftChange({ ...draft, targetOn: event.target.value })}
                />
              </div>
            </div>
            <div className="talia-report__actions-bar">
              <button type="submit" className="talia-btn talia-btn--primary" disabled={busy}>Save dates</button>
            </div>
          </form>
        ) : (
          <p className="pp-form__empty">Details is where phase and milestone dates are set.</p>
        )}
      </ReportDataDetails>

      <ReportProvenance visible={showProvenance}>
        <p>
          Phases live in <code>public.project_phase</code> and use the same codes as the functionality matrix.
          Milestones live in <code>public.project_milestone</code>. A milestone name is the requirement
          target version, so the log and the plan stay on the same label. Dates are the target, not a forecast.
        </p>
      </ReportProvenance>
    </div>
  );
};

export default ProjectPlanPresenter;
