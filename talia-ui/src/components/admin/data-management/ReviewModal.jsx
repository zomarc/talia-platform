import React from 'react';

const DEFAULT_LIMIT = 100;

const buildActiveFilters = (draft) => {
  const next = {};
  if (draft.sail_code?.trim()) next.sail_code = draft.sail_code.trim();
  if (draft.ship_code?.trim()) next.ship_code = draft.ship_code.trim();
  if (draft.include_non_real_sailings) next.include_non_real_sailings = true;
  if (draft.query_column?.trim() && draft.query_value?.trim()) {
    next.query_column = draft.query_column.trim();
    next.query_value = draft.query_value.trim();
    next.query_operator = draft.query_operator || 'contains';
  }
  return next;
};

const ReviewModal = ({ reviewData, onClose, onQuery }) => {
  const tableName = reviewData?.tableName || '';
  const [limit, setLimit] = React.useState(reviewData?.limit || DEFAULT_LIMIT);
  const [rows, setRows] = React.useState(Array.isArray(reviewData?.data) ? reviewData.data : []);
  const [queryError, setQueryError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({
    sail_code: '',
    ship_code: '',
    include_non_real_sailings: false,
    query_column: '',
    query_value: '',
    query_operator: 'contains',
  });

  const runQuery = React.useCallback(async (nextLimit = limit, nextFilters = filters) => {
    if (typeof onQuery !== 'function' || !tableName) return;
    setLoading(true);
    setQueryError('');
    try {
      const result = await onQuery({
        tableName,
        limit: Number(nextLimit) || DEFAULT_LIMIT,
        filters: buildActiveFilters(nextFilters),
      });
      setRows(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      setRows([]);
      setQueryError(error?.message || 'Failed to load table data');
    } finally {
      setLoading(false);
    }
  }, [filters, limit, onQuery, tableName]);

  React.useEffect(() => {
    if (!tableName) return;
    setLimit(reviewData?.limit || DEFAULT_LIMIT);
    setRows(Array.isArray(reviewData?.data) ? reviewData.data : []);
    setQueryError('');
    setFilters({
      sail_code: '',
      ship_code: '',
      include_non_real_sailings: false,
      query_column: '',
      query_value: '',
      query_operator: 'contains',
    });
    runQuery(reviewData?.limit || DEFAULT_LIMIT, {
      sail_code: '',
      ship_code: '',
      include_non_real_sailings: false,
      query_column: '',
      query_value: '',
      query_operator: 'contains',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName]);

  if (!reviewData) return null;

  return (
    <div onClick={onClose} className="dm-review-overlay">
      <div
        onClick={(e) => e.stopPropagation()}
        className="dm-review-modal"
      >
        <div className="dm-review-header">
          <h2 className="dm-review-title">
            👁️ Review: {reviewData.tableName}
          </h2>
          <button
            onClick={onClose}
            className="dm-review-close"
          >
            ✕ Close
          </button>
        </div>
        <div className="dm-review-controls">
          <label className="dm-review-control">
            <span>Limit</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={limit}
              onChange={(event) => setLimit(Math.max(1, Math.min(1000, Number(event.target.value || DEFAULT_LIMIT))))}
            />
          </label>
          <label className="dm-review-control">
            <span>Sail Code</span>
            <input
              type="text"
              value={filters.sail_code}
              onChange={(event) => setFilters((prev) => ({ ...prev, sail_code: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="dm-review-control">
            <span>Ship Code</span>
            <input
              type="text"
              value={filters.ship_code}
              onChange={(event) => setFilters((prev) => ({ ...prev, ship_code: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          <label className="dm-review-control">
            <span>Column</span>
            <input
              type="text"
              value={filters.query_column}
              onChange={(event) => setFilters((prev) => ({ ...prev, query_column: event.target.value }))}
              placeholder="e.g. sail_code"
            />
          </label>
          <label className="dm-review-control">
            <span>Operator</span>
            <select
              value={filters.query_operator}
              onChange={(event) => setFilters((prev) => ({ ...prev, query_operator: event.target.value }))}
            >
              <option value="contains">contains</option>
              <option value="eq">equals</option>
              <option value="neq">not equals</option>
              <option value="starts_with">starts with</option>
              <option value="ends_with">ends with</option>
              <option value="gt">greater than</option>
              <option value="gte">greater or equal</option>
              <option value="lt">less than</option>
              <option value="lte">less or equal</option>
            </select>
          </label>
          <label className="dm-review-control">
            <span>Value</span>
            <input
              type="text"
              value={filters.query_value}
              onChange={(event) => setFilters((prev) => ({ ...prev, query_value: event.target.value }))}
              placeholder="Filter value"
            />
          </label>
          <label className="dm-review-control dm-review-control--checkbox">
            <input
              type="checkbox"
              checked={filters.include_non_real_sailings}
              onChange={(event) => setFilters((prev) => ({ ...prev, include_non_real_sailings: event.target.checked }))}
            />
            <span>Include non-real sailings</span>
          </label>
          <button type="button" className="talia-btn talia-btn--small" onClick={() => runQuery()} disabled={loading}>
            {loading ? '⏳ Querying...' : 'Apply Query'}
          </button>
        </div>
        <div className="dm-review-body">
          {queryError ? <div className="dm-review-error">❌ {queryError}</div> : null}
          {loading ? (
            <div className="dm-review-empty">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="dm-review-empty">
              No data found
            </div>
          ) : (
            <table
              className="review-table dm-review-table"
            >
              <thead>
                <tr
                  className="dm-review-table-head"
                >
                  {Object.keys(rows[0]).map(col => (
                    <th
                      key={col}
                      className="dm-review-header-cell"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`dm-review-row ${idx % 2 === 0 ? 'review-row-even' : 'review-row-odd'}`}
                  >
                    {Object.values(row).map((val, colIdx) => (
                      <td
                        key={colIdx}
                        className="dm-review-cell"
                        title={String(val)}
                      >
                        {val === null || val === undefined ? (
                          <span className="dm-review-null">NULL</span>
                        ) : typeof val === 'object' ? (
                          JSON.stringify(val)
                        ) : (
                          String(val)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
