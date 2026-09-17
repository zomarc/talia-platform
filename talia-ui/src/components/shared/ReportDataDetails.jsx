import React from 'react';

/**
 * Gate for header ≣ **Details** — secondary / extra data blocks only
 * (history panels, field editors, point-value tables). Primary report content
 * (main Tabulator / chart / map) stays in `talia-report__content` and must
 * never be wrapped here: unmounting destroys one-shot Tabulator/chart instances.
 *
 * When `visible` is false, children stay mounted but are hidden so state survives
 * the global Details toggle.
 *
 * Selection / row-detail cards should use `.talia-card` so Appearance
 * Card Intensity + Component & Card Padding apply. Avoid a redundant
 * “Selected …” title above the card.
 *
 * @param {boolean} visible - from `usePanelDetailsVisibility()[0]`
 * @param {keyof JSX.IntrinsicElements | React.ElementType} [as='div'] - root element, e.g. `'section'`
 */
export default function ReportDataDetails({
  visible,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  const combined = ['talia-report-data-details', className].filter(Boolean).join(' ');
  return (
    <Tag
      className={combined}
      hidden={!visible}
      aria-hidden={!visible}
      {...rest}
    >
      {children}
    </Tag>
  );
}
