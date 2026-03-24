import { gql } from '@apollo/client';
import { apolloClient } from '../../lib/apolloClient';
import { trackedApolloMutate, trackedApolloQuery } from './trackedGraphql';

const GET_INVENTORY_ITEMS = gql`
  query GetInventoryItemsForSeries($filters: InventoryItemFilters) {
    inventoryItems(filters: $filters) {
      id
      sailCode
      referenceSailCode
      shipCode
    }
  }
`;

const GET_INVENTORY_PROFILE_SERIES = gql`
  query GetInventoryProfileSeries($inventoryItemId: ID!) {
    inventoryItemProfileSeries(inventoryItemId: $inventoryItemId) {
      inventoryItemId
      kind
      modelKey
      modelLabel
      profileScope
      ownerKey
      lastEditedBy
      points {
        pointOrder
        weekLabel
        weeksUntilSailing
        valueBookings
        valueGuests
        asOfDate
        source
        metadata
      }
    }
  }
`;

const UPSERT_INVENTORY_PROFILE_SERIES = gql`
  mutation UpsertInventoryProfileSeries($input: InventoryProfileSeriesInput!) {
    upsertInventoryProfileSeries(input: $input) {
      inventoryItemId
      kind
      modelKey
      modelLabel
      profileScope
      ownerKey
      lastEditedBy
      points {
        pointOrder
        weekLabel
        weeksUntilSailing
        valueBookings
        valueGuests
        asOfDate
        source
        metadata
      }
    }
  }
`;

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const roundCount = (value, max) => {
  const n = toNumberOrNull(value);
  if (n == null) return null;
  return Math.min(max, Math.max(0, Math.round(n)));
};

const normalizePoint = (point) => ({
  pointOrder: Number.isFinite(Number(point?.pointOrder)) ? Number(point.pointOrder) : 0,
  weekLabel: point?.weekLabel || `W-${point?.weeksUntilSailing ?? 0}`,
  weeksUntilSailing: Number.isFinite(Number(point?.weeksUntilSailing)) ? Number(point.weeksUntilSailing) : null,
  valueBookings: roundCount(point?.valueBookings, 25_000_000),
  valueGuests: roundCount(point?.valueGuests, 200_000_000),
  asOfDate: point?.asOfDate || null,
  source: point?.source || null,
  metadata: point?.metadata || {},
});

class InventoryProfileSeriesService {
  async findInventoryItemBySailCode(sailCode) {
    if (!sailCode) return null;
    const code = String(sailCode).trim();
    if (!code) return null;

    const tryFilters = async (filters) => {
      const { data } = await trackedApolloQuery({
        client: apolloClient,
        query: GET_INVENTORY_ITEMS,
        variables: { filters: { ...filters, limit: 1 } },
        component: 'Inventory Profile Series',
        purpose: 'Resolve inventory item by sail code',
        tableName: 'inventory_item',
        options: { fetchPolicy: 'network-only' },
      });
      return data?.inventoryItems?.[0] || null;
    };

    const bySail = await tryFilters({ sailCode: code });
    if (bySail?.id) return bySail;
    const byReference = await tryFilters({ referenceSailCode: code });
    return byReference?.id ? byReference : null;
  }

  async fetchSeriesForInventoryItem(inventoryItemId) {
    if (!inventoryItemId) return [];
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_INVENTORY_PROFILE_SERIES,
      variables: { inventoryItemId: String(inventoryItemId) },
      component: 'Inventory Profile Series',
      purpose: 'Fetch unified REAL/TARGET/BUDGET/MODEL series',
      tableName: 'inventory_item_profile_curve_point',
      options: { fetchPolicy: 'network-only' },
    });

    return (data?.inventoryItemProfileSeries || []).map((series) => ({
      ...series,
      points: (series?.points || [])
        .map(normalizePoint)
        .sort((a, b) => (a.pointOrder || 0) - (b.pointOrder || 0)),
    }));
  }

  async upsertModelSeries({ inventoryItemId, modelKey, modelLabel, points }) {
    if (!inventoryItemId) {
      throw new Error('inventoryItemId is required');
    }
    const cleanPoints = (points || []).map((point, idx) => ({
      pointOrder: Number.isFinite(Number(point?.pointOrder)) ? Number(point.pointOrder) : idx,
      weekLabel: point?.weekLabel || `W-${point?.weeksUntilSailing ?? 0}`,
      weeksUntilSailing: Number.isFinite(Number(point?.weeksUntilSailing)) ? Number(point.weeksUntilSailing) : 0,
      valueBookings: Math.min(
        25_000_000,
        Math.max(0, Math.round(Number(point?.valueBookings || 0)))
      ),
      valueGuests: Math.min(
        200_000_000,
        Math.max(0, Math.round(Number(point?.valueGuests || 0)))
      ),
      asOfDate: point?.asOfDate || null,
      source: point?.source || 'talia_target_editor',
      metadata: point?.metadata || {},
    }));

    const { data } = await trackedApolloMutate({
      client: apolloClient,
      mutation: UPSERT_INVENTORY_PROFILE_SERIES,
      variables: {
        input: {
          inventoryItemId: String(inventoryItemId),
          kind: 'MODEL',
          modelKey: modelKey || 'talia-default',
          modelLabel: modelLabel || null,
          points: cleanPoints,
        },
      },
      component: 'Inventory Profile Series',
      purpose: 'Persist MODEL points in inventory profile curve store',
      tableName: 'inventory_item_profile_curve_point',
    });

    return data?.upsertInventoryProfileSeries || null;
  }
}

const inventoryProfileSeriesService = new InventoryProfileSeriesService();
export default inventoryProfileSeriesService;
