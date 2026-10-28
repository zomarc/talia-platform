import React, { useMemo, useState } from 'react';
import './record-links.css';

const KIND_LABELS = {
  requirement: 'Requirement',
  matrix: 'Matrix',
  risk: 'Risk',
};

const RecordLinkEditor = ({ kinds, catalogs, links, onChange }) => {
  const [kind, setKind] = useState(kinds[0]?.id || 'requirement');
  const [query, setQuery] = useState('');
  const choices = useMemo(() => {
    const rows = catalogs?.[kind] || [];
    const needle = query.trim().toLowerCase();
    const selected = new Set((links || []).map((link) => `${link.targetKind}:${link.targetId}`));
    return rows
      .filter((row) => !selected.has(`${kind}:${row.id}`))
      .filter((row) => !needle || String(row.label || '').toLowerCase().includes(needle))
      .slice(0, 8);
  }, [catalogs, kind, query, links]);

  const add = (row) => {
    onChange([...(links || []), { targetKind: kind, targetId: row.id, label: row.label }]);
    setQuery('');
  };

  const remove = (link) => {
    onChange((links || []).filter((item) => !(item.targetKind === link.targetKind && item.targetId === link.targetId)));
  };

  return (
    <div className="record-links">
      <div className="record-links__current">
        {(links || []).length ? (links || []).map((link) => (
          <button
            key={`${link.targetKind}:${link.targetId}`}
            type="button"
            className="record-links__chip"
            onClick={() => remove(link)}
            title="Remove link"
          >
            {KIND_LABELS[link.targetKind] || link.targetKind}: {link.label || link.targetId}
          </button>
        )) : <span className="record-links__empty">No links yet.</span>}
      </div>
      <div className="record-links__add">
        <select
          className="talia-report-filters__input"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          aria-label="Record type"
        >
          {kinds.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <input
          className="talia-report-filters__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a record"
          aria-label="Find a record to link"
        />
      </div>
      {choices.length ? (
        <ul className="record-links__choices">
          {choices.map((row) => (
            <li key={row.id}>
              <button type="button" className="record-links__choice" onClick={() => add(row)}>{row.label}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default RecordLinkEditor;
