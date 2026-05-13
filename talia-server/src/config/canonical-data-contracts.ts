export type CanonicalFieldContract = {
  field: string;
  type: string;
  required: boolean;
  description: string;
};

export type CanonicalModelContract = {
  model: string;
  grain: string;
  description: string;
  sourcePriority: string[];
  provenanceFields: string[];
  fields: CanonicalFieldContract[];
};

export const CANONICAL_DATA_CONTRACTS: CanonicalModelContract[] = [
  {
    model: 'capacity_fact',
    grain: 'sail_code + cabin_category + as_of_date',
    description: 'Canonical capacity facts for ship/sail/cabin capacity monitoring.',
    sourcePriority: ['stg capacity candidate (when validated)', 'dwh.Dim_Sail_By_Cabin_Occupancy'],
    provenanceFields: ['source_table', 'source_confidence', 'source_refreshed_at'],
    fields: [
      { field: 'sail_code', type: 'string', required: true, description: 'Canonical sailing code.' },
      { field: 'ship_code', type: 'string', required: true, description: 'Ship code.' },
      { field: 'cabin_category', type: 'string', required: true, description: 'Cabin category code.' },
      { field: 'total_cabins', type: 'integer', required: true, description: 'Total cabin capacity.' },
      { field: 'occupied_cabins', type: 'integer', required: false, description: 'Occupied cabins at snapshot.' },
      { field: 'remaining_cabins', type: 'integer', required: false, description: 'Remaining cabins at snapshot.' },
      { field: 'as_of_date', type: 'date', required: true, description: 'Snapshot date for this fact.' }
    ]
  },
  {
    model: 'availability_fact',
    grain: 'sail_code + cabin_category + snapshot_date',
    description: 'Canonical availability facts at sail/cabin grain.',
    sourcePriority: ['stg availability candidate (when validated)', 'dwh.Dim_Cabin_Availability'],
    provenanceFields: ['source_table', 'source_confidence', 'source_refreshed_at'],
    fields: [
      { field: 'sail_code', type: 'string', required: true, description: 'Canonical sailing code.' },
      { field: 'cabin_category', type: 'string', required: true, description: 'Cabin category code.' },
      { field: 'available_cabins', type: 'integer', required: true, description: 'Bookable cabins.' },
      { field: 'total_cabins', type: 'integer', required: true, description: 'Total cabins in inventory.' },
      { field: 'availability_result', type: 'string', required: false, description: 'Availability status label.' },
      { field: 'snapshot_date', type: 'date', required: true, description: 'Date of captured availability.' }
    ]
  },
  {
    model: 'promotion_active_fact',
    grain: 'promo_code + applicability_scope + as_of_date',
    description: 'Canonical active-promotion applicability model.',
    sourcePriority: ['stg.RES_PROMOTION', 'published rates promo context'],
    provenanceFields: ['source_table', 'source_confidence', 'source_refreshed_at'],
    fields: [
      { field: 'promo_code', type: 'string', required: true, description: 'Promotion identifier.' },
      { field: 'res_id', type: 'string', required: false, description: 'Reservation-linked scope when available.' },
      { field: 'is_active', type: 'boolean', required: true, description: 'Whether promo is currently active.' },
      { field: 'active_from', type: 'date', required: false, description: 'Promotion start date if available.' },
      { field: 'active_to', type: 'date', required: false, description: 'Promotion end date if available.' },
      { field: 'as_of_date', type: 'date', required: true, description: 'Materialization/snapshot date.' }
    ]
  },
  {
    model: 'booking_event_fact',
    grain: 'res_id + event_date + event_type',
    description: 'Canonical reservation lifecycle events.',
    sourcePriority: ['stg.RES_HEADER_SNAPSHOT', 'derived backfill from stg.RES_HEADER'],
    provenanceFields: ['source_table', 'source_confidence', 'source_refreshed_at'],
    fields: [
      { field: 'res_id', type: 'string', required: true, description: 'Reservation id.' },
      { field: 'sail_code', type: 'string', required: false, description: 'Sailing code (enriched if missing).' },
      { field: 'event_type', type: 'string', required: true, description: 'created/updated/cancelled/etc.' },
      { field: 'event_date', type: 'date', required: true, description: 'Event timestamp date.' },
      { field: 'delta', type: 'json', required: false, description: 'Field-level change payload.' }
    ]
  },
  {
    model: 'booking_profile_fact',
    grain: 'sail_code + week_label + series_kind',
    description: 'Canonical profile series for ACTUAL, PRIOR_YEAR_REP, TARGET.',
    sourcePriority: ['derived server-side from reservation + target tables'],
    provenanceFields: ['source_table', 'source_confidence', 'source_refreshed_at'],
    fields: [
      { field: 'sail_code', type: 'string', required: true, description: 'Canonical sailing code.' },
      { field: 'week_label', type: 'string', required: true, description: 'Week-to-sail bucket label.' },
      { field: 'weeks_until_sailing', type: 'integer', required: true, description: 'Weeks until sailing.' },
      { field: 'series_kind', type: 'string', required: true, description: 'ACTUAL/PRIOR_YEAR_REP/TARGET.' },
      { field: 'bookings', type: 'integer', required: false, description: 'Series booking count.' },
      { field: 'guests', type: 'integer', required: false, description: 'Series guest count.' }
    ]
  }
];

export const getCanonicalDataContracts = () => CANONICAL_DATA_CONTRACTS;
