import React from 'react';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

const TYPE_ICON = {
  note: '✎',
  ops: '⚙',
  pricing: '€',
  risk: '!',
};

const typeIcon = (memoType) => TYPE_ICON[String(memoType || 'note').toLowerCase()] || '✎';

const InventoryMemoPresenter = ({
  selection,
  subtitle,
  inventoryItem,
  memos,
  mmsi,
  memoText,
  memoType,
  saving,
  setMmsi,
  setMemoText,
  setMemoType,
  onSaveMemo,
  panelInstanceId,
  panelComponentId,
}) => {
  const { showDetails, isCompact, reportShellClassName } = useReportShellOptions(
    panelComponentId || 'inventory-memo',
    panelInstanceId
  );

  return (
    <div className={`talia-report inventory-memo ${reportShellClassName || ''}`}>
      <header className="talia-report__header">
        <h2 className="talia-report__title">Inventory Memos</h2>
      </header>

      {showDetails ? (
        <section className="inventory-memo__details" aria-label="Inventory details">
          <p className="talia-report__subtitle">{subtitle}</p>
          <div className="inventory-memo__chips">
            {inventoryItem?.id && <span className="inventory-memo__chip">Item ID: {inventoryItem.id}</span>}
            {inventoryItem?.localKey && <span className="inventory-memo__chip">Key: {inventoryItem.localKey}</span>}
            <span className="inventory-memo__context">
              Sail: {selection.sailCode || 'N/A'} | Ship: {selection.shipCode || 'N/A'}
            </span>
          </div>
        </section>
      ) : null}

      <section className="inventory-memo__editor">
        <div className="inventory-memo__row">
          <label className="inventory-memo__field">
            <span>MMSI</span>
            <input
              className="inventory-memo__input"
              value={mmsi}
              onChange={(e) => setMmsi(e.target.value)}
              placeholder="Optional for stronger mapping"
            />
          </label>
          <label className="inventory-memo__field">
            <span>Type</span>
            <select
              className="inventory-memo__input"
              value={memoType}
              onChange={(e) => setMemoType(e.target.value)}
            >
              <option value="note">note</option>
              <option value="ops">ops</option>
              <option value="pricing">pricing</option>
              <option value="risk">risk</option>
            </select>
          </label>
        </div>

        <label className="inventory-memo__field">
          <span>Memo</span>
          <textarea
            className="inventory-memo__textarea"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="Add contextual notes linked to this inventory item..."
            rows={4}
          />
        </label>

        <div className="inventory-memo__actions">
          <button
            type="button"
            className="talia-btn talia-btn--primary"
            onClick={onSaveMemo}
            disabled={saving || !memoText.trim()}
          >
            {saving ? 'Saving...' : 'Save Memo'}
          </button>
        </div>
      </section>

      <section className="inventory-memo__list">
        <h3 className="inventory-memo__list-title">Memo History</h3>
        {memos.length === 0 ? (
          <div className="inventory-memo__empty">No memos yet for this inventory item.</div>
        ) : (
          <ul className="inventory-memo__items">
            {memos.map((memo) => {
              const kind = memo.memoType || 'note';
              return (
                <li
                  key={memo.id}
                  className={`inventory-memo__item${isCompact ? ' inventory-memo__item--compact' : ''}`}
                >
                  <div className="inventory-memo__item-head">
                    <span className="inventory-memo__type" title={kind}>
                      <span className="inventory-memo__type-icon" aria-hidden="true">{typeIcon(kind)}</span>
                      {isCompact ? null : <span>{kind}</span>}
                    </span>
                    <span className="inventory-memo__meta">{formatDateTime(memo.createdAt)}</span>
                    {isCompact && memo.createdBy ? (
                      <span className="inventory-memo__meta">{memo.createdBy}</span>
                    ) : null}
                  </div>
                  <p className="inventory-memo__text">{memo.memoText}</p>
                  {!isCompact && memo.createdBy ? (
                    <div className="inventory-memo__meta">By: {memo.createdBy}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default InventoryMemoPresenter;
