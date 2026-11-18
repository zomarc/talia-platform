import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKnownTableNames,
  buildPanelCatalog,
  extractTablesFromRequirements,
  resolvePanelTables,
} from './dataLineageCatalog.js';
import {
  buildComponentOrientationRows,
  buildSelectionDetail,
  buildSynapseEdges,
  buildTableOrientationRows,
  filterRowsByCategory,
  filterRowsByScope,
  indexEtlReferenceByTarget,
  indexUsageByPanel,
  listLineageCategories,
  sinceMinutesForRecency,
  usageIntensity,
  withUsageIntensity,
} from './dataLineageView.js';

test('extractTablesFromRequirements finds known tokens without partials', () => {
  const known = buildKnownTableNames({
    reservation: { source: 'stg.RES_HEADER' },
    agency: { source: 'dwh.Dim_Agency' },
  });
  const tables = extractTablesFromRequirements(
    'Requires reservation (+ occupancy) and agency. Not reservation_current_state here unless listed.',
    known,
  );
  assert.ok(tables.includes('reservation'));
  assert.ok(tables.includes('agency'));
});

test('extractTablesFromRequirements does not treat ship/dates as Dim ship', () => {
  const known = buildKnownTableNames({
    ship: { source: 'dwh.Dim_Ship' },
    master_sail: { source: 'dwh.Dim_Master_Sail' },
  });
  const tables = extractTablesFromRequirements(
    'Frozen SW_ETL group header history. Sail.select narrows ship/dates; group.select picks the path series.',
    known,
  );
  assert.ok(!tables.includes('ship'));
});

test('HistoricMrPath resolves real SW_ETL tables, not ship', () => {
  const tables = resolvePanelTables('HistoricMrPath', {
    dataRequirements: 'Frozen SW_ETL group header history. Sail.select narrows ship/dates.',
  });
  assert.deepEqual(
    tables.sort(),
    ['master_sail', 'sw_etl_group', 'sw_etl_group_header', 'sw_etl_group_ship'].sort(),
  );
  assert.ok(!tables.includes('ship'));
});

test('buildPanelCatalog skips mock-only panels and keeps table deps', () => {
  const known = buildKnownTableNames({ master_sail: { source: 'dwh.Dim_Master_Sail' } });
  const catalog = buildPanelCatalog({
    // Unique keys so scraped catalog for real panels does not bleed into the test.
    LineageTestExplorer: {
      panelId: 'lineage-test-explorer',
      title: 'Lineage Test Explorer',
      category: 'Inventory',
      showInReports: true,
      dataRequirements: 'Requires master_sail and inventory_item',
    },
    LineageFakeGame: {
      panelId: 'lineage-fake-game',
      title: 'Fake',
      showInReports: true,
      dataRequirements: 'Uses mock data',
    },
  }, known);
  assert.equal(catalog.length, 1);
  assert.deepEqual(catalog[0].tables.sort(), ['inventory_item', 'master_sail'].sort());
});

test('table orientation uses Synapse source, not ETL as primary', () => {
  const synapse = buildSynapseEdges({
    agency: { source: 'dwh.Dim_Agency', type: 'direct' },
    reservation: { source: 'stg.RES_HEADER', type: 'direct' },
    unused_mapped: { source: 'dwh.Something', type: 'direct' },
  });
  const etl = indexEtlReferenceByTarget([
    { source_schema: 'SEAWARE', source_tablename: 'AGENCY', target_tablename: 'agency', upsert_id: 'agency_id' },
  ]);
  const panels = [
    { componentKey: 'Agency', panelId: 'agency', title: 'Agency', tables: ['agency'] },
    { componentKey: 'Distribution', panelId: 'distribution', title: 'Distribution', tables: ['reservation', 'agency'] },
  ];
  const usage = indexUsageByPanel([
    { panelComponent: 'Agency', openCount: 2, lastAt: '2026-01-01', roles: ['MANAGER'] },
    { panelComponent: 'Distribution', openCount: 10, lastAt: '2026-01-02', roles: ['ADMIN'] },
  ], panels);
  const allRows = withUsageIntensity(buildTableOrientationRows({
    synapseEdges: synapse,
    panelCatalog: panels,
    usageMap: usage,
    etlByTarget: etl,
  }));
  const agency = allRows.find((r) => r.taliaTable === 'agency');
  assert.equal(agency.sourceLabel, 'dwh.Dim_Agency');
  assert.equal(agency.synapseSource, 'dwh.Dim_Agency');
  assert.deepEqual(agency.etlSources, ['SEAWARE.AGENCY']);
  assert.equal(agency.usageCount, 12);

  const usedOnly = filterRowsByScope(allRows, 'used', 'tables');
  assert.ok(usedOnly.every((r) => r.consumerCount > 0));
  assert.ok(!usedOnly.some((r) => r.taliaTable === 'unused_mapped'));

  const openedOnly = filterRowsByScope(allRows, 'opened', 'tables');
  assert.ok(openedOnly.every((r) => r.usageCount > 0));
  assert.equal(usageIntensity(12, 12), 'high');
});

test('component detail includes override columns for Historic MR path', () => {
  const catalog = buildPanelCatalog({
    HistoricMrPath: {
      panelId: 'historic-mr-path',
      title: 'Historic MR path',
      showInReports: true,
      tables: ['master_sail', 'sw_etl_group', 'sw_etl_group_header', 'sw_etl_group_ship'],
      dataRequirements: 'sourceMrPath',
    },
  }, []);
  const rows = buildComponentOrientationRows(catalog, new Map(), new Map());
  const detail = buildSelectionDetail({
    selection: rows[0],
    fieldByPanel: new Map(),
    tableSourcesMap: {
      master_sail: { source: 'dwh.Dim_Master_Sail' },
      sw_etl_group: { source: 'stg.SW_ETL_GROUPS' },
    },
  });
  assert.ok(detail.summary?.length);
  assert.ok(detail.lineage?.length >= 4);
  assert.ok(detail.columns.some((c) => c.name === 'groupId'));
  assert.ok(detail.columns.some((c) => c.name === 'sourceMr'));
});

test('component orientation sorts by open count', () => {
  const panels = [
    { componentKey: 'A', panelId: 'a', title: 'Alpha', tables: ['agency'], category: 'X', dataRequirements: '' },
    { componentKey: 'B', panelId: 'b', title: 'Beta', tables: ['reservation'], category: 'X', dataRequirements: '' },
  ];
  const usage = indexUsageByPanel([
    { panelComponent: 'A', openCount: 1, roles: ['USER'] },
    { panelComponent: 'B', openCount: 5, roles: ['ADMIN'] },
  ], panels);
  const rows = buildComponentOrientationRows(panels, usage, new Map());
  assert.equal(rows[0].title, 'Beta');
  assert.equal(rows[0].usageCount, 5);
});

test('usage index folds Options: and titles onto panelId', () => {
  const panels = [
    {
      componentKey: 'MasterSailingExplorer',
      panelId: 'master-sailing-explorer',
      title: 'Master Sailing Explorer',
      tables: ['master_sail'],
    },
  ];
  const usage = indexUsageByPanel([
    { panelComponent: 'Options:master-sailing-explorer', openCount: 10, roles: ['ADMIN'] },
    { panelComponent: 'Master Sailing Explorer', openCount: 5, roles: ['MANAGER'] },
    { panelComponent: 'master-sailing-explorer', openCount: 2, roles: ['ADMIN'] },
  ], panels);
  const hit = usage.get('master-sailing-explorer');
  assert.equal(hit.openCount, 17);
  assert.deepEqual(hit.roles, ['ADMIN', 'MANAGER']);
});

test('Role/User/Recency filters re-rank via usage map without dropping edges', () => {
  const panels = [
    { componentKey: 'Alpha', panelId: 'alpha', title: 'Alpha', tables: ['agency'], category: 'Tables', dataRequirements: '' },
    { componentKey: 'Beta', panelId: 'beta', title: 'Beta', tables: ['reservation'], category: 'Tables', dataRequirements: '' },
    { componentKey: 'Gamma', panelId: 'gamma', title: 'Gamma', tables: ['budget'], category: 'Tables', dataRequirements: '' },
  ];

  // Simulated server aggregate for Role=ADMIN + Recency=7d (Gamma unused in window).
  const filteredUsage = indexUsageByPanel([
    { panelComponent: 'Alpha', openCount: 8, lastAt: '2026-11-10', roles: ['ADMIN'] },
    { panelComponent: 'Beta', openCount: 2, lastAt: '2026-11-09', roles: ['ADMIN'] },
  ]);
  assert.equal(sinceMinutesForRecency('7d'), 7 * 24 * 60);

  const ranked = withUsageIntensity(
    buildComponentOrientationRows(panels, filteredUsage, new Map()),
  );
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].title, 'Alpha');
  assert.equal(ranked[0].usageCount, 8);
  assert.equal(ranked[0].intensity, 'high');
  assert.equal(ranked[2].title, 'Gamma');
  assert.equal(ranked[2].usageCount, 0);
  assert.equal(ranked[2].intensity, 'none');

  // User filter simulation: only Beta opened by that user.
  const userUsage = indexUsageByPanel([
    { panelComponent: 'Beta', openCount: 3, lastAt: '2026-11-11', roles: ['MANAGER'] },
  ]);
  const byUser = withUsageIntensity(
    buildComponentOrientationRows(panels, userUsage, new Map()),
  );
  assert.equal(byUser[0].title, 'Beta');
  assert.equal(byUser.filter((r) => r.usageCount === 0).length, 2);
});

test('sinceMinutesForRecency maps windows', () => {
  assert.equal(sinceMinutesForRecency('7d'), 7 * 24 * 60);
  assert.equal(sinceMinutesForRecency('all'), null);
});

test('category filter defaults to Application (excludes Admin)', () => {
  const rows = [
    { title: 'Docs', category: 'Admin' },
    { title: 'MR', category: 'Reports' },
    { title: 'Ship', category: 'Dashboards' },
  ];
  assert.deepEqual(listLineageCategories(rows), ['Admin', 'Dashboards', 'Reports']);
  const app = filterRowsByCategory(rows, 'application');
  assert.deepEqual(app.map((r) => r.title).sort(), ['MR', 'Ship']);
  assert.equal(filterRowsByCategory(rows, 'admin').length, 1);
  assert.equal(filterRowsByCategory(rows, 'Reports')[0].title, 'MR');
  assert.equal(filterRowsByCategory(rows, 'all').length, 3);
});
