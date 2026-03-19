import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TARGET_DIRS = [
  join(ROOT, 'src', 'components', 'focus-panels'),
  join(ROOT, 'src', 'hooks'),
  join(ROOT, 'src', 'services', 'data')
];
const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const strictMode = process.argv.includes('--strict');
const violations = [];

const allowedDirectApolloFiles = new Set([
  join(ROOT, 'src', 'services', 'data', 'trackedGraphql.js')
]);

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!FILE_EXTENSIONS.has(extname(entry.name))) continue;
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) continue;
    const content = await readFile(fullPath, 'utf8');
    const relPath = fullPath.replace(`${ROOT}/`, '');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNo = index + 1;
      const fetchLiteral = line.match(/fetch\(\s*['"`]([^'"`]+)['"`]/);
      if (fetchLiteral) {
        const url = fetchLiteral[1];
        const isAllowedGraphql = url === '/api/graphql' || url === '/graphql';
        if (!isAllowedGraphql) {
          violations.push({
            path: relPath,
            line: lineNo,
            rule: 'ui-must-use-graphql-endpoint',
            detail: `Disallowed fetch endpoint "${url}" in UI data path`
          });
        }
      }

      const hasDirectApollo = /apolloClient\.(query|mutate)\(/.test(line);
      if (hasDirectApollo && !allowedDirectApolloFiles.has(fullPath)) {
        violations.push({
          path: relPath,
          line: lineNo,
          rule: 'use-tracked-apollo-helper',
          detail: 'Use trackedApolloQuery/trackedApolloMutate helpers instead of direct apolloClient calls'
        });
      }
    });
  }
};

const main = async () => {
  for (const dir of TARGET_DIRS) {
    await walk(dir);
  }

  if (!violations.length) {
    console.log('Data boundary check passed: UI data access is GraphQL-only and tracked.');
    return;
  }

  const prefix = strictMode ? 'failed' : 'warning';
  const out = strictMode ? console.error : console.warn;
  out(`Data boundary check ${prefix}: violations found in UI data-access paths.`);
  violations
    .sort((a, b) => `${a.path}:${a.line}`.localeCompare(`${b.path}:${b.line}`))
    .forEach(({ path, line, rule, detail }) => {
      out(` - ${path}:${line} [${rule}] ${detail}`);
    });
  if (strictMode) process.exit(1);
};

main().catch((error) => {
  console.error('Data boundary check failed with runtime error:', error);
  process.exit(1);
});
