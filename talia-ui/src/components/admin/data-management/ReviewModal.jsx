import React from 'react';

const ReviewModal = ({ reviewData, onClose }) => {
  if (!reviewData) return null;

  return (
    <div onClick={onClose} className="dm-review-overlay">
      <div
        onClick={(e) => e.stopPropagation()}
        className="dm-review-modal"
      >
        <div className="dm-review-header">
          <h2 className="dm-review-title">
            👁️ Review: {reviewData.tableName} (Top 100 rows)
          </h2>
          <button
            onClick={onClose}
            className="dm-review-close"
          >
            ✕ Close
          </button>
        </div>
        <div className="dm-review-body">
          {reviewData.data.length === 0 ? (
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
                  {Object.keys(reviewData.data[0]).map(col => (
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
                {reviewData.data.map((row, idx) => (
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
