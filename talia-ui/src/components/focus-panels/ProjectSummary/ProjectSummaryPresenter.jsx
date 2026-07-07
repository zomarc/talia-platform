/**
 * Project Summary Presenter — renders the stored executive overview HTML
 * in a sandboxed iframe (self-contained branded document, our own content).
 */

import React from 'react';

const formatTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ProjectSummaryPresenter = ({ summary, onRefresh }) => {
  const generatedAt = formatTimestamp(summary?.generatedAt);

  return (
    <div className="talia-report" role="region" aria-label="Project summary">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">{summary?.title || 'Project Summary'}</h2>
          <p className="talia-report__subtitle">
            {summary?.version ? `${summary.version} · ` : ''}
            {generatedAt ? `Published ${generatedAt}` : 'Latest executive overview'}
          </p>
        </div>
        {onRefresh ? (
          <div className="talia-report__header-right">
            <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
              Refresh
            </button>
          </div>
        ) : null}
      </header>
      <main className="talia-report__content" style={{ padding: 0 }}>
        <iframe
          title={summary?.title || 'Project Summary'}
          srcDoc={summary?.content || ''}
          sandbox=""
          style={{
            width: '100%',
            height: '100%',
            minHeight: '600px',
            border: 'none',
            display: 'block'
          }}
        />
      </main>
    </div>
  );
};

export default ProjectSummaryPresenter;
