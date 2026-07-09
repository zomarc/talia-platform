#!/usr/bin/env node
/**
 * Inject a git commit summary into docs/EXECUTIVE-OVERVIEW.html.
 *
 * Replaces content between <!-- COMMITS:START --> and <!-- COMMITS:END --> markers.
 * Commits are taken from origin/main..HEAD when available, otherwise the last 30
 * commits on the current branch.
 *
 * Usage:
 *   node scripts/inject-executive-overview-commits.mjs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const HTML_PATH = path.join(rootDir, 'docs', 'EXECUTIVE-OVERVIEW.html');

const START_MARKER = '<!-- COMMITS:START -->';
const END_MARKER = '<!-- COMMITS:END -->';

function runGit(args) {
  try {
    return execSync(`git ${args}`, { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function resolveCommitRange() {
  const hasOriginMain = runGit('rev-parse --verify origin/main');
  const ahead = hasOriginMain ? runGit('rev-list --count origin/main..HEAD') : '';
  if (hasOriginMain && ahead && ahead !== '0') {
    return { range: 'origin/main..HEAD', label: `${ahead} commit${ahead === '1' ? '' : 's'} ahead of origin/main` };
  }
  return { range: '-30', label: 'last 30 commits on current branch' };
}

function parseCommits(range) {
  const raw = runGit(`log ${range} --format=%h%x1f%s%x1f%b%x1e`);
  if (!raw) return [];

  return raw
    .split('\x1e')
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ''] = entry.split('\x1f');
      return {
        hash: hash?.trim(),
        subject: subject?.trim(),
        detail: commitDetail(subject, body)
      };
    })
    .filter((c) => c.hash && c.subject);
}

const MAX_DISPLAY = 30;

function deriveDetail(subject) {
  if (!subject) return '';
  const stripped = subject.replace(/^(feat|fix|docs|chore|refactor|test|style|perf)(\([^)]+\))?!?:\s*/i, '');
  return stripped.length > 0 && stripped !== subject ? stripped : '';
}

function commitDetail(subject, body) {
  const fromBody = body
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  const detail = fromBody || deriveDetail(subject);
  if (!detail) return '';
  const normalizedSubject = subject.replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedDetail = detail.replace(/\s+/g, ' ').trim().toLowerCase();
  if (normalizedDetail === normalizedSubject) return '';
  if (normalizedSubject.includes(normalizedDetail) || normalizedDetail.includes(normalizedSubject)) {
    return fromBody ? detail : '';
  }
  return detail;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCommitsHtml(commits, rangeLabel, totalCount) {
  if (commits.length === 0) {
    return [
      '<p class="commits-meta">No commits found for the current range.</p>',
      '<ul class="commit-list"></ul>'
    ].join('\n');
  }

  const displayed = commits.slice(0, MAX_DISPLAY);
  const truncated = totalCount > displayed.length;
  const metaParts = [rangeLabel];
  if (truncated) {
    metaParts.push(`showing ${displayed.length} most recent of ${totalCount}`);
  }
  metaParts.push(`generated ${new Date().toISOString().slice(0, 10)}`);

  const items = displayed
    .map(({ hash, subject, detail }) => {
      const detailHtml = detail
        ? `<span class="commit-detail">${escapeHtml(detail)}</span>`
        : '';
      return [
        '<li>',
        `  <code class="commit-hash">${escapeHtml(hash)}</code>`,
        `  <span class="commit-subject">${escapeHtml(subject)}</span>`,
        detailHtml ? `  ${detailHtml}` : '',
        '</li>'
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    `<p class="commits-meta">${escapeHtml(metaParts.join(' · '))}</p>`,
    '<ul class="commit-list">',
    items,
    '</ul>'
  ].join('\n');
}

function injectCommits(html, commitsHtml) {
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Missing ${START_MARKER} / ${END_MARKER} markers in ${HTML_PATH}`);
  }

  const before = html.slice(0, start + START_MARKER.length);
  const after = html.slice(end);
  return `${before}\n${commitsHtml}\n      ${after}`;
}

function main() {
  if (!fs.existsSync(HTML_PATH)) {
    console.error(`✗ HTML not found: ${HTML_PATH}`);
    process.exit(1);
  }

  const { range, label } = resolveCommitRange();
  const commits = parseCommits(range);
  const commitsHtml = buildCommitsHtml(commits, label, commits.length);
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const updated = injectCommits(html, commitsHtml);

  fs.writeFileSync(HTML_PATH, updated, 'utf8');
  console.log(`✓ Injected ${commits.length} commit(s) into docs/EXECUTIVE-OVERVIEW.html (${label})`);
}

main();
