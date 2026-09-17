import React from 'react';

/**
 * Admin+ **Provenance** section — where this report’s data comes from.
 * Not Details (≣), not Callouts, and not tab ⓘ technical meta.
 *
 * Gate with `useReportShellOptions` → `showProvenance`
 * (`VIEW_PROVENANCE`, minRole ADMIN, default off).
 * Keep children mounted when hidden so the Views toggle does not remount.
 *
 * @param {boolean} visible
 * @param {string} [title='Provenance']
 * @param {keyof JSX.IntrinsicElements | React.ElementType} [as='section']
 */
export default function ReportProvenance({
  visible,
  title = 'Provenance',
  as: Tag = 'section',
  className = '',
  children,
  ...rest
}) {
  const combined = ['talia-report-provenance', className].filter(Boolean).join(' ');
  return (
    <Tag
      className={combined}
      hidden={!visible}
      aria-hidden={!visible}
      aria-label="Provenance"
      {...rest}
    >
      {title ? <h3 className="talia-report-provenance__title">{title}</h3> : null}
      <div className="talia-report-provenance__body">
        {children}
      </div>
    </Tag>
  );
}
