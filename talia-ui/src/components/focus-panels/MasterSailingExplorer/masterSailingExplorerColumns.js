import { formatDayMonYy } from '../../../lib/dateFormat.js';
import { toDemandVolume } from '../../../lib/demandUnit.js';

export const MSE_COMPACT_BREAKPOINT = 640;

export const formatMseCount = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export const formatMsePercent = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

export const formatMseSegmentHighlights = (segments = []) => {
  if (!segments.length) return '<span class="ms-explorer-segments ms-explorer-segments--empty">—</span>';
  const items = segments.map((segment) => {
    const guests = Number.parseFloat(segment?.guests ?? segment?.booked);
    const guestsValue = Number.isFinite(guests) && guests > 0 ? guests : 0;
    const guestsLabel = `${guestsValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const bookingClass = segment?.is_booking ? 'ms-explorer-segment--booking' : 'ms-explorer-segment--active';
    return `<span class="ms-explorer-segment ${bookingClass}" title="${segment.sail_code}: ${guestsLabel} guests (selling)"><span class="ms-explorer-segment__code">${segment.sail_code}</span><span class="ms-explorer-segment__metrics">${guestsLabel}</span></span>`;
  }).join('');
  return `<span class="ms-explorer-segments">${items}</span>`;
};

export const shortenTargetProfileName = (name, max = 16) => {
  const text = String(name || '')
    .replace(/^Suggested ·\s*/i, '')
    .replace(/^Default ·\s*/i, '')
    .trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
};

export const formatMseTargetReview = (row, { compact = false } = {}) => {
  if (row?.row_type === 'day') return '';
  if (row?.target_review_pending) {
    const el = document.createElement('span');
    el.className = 'mse-target-review mse-target-review--pending';
    el.textContent = compact ? '…' : '…';
    el.title = 'Loading target profile…';
    if (!compact) return el;
    const wrap = document.createElement('span');
    wrap.className = 'mse-target-review-stack';
    wrap.title = 'Loading target profile…';
    const name = document.createElement('span');
    name.className = 'mse-target-review__name';
    name.textContent = '…';
    wrap.append(el, name);
    return wrap;
  }
  const status = row?.target_review_status;
  const profileName = String(row?.target_profile_name || '').trim();
  if ((!status || status === 'unknown') && !profileName) return compact ? '—' : '—';
  const gap = row?.target_gap_pp;
  const gapTxt = gap != null && Number.isFinite(Number(gap))
    ? ` ${Number(gap) > 0 ? '+' : ''}${Number(gap).toFixed(0)}`
    : '';
  const label = !status || status === 'unknown'
    ? '—'
    : status === 'behind' ? `▼${gapTxt}` : status === 'ahead' ? `▲${gapTxt}` : `●${gapTxt}`;
  const el = document.createElement('span');
  el.className = `mse-target-review${status && status !== 'unknown' ? ` mse-target-review--${status}` : ''}`;
  el.textContent = label;
  const title = [
    profileName ? `Target: ${profileName}` : 'No target profile',
    row?.target_lf_pct != null ? `Goal ${Number(row.target_lf_pct).toFixed(1)}%` : null,
    status && status !== 'unknown' ? status : null,
  ]
    .filter(Boolean)
    .join(' · ');
  el.title = title;
  if (!compact) return el;
  const wrap = document.createElement('span');
  wrap.className = 'mse-target-review-stack';
  wrap.title = title;
  const name = document.createElement('span');
  name.className = 'mse-target-review__name';
  name.textContent = shortenTargetProfileName(profileName) || 'No tgt';
  wrap.append(el, name);
  return wrap;
};

const bookedVolumeForRow = (row) => (
  row?.row_type === 'day' ? row?.booked : row?.total_booked
);

const bookedPctForRow = (row) => {
  if (row?.row_type === 'day') {
    const denom = Number(row?.sellable_cabins || row?.total_cabins);
    if (!(denom > 0)) return null;
    return (Number(row?.booked_cabins || 0) / denom) * 100;
  }
  return row?.actual_booked_pct;
};

const formatCompactDateCell = (cell) => {
  const row = cell.getRow().getData();
  if (row?.row_type === 'day') return `Day ${row?.voyage_day_index || ''}`;
  const date = formatDayMonYy(cell.getValue(), '');
  const sail = row?.sail_code || '';
  const el = document.createElement('span');
  el.className = 'mse-compact-date';
  const day = document.createElement('span');
  day.className = 'mse-compact-date__day';
  day.textContent = date || '—';
  const code = document.createElement('span');
  code.className = 'mse-compact-date__sail';
  code.textContent = sail;
  el.append(day, code);
  return el;
};

const formatCompactBookedCell = (cell) => {
  const row = cell.getRow().getData();
  const el = document.createElement('span');
  el.className = 'mse-compact-bk';
  const volume = document.createElement('span');
  volume.className = 'mse-compact-bk__n';
  volume.textContent = formatMseCount(bookedVolumeForRow(row));
  const pct = bookedPctForRow(row);
  el.append(volume);
  if (pct != null && Number.isFinite(Number(pct))) {
    const pctEl = document.createElement('span');
    pctEl.className = 'mse-compact-bk__pct';
    pctEl.textContent = formatMsePercent(pct);
    el.append(pctEl);
  }
  const berths = formatMseCount(bookedVolumeForRow(row));
  const cabins = formatMseCount(row?.booked_cabins);
  el.title = `Booked berths ${berths}${pct != null && Number.isFinite(Number(pct)) ? ` (${formatMsePercent(pct)})` : ''} · Booked cabins ${cabins}`;
  return el;
};

const formatCompactCabinsCell = (cell) => {
  const row = cell.getRow().getData();
  const el = document.createElement('span');
  el.className = 'mse-compact-bk mse-compact-cabins';
  const booked = document.createElement('span');
  booked.className = 'mse-compact-bk__n';
  booked.textContent = formatMseCount(row?.booked_cabins);
  el.append(booked);
  const sellable = Number(row?.sellable_cabins || row?.total_cabins);
  if (Number.isFinite(sellable) && sellable > 0) {
    const tot = document.createElement('span');
    tot.className = 'mse-compact-bk__pct';
    tot.textContent = `/ ${formatMseCount(sellable)}`;
    el.append(tot);
  }
  const offsale = Number(row?.offsale_cabins);
  el.title = [
    `Booked cabins ${formatMseCount(row?.booked_cabins)}`,
    Number.isFinite(sellable) && sellable > 0 ? `Sellable ${formatMseCount(sellable)}` : null,
    Number.isFinite(offsale) && offsale > 0 ? `Offsale ${formatMseCount(offsale)}` : null,
    Number(row?.total_cabins) > 0 ? `Nameplate ${formatMseCount(row.total_cabins)}` : null,
  ].filter(Boolean).join(' · ');
  return el;
};

export const buildMasterSailingExplorerColumns = ({
  compact = false,
  segmentsVisible = false,
  viewMode = 'nested',
  demandUnit,
  demandNoun = 'guests',
  onExpandToggle,
} = {}) => {
  if (compact) {
    return [
      {
        field: 'sail_date_from',
        title: 'Date',
        headerTooltip: 'Departure date and sail code',
        minWidth: 108,
        widthGrow: 2,
        formatter: formatCompactDateCell,
        headerSort: viewMode === 'flat',
      },
      {
        field: 'berths_occupied',
        title: 'Bk B',
        headerTooltip: 'Booked berths and actual booked %',
        hozAlign: 'right',
        minWidth: 64,
        widthGrow: 1,
        formatter: formatCompactBookedCell,
        headerSort: false,
      },
      {
        field: 'booked_cabins',
        title: 'Bk C',
        headerTooltip: 'Booked cabins / sellable cabins',
        hozAlign: 'right',
        minWidth: 64,
        widthGrow: 1,
        formatter: formatCompactCabinsCell,
        headerSort: false,
      },
      {
        field: 'target_review_status',
        title: 'vs Tgt',
        headerTooltip: 'Actual cabin LF vs active target (behind / on / ahead)',
        hozAlign: 'center',
        minWidth: 72,
        widthGrow: 1,
        formatter: (cell) => formatMseTargetReview(cell.getRow().getData(), { compact: true }),
        headerSort: false,
      },
    ];
  }

  const baseColumns = [
    {
      field: 'expand_toggle',
      title: '',
      width: 34,
      hozAlign: 'center',
      headerSort: false,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type !== 'master' || !row?.is_expandable) return '';
        return row?.is_expanded ? '▾' : '▸';
      },
      cellClick: (event, cell) => {
        onExpandToggle?.(event, cell.getRow().getData());
      },
    },
    {
      field: 'sail_date_from',
      title: 'Date',
      headerTooltip: 'Departure date',
      width: 96,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type === 'day') return `Day ${row?.voyage_day_index || ''}`;
        return formatDayMonYy(cell.getValue(), '');
      },
      headerSort: viewMode === 'flat',
    },
    {
      field: 'row_label',
      title: 'Sail/Day',
      headerTooltip: 'Master sail / voyage day',
      minWidth: 130,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type === 'day') {
          return formatDayMonYy(row?.voyage_day_date, row?.day_label || '');
        }
        return row?.sail_code || '';
      },
      headerSort: false,
    },
  ];

  if (segmentsVisible) {
    baseColumns.push({
      field: 'contributing_segments',
      title: 'Segs',
      headerTooltip: 'Contributing segments',
      minWidth: 220,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type === 'day') {
          return formatMseSegmentHighlights(row?.contributing_segments);
        }
        return formatMseSegmentHighlights(row?.segment_summaries || []);
      },
      headerSort: false,
    });
  }

  baseColumns.push(
    {
      field: 'sail_days',
      title: 'Dur',
      headerTooltip: 'Duration',
      hozAlign: 'center',
      width: 72,
      headerSort: false,
    },
    {
      field: 'package_name',
      title: 'Pkg',
      headerTooltip: 'Package',
      minWidth: 120,
      headerSort: false,
    },
    {
      field: 'route',
      titleShort: 'Route',
      titleLong: 'Route',
      width: 96,
      headerSort: false,
    },
    {
      field: 'berths_occupied',
      titleShort: 'Bk B',
      titleLong: 'Booked (berths)',
      hozAlign: 'right',
      width: 100,
      formatter: (cell) => formatMseCount(bookedVolumeForRow(cell.getRow().getData())),
      headerSort: false,
    },
    {
      field: 'total_cabins',
      titleShort: 'Tot C',
      titleLong: 'Nameplate cabins',
      hozAlign: 'right',
      width: 96,
      formatter: (cell) => formatMseCount(cell.getRow().getData()?.total_cabins),
      headerSort: false,
    },
    {
      field: 'offsale_cabins',
      titleShort: 'Off C',
      titleLong: 'Offsale / blocked cabins',
      hozAlign: 'right',
      width: 88,
      formatter: (cell) => formatMseCount(cell.getRow().getData()?.offsale_cabins),
      headerSort: false,
    },
    {
      field: 'booked_cabins',
      titleShort: 'Bk C',
      titleLong: 'Booked cabins',
      hozAlign: 'right',
      width: 104,
      formatter: (cell) => formatMseCount(cell.getRow().getData()?.booked_cabins),
      headerSort: false,
    },
    {
      field: 'booked_guests',
      titleShort: 'Booked',
      titleLong: `Booked ${demandNoun} (real / materialised; presentation from guests)`,
      hozAlign: 'right',
      width: 96,
      formatter: (cell) => formatMseCount(
        toDemandVolume(cell.getRow().getData()?.booked_guests, demandUnit)
      ),
      headerSort: false,
    },
    {
      field: 'estimated_guests',
      titleShort: 'Est',
      titleLong: `Estimated ${demandNoun} (contracted × probability; presentation from guests)`,
      hozAlign: 'right',
      width: 88,
      formatter: (cell) => formatMseCount(
        toDemandVolume(cell.getRow().getData()?.estimated_guests, demandUnit)
      ),
      headerSort: false,
    },
    {
      field: 'contracted_guests',
      titleShort: 'Contr',
      titleLong: `Contracted ${demandNoun} (synthetic group OF face; presentation from guests)`,
      hozAlign: 'right',
      width: 96,
      formatter: (cell) => formatMseCount(
        toDemandVolume(cell.getRow().getData()?.contracted_guests, demandUnit)
      ),
      headerSort: false,
    },
    {
      field: 'guaranteed_cabins',
      titleShort: 'Res C',
      titleLong: 'Reserved cabins (group × probability)',
      hozAlign: 'right',
      width: 184,
      formatter: (cell) => formatMseCount(cell.getRow().getData()?.guaranteed_cabins),
      headerSort: false,
    },
    {
      field: 'actual_booked_pct',
      titleShort: 'Bk%',
      titleLong: 'Actual booked cabins %',
      hozAlign: 'right',
      width: 92,
      formatter: (cell) => formatMsePercent(bookedPctForRow(cell.getRow().getData())),
      headerSort: false,
    },
    {
      field: 'potential_booked_pct',
      titleShort: 'Pot%',
      titleLong: 'Potential booked cabins % (booked + reserved)',
      hozAlign: 'right',
      width: 102,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const pct = row?.row_type === 'day'
          ? (
            Number(row?.sellable_cabins || row?.total_cabins) > 0
              ? ((Number(row?.booked_cabins || 0) + Number(row?.guaranteed_cabins || 0)) / Number(row?.sellable_cabins || row?.total_cabins)) * 100
              : null
          )
          : row?.potential_booked_pct;
        return formatMsePercent(pct);
      },
      headerSort: false,
    },
    {
      field: 'booking_upside_pct',
      titleShort: 'Up%',
      titleLong: 'Upside % (potential - actual)',
      hozAlign: 'right',
      width: 92,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const pct = row?.row_type === 'day'
          ? (
            Number(row?.sellable_cabins || row?.total_cabins) > 0
              ? ((Number(row?.guaranteed_cabins || 0) / Number(row?.sellable_cabins || row?.total_cabins)) * 100)
              : null
          )
          : row?.booking_upside_pct;
        return formatMsePercent(pct);
      },
      headerSort: false,
    },
    {
      field: 'target_review_status',
      titleShort: 'vs Tgt',
      titleLong: 'Actual cabin LF vs active target (behind / on / ahead)',
      hozAlign: 'center',
      width: 88,
      formatter: (cell) => formatMseTargetReview(cell.getRow().getData()),
      headerSort: false,
    },
    {
      field: 'berth_capacity',
      titleShort: 'Cap B',
      titleLong: 'Capacity (berths)',
      hozAlign: 'right',
      width: 108,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const value = row?.row_type === 'day' ? row?.capacity : row?.total_capacity;
        return formatMseCount(value);
      },
      headerSort: false,
    },
    {
      field: 'berths_available',
      titleShort: 'Avl B',
      titleLong: 'Available (berths)',
      hozAlign: 'right',
      width: 88,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const value = row?.row_type === 'day' ? row?.available : row?.total_available;
        return formatMseCount(value);
      },
      headerSort: false,
    },
  );

  return baseColumns;
};
