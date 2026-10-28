/**
 * Functionality Matrix presenter — compact grid or list, and the specification card.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import LinkedDocuments from '../../shared/LinkedDocuments';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import { payloadFromRows, registerPanelDataExport } from '../../../lib/panelDataExport';
import {
  MATRIX_PHASES,
  MATRIX_PHASE_LABELS,
  MATRIX_RANKS,
  groupMatrixRows,
  phaseLabel,
  rankPair,
} from '../../../lib/functionalityMatrix';
import './functionality-matrix.css';

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Field = ({ label, children }) => (
  <label className="fm-field">
    <span className="fm-field__label">{label}</span>
    {children}
  </label>
);

const MatrixCell = ({ item, selected, onSelect, showAxisLabels }) => (
  <button
    type="button"
    className={`fm-cell fm-cell--phase-${item.phase}${selected ? ' is-selected' : ''}`}
    onClick={() => onSelect(item)}
    aria-pressed={selected}
    title={`${item.referenceCode} ${item.name} · ${phaseLabel(item.phase)} · ${rankPair(item)}`}
  >
    {showAxisLabels ? <span className="fm-cell__rank">{rankPair(item)}</span> : null}
    <span className="fm-cell__name">{item.shortName}</span>
  </button>
);

const ReadingBlock = ({ label, text }) => {
  if (!text) return null;
  return (
    <p className="fm-reading__block">
      <span className="fm-reading__label">{label}</span>
      {text}
    </p>
  );
};

const MatrixReading = ({ item }) => {
  const notes = item.notes || [];
  const links = item.links || [];
  return (
    <article className="fm-reading" aria-label={`${item.referenceCode} ${item.name}`}>
      <header className="fm-reading__head">
        <strong>{item.referenceCode}</strong>
        <span className="fm-reading__name">{item.name}</span>
        <span className="fm-reading__meta">
          {item.element} · {item.functionName} · {rankPair(item)} · {phaseLabel(item.phase)}
        </span>
      </header>
      <ReadingBlock label="Concept" text={item.concept} />
      <ReadingBlock label="Rationale" text={item.rationale} />
      <ReadingBlock label="Technical" text={item.technicalRequirement} />
      {notes.length > 0 ? (
        <div className="fm-reading__block">
          <span className="fm-reading__label">Discussion</span>
          <ul className="fm-reading__notes">
            {notes.map((note) => <li key={note.id}>{note.body}</li>)}
          </ul>
        </div>
      ) : null}
      {links.length > 0 ? (
        <p className="fm-reading__block">
          <span className="fm-reading__label">Assigned</span>
          {links.map((link) => link.title || link.requirementItemId).filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <LinkedDocuments targetKind="matrix" targetId={item.id} />
    </article>
  );
};

const MatrixSpec = ({
  drafting,
  selected,
  form,
  logItems,
  noteDraft,
  busy,
  onFormChange,
  onToggleAssignment,
  onNoteDraft,
  onSave,
  onDelete,
  onAddNote,
  onDeleteNote,
  onExportOne,
  elements,
}) => {
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const assigned = new Set(form.assignedIds || []);
  const query = assignmentQuery.trim().toLowerCase();

  const assignmentRows = useMemo(() => {
    const matched = (logItems || []).filter((item) => {
      if (assigned.has(item.id)) return true;
      if (!query) return false;
      const haystack = `${item.title || ''} ${item.section || ''} ${item.status || ''}`.toLowerCase();
      return haystack.includes(query);
    });
    const checked = matched.filter((item) => assigned.has(item.id));
    const rest = matched.filter((item) => !assigned.has(item.id)).slice(0, 40);
    return [...checked, ...rest];
  }, [logItems, assigned, query]);

  const showSpec = drafting || selected;
  if (!showSpec) {
    return (
      <p className="fm-spec__empty">Details is where a requirement is entered and edited.</p>
    );
  }

  return (
    <form
      className="talia-card fm-spec"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="fm-spec__grid">
        <Field label="Reference">
          <input
            value={form.referenceCode}
            onChange={(event) => onFormChange('referenceCode', event.target.value)}
            placeholder="R001"
            required
          />
        </Field>
        <Field label="Short name">
          <input
            value={form.shortName}
            onChange={(event) => onFormChange('shortName', event.target.value)}
            required
          />
        </Field>
        <Field label="Requirement name">
          <input
            className="fm-field__wide"
            value={form.name}
            onChange={(event) => onFormChange('name', event.target.value)}
            required
          />
        </Field>
        <Field label="Element">
          <input
            value={form.element}
            onChange={(event) => onFormChange('element', event.target.value)}
            list="fm-elements"
            placeholder="UI, Engine, Server"
            required
          />
          <datalist id="fm-elements">
            {elements.map((name) => <option key={name} value={name} />)}
          </datalist>
        </Field>
        <Field label="Function">
          <input
            value={form.functionName}
            onChange={(event) => onFormChange('functionName', event.target.value)}
            placeholder="Regulator, Admin, Forecasting"
            required
          />
        </Field>
        <Field label="Complexity">
          <select value={form.complexity} onChange={(event) => onFormChange('complexity', event.target.value)}>
            {MATRIX_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
          </select>
        </Field>
        <Field label="Size">
          <select value={form.size} onChange={(event) => onFormChange('size', event.target.value)}>
            {MATRIX_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
          </select>
        </Field>
        <Field label="Phase">
          <select value={form.phase} onChange={(event) => onFormChange('phase', event.target.value)}>
            {MATRIX_PHASES.map((phase) => (
              <option key={phase} value={phase}>{MATRIX_PHASE_LABELS[phase]}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Concept">
        <textarea
          rows={3}
          value={form.concept}
          onChange={(event) => onFormChange('concept', event.target.value)}
          placeholder="High-level concept of the requirement"
        />
      </Field>
      <Field label="Rationale">
        <textarea
          rows={3}
          value={form.rationale}
          onChange={(event) => onFormChange('rationale', event.target.value)}
          placeholder="Why this requirement exists"
        />
      </Field>

      <section className="fm-discussion" aria-label="Discussion">
        <h3 className="fm-spec__heading">Discussion</h3>
        {drafting ? (
          <p className="fm-spec__hint">Save the requirement before adding discussion.</p>
        ) : (
          <>
            <ul className="fm-notes">
              {(selected?.notes || []).length === 0 ? (
                <li className="fm-spec__hint">No discussion yet.</li>
              ) : (selected.notes || []).map((note) => (
                <li key={note.id} className="fm-note">
                  <p>{note.body}</p>
                  <div className="fm-note__meta">
                    <span>{formatWhen(note.createdAt)}</span>
                    <button type="button" onClick={() => onDeleteNote(note.id)} disabled={busy}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="fm-note__compose">
              <textarea
                rows={2}
                value={noteDraft}
                onChange={(event) => onNoteDraft(event.target.value)}
                placeholder="Add a discussion note"
              />
              <button type="button" className="talia-btn talia-btn--secondary" onClick={onAddNote} disabled={busy || !noteDraft.trim()}>
                Add note
              </button>
            </div>
          </>
        )}
      </section>

      <Field label="Technical requirement">
        <textarea
          rows={4}
          value={form.technicalRequirement}
          onChange={(event) => onFormChange('technicalRequirement', event.target.value)}
          placeholder="Formal technical requirement, written once the discussion settles"
        />
      </Field>

      <section className="fm-assign" aria-label="Assigned requirements">
        <h3 className="fm-spec__heading">Assigned requirements</h3>
        <p className="fm-spec__hint">Items from the Requirements Log. Assignment is saved with this specification.</p>
        <input
          type="search"
          value={assignmentQuery}
          onChange={(event) => setAssignmentQuery(event.target.value)}
          placeholder="Search the log to assign"
          aria-label="Search Requirements Log"
        />
        <ul className="fm-assign__list">
          {assignmentRows.length === 0 ? (
            <li className="fm-spec__hint">
              {query ? 'No log items match.' : 'Search to assign a Requirements Log item.'}
            </li>
          ) : assignmentRows.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={assigned.has(item.id)}
                  onChange={() => onToggleAssignment(item.id)}
                />
                <span>{item.title}</span>
                <span className="fm-assign__meta">{item.section} · {item.status}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="fm-spec__actions">
        <button type="submit" className="talia-btn talia-btn--primary" disabled={busy}>
          Save specification
        </button>
        {!drafting && (
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onExportOne} disabled={busy}>
            Export JSON
          </button>
        )}
        {!drafting && (
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onDelete} disabled={busy}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
};

const FM_EXPORT_COLUMNS = [
  { field: 'referenceCode', title: 'Reference' },
  { field: 'shortName', title: 'Short name' },
  { field: 'name', title: 'Name' },
  { field: 'element', title: 'Element' },
  { field: 'functionName', title: 'Function' },
  { field: 'complexity', title: 'Complexity' },
  { field: 'size', title: 'Size' },
  { field: 'phase', title: 'Phase' },
  { field: 'concept', title: 'Concept' },
  { field: 'rationale', title: 'Rationale' },
  { field: 'technicalRequirement', title: 'Technical' },
  { field: 'links', title: 'Assigned' },
];

const matrixExportRow = (item) => ({
  referenceCode: item.referenceCode || '',
  shortName: item.shortName || '',
  name: item.name || '',
  element: item.element || '',
  functionName: item.functionName || '',
  complexity: item.complexity || '',
  size: item.size || '',
  phase: phaseLabel(item.phase),
  concept: item.concept || '',
  rationale: item.rationale || '',
  technicalRequirement: item.technicalRequirement || '',
  links: (item.links || []).map((link) => link.title || link.requirementItemId).filter(Boolean).join('; '),
});

const FunctionalityMatrixPresenter = ({
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
  elements,
  elementFilter,
  phaseFilter,
  onElementFilter,
  onPhaseFilter,
  logItems,
  selectedId,
  selected,
  drafting,
  form,
  noteDraft,
  busy,
  message,
  onSelect,
  onNew,
  onFormChange,
  onToggleAssignment,
  onNoteDraft,
  onSave,
  onDelete,
  onAddNote,
  onDeleteNote,
  onExportAll,
  onExportOne,
  onRefresh,
}) => {
  const exportItemsRef = useRef(items);
  exportItemsRef.current = items;
  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId: panelComponentId || 'functionality-matrix',
    getPayload: () => payloadFromRows(
      'Functionality Matrix',
      FM_EXPORT_COLUMNS,
      (exportItemsRef.current || []).map(matrixExportRow),
    ),
  }), [panelInstanceId, panelComponentId]);

  const rows = useMemo(() => groupMatrixRows(items), [items]);
  const listItems = useMemo(() => [...items].sort((a, b) => {
    const byElement = String(a.element || '').localeCompare(String(b.element || ''));
    if (byElement !== 0) return byElement;
    return String(a.referenceCode || '').localeCompare(String(b.referenceCode || ''), undefined, { numeric: true });
  }), [items]);

  return (
    <div
      className={`focus-panel talia-report functionality-matrix${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
      role="region"
      aria-label="Functionality Matrix"
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={panelComponentId || undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Functionality Matrix</h2>
          <p className="talia-report__subtitle">
            Requirements by element · complexity/size on each cell · phase sets the colour
            {totalCount ? ` · ${items.length} of ${totalCount}` : ''}
          </p>
        </div>
      </header>

      <div
        className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
        aria-label="Functionality Matrix filters"
      >
        <label>
          Element
          <select value={elementFilter} onChange={(event) => onElementFilter(event.target.value)}>
            <option value="all">All</option>
            {elements.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          Phase
          <select value={phaseFilter} onChange={(event) => onPhaseFilter(event.target.value)}>
            <option value="all">All</option>
            {MATRIX_PHASES.map((phase) => (
              <option key={phase} value={phase}>{MATRIX_PHASE_LABELS[phase]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="talia-report__actions-bar" aria-label="Functionality Matrix actions">
        <button type="button" className="talia-btn talia-btn--primary" onClick={onNew} disabled={busy}>
          New requirement
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onExportAll} disabled={busy || totalCount === 0}>
          Export JSON
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} disabled={busy}>
          Refresh
        </button>
      </div>

      <ReportProvenance visible={showProvenance} title="Provenance">
        Cells are stored in the local tables functionality_matrix_item, functionality_matrix_note, and functionality_matrix_link.
        Requirements Log rows stay in talia_requirement_item and are assigned onto a cell by link.
      </ReportProvenance>

      {message ? <div className="talia-callout" role="status">{message}</div> : null}

      <div className="talia-report__content">
        <div className="fm-stage">
        <div className="fm-main">
        {showAxisLabels ? (
          <div className="fm-legend" aria-label="Phase colours">
            {MATRIX_PHASES.map((phase) => (
              <span key={phase} className={`fm-legend__swatch fm-cell--phase-${phase}`}>{MATRIX_PHASE_LABELS[phase]}</span>
            ))}
          </div>
        ) : null}
        <div className="fm-board">
        {items.length === 0 ? (
          <div className="talia-callout">No requirements in this view. Add one to start the matrix.</div>
        ) : display === 'list' ? (
          <table className="fm-list">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Short name</th>
                <th>Name</th>
                <th>Element</th>
                <th>Function</th>
                <th>Complexity</th>
                <th>Size</th>
                <th>Phase</th>
              </tr>
            </thead>
            <tbody>
              {listItems.map((item) => (
                <tr
                  key={item.id}
                  className={item.id === selectedId ? 'is-selected' : undefined}
                  onClick={() => onSelect(item)}
                >
                  <td>{item.referenceCode}</td>
                  <td>{item.shortName}</td>
                  <td>{item.name}</td>
                  <td>{item.element}</td>
                  <td>{item.functionName}</td>
                  <td>{item.complexity}</td>
                  <td>{item.size}</td>
                  <td><span className={`fm-legend__swatch fm-cell--phase-${item.phase}`}>{phaseLabel(item.phase)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="fm-grid" role="list">
            {rows.map((row) => (
              <div key={row.element} className="fm-row" role="listitem">
                <div className="fm-row__label">{row.element}</div>
                <div className="fm-cells">
                  {row.items.map((item) => (
                    <MatrixCell
                      key={item.id}
                      item={item}
                      selected={item.id === selectedId}
                      onSelect={onSelect}
                      showAxisLabels={showAxisLabels}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        </div>
        {selected && !drafting ? (
          <MatrixReading item={selected} />
        ) : (
          <p className="fm-reading fm-reading--empty">
            {drafting ? 'The new requirement is edited in Details.' : 'Select a cell to read the requirement.'}
          </p>
        )}
        </div>
      </div>

      <ReportDataDetails visible={showDetails}>
        <MatrixSpec
          drafting={drafting}
          selected={selected}
          form={form}
          logItems={logItems}
          noteDraft={noteDraft}
          busy={busy}
          elements={elements}
          onFormChange={onFormChange}
          onToggleAssignment={onToggleAssignment}
          onNoteDraft={onNoteDraft}
          onSave={onSave}
          onDelete={onDelete}
          onAddNote={onAddNote}
          onDeleteNote={onDeleteNote}
          onExportOne={onExportOne}
        />
      </ReportDataDetails>
    </div>
  );
};

export default FunctionalityMatrixPresenter;
