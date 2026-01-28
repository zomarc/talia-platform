import React from 'react';

const ReviewModal = ({ theme, reviewData, onClose }) => {
  if (!reviewData) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '12px',
          border: `1px solid ${theme.colors.glassBorder}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          width: '100%'
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.colors.glassBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '14px', color: theme.colors.foreground }}>
            👁️ Review: {reviewData.tableName} (Top 100 rows)
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.glassBorder}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✕ Close
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px'
          }}
        >
          {reviewData.data.length === 0 ? (
            <div style={{ color: theme.colors.textMuted, textAlign: 'center', padding: '40px' }}>
              No data found
            </div>
          ) : (
            <table
              className="review-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                fontFamily: 'monospace'
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderBottom: `2px solid ${theme.colors.glassBorder}`
                  }}
                >
                  {Object.keys(reviewData.data[0]).map(col => (
                    <th
                      key={col}
                      style={{
                        padding: '6px 8px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: theme.colors.foreground,
                        fontSize: '9px',
                        position: 'sticky',
                        top: 0,
                        background: 'rgba(15, 15, 35, 0.95)'
                      }}
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
                    className={idx % 2 === 0 ? 'review-row-even' : 'review-row-odd'}
                    style={{
                      borderBottom: `1px solid ${theme.colors.glassBorder}`
                    }}
                  >
                    {Object.values(row).map((val, colIdx) => (
                      <td
                        key={colIdx}
                        style={{
                          padding: '6px 8px',
                          color: theme.colors.textSecondary,
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={String(val)}
                      >
                        {val === null || val === undefined ? (
                          <span style={{ color: theme.colors.textMuted }}>NULL</span>
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
