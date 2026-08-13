import React, { useEffect, useState } from 'react';
import {
  loadRoleCriteria,
  loadRoleComponentOps,
  saveRoleCriteria,
  saveRoleComponentOps,
} from '../../../services/data/roleCriteriaService';
import { DEFAULT_COMPONENT_OPTIONS } from '../../../lib/componentOptionsCatalog';

const ROLES = ['GUEST', 'USER', 'MANAGER', 'ADMIN'];

const AdminRoleCriteriaPanel = () => {
  const [role, setRole] = useState('USER');
  const [criteriaText, setCriteriaText] = useState('{\n  "rangeKey": "all_future"\n}');
  const [opsText, setOpsText] = useState('{}');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('Loading…');
      try {
        const [criteria, ops] = await Promise.all([
          loadRoleCriteria(role, { component: 'AdminRoleCriteria' }),
          loadRoleComponentOps(role, { component: 'AdminRoleCriteria' }),
        ]);
        if (cancelled) return;
        const { role: _r, updatedAt: _u, ...criteriaBody } = criteria || {};
        const { role: _or, updatedAt: _ou, ...opsBody } = ops || {};
        setCriteriaText(JSON.stringify(criteriaBody, null, 2));
        setOpsText(JSON.stringify(Object.keys(opsBody).length ? opsBody : {
          'cabin-deck-inventory': { allocate: role !== 'GUEST' && role !== 'USER' },
          'master-sailing-explorer': { showFilters: true, columnFilters: true },
        }, null, 2));
        setStatus('');
      } catch (error) {
        if (!cancelled) setStatus(error?.message || 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const criteria = JSON.parse(criteriaText || '{}');
      const ops = JSON.parse(opsText || '{}');
      await saveRoleCriteria(role, criteria, { component: 'AdminRoleCriteria' });
      await saveRoleComponentOps(role, ops, { component: 'AdminRoleCriteria' });
      setStatus(`Saved baseline for ${role}`);
    } catch (error) {
      setStatus(error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="talia-report admin-role-criteria" role="region" aria-label="Role criteria">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Role criteria &amp; operations</h2>
          <p className="talia-report__subtitle">
            Role baseline global criteria (always applied) and per-component Operations allow-list.
            Users inherit criteria and may personalize deltas; Admin can override a user via profile.
          </p>
        </div>
      </header>
      <div className="talia-report__controls" aria-label="Role selector">
        <label className="dashboard-form-label" htmlFor="admin-role-criteria-role">Role</label>
        <select
          id="admin-role-criteria-role"
          className="dashboard-form-input"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          {ROLES.map((entry) => (
            <option key={entry} value={entry}>{entry}</option>
          ))}
        </select>
        <button
          type="button"
          className="talia-btn talia-btn--primary"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save role baseline'}
        </button>
        {status ? <span className="dashboard-form-hint">{status}</span> : null}
      </div>
      <div className="talia-report__content admin-role-criteria__grid">
        <label className="dashboard-form-group">
          <span className="dashboard-form-label">Role global criteria (JSON)</span>
          <textarea
            className="dashboard-form-input"
            rows={16}
            value={criteriaText}
            onChange={(event) => setCriteriaText(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="dashboard-form-group">
          <span className="dashboard-form-label">
            Role component ops allow-list (JSON)
            <span className="dashboard-form-hint">
              {' '}Catalog keys: {Object.keys(DEFAULT_COMPONENT_OPTIONS).join(', ')}
            </span>
          </span>
          <textarea
            className="dashboard-form-input"
            rows={16}
            value={opsText}
            onChange={(event) => setOpsText(event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>
    </div>
  );
};

export default AdminRoleCriteriaPanel;
