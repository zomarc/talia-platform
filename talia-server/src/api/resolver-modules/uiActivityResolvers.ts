import { supabaseDataService } from '../../services/supabase.js';

export const uiActivityQueryResolvers = {
  uiActivityEvents: async (_parent: any, args: any) => {
    try {
      const rows = await supabaseDataService.getUiActivityEvents({
        sinceMinutes: args?.sinceMinutes,
        limit: args?.limit,
        userId: args?.userId,
        userEmail: args?.userEmail
      });
      return (rows || []).map((row: any) => ({
        id: row.id,
        at: row.at,
        userId: row.user_id,
        userEmail: row.user_email,
        userRole: row.user_role,
        kind: row.kind,
        report: row.report,
        panelComponent: row.panel_component,
        purpose: row.purpose,
        status: row.status,
        performanceMs: row.performance_ms,
        queryCount: row.query_count,
        sourceQueryId: row.source_query_id,
        criteria: row.criteria || {}
      }));
    } catch (error) {
      console.error('Error fetching UI activity events:', error);
      return [];
    }
  },

  uiActivityPanelUsage: async (_parent: any, args: any) => {
    try {
      return await supabaseDataService.getUiActivityPanelUsage({
        sinceMinutes: args?.sinceMinutes,
        userId: args?.userId,
        userEmail: args?.userEmail,
        userRole: args?.userRole,
      });
    } catch (error) {
      console.error('Error fetching UI activity panel usage:', error);
      return [];
    }
  },
};

export const uiActivityMutationResolvers = {
  logUiActivityEvent: async (_parent: any, args: any) => {
    try {
      return await supabaseDataService.logUiActivityEvent(args?.input || {});
    } catch (error) {
      console.error('Error logging UI activity event:', error);
      return false;
    }
  },

  purgeUiActivityEvents: async (_parent: any, args: any) => {
    try {
      return await supabaseDataService.purgeUiActivityEvents(args?.olderThanHours);
    } catch (error) {
      console.error('Error purging UI activity events:', error);
      return 0;
    }
  },
};
