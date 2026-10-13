/**
 * Empty report frame. Caption and wireframe come from this instance's Views.
 */

import React from 'react';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';

const viewValue = (views, id, fallback) => {
  const entry = (views || []).find((view) => view.id === id);
  if (!entry || entry.value == null) return fallback;
  return entry.value;
};

const PlaceHolderPresenter = ({
  panelInstanceId = null,
  panelComponentId = null,
}) => {
  const { views, reportShellClassName } = useReportShellOptions(
    panelComponentId || 'ui-placeholder',
    panelInstanceId
  );
  const caption = String(viewValue(views, 'caption', 'Place Holder')).trim();
  const showWireframe = viewValue(views, 'wireframe', true) !== false;

  return (
    <div
      className={`focus-panel talia-report ui-placeholder ${reportShellClassName}`}
      role="region"
      aria-label="Place holder"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Place Holder</h2>
          <span className="talia-report__subtitle">Empty slot for a future report</span>
        </div>
      </header>
      <main className="talia-report__content">
        <div className={`ui-placeholder__stage${showWireframe ? ' ui-placeholder__stage--wireframe' : ''}`}>
          {showWireframe ? (
            <svg className="ui-placeholder__x" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line x1="0" y1="0" x2="100" y2="100" />
              <line x1="100" y1="0" x2="0" y2="100" />
            </svg>
          ) : null}
          {caption ? <p className="ui-placeholder__caption">{caption}</p> : null}
        </div>
      </main>
    </div>
  );
};

export default PlaceHolderPresenter;
