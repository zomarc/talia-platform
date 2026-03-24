import React from 'react';

/**
 * Standard gate for header ≣ “data details”: when `visible` is false, children unmount
 * (Tabulator destroyed, no stray headers). Same pattern as Competitor Pricing hiding the table.
 *
 * @param {boolean} visible - from `usePanelDetailsVisibility()[0]` (or alias `showTable` / `showDetails`)
 * @param {keyof JSX.IntrinsicElements | React.ElementType} [as='div'] - root element, e.g. `'section'`
 */
export default function ReportDataDetails({
  visible,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  if (!visible) return null;
  const combined = ['talia-report-data-details', className].filter(Boolean).join(' ');
  return (
    <Tag className={combined} {...rest}>
      {children}
    </Tag>
  );
}
