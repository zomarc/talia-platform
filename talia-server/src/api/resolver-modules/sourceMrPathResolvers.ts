/**
 * Historic MR path — sailed groups, last hold before departure.
 * As-of named is 0 when the header version has no named count (no hindsight).
 */

import { supabase } from '../../services/supabase.js';
import { dateKey } from '../../services/sourceMrReview.js';
import { buildSourceMrPath, buildSourceMrPathDays } from '../../services/sourceMrPath.js';

const fetchHolds = async () => {
  const pageSize = 2000;
  const rows: any[] = [];
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await supabase
      .rpc('sw_etl_mr_path_holds')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

export const sourceMrPathQueryResolvers = {
  sourceMrPath: async (_parent: unknown, args: { shipCode?: string | null, dateFrom?: string | null, dateTo?: string | null } = {}) => {
    const [holds, feed] = await Promise.all([
      fetchHolds(),
      supabase
        .from('sw_etl_group')
        .select('changed_date')
        .not('changed_date', 'is', null)
        .order('changed_date', { ascending: false })
        .limit(1),
    ]);
    if (feed.error) throw new Error(feed.error.message);
    const path = buildSourceMrPath({
      holds,
      shipCode: args?.shipCode || null,
      dateFrom: args?.dateFrom || null,
      dateTo: args?.dateTo || null,
    });
    return {
      ...path,
      feedThrough: dateKey(feed.data?.[0]?.changed_date),
    };
  },

  sourceMrPathDays: async (_parent: unknown, args: { groupId?: string | null } = {}) => {
    const id = Number(args?.groupId);
    if (!Number.isFinite(id)) {
      return buildSourceMrPathDays({ groupId: args?.groupId, days: [] });
    }
    const [days, group] = await Promise.all([
      supabase.rpc('sw_etl_mr_path_days', { p_group_id: id }),
      supabase
        .from('sw_etl_group')
        .select('sail_date_from, n_of_delegate_guests')
        .eq('group_id', id)
        .limit(1),
    ]);
    if (days.error) throw new Error(days.error.message);
    if (group.error) throw new Error(group.error.message);
    const row = group.data?.[0] || {};
    return buildSourceMrPathDays({
      groupId: id,
      sailDate: row.sail_date_from,
      finalNamed: row.n_of_delegate_guests,
      days: days.data || [],
    });
  },
};
