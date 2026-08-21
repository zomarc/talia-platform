/**
 * Compact header glyphs (12×12). Stroke follows currentColor.
 */
const svgProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
  focusable: false,
};

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconSidebar({ collapsed = false }) {
  return (
    <svg {...svgProps}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.4" {...stroke} />
      <path d="M6.2 2.5v11" {...stroke} />
      {collapsed
        ? <path d="M8.4 8h4.2M11.2 6.2L13 8l-1.8 1.8" {...stroke} />
        : <path d="M12.6 8H8.4M9.8 6.2L8 8l1.8 1.8" {...stroke} />}
    </svg>
  );
}

export function IconFilter() {
  return (
    <svg {...svgProps}>
      <path d="M2.5 3.5h11L9.6 8.4v4.1L6.4 14V8.4L2.5 3.5z" {...stroke} />
    </svg>
  );
}

export function IconFocus() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="5" width="10" height="8" rx="1.2" {...stroke} />
      <path d="M5.2 5V3.8A1.3 1.3 0 0 1 6.5 2.5h3A1.3 1.3 0 0 1 10.8 3.8V5" {...stroke} />
    </svg>
  );
}

export function IconEye() {
  return (
    <svg {...svgProps}>
      <path d="M2 8s2.4-4.2 6-4.2S14 8 14 8s-2.4 4.2-6 4.2S2 8 2 8z" {...stroke} />
      <circle cx="8" cy="8" r="1.6" {...stroke} />
    </svg>
  );
}

export function IconRefresh({ all = false, done = false }) {
  if (done) {
    return (
      <svg {...svgProps}>
        <path d="M3.2 8.2 6.4 11.4 12.8 4.8" {...stroke} />
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <path d="M13 7.2A5 5 0 1 0 12.2 11" {...stroke} />
      <path d="M13 3.8v3.4H9.6" {...stroke} />
      {all ? <path d="M3.4 9.2v-2.2h2.4" {...stroke} /> : null}
    </svg>
  );
}

export function IconChevron({ open = false }) {
  return (
    <svg {...svgProps} style={{ transform: open ? 'rotate(180deg)' : undefined }}>
      <path d="M4 6.2 8 10.2 12 6.2" {...stroke} />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg {...svgProps}>
      <path d="M3.2 8.2 6.4 11.4 12.8 4.8" {...stroke} />
    </svg>
  );
}

export function IconSave() {
  return (
    <svg {...svgProps}>
      <path d="M3.2 3.2h8.1L12.8 5.8V12.8H3.2V3.2z" {...stroke} />
      <path d="M5.2 3.2v3.4h5.2V3.2" {...stroke} />
      <path d="M5.4 12.8v-3.6h5.2v3.6" {...stroke} />
    </svg>
  );
}
