/**
 * Source MR effectiveness — frozen SW_ETL extract, aggregated for the review panel.
 */

import { supabase } from '../../services/supabase.js';
import { buildSourceMrReview, dateKey, testCandidateGroupIds } from '../../services/sourceMrReview.js';

const GROUP_COLUMNS = [
  'rec_group_id',
  'group_id',
  'group_status',
  'changed_date',
  'sail_date_from',
  'sail_date_to',
  'n_of_guests',
  'n_of_cabins',
  'n_of_delegate_guests',
  'probability',
  'is_prob_manual',
].join(',');

const SHIP_COLUMNS = 'rec_group_id, ship_code, sail_id';

const HISTORY_COLUMNS = [
  'group_id',
  'changed_date',
  'group_status',
  'n_of_guests',
  'probability',
  'is_prob_manual',
].join(',');

const fetchAll = async (table: string, columns: string) => {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; from < 500000; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

const mapHistory = (rows: any[]) => rows.map((row) => ({
  changedDate: row.changed_date || null,
  status: String(row.group_status || '').trim() || null,
  probability: row.probability == null ? null : Number(row.probability),
  requestedGuests: row.n_of_guests == null ? null : Number(row.n_of_guests),
  manual: row.is_prob_manual === true,
}));

const loadHeaderActivity = async (groups: any[]) => {
  const ids = testCandidateGroupIds(groups);
  if (!ids.length) return new Map();
  const { data, error } = await supabase.rpc('sw_etl_header_activity', { group_ids: ids });
  if (error) {
    console.warn(`Source MR history activity skipped: ${error.message}`);
    return new Map();
  }
  return new Map((data || []).map((row: any) => [String(row.group_id), Number(row.change_days) || 0]));
};

const loadHistory = async (groupId: any) => {
  const id = Number(groupId);
  if (!Number.isFinite(id)) return [];
  const { data, error } = await supabase
    .from('sw_etl_group_header')
    .select(HISTORY_COLUMNS)
    .eq('group_id', id)
    .order('changed_date', { ascending: true })
    .limit(800);
  if (error) throw new Error(error.message);
  return mapHistory(data || []);
};

export const sourceMrReviewQueryResolvers = {
  sourceMrReview: async (_parent: unknown, args: { shipCode?: string | null, dateFrom?: string | null, dateTo?: string | null } = {}) => {
    const [groups, ships, loadRow, allocResult] = await Promise.all([
      fetchAll('sw_etl_group', GROUP_COLUMNS),
      fetchAll('sw_etl_group_ship', SHIP_COLUMNS),
      supabase
        .from('sw_etl_extract_load')
        .select('load_date')
        .eq('entity_type', 'GRP')
        .order('load_date', { ascending: false })
        .limit(1),
      supabase.from('sw_etl_alloc_by_owner').select('owner_type, allocation_rows, owners, avg_probability'),
    ]);

    if (loadRow.error) throw new Error(loadRow.error.message);
    if (allocResult.error) throw new Error(allocResult.error.message);

    const shipsByRecGroupId = new Map(
      ships.map((row) => [String(row.rec_group_id), row])
    );
    const activityByGroupId = await loadHeaderActivity(groups);
    const review = buildSourceMrReview({
      groups,
      shipsByRecGroupId,
      extractLoadThrough: loadRow.data?.[0]?.load_date || null,
      activityByGroupId,
      shipCode: args?.shipCode || null,
      dateFrom: args?.dateFrom || null,
      dateTo: args?.dateTo || null,
    });

    const history = review.candidate ? await loadHistory(review.candidate.groupId) : [];
    const candidate = review.candidate
      ? { ...review.candidate, versions: history.length, history }
      : null;

    return {
      ...review,
      feedThrough: dateKey(review.feedThrough),
      candidate,
      allocations: (allocResult.data || []).map((row: any) => ({
        ownerType: row.owner_type,
        allocationRows: Number(row.allocation_rows) || 0,
        owners: Number(row.owners) || 0,
        avgProbability: row.avg_probability == null ? null : Number(row.avg_probability),
      })),
    };
  },

  sourceMrGroupHistory: async (_parent: any, args: any) => {
    const history = await loadHistory(args?.groupId);
    return {
      groupId: String(args?.groupId || ''),
      versions: history.length,
      history,
    };
  },
};
