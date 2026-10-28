/**
 * Markdown for project documents: headings, lists, tables, emphasis,
 * fenced code, links, and images. HTML in the source is left as text;
 * the React view renders tokens as elements, so it is not interpreted as HTML.
 */

const isSafeUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const parseInlines = (raw) => {
  const text = String(raw || '');
  const tokens = [];
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|(?<![*\w])\*([^*]+)\*(?!\*)|`([^`]+)`/g;
  let cursor = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > cursor) tokens.push({ type: 'text', text: text.slice(cursor, match.index) });
    if (match[1] != null) {
      const src = match[2];
      const asset = /^asset:([0-9a-f-]{36})$/i.exec(src);
      if (asset) tokens.push({ type: 'image', alt: match[1], assetId: asset[1] });
      else if (isSafeUrl(src)) tokens.push({ type: 'image', alt: match[1], href: src });
      else tokens.push({ type: 'text', text: match[0] });
    } else if (match[3] != null) {
      if (isSafeUrl(match[4])) tokens.push({ type: 'link', text: match[3], href: match[4] });
      else tokens.push({ type: 'text', text: match[3] });
    }     else if (match[5] != null) tokens.push({ type: 'strong', text: match[5] });
    else if (match[6] != null) tokens.push({ type: 'strong', text: match[6] });
    else if (match[7] != null) tokens.push({ type: 'em', text: match[7] });
    else if (match[8] != null) tokens.push({ type: 'code', text: match[8] });
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (cursor < text.length) tokens.push({ type: 'text', text: text.slice(cursor) });
  return tokens;
};

const indentOf = (line) => {
  const match = /^(\s*)/.exec(line);
  return match ? match[1].length : 0;
};

const listItem = (line) => {
  const match = /^(\s*)([-*]|\d+[.)])\s+(.*)$/.exec(line);
  if (!match) return null;
  return {
    indent: match[1].length,
    ordered: /\d/.test(match[2]),
    text: match[3],
  };
};

const isHr = (line) => /^\s*([-*_])\1{2,}\s*$/.test(line);

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);

const isTableDivider = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

const tableCells = (line) => {
  const trimmed = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
};

const stripFrontMatter = (source) => {
  const text = String(source || '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\n/, '');
};

const buildList = (entries) => {
  const root = { type: entries[0].ordered ? 'ol' : 'ul', items: [] };
  const stack = [{ indent: -1, node: root }];

  entries.forEach((entry) => {
    while (stack.length > 1 && entry.indent < stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];
    if (entry.indent > top.indent) {
      const parent = top.node.items[top.node.items.length - 1];
      const nested = { type: entry.ordered ? 'ol' : 'ul', items: [] };
      if (parent) parent.children = nested;
      stack.push({ indent: entry.indent, node: parent ? nested : top.node });
    }
    const current = stack[stack.length - 1].node;
    current.items.push({ inlines: parseInlines(entry.text) });
  });

  return root;
};

const isBlockStart = (line) => (
  line.startsWith('```')
  || /^(#{1,4})\s+/.test(line)
  || listItem(line)
  || isHr(line)
  || isTableRow(line)
  || /^\s*>\s?/.test(line)
);

/**
 * @returns {Array<object>} blocks ready for a React renderer
 */
export function parseMarkdown(source) {
  const lines = stripFrontMatter(source).split('\n');
  const blocks = [];
  let i = 0;

  const pushParagraph = (buffer) => {
    const text = buffer.join(' ').trim();
    if (text) blocks.push({ type: 'p', inlines: parseInlines(text) });
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', lang, text: code.join('\n') });
      i += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: `h${heading[1].length}`,
        inlines: parseInlines(heading[2].trim()),
      });
      i += 1;
      continue;
    }

    if (isHr(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (listItem(line)) {
      const entries = [];
      while (i < lines.length) {
        if (!lines[i].trim()) {
          let look = i + 1;
          while (look < lines.length && !lines[look].trim()) look += 1;
          const next = look < lines.length ? listItem(lines[look]) : null;
          const sameKind = next && next.ordered === entries[0].ordered;
          if (next && (next.indent > entries[0].indent || sameKind)) {
            i = look;
            continue;
          }
          break;
        }
        const item = listItem(lines[i]);
        if (!item) break;
        entries.push(item);
        i += 1;
      }
      if (entries.length) blocks.push(buildList(entries));
      continue;
    }

    if (isTableRow(line)) {
      const rows = [];
      while (i < lines.length && (isTableRow(lines[i]) || isTableDivider(lines[i]))) {
        if (!isTableDivider(lines[i])) rows.push(tableCells(lines[i]).map((cell) => parseInlines(cell)));
        i += 1;
      }
      const [header, ...body] = rows;
      blocks.push({ type: 'table', header: header || [], rows: body });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', inlines: parseInlines(quote.join(' ')) });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const buffer = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      buffer.push(lines[i].trim());
      i += 1;
    }
    pushParagraph(buffer);
  }

  return blocks;
}

export function assetIdsInMarkdown(source) {
  const ids = new Set();
  const pattern = /!\[[^\]]*\]\(asset:([0-9a-f-]{36})\)/gi;
  let match = pattern.exec(String(source || ''));
  while (match) {
    ids.add(match[1].toLowerCase());
    match = pattern.exec(String(source || ''));
  }
  return [...ids];
}
