export type ExternalFeedContract = {
  feedKey: string;
  domain: 'competitor' | 'ship_location' | 'search';
  owner: string;
  requiredFreshnessMinutes: number;
  staleAfterMinutes: number;
  requiredFields: string[];
  keyFields: string[];
  reliabilityRules: string[];
};

export const EXTERNAL_FEED_CONTRACTS: ExternalFeedContract[] = [
  {
    feedKey: 'competitor_current_state',
    domain: 'competitor',
    owner: 'pricing-intel',
    requiredFreshnessMinutes: 240,
    staleAfterMinutes: 720,
    requiredFields: [
      'snapshot_date',
      'cruise_line',
      'ship_name',
      'departure_date',
      'duration',
      'currency'
    ],
    keyFields: ['competitor_key'],
    reliabilityRules: [
      'Rows without price values are dropped from recommendation inputs.',
      'Use latest snapshot_date only when requested by consumer.',
      'Flag feed stale when no new snapshot within staleAfterMinutes.'
    ]
  },
  {
    feedKey: 'competitor_benchmark',
    domain: 'competitor',
    owner: 'pricing-intel',
    requiredFreshnessMinutes: 240,
    staleAfterMinutes: 720,
    requiredFields: [
      'snapshot_date',
      'cruise_line_name',
      'source_ship_name',
      'departure_date',
      'cruise_duration',
      'cabin_type',
      'currency_code'
    ],
    keyFields: ['snapshot_date', 'cruise_line_code', 'ship_code', 'departure_date', 'cabin_type', 'source_market'],
    reliabilityRules: [
      'Separate from competitor_current_state (stg.COMPETITOR).',
      'Sync only Is_Latest_Snapshot = Y; historical scrape days are not needed for the panel.',
      'Date window is Departure_Date (voyage), not Snapshot_Date (scrape).',
      'ship_code is the competitor ship, not inventory_item.ship_code.'
    ]
  },
  {
    feedKey: 'ship_position_logs',
    domain: 'ship_location',
    owner: 'ops-intel',
    requiredFreshnessMinutes: 15,
    staleAfterMinutes: 60,
    requiredFields: ['mmsi', 'captured_at', 'latitude', 'longitude'],
    keyFields: ['mmsi', 'captured_at'],
    reliabilityRules: [
      'Ignore points outside valid geo ranges.',
      'Mark stale when latest position older than staleAfterMinutes.',
      'Expose staleness status to UI consumers.'
    ]
  },
  {
    feedKey: 'google_search_trends',
    domain: 'search',
    owner: 'demand-intel',
    requiredFreshnessMinutes: 1440,
    staleAfterMinutes: 4320,
    requiredFields: ['query', 'fetched_at', 'interest_score'],
    keyFields: ['query', 'fetched_at'],
    reliabilityRules: [
      'Deduplicate by query + fetched_at.',
      'Discard malformed points (null query or score).',
      'Mark stale when latest pull exceeds staleAfterMinutes.'
    ]
  }
];

export const getExternalFeedContracts = () => EXTERNAL_FEED_CONTRACTS;
