import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const COMPONENTS_DIR = join(ROOT, 'src', 'components');
const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const INLINE_STYLE_PATTERN = /style\s*=\s*\{\{/g;
const strictMode = process.argv.includes('--strict');

const violations = [];

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!FILE_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) {
      continue;
    }
    const content = await readFile(fullPath, 'utf8');
    const matches = content.match(INLINE_STYLE_PATTERN);
    if (matches && matches.length > 0) {
      violations.push({ path: fullPath.replace(`${ROOT}/`, ''), count: matches.length });
    }
  }
};

const main = async () => {
  await walk(COMPONENTS_DIR);

  if (!violations.length) {
    console.log('Component standards check passed: no inline style blocks found in src/components.');
    return;
  }

  const prefix = strictMode ? 'failed' : 'warning';
  const out = strictMode ? console.error : console.warn;
  out(`Component standards check ${prefix}: inline style blocks detected in src/components.`);
  violations
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach(({ path, count }) => {
      out(` - ${path} (${count} match${count === 1 ? '' : 'es'})`);
    });
  if (strictMode) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Component standards check failed with runtime error:', error);
  process.exit(1);
});

