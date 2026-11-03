/**
 * Convert pasted / imported plain text (and PDF text layers) into sensible Markdown
 * for the Documents repository. Original files are not retained — content only.
 */

const HEADING_EXACT = new Set([
  'objective',
  'historical data requirements',
  'historical period',
  'minimum required historical fields',
  'matching variable bands',
  'days to departure (dtd)',
  'departure period',
  'group size',
  'example — new group',
  'example - new group',
  'historical matching & fallback decision tree',
  'historical matching and fallback decision tree',
  'decision at every level',
  'proposed fallback sequence',
  'illustrative matching outcome',
  'historical pr calculation',
  'conversion into the seaware pr%',
  'testing approach',
  'decision steps',
  'layout and numbering check',
]);

const TABLE_HEADERS = [
  { match: /^band\s+dtd\s+range$/i, columns: ['Band', 'DTD range'], kind: 'band_range' },
  { match: /^band\s+departure\s+period$/i, columns: ['Band', 'Departure period'], kind: 'band_range' },
  { match: /^band\s+allocated\s+cabins$/i, columns: ['Band', 'Allocated cabins'], kind: 'band_range' },
  { match: /^variable\s+value$/i, columns: ['Variable', 'Value'], kind: 'variable_value' },
  { match: /^level\s+matching\s+logic\s*\/\s*action$/i, columns: ['Level', 'Matching logic / action'], kind: 'level_action' },
  {
    match: /^level\s+unique\s+historical\s+ids\s+decision$/i,
    columns: ['Level', 'Unique historical IDs', 'Decision'],
    kind: 'level_ids_decision',
  },
  {
    match: /^rolling\s+12-month\s+interval\s+illustrative\s+weight$/i,
    columns: ['Rolling 12-month interval', 'Illustrative weight'],
    kind: 'interval_weight',
  },
];

const STEP_HEADING = /^step\s+[a-d]\b/i;
const BULLET = /^[•·▪◦]\s+(.*)$/;
const NUMBERED = /^(\d+)[.)]\s+(.*)$/;
const LEVEL_ROW = /^(\d+)\s*[·.•-]\s+(.+)$/;
const BAND_ROW = /^(\d+)\s+(\S.*)$/;
const VARIABLE_KEYS = [
  'Account',
  'Market',
  'Booking Type',
  'Group Type',
  'Product',
  'Sailing date',
  'Departure month',
  'Group size',
  'Booking status',
  'Calculation date',
  'DTD',
];

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ');
}

function looksLikeMarkdown(text) {
  const sample = text.trim().slice(0, 1200);
  if (!sample) return false;
  const signals = (sample.match(/^#{1,6}\s/gm) || []).length
    + (sample.match(/^\|.+\|/gm) || []).length
    + (sample.match(/^```/gm) || []).length;
  return signals >= 2 || /^#{1,6}\s/m.test(sample.trimStart());
}

function isShortTitleLine(line) {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/[.!?]$/.test(t) && t.length > 40) return false;
  if (BULLET.test(t) || NUMBERED.test(t)) return false;
  return true;
}

function headingLevelFor(line) {
  const key = line.trim().toLowerCase();
  if (HEADING_EXACT.has(key)) return 2;
  if (STEP_HEADING.test(key)) return 3;
  return 0;
}

/** Short label lines immediately before a list/table become ## headings. */
function promoteLabelBeforeStructure(out) {
  if (out.length < 1) return;
  let idx = out.length - 1;
  while (idx >= 0 && out[idx] === '') idx -= 1;
  if (idx < 0) return;
  const label = out[idx];
  if (!label || label.startsWith('#') || label.startsWith('|') || label.startsWith('- ') || NUMBERED.test(label)) return;
  if (headingLevelFor(label)) return;
  if (!isShortTitleLine(label) || label.length > 60) return;
  if (/[.!?]$/.test(label)) return;
  out[idx] = `## ${label}`;
}

function collapseSoftWraps(lines) {
  const out = [];
  let buf = '';

  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '');
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      out.push('');
      continue;
    }

    const heading = headingLevelFor(trimmed);
    const isBullet = BULLET.test(trimmed);
    const isNumbered = NUMBERED.test(trimmed);
    const isTableHeader = TABLE_HEADERS.some((h) => h.match.test(trimmed));
    const isBandRow = BAND_ROW.test(trimmed) && trimmed.length < 80;
    const isLevelRow = LEVEL_ROW.test(trimmed);
    const isStep = STEP_HEADING.test(trimmed);
    const isVarKey = VARIABLE_KEYS.some((k) => trimmed === k || trimmed.startsWith(`${k} `));

    const structural = heading
      || isBullet
      || isNumbered
      || isTableHeader
      || isBandRow
      || isLevelRow
      || isStep
      || isVarKey
      || /^[a-z]\)\s+/i.test(trimmed);

    const startsNewItem = isBullet || isNumbered || isLevelRow || isBandRow || isTableHeader || heading || isStep;

    if (structural) {
      // Soft-continue a previous bullet/number/level line instead of orphaning wrapped text.
      // Never glue the next list/level/band row onto the previous one.
      const prev = buf || out[out.length - 1];
      if (
        prev
        && (BULLET.test(prev) || NUMBERED.test(prev) || LEVEL_ROW.test(prev))
        && !/[.!?]"?\s*$/.test(prev)
        && !startsNewItem
      ) {
        const joined = `${prev} ${trimmed}`;
        if (buf) buf = joined;
        else out[out.length - 1] = joined;
        continue;
      }
      flush();
      out.push(trimmed);
      continue;
    }

    if (!buf) {
      // Continue previous structural line when wrap broke mid-sentence.
      const prev = out[out.length - 1];
      if (
        prev
        && (BULLET.test(prev) || NUMBERED.test(prev) || LEVEL_ROW.test(prev))
        && !LEVEL_ROW.test(trimmed)
        && !BAND_ROW.test(trimmed)
        && (!/[.!?]"?\s*$/.test(prev) || /^[a-z]/.test(trimmed))
      ) {
        out[out.length - 1] = `${prev} ${trimmed}`;
        continue;
      }
      buf = trimmed;
      continue;
    }

    // Do not glue consecutive short title / heading-like lines.
    if (isShortTitleLine(buf) && isShortTitleLine(trimmed) && buf.length < 70 && trimmed.length < 70) {
      flush();
      buf = trimmed;
      continue;
    }

    // Soft wrap: continue the paragraph unless the previous line ended a sentence
    // and this looks like a new sentence/section start with a capital.
    const prevEndsOpen = !/[.!?:"']\s*$/.test(buf) || /,\s*$/.test(buf) || /\b(the|a|an|of|to|for|and|or|with|from|by|in|on|at|as)$/i.test(buf);
    if (prevEndsOpen || /^[a-z]/.test(trimmed)) {
      buf = `${buf} ${trimmed}`;
    } else {
      flush();
      buf = trimmed;
    }
  }
  flush();
  return out;
}

function parseBandRangeRows(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(BAND_ROW);
    if (!m) break;
    rows.push([m[1], m[2].trim()]);
    i += 1;
  }
  return { rows, next: i };
}

function parseVariableValueRows(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || headingLevelFor(line) || BULLET.test(line) || NUMBERED.test(line)) break;
    const key = VARIABLE_KEYS.find((k) => line === k || line.startsWith(`${k} `));
    if (!key) break;
    if (line === key) {
      const value = (lines[i + 1] || '').trim();
      if (!value || headingLevelFor(value) || VARIABLE_KEYS.includes(value)) break;
      rows.push([key, value]);
      i += 2;
      continue;
    }
    rows.push([key, line.slice(key.length).trim()]);
    i += 1;
  }
  return { rows, next: i };
}

function parseLevelActionRows(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || headingLevelFor(line) || BULLET.test(line)) break;
    const m = line.match(LEVEL_ROW);
    if (!m) {
      if (rows.length && !NUMBERED.test(line) && !TABLE_HEADERS.some((h) => h.match.test(line))) {
        rows[rows.length - 1][1] = `${rows[rows.length - 1][1]} ${line}`;
        i += 1;
        continue;
      }
      break;
    }
    const rest = m[2].trim();
    const labelMatch = rest.match(
      /^((?:Full match|Broaden \w+|Remove [\w ]+|Compare Groups from other accounts))(?:\s+)(.+)$/i,
    );
    if (labelMatch) {
      rows.push([`${m[1]} · ${labelMatch[1]}`, labelMatch[2]]);
    } else {
      rows.push([`${m[1]} ·`, rest]);
    }
    i += 1;
  }
  return { rows, next: i };
}

function parseLevelIdsDecisionRows(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || headingLevelFor(line) || BULLET.test(line)) break;
    // "1 · Full match 2 Insufficient → Level 2" or "4–8 Not evaluated Stop at Level 3"
    const range = line.match(/^(\d+\s*[–-]\s*\d+)\s+(.+)$/);
    if (range) {
      const rest = range[2].trim();
      const parts = rest.match(/^(.+?)\s{2,}(.+)$/) || rest.match(/^((?:Not evaluated|Sufficient|Insufficient)\b.*)$/i);
      if (parts && parts[2]) {
        rows.push([range[1], parts[1].trim(), parts[2].trim()]);
      } else {
        const split = rest.split(/\s+(?=(?:Not evaluated|Stop|Sufficient|Insufficient)\b)/i);
        rows.push([range[1], split[0]?.trim() || rest, split.slice(1).join(' ').trim() || '—']);
      }
      i += 1;
      continue;
    }
    const m = line.match(LEVEL_ROW);
    if (!m) break;
    const rest = m[2].trim();
    // "Full match 2 Insufficient → Level 2"
    const tri = rest.match(/^(.+?)\s+(\d+)\s+(Insufficient.+|Sufficient.+|Not evaluated.+)$/i);
    if (tri) {
      rows.push([`${m[1]} · ${tri[1].trim()}`, tri[2], tri[3].trim()]);
    } else {
      rows.push([`${m[1]} ·`, rest, '—']);
    }
    i += 1;
  }
  return { rows, next: i };
}

function parseIntervalWeightRows(lines, start) {
  const rows = [];
  let i = start;
  const labels = ['Oldest 12 months', 'Middle 12 months', 'Most recent 12 months'];
  while (i < lines.length) {
    const line = lines[i];
    if (!line || headingLevelFor(line) || BULLET.test(line) || NUMBERED.test(line)) break;
    const label = labels.find((l) => line.startsWith(l));
    if (!label) break;
    const weight = line.slice(label.length).trim() || (lines[i + 1] || '').trim();
    if (weight && /^\d+%/.test(weight)) {
      rows.push([label, weight]);
      i += 1;
    } else if (lines[i + 1] && /^\d+%/.test(lines[i + 1].trim())) {
      rows.push([label, lines[i + 1].trim()]);
      i += 2;
    } else {
      break;
    }
  }
  return { rows, next: i };
}

function toMdTable(columns, rows) {
  if (!rows.length) return '';
  const escape = (cell) => String(cell ?? '').replace(/\|/g, '\\|').trim();
  const header = `| ${columns.map(escape).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(escape).join(' | ')} |`).join('\n');
  return `${header}\n${sep}\n${body}`;
}

function titleFromLines(lines, suggestedTitle) {
  const usable = lines.map((l) => l.trim()).filter(Boolean);
  if (usable.length) {
    const first = usable[0];
    if (isShortTitleLine(first)) {
      return first.length <= 80 ? first : `${first.slice(0, 77)}…`;
    }
    return first.length <= 80 ? first : `${first.slice(0, 77)}…`;
  }
  if (suggestedTitle && String(suggestedTitle).trim()) return String(suggestedTitle).trim();
  return 'Imported document';
}

/**
 * Turn raw pasted / extracted text into { title, body } Markdown.
 */
export function textToMarkdown(rawText, options = {}) {
  const { suggestedTitle = '' } = options;
  const normalized = normalizeWhitespace(rawText).trim();
  if (!normalized) {
    return { title: suggestedTitle || 'Imported document', body: '' };
  }

  if (looksLikeMarkdown(normalized)) {
    const lines = normalized.split('\n');
    const h1 = lines.find((l) => /^#\s+/.test(l.trim()));
    const title = suggestedTitle
      || (h1 ? h1.replace(/^#\s+/, '').trim() : titleFromLines(lines, ''));
    return { title, body: normalized };
  }

  const collapsed = collapseSoftWraps(normalized.split('\n'));
  const title = titleFromLines(collapsed, suggestedTitle);
  const out = [];
  let i = 0;
  let emittedTitle = false;

  // Lead with H1 from title; skip duplicate first line(s) if they match title / subtitle
  out.push(`# ${title}`);
  emittedTitle = true;
  if (collapsed[0]?.trim() === title) i = 1;
  if (collapsed[i] && isShortTitleLine(collapsed[i]) && collapsed[i] !== title && !headingLevelFor(collapsed[i])) {
    out.push('');
    out.push(`**${collapsed[i]}**`);
    i += 1;
  }

  while (i < collapsed.length) {
    const line = collapsed[i];
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      i += 1;
      continue;
    }

    const hLevel = headingLevelFor(line);
    if (hLevel) {
      out.push('');
      out.push(`${'#'.repeat(hLevel)} ${line}`);
      i += 1;
      continue;
    }

    if (STEP_HEADING.test(line)) {
      out.push('');
      out.push(`### ${line}`);
      i += 1;
      continue;
    }

    const header = TABLE_HEADERS.find((h) => h.match.test(line));
    if (header) {
      let parsed;
      if (header.kind === 'band_range') parsed = parseBandRangeRows(collapsed, i + 1);
      else if (header.kind === 'variable_value') parsed = parseVariableValueRows(collapsed, i + 1);
      else if (header.kind === 'level_action') parsed = parseLevelActionRows(collapsed, i + 1);
      else if (header.kind === 'level_ids_decision') parsed = parseLevelIdsDecisionRows(collapsed, i + 1);
      else if (header.kind === 'interval_weight') parsed = parseIntervalWeightRows(collapsed, i + 1);
      if (parsed?.rows?.length) {
        promoteLabelBeforeStructure(out);
        out.push('');
        out.push(toMdTable(header.columns, parsed.rows));
        i = parsed.next;
        continue;
      }
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      const items = [];
      while (i < collapsed.length) {
        const b = collapsed[i].match(BULLET);
        if (!b) break;
        items.push(`- ${b[1].trim()}`);
        i += 1;
      }
      promoteLabelBeforeStructure(out);
      out.push('');
      out.push(...items);
      continue;
    }

    const numbered = line.match(NUMBERED);
    if (numbered) {
      const items = [];
      while (i < collapsed.length) {
        const n = collapsed[i].match(NUMBERED);
        if (!n) break;
        items.push(`${n[1]}. ${n[2].trim()}`);
        i += 1;
      }
      promoteLabelBeforeStructure(out);
      out.push('');
      out.push(...items);
      continue;
    }

    // Semicolon-separated field lists (e.g. Minimum Required historical fields)
    if (line.includes(';') && line.split(';').length >= 2 && line.length < 280) {
      const fieldItems = [];
      while (i < collapsed.length) {
        const candidate = collapsed[i];
        if (!candidate || !candidate.includes(';') || headingLevelFor(candidate) || BULLET.test(candidate)) break;
        if (candidate.split(';').length < 2 || candidate.length >= 280) break;
        candidate.split(';').map((p) => p.trim()).filter(Boolean).forEach((part) => {
          fieldItems.push(`- ${part}`);
        });
        i += 1;
      }
      if (fieldItems.length) {
        out.push('');
        out.push(...fieldItems);
        continue;
      }
    }

    if (/^[a-z]\)\s+/i.test(line)) {
      out.push(`  - ${line.replace(/^[a-z]\)\s+/i, '')}`);
      i += 1;
      continue;
    }

    out.push('');
    out.push(line);
    i += 1;
  }

  const body = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  void emittedTitle;
  return { title, body };
}

function stemFromFilename(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * Read a .txt / .md File (browser) and convert to Markdown.
 */
export async function importTextFile(file) {
  if (!file) throw new Error('No file provided');
  const name = file.name || 'import.txt';
  const lower = name.toLowerCase();
  if (!/\.(txt|md|markdown|text)$/i.test(lower) && file.type && !/^text\//.test(file.type)) {
    throw new Error('Expected a .txt or .md file');
  }
  const raw = typeof file.text === 'function'
    ? await file.text()
    : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsText(file);
    });
  return textToMarkdown(raw, { suggestedTitle: stemFromFilename(name) });
}

/**
 * Extract text from a PDF File via pdfjs-dist, then convert to Markdown.
 * Returns empty body with a hint title when no text layer is found.
 */
export async function importPdfFile(file, pdfjsModule) {
  if (!file) throw new Error('No file provided');
  const pdfjs = pdfjsModule || await import('pdfjs-dist');
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const withBreaks = [];
    let line = '';
    (content.items || []).forEach((item) => {
      if (!item || typeof item.str !== 'string') return;
      line += item.str;
      if (item.hasEOL) {
        withBreaks.push(line.trimEnd());
        line = '';
      }
    });
    if (line.trim()) withBreaks.push(line.trim());
    const text = withBreaks.length
      ? withBreaks.join('\n')
      : (content.items || [])
        .map((item) => (item && typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (text) pages.push(text);
  }
  const raw = pages.filter(Boolean).join('\n\n');
  const suggestedTitle = stemFromFilename(file.name || 'Imported PDF');
  if (!raw.trim()) {
    return {
      title: suggestedTitle,
      body: '',
      emptyExtract: true,
    };
  }
  return { ...textToMarkdown(raw, { suggestedTitle }), emptyExtract: false };
}

/**
 * Route a File to the correct importer.
 */
export async function importDocumentFile(file, pdfjsModule) {
  if (!file) throw new Error('No file provided');
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return importPdfFile(file, pdfjsModule);
  }
  return importTextFile(file);
}
