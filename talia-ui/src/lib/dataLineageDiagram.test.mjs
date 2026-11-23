import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLineageDiagramModel,
  lineageEdgeConnector,
} from './dataLineageDiagram.js';
import { selectVisibleLogicalLinks } from './dataLineageLogicalLinks.js';

const sharedFieldRows = [
  {
    id: 'field:promo_name',
    kind: 'field',
    field: 'promo_name',
    label: 'Package name',
    sourceLabel: 'fcu.GQL_PUBLISHED_RATES',
    usageCount: 20,
    taliaTables: ['published_rates_current_state'],
    components: [
      { panelId: 'published-rates', componentKey: 'PublishedRates', title: 'Published Rates', openCount: 20 },
      { panelId: 'promo-explorer', componentKey: 'PromoExplorer', title: 'Promo Explorer', openCount: 4 },
      { panelId: 'explorer', componentKey: 'Explorer', title: 'Explorer', openCount: 0 },
    ],
  },
  {
    id: 'component:PublishedRates',
    kind: 'component',
    panelId: 'published-rates',
    componentKey: 'PublishedRates',
    title: 'Published Rates',
    usageCount: 20,
    tables: [{
      taliaTable: 'published_rates_current_state',
      sourceLabel: 'fcu.GQL_PUBLISHED_RATES',
    }],
  },
];

test('Component filter scopes diagram to that panel only', () => {
  const model = buildLineageDiagramModel({
    rows: sharedFieldRows,
    orientation: 'fields',
    componentFilter: 'published-rates',
  });
  assert.match(model.mermaidSource, /Published Rates/);
  assert.doesNotMatch(model.mermaidSource, /Promo Explorer/);
  assert.doesNotMatch(model.mermaidSource, /cmp_explorer\b/);
  assert.equal(model.includeComponents, true);
});

test('Co-consumers restores shared-field fan-out under Component filter', () => {
  const model = buildLineageDiagramModel({
    rows: sharedFieldRows,
    orientation: 'fields',
    componentFilter: 'published-rates',
    includeCoConsumers: true,
  });
  assert.match(model.mermaidSource, /Published Rates/);
  assert.match(model.mermaidSource, /Promo Explorer/);
  assert.match(model.mermaidSource, /Explorer/);
  assert.equal(model.includeCoConsumers, true);
});

test('Clear Component filter keeps shared-field fan-out', () => {
  const model = buildLineageDiagramModel({
    rows: sharedFieldRows.filter((r) => r.kind === 'field'),
    orientation: 'fields',
    componentFilter: '',
  });
  assert.match(model.mermaidSource, /Published Rates/);
  assert.match(model.mermaidSource, /Promo Explorer/);
  assert.match(model.mermaidSource, /Explorer/);
});

test('Table orientation Component filter drops other consumers', () => {
  const rows = [
    {
      id: 'table:published_rates_current_state',
      kind: 'table',
      taliaTable: 'published_rates_current_state',
      sourceLabel: 'fcu.GQL_PUBLISHED_RATES',
      usageCount: 8,
      consumers: [
        { panelId: 'published-rates', componentKey: 'PublishedRates', title: 'Published Rates', openCount: 8 },
        { panelId: 'promo-explorer', componentKey: 'PromoExplorer', title: 'Promo Explorer', openCount: 1 },
      ],
    },
    {
      id: 'component:PublishedRates',
      kind: 'component',
      panelId: 'published-rates',
      componentKey: 'PublishedRates',
      title: 'Published Rates',
    },
  ];
  const model = buildLineageDiagramModel({
    rows,
    orientation: 'tables',
    componentFilter: 'PublishedRates',
  });
  assert.match(model.mermaidSource, /Published Rates/);
  assert.doesNotMatch(model.mermaidSource, /Promo Explorer/);
});

test('lineageEdgeConnector maps usage and logical kinds', () => {
  assert.equal(lineageEdgeConnector(0), '-.->');
  assert.equal(lineageEdgeConnector(3), '-->');
  assert.equal(lineageEdgeConnector(20), '==>');
  assert.equal(lineageEdgeConnector(99, 'logical'), '-.->');
});

test('Usage weighting emits muted / hot linkStyle', () => {
  const model = buildLineageDiagramModel({
    rows: sharedFieldRows.filter((r) => r.kind === 'field'),
    orientation: 'fields',
    componentFilter: '',
  });
  assert.match(model.mermaidSource, /==>/);
  assert.match(model.mermaidSource, /linkStyle \d+ stroke:/);
  assert.match(model.mermaidSource, /opacity:0\.35/);
});

test('Logical links only appear when both Talia tables are on canvas', () => {
  const rows = [
    {
      id: 'table:master_sail',
      kind: 'table',
      taliaTable: 'master_sail',
      sourceLabel: 'dwh.Dim_Master_Sail',
      usageCount: 5,
      consumers: [],
    },
    {
      id: 'table:inventory_item',
      kind: 'table',
      taliaTable: 'inventory_item',
      sourceLabel: '—',
      usageCount: 2,
      consumers: [],
    },
  ];
  const off = buildLineageDiagramModel({ rows, orientation: 'tables', showLogicalLinks: false });
  assert.equal(off.logicalLinkCount, 0);
  assert.doesNotMatch(off.mermaidSource, /logicalStroke|stroke-dasharray:6 4/);

  const on = buildLineageDiagramModel({ rows, orientation: 'tables', showLogicalLinks: true });
  assert.ok(on.logicalLinkCount >= 1);
  assert.match(on.mermaidSource, /stroke-dasharray:6 4/);
});

test('selectVisibleLogicalLinks ignores missing endpoints', () => {
  const links = selectVisibleLogicalLinks(['master_sail']);
  assert.equal(links.length, 0);
  const both = selectVisibleLogicalLinks(['master_sail', 'inventory_item']);
  assert.ok(both.some((l) => l.from === 'master_sail' && l.to === 'inventory_item'));
});
