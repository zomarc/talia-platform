/**
 * Risk register presenter — list or heat map, a reading, and the edit form.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import LinkedDocuments from '../../shared/LinkedDocuments';
import RecordLinkEditor from '../../shared/RecordLinkEditor';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import { payloadFromRows, registerPanelDataExport } from '../../../lib/panelDataExport';
import {
  RISK_BAND_LABELS,
  RISK_CATEGORIES,
  RISK_CATEGORY_LABELS,
  RISK_IMPACT_LABELS,
  RISK_LIKELIHOOD_LABELS,
  RISK_PROXIMITIES,
  RISK_PROXIMITY_LABELS,
  RISK_RESPONSES,
  RISK_RESPONSE_LABELS,
  RISK_SCALE,
  RISK_STATUSES,
  RISK_STATUS_LABELS,
  riskBand,
} from '../../../lib/riskRegister';
import './risk-register.css';

const LINK_KINDS = [
  { id: 'requirement', label: 'Requirement' },
  { id: 'matrix', label: 'Matrix' },
];

const Field = ({ label, children }) => (
  <label className="rr-field">
    <span className="rr-field__label">{label}</span>
    {children}
  </label>
);

const bandOf = (item) => riskBand(item?.likelihood, item?.impact);

const RISK_EXPORT_COLUMNS = [
  { field: 'referenceCode', title: 'Reference' },
  { field: 'title', title: 'Title' },
  { field: 'statement', title: 'Statement' },
  { field: 'category', title: 'Category' },
  { field: 'likelihood', title: 'Likelihood' },
  { field: 'impact', title: 'Impact' },
  { field: 'band', title: 'Band' },
  { field: 'proximity', title: 'Proximity' },
  { field: 'status', title: 'Status' },
  { field: 'response', title: 'Response' },
  { field: 'treatment', title: 'Treatment' },
  { field: 'owner', title: 'Owner' },
  { field: 'reviewOn', title: 'Review' },
  { field: 'links', title: 'Linked' },
];

const riskExportRow = (item) => {
  const band = bandOf(item);
  return {
    referenceCode: item.referenceCode || '',
    title: item.title || '',
    statement: item.statement || '',
    category: RISK_CATEGORY_LABELS[item.category] || item.category || '',
    likelihood: RISK_LIKELIHOOD_LABELS[item.likelihood] || item.likelihood || '',
    impact: RISK_IMPACT_LABELS[item.impact] || item.impact || '',
    band: RISK_BAND_LABELS[band] || band,
    proximity: RISK_PROXIMITY_LABELS[item.proximity] || item.proximity || '',
    status: RISK_STATUS_LABELS[item.status] || item.status || '',
    response: RISK_RESPONSE_LABELS[item.response] || item.response || '',
    treatment: item.treatment || '',
    owner: item.owner || '',
    reviewOn: item.reviewOn || '',
    links: (item.links || []).map((link) => link.label || link.targetId).filter(Boolean).join('; '),
  };
};

const RiskReading = ({ item }) => (
  <article className="rr-reading" aria-label={`${item.referenceCode} ${item.title}`}>
    <header className="rr-reading__head">
      <strong>{item.referenceCode}</strong>
      <span className="rr-reading__name">{item.title}</span>
      <span className={`rr-band rr-band--${bandOf(item)}`}>{RISK_BAND_LABELS[bandOf(item)]}</span>
      <span className="rr-reading__meta">
        {RISK_CATEGORY_LABELS[item.category] || item.category}
        {' · '}
        {RISK_LIKELIHOOD_LABELS[item.likelihood]} × {RISK_IMPACT_LABELS[item.impact]}
        {' · '}
        {RISK_RESPONSE_LABELS[item.response] || item.response}
        {' · '}
        {RISK_STATUS_LABELS[item.status] || item.status}
      </span>
    </header>
    {item.statement ? (
      <p className="rr-reading__block"><span>Statement</span>{item.statement}</p>
    ) : null}
    {item.treatment ? (
      <p className="rr-reading__block"><span>Treatment</span>{item.treatment}</p>
    ) : null}
    <p className="rr-reading__block">
      <span>Owner</span>
      {item.owner || 'Unassigned'}
      {item.reviewOn ? ` · Review ${item.reviewOn}` : ''}
      {item.proximity ? ` · ${RISK_PROXIMITY_LABELS[item.proximity] || item.proximity}` : ''}
    </p>
    {item.residualLikelihood && item.residualImpact ? (
      <p className="rr-reading__block">
        <span>Residual</span>
        {RISK_LIKELIHOOD_LABELS[item.residualLikelihood]} × {RISK_IMPACT_LABELS[item.residualImpact]}
        {' · '}
        {RISK_BAND_LABELS[riskBand(item.residualLikelihood, item.residualImpact)]}
      </p>
    ) : null}
    {(item.links || []).length ? (
      <p className="rr-reading__block">
        <span>Linked</span>
        {item.links.map((link) => link.label || link.targetId).join(' · ')}
      </p>
    ) : null}
    <LinkedDocuments targetKind="risk" targetId={item.id} />
  </article>
);

const HeatMap = ({ items, selectedId, onSelect, showAxisLabels }) => {
  const byCell = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = `${item.likelihood}:${item.impact}`;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [items]);

  const likelihoods = [...RISK_SCALE].reverse();

  return (
    <div className={`rr-heat${showAxisLabels ? '' : ' rr-heat--plain'}`} role="grid" aria-label="Likelihood and impact">
      {showAxisLabels ? (
        <>
          <div />
          {RISK_SCALE.map((impact) => (
            <div key={`impact-${impact}`} className="rr-heat__axis rr-heat__axis--impact">{RISK_IMPACT_LABELS[impact]}</div>
          ))}
        </>
      ) : null}
      {likelihoods.map((likelihood) => (
        <React.Fragment key={likelihood}>
          {showAxisLabels ? <div className="rr-heat__axis">{RISK_LIKELIHOOD_LABELS[likelihood]}</div> : null}
          {RISK_SCALE.map((impact) => {
            const cellItems = byCell.get(`${likelihood}:${impact}`) || [];
            const band = riskBand(likelihood, impact);
            return (
              <div key={impact} className={`rr-heat__cell rr-band--${band}`}>
                {cellItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === selectedId ? 'is-selected' : ''}
                    onClick={() => onSelect(item)}
                  >
                    {item.referenceCode} {item.title}
                  </button>
                ))}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

const RiskForm = ({
  drafting,
  selected,
  form,
  catalogs,
  busy,
  onFormChange,
  onLinksChange,
  onSave,
  onDelete,
  onExportOne,
}) => {
  if (!drafting && !selected) {
    return <p className="rr-form__empty">Details is where a risk is entered and edited.</p>;
  }

  return (
    <form
      className="talia-card rr-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="rr-form__grid">
        <Field label="Reference">
          <input value={form.referenceCode} onChange={(event) => onFormChange('referenceCode', event.target.value)} required />
        </Field>
        <Field label="Title">
          <input value={form.title} onChange={(event) => onFormChange('title', event.target.value)} required />
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={(event) => onFormChange('category', event.target.value)}>
            {RISK_CATEGORIES.map((value) => <option key={value} value={value}>{RISK_CATEGORY_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(event) => onFormChange('status', event.target.value)}>
            {RISK_STATUSES.map((value) => <option key={value} value={value}>{RISK_STATUS_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field label="Likelihood">
          <select value={form.likelihood} onChange={(event) => onFormChange('likelihood', Number(event.target.value))}>
            {RISK_SCALE.map((value) => <option key={value} value={value}>{value} · {RISK_LIKELIHOOD_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field label="Impact">
          <select value={form.impact} onChange={(event) => onFormChange('impact', Number(event.target.value))}>
            {RISK_SCALE.map((value) => <option key={value} value={value}>{value} · {RISK_IMPACT_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field label="Response">
          <select value={form.response} onChange={(event) => onFormChange('response', event.target.value)}>
            {RISK_RESPONSES.map((value) => <option key={value} value={value}>{RISK_RESPONSE_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field label="Proximity">
          <select value={form.proximity} onChange={(event) => onFormChange('proximity', event.target.value)}>
            {RISK_PROXIMITIES.map((value) => <option key={value} value={value}>{RISK_PROXIMITY_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field label="Owner">
          <input value={form.owner} onChange={(event) => onFormChange('owner', event.target.value)} />
        </Field>
        <Field label="Review">
          <input type="date" value={form.reviewOn || ''} onChange={(event) => onFormChange('reviewOn', event.target.value)} />
        </Field>
        <Field label="Residual likelihood">
          <select value={form.residualLikelihood} onChange={(event) => onFormChange('residualLikelihood', event.target.value === '' ? '' : Number(event.target.value))}>
            <option value="">—</option>
            {RISK_SCALE.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Residual impact">
          <select value={form.residualImpact} onChange={(event) => onFormChange('residualImpact', event.target.value === '' ? '' : Number(event.target.value))}>
            <option value="">—</option>
            {RISK_SCALE.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Statement">
        <textarea rows={4} value={form.statement} onChange={(event) => onFormChange('statement', event.target.value)} />
      </Field>
      <Field label="Treatment">
        <textarea rows={3} value={form.treatment} onChange={(event) => onFormChange('treatment', event.target.value)} />
      </Field>
      <Field label="Links">
        <RecordLinkEditor
          kinds={LINK_KINDS}
          catalogs={catalogs}
          links={form.links}
          onChange={onLinksChange}
        />
      </Field>
      <div className="talia-report__actions-bar">
        <button type="submit" className="talia-btn talia-btn--primary" disabled={busy}>Save</button>
        {selected && !drafting ? (
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onDelete} disabled={busy}>Delete</button>
        ) : null}
        {selected && !drafting ? (
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onExportOne} disabled={busy}>Export JSON</button>
        ) : null}
      </div>
    </form>
  );
};

const RiskRegisterPresenter = ({
  panelInstanceId,
  panelComponentId,
  reportShellClassName,
  display,
  showFilters,
  showDetails,
  showProvenance,
  showAxisLabels = true,
  items,
  totalCount,
  categoryFilter,
  statusFilter,
  onCategoryFilter,
  onStatusFilter,
  catalogs,
  selectedId,
  selected,
  drafting,
  form,
  busy,
  message,
  onSelect,
  onNew,
  onFormChange,
  onLinksChange,
  onSave,
  onDelete,
  onExportAll,
  onExportOne,
  onRefresh,
}) => {
  const exportItemsRef = useRef(items);
  exportItemsRef.current = items;
  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId: panelComponentId || 'risk-register',
    getPayload: () => payloadFromRows(
      'Risk Register',
      RISK_EXPORT_COLUMNS,
      (exportItemsRef.current || []).map(riskExportRow),
    ),
  }), [panelInstanceId, panelComponentId]);

  return (
  <div
    className={`focus-panel talia-report risk-register${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
    role="region"
    aria-label="Risk Register"
    data-panel-instance-id={panelInstanceId || undefined}
    data-panel-component-id={panelComponentId || undefined}
  >
    <header className="talia-report__header">
      <div className="talia-report__header-left">
        <h2 className="talia-report__title">Risk Register</h2>
        <p className="talia-report__subtitle">
          Cause, event, and effect · likelihood × impact sets the band
          {totalCount ? ` · ${items.length} of ${totalCount}` : ''}
        </p>
      </div>
    </header>

    <div className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`} aria-label="Risk filters">
      <label>
        Category
        <select value={categoryFilter} onChange={(event) => onCategoryFilter(event.target.value)}>
          <option value="all">All</option>
          {RISK_CATEGORIES.map((value) => <option key={value} value={value}>{RISK_CATEGORY_LABELS[value]}</option>)}
        </select>
      </label>
      <label>
        Status
        <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}>
          <option value="all">All</option>
          {RISK_STATUSES.map((value) => <option key={value} value={value}>{RISK_STATUS_LABELS[value]}</option>)}
        </select>
      </label>
    </div>

    <div className="talia-report__actions-bar">
      <button type="button" className="talia-btn talia-btn--primary" onClick={onNew} disabled={busy}>New risk</button>
      <button type="button" className="talia-btn talia-btn--secondary" onClick={onExportAll} disabled={busy || !totalCount}>Export JSON</button>
      <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} disabled={busy}>Refresh</button>
    </div>

    {message ? <p className="talia-callout">{message}</p> : null}

    <div className="talia-report__content">
      <div className="rr-stage">
      <div className="rr-board">
        {display === 'heat' ? (
          <HeatMap items={items} selectedId={selectedId} onSelect={onSelect} showAxisLabels={showAxisLabels} />
        ) : (
          <ul className="rr-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedId ? 'is-selected' : ''}
                  onClick={() => onSelect(item)}
                >
                  <span className={`rr-band rr-band--${bandOf(item)}`}>{item.referenceCode}</span>
                  <span className="rr-list__title">{item.title}</span>
                  <span className="rr-list__meta">
                    {RISK_STATUS_LABELS[item.status]} · {RISK_CATEGORY_LABELS[item.category]}
                    {item.owner ? ` · ${item.owner}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && !drafting ? (
        <RiskReading item={selected} />
      ) : (
        <p className="rr-reading rr-reading--empty">
          {drafting ? 'The new risk is edited in Details.' : 'Select a risk to read it.'}
        </p>
      )}
      </div>
    </div>

    <ReportDataDetails visible={showDetails}>
      <RiskForm
        drafting={drafting}
        selected={selected}
        form={form}
        catalogs={catalogs}
        busy={busy}
        onFormChange={onFormChange}
        onLinksChange={onLinksChange}
        onSave={onSave}
        onDelete={onDelete}
        onExportOne={onExportOne}
      />
    </ReportDataDetails>

    <ReportProvenance visible={showProvenance}>
      <p>
        Rows live in <code>public.risk_register_item</code>. Likelihood and impact are 1–5.
        The band is that cell: low, medium, high, or critical. Treatments link to the
        Requirements Log and the Functionality Matrix. Documents link back onto the risk.
      </p>
    </ReportProvenance>
  </div>
  );
};

export default RiskRegisterPresenter;
