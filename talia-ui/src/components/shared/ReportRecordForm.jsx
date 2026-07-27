/**
 * Single-row vertical record form + optional table/form swap helper.
 *
 * Multi-row path must stay a normal React Tabulator host (no imperative DOM,
 * no layout overrides). Single-row path shows a compact label/value form.
 *
 * Import shouldShowReportRecordForm from lib/reportRecordForm.js (not here)
 * so Fast Refresh stays compatible.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  buildReportRecordFields,
  shouldShowReportRecordForm,
} from '../../lib/reportRecordForm';

/**
 * When data has exactly one row, show a compact vertical form and keep the
 * Tabulator host mounted but hidden. Otherwise render only the normal table host.
 */
export const ReportTableOrRecord = ({
  data,
  columns,
  tableRef,
  tableClassName = 'talia-table',
  tableProps = {},
  onRecordActive = null,
  ariaLabel = 'Record details',
  emptyDisplay = '—',
  hideEmpty = false,
}) => {
  const showForm = shouldShowReportRecordForm(data);
  const row = showForm ? data[0] : null;
  const lastActiveKeyRef = useRef(null);

  useEffect(() => {
    if (!showForm || !row || typeof onRecordActive !== 'function') {
      if (!showForm) lastActiveKeyRef.current = null;
      return;
    }
    const key = row.res_id ?? row.agency_id ?? row.sail_code ?? row.id ?? JSON.stringify(row);
    const keyStr = String(key);
    if (lastActiveKeyRef.current === keyStr) return;
    lastActiveKeyRef.current = keyStr;
    onRecordActive(row);
  }, [showForm, row, onRecordActive]);

  return (
    <>
      {showForm ? (
        <ReportRecordForm
          columns={columns}
          row={row}
          ariaLabel={ariaLabel}
          emptyDisplay={emptyDisplay}
          hideEmpty={hideEmpty}
        />
      ) : null}
      <div
        ref={tableRef}
        className={tableClassName}
        hidden={showForm || undefined}
        {...tableProps}
      />
    </>
  );
};

const ReportRecordForm = ({
  columns = [],
  row = null,
  ariaLabel = 'Record details',
  emptyDisplay = '—',
  hideEmpty = false,
}) => {
  const fields = useMemo(
    () => buildReportRecordFields(columns, row),
    [columns, row]
  );
  const visibleFields = hideEmpty
    ? fields.filter((field) => !field.empty)
    : fields;

  if (!row) return null;

  return (
    <div className="talia-record-form" role="region" aria-label={ariaLabel}>
      <dl className="talia-record-form__list">
        {visibleFields.map((field) => (
          <div key={field.key} className="talia-record-form__row">
            <dt className="talia-record-form__label">{field.label}</dt>
            <dd className="talia-record-form__value">
              {field.empty
                ? emptyDisplay
                : field.html
                  ? (
                    <span
                      className="talia-record-form__html"
                      dangerouslySetInnerHTML={{ __html: field.html }}
                    />
                  )
                  : field.text}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default ReportRecordForm;
