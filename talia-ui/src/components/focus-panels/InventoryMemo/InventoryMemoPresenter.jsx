import React from 'react';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

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
  onSaveMemo
}) => (
  <div className="inventory-memo">
    <header className="inventory-memo__header">
      <div>
        <h2 className="inventory-memo__title">Inventory Memos</h2>
        <p className="inventory-memo__subtitle">{subtitle}</p>
      </div>
      <div className="inventory-memo__chips">
        {inventoryItem?.id && <span className="inventory-memo__chip">Item ID: {inventoryItem.id}</span>}
        {inventoryItem?.localKey && <span className="inventory-memo__chip">Key: {inventoryItem.localKey}</span>}
      </div>
    </header>

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
          className="talia-btn talia-btn--primary"
          onClick={onSaveMemo}
          disabled={saving || !memoText.trim()}
        >
          {saving ? 'Saving...' : 'Save Memo'}
        </button>
        <span className="inventory-memo__context">
          Sail: {selection.sailCode || 'N/A'} | Ship: {selection.shipCode || 'N/A'}
        </span>
      </div>
    </section>

    <section className="inventory-memo__list">
      <h3 className="inventory-memo__list-title">Memo History</h3>
      {memos.length === 0 ? (
        <div className="inventory-memo__empty">No memos yet for this inventory item.</div>
      ) : (
        <ul className="inventory-memo__items">
          {memos.map((memo) => (
            <li key={memo.id} className="inventory-memo__item">
              <div className="inventory-memo__item-head">
                <span className="inventory-memo__type">{memo.memoType || 'note'}</span>
                <span className="inventory-memo__meta">{formatDateTime(memo.createdAt)}</span>
              </div>
              <p className="inventory-memo__text">{memo.memoText}</p>
              {memo.createdBy && <div className="inventory-memo__meta">By: {memo.createdBy}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>
);

export default InventoryMemoPresenter;
