import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInteractionModel,
  buildPresentationModel,
  eventChannelKey,
  normalizeEventName,
} from './componentInteractionsTransform.js';

const registry = {
  MasterSailingExplorer: {
    title: 'Master Sailing Explorer',
    category: 'Tables',
    events: { emits: ['talia:sail.select', 'talia:sail.clear'], respondsTo: [] },
  },
  MasterSailing: {
    title: 'Master Sailing',
    category: 'Tables',
    events: { emits: ['talia:sail.select', 'talia:sail.clear'], respondsTo: [] },
  },
  ShipDayBerth: {
    title: 'Ship × Day Berths',
    category: 'Tables',
    events: {
      emits: [],
      respondsTo: ['talia:sail.select', 'talia:sail.clear', 'talia:ship.select', 'talia:ship.clear'],
    },
  },
  ReservationCurrentState: {
    title: 'Reservation Current State',
    category: 'Tables',
    events: { emits: ['talia:reservation.select'], respondsTo: ['talia:sail.select'] },
  },
  CompetitorPricing: {
    title: 'Competitor Pricing',
    category: 'Dashboards',
    // legacy dotted alias should fold into the canonical Sailing channel
    events: { emits: [], respondsTo: ['talia:sail.select', 'talia.sail.select'] },
  },
  Agency: {
    title: 'Agency Directory',
    category: 'Tables',
    events: { emits: ['talia:agency.select'], respondsTo: ['talia:reservation.select'] },
  },
  LonelyGame: {
    title: 'Pong',
    category: 'Fun',
    events: { emits: [], respondsTo: [] },
  },
};

test('normalizeEventName folds the legacy dotted sail alias', () => {
  assert.equal(normalizeEventName('talia.sail.select'), 'talia:sail.select');
  assert.equal(normalizeEventName('talia:ship.clear'), 'talia:ship.clear');
  assert.equal(normalizeEventName(''), null);
});

test('eventChannelKey strips select/clear suffix', () => {
  assert.equal(eventChannelKey('talia:sail.select'), 'talia:sail');
  assert.equal(eventChannelKey('talia:sail.clear'), 'talia:sail');
  assert.equal(eventChannelKey('talia.sail.select'), 'talia:sail');
});

test('only wired channels (emitter AND listener) are returned as main interactions', () => {
  const { channels } = buildInteractionModel(registry);
  const keys = channels.map((c) => c.key);
  assert.ok(keys.includes('talia:sail'));
  assert.ok(keys.includes('talia:reservation'));
  // agency is emitted but nobody listens (non-canonical) -> not a main interaction
  assert.ok(!keys.includes('talia:agency'));
});

test('canonical ship channel is surfaced even without an emitter, flagged incomplete', () => {
  const { channels } = buildInteractionModel(registry);
  const ship = channels.find((c) => c.key === 'talia:ship');
  assert.ok(ship, 'ship channel should be present');
  assert.equal(ship.emitters.length, 0);
  assert.ok(ship.listeners.length > 0);
  assert.equal(ship.incomplete, true);
});

test('canonical channels sort first', () => {
  const { channels } = buildInteractionModel(registry);
  assert.ok(channels[0].canonical);
  assert.equal(channels[0].key, 'talia:sail');
});

test('sail channel aggregates emitters and listeners, dedupes alias', () => {
  const { channels } = buildInteractionModel(registry);
  const sail = channels.find((c) => c.key === 'talia:sail');
  assert.deepEqual(sail.emitters.map((e) => e.name).sort(), ['MasterSailing', 'MasterSailingExplorer']);
  assert.ok(sail.listeners.some((l) => l.name === 'ShipDayBerth'));
  assert.ok(sail.listeners.some((l) => l.name === 'CompetitorPricing'));
  assert.equal(sail.label, 'Sailing selection');
});

test('summary counts reflect participation', () => {
  const { summary } = buildInteractionModel(registry);
  assert.equal(summary.totalPanels, 7);
  assert.equal(summary.canonicalChannels, 2);
  assert.ok(summary.participatingPanels >= 4);
  // the lonely game never participates
  assert.ok(summary.participatingPanels < summary.totalPanels);
});

test('includeUnlinked surfaces dangling contracts', () => {
  const { unlinked } = buildInteractionModel(registry, { includeUnlinked: true });
  assert.ok(unlinked.some((c) => c.key === 'talia:agency'));
});

test('presentation model splits physical vs selling around the inventory_item hub', () => {
  const model = buildPresentationModel(registry);

  assert.equal(model.hub.table, 'inventory_item');
  assert.equal(model.hub.key, 'reference_sail_code');

  // Physical side is the ship-channel participant.
  const physicalNames = [...model.physical.drivers, ...model.physical.responders].map((p) => p.name);
  assert.ok(physicalNames.includes('ShipDayBerth'));

  // Selling drivers are the sail emitters; ShipDayBerth must not leak into selling.
  const sellingDrivers = model.selling.drivers.map((p) => p.name).sort();
  assert.deepEqual(sellingDrivers, ['MasterSailing', 'MasterSailingExplorer']);
  const sellingNames = [...model.selling.drivers, ...model.selling.responders].map((p) => p.name);
  assert.ok(!sellingNames.includes('ShipDayBerth'));

  // Selling responders include the reservation listener and are categorized.
  assert.ok(model.selling.responders.some((p) => p.name === 'ReservationCurrentState'));
  assert.ok(model.selling.responderCount >= 1);
  assert.ok(model.selling.responderCategories.length >= 1);
  assert.ok(model.selling.responderCategories.every((c) => c.category && c.count > 0));
});
