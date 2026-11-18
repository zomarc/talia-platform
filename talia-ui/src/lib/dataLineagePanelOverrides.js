/**
 * Manual lineage overrides where scraped tableName tags understate server deps,
 * or non-Tabulator panels need explicit column provenance.
 *
 * tables / columns here win over scrape + free-text extract.
 */

const HISTORIC_MR_COLUMNS = [
  { name: 'groupId', provenance: 'sourceMrPath / sourceMrPathDays' },
  { name: 'shipCode', provenance: 'sourceMrPath groups/highlights' },
  { name: 'sailDateFrom', provenance: 'sourceMrPath (+ master_sail resolve)' },
  { name: 'sailDateTo', provenance: 'sourceMrPath (+ master_sail resolve)' },
  { name: 'holdDate', provenance: 'sourceMrPath last hold before departure' },
  { name: 'status', provenance: 'sourceMrPath / header day status' },
  { name: 'requestedGuests', provenance: 'sourceMrPath / path days' },
  { name: 'namedGuests', provenance: 'sourceMrPath / path days' },
  { name: 'sourceMr', provenance: 'source probability on hold / day' },
  { name: 'taliaMr', provenance: 'replayed Talia MR on hold / day' },
  { name: 'sourceExpectedGuests', provenance: 'requested × sourceMr' },
  { name: 'taliaExpectedGuests', provenance: 'requested × taliaMr' },
  { name: 'changedDate', provenance: 'sourceMrPathDays day series' },
  { name: 'sail_code', provenance: 'master_sail (window resolve)' },
  { name: 'ship_code', provenance: 'master_sail (window resolve)' },
];

const SOURCE_MR_COLUMNS = [
  { name: 'group_id', provenance: 'sw_etl_group / sourceMrReview' },
  { name: 'ship_code', provenance: 'sw_etl_group_ship / inventory_item' },
  { name: 'sail_date_from', provenance: 'sw_etl_group / master_sail' },
  { name: 'n_of_guests', provenance: 'requested guests on extract' },
  { name: 'n_of_delegate_guests', provenance: 'named guests on extract' },
  { name: 'probability', provenance: 'source MR on extract' },
  { name: 'talia_mr', provenance: 'independent Talia MR (MR01)' },
];

/** @type {Record<string, { tables?: string[], columns?: Array<{ name: string, provenance: string }> }>} */
export const DATA_LINEAGE_PANEL_OVERRIDES = {
  HistoricMrPath: {
    tables: [
      'master_sail',
      'sw_etl_group',
      'sw_etl_group_header',
      'sw_etl_group_ship',
    ],
    columns: HISTORIC_MR_COLUMNS,
  },
  MrRetrospect: {
    tables: [
      'master_sail',
      'sw_etl_group',
      'sw_etl_group_header',
      'sw_etl_group_ship',
    ],
    columns: HISTORIC_MR_COLUMNS,
  },
  SourceMrReview: {
    tables: [
      'inventory_item',
      'master_sail',
      'sw_etl_group',
      'sw_etl_group_header',
      'sw_etl_group_ship',
      'sw_etl_extract_load',
    ],
    columns: SOURCE_MR_COLUMNS,
  },
  GroupsExplorer: {
    tables: ['agency', 'inventory_item', 'reservation', 'sail_booking_summary'],
  },
  TaliaMrMethod: {
    tables: ['reservation'],
    columns: [
      { name: 'group_id', provenance: 'reservation (live book) or worked example' },
      { name: 'probability', provenance: 'source MR input to MR01' },
      { name: 'n_of_guests', provenance: 'requested guests' },
      { name: 'n_of_delegate_guests', provenance: 'named guests' },
      { name: 'talia_mr', provenance: 'MR01 output' },
    ],
  },
};

export default DATA_LINEAGE_PANEL_OVERRIDES;
