/**
 * Shared chrome glyphs (14×14). Stroke follows currentColor.
 *
 * Use these for StatusBar / action headers — never emoji or "?" placeholders
 * (emoji often corrupt to "?" in some encodings / fonts).
 *
 * Import from `./StatusBarIcons` or `../shared/StatusBarIcons`.
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

/** Clipboard / status sheet */
export function IconStatus() {
  return (
    <svg {...svgProps}>
      <rect x="3.2" y="2.8" width="9.6" height="11" rx="1.2" {...stroke} />
      <path d="M5.4 6.2h5.2M5.4 8.6h5.2M5.4 11h3.4" {...stroke} />
    </svg>
  );
}

/** Lightning bolt — full / force update */
export function IconBolt() {
  return (
    <svg {...svgProps}>
      <path d="M9.2 2.4 4.6 9.1h3.2L6.8 13.6 12.4 6.9H9.2L9.2 2.4z" {...stroke} />
    </svg>
  );
}

/** Stop square */
export function IconStop() {
  return (
    <svg {...svgProps}>
      <rect x="4" y="4" width="8" height="8" rx="1.1" {...stroke} />
    </svg>
  );
}

/** Database / backup cylinder */
export function IconBackup() {
  return (
    <svg {...svgProps}>
      <ellipse cx="8" cy="4.2" rx="4.6" ry="1.8" {...stroke} />
      <path d="M3.4 4.2v7.6c0 1 2.1 1.8 4.6 1.8s4.6-.8 4.6-1.8V4.2" {...stroke} />
      <path d="M3.4 8c0 1 2.1 1.8 4.6 1.8s4.6-.8 4.6-1.8" {...stroke} />
    </svg>
  );
}

/** Wrench — dev tools */
export function IconWrench() {
  return (
    <svg {...svgProps}>
      <path
        d="M10.8 2.6a2.6 2.6 0 0 0-3.5 3.1L3.4 9.6l2.9 2.9 3.9-3.9a2.6 2.6 0 0 0 3.1-3.5L11.2 7.2 10.8 2.6z"
        {...stroke}
      />
    </svg>
  );
}

/** App / rocket mark (simple chevron stack) */
export function IconApp() {
  return (
    <svg {...svgProps}>
      <path d="M8 2.4 12.4 12.2H9.4L8 9.2 6.6 12.2H3.6L8 2.4z" {...stroke} />
      <path d="M6.2 12.8h3.6" {...stroke} />
    </svg>
  );
}

/** Indeterminate busy spinner (uses `.talia-icon--spin`) */
export function IconSpinner() {
  return (
    <svg {...svgProps} className="talia-icon--spin">
      <path d="M13 8A5 5 0 1 1 11.2 4.1" {...stroke} />
    </svg>
  );
}

const CHROME_ICON_INNER = {
  status: '<rect x="3.2" y="2.8" width="9.6" height="11" rx="1.2"/><path d="M5.4 6.2h5.2M5.4 8.6h5.2M5.4 11h3.4"/>',
  eye: '<path d="M2 8s2.4-4.2 6-4.2S14 8 14 8s-2.4 4.2-6 4.2S2 8 2 8z"/><circle cx="8" cy="8" r="1.6"/>',
  refresh: '<path d="M13 7.2A5 5 0 1 0 12.2 11"/><path d="M13 3.8v3.4H9.6"/>',
  bolt: '<path d="M9.2 2.4 4.6 9.1h3.2L6.8 13.6 12.4 6.9H9.2L9.2 2.4z"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1.1"/>',
  backup: '<ellipse cx="8" cy="4.2" rx="4.6" ry="1.8"/><path d="M3.4 4.2v7.6c0 1 2.1 1.8 4.6 1.8s4.6-.8 4.6-1.8V4.2"/><path d="M3.4 8c0 1 2.1 1.8 4.6 1.8s4.6-.8 4.6-1.8"/>',
  save: '<path d="M3.2 3.2h8.1L12.8 5.8V12.8H3.2V3.2z"/><path d="M5.2 3.2v3.4h5.2V3.2"/><path d="M5.4 12.8v-3.6h5.2v3.6"/>',
  spinner: '<path d="M13 8A5 5 0 1 1 11.2 4.1"/>',
  detail: '<circle cx="4" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12" cy="8" r="1.1"/>',
};

/**
 * Inline SVG HTML for Tabulator formatters / non-React surfaces.
 * @param {keyof typeof CHROME_ICON_INNER} name
 * @param {{ spin?: boolean }} [opts]
 */
export function chromeIconMarkup(name, opts = {}) {
  const inner = CHROME_ICON_INNER[name] || CHROME_ICON_INNER.detail;
  const spinClass = opts.spin || name === 'spinner' ? ' talia-icon--spin' : '';
  return (
    `<svg class="talia-chrome-icon${spinClass}" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`
    + `<g fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
    + `</svg>`
  );
}

/** Map panel action id → React icon node (busy → spinner). */
export function PanelActionIcon({ actionId, busy = false }) {
  if (busy) return <IconSpinner />;
  switch (actionId) {
    case 'status':
      return <IconStatus />;
    case 'review':
      return <IconEye />;
    case 'sync':
    case 'update':
      return <IconRefresh />;
    case 'full':
      return <IconBolt />;
    case 'stop':
      return <IconStop />;
    case 'detail':
      return (
        <svg {...svgProps}>
          <circle cx="4" cy="8" r="1.1" {...stroke} />
          <circle cx="8" cy="8" r="1.1" {...stroke} />
          <circle cx="12" cy="8" r="1.1" {...stroke} />
        </svg>
      );
    default:
      return <IconStatus />;
  }
}

/** HTML for panel actions inside Tabulator formatters. */
export function panelActionIconMarkup(actionId, { busy = false } = {}) {
  if (busy) return chromeIconMarkup('spinner', { spin: true });
  switch (actionId) {
    case 'status':
      return chromeIconMarkup('status');
    case 'review':
      return chromeIconMarkup('eye');
    case 'sync':
    case 'update':
      return chromeIconMarkup('refresh');
    case 'full':
      return chromeIconMarkup('bolt');
    case 'stop':
      return chromeIconMarkup('stop');
    case 'detail':
      return chromeIconMarkup('detail');
    default:
      return chromeIconMarkup('status');
  }
}
