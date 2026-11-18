/**
 * Panel lineage key flags — ADMIN+/SUPER_USER.
 * Soft coverage highlighting for source remapping (D015).
 */

import { supabaseDataService } from '../../services/supabase.js';
import { currentUserKey, requireProjectAdmin } from './projectRecordLinks.js';

export const panelLineageQueryResolvers = {
  panelLineageFlags: async (_parent: any, _args: any, context: any) => {
    requireProjectAdmin(context);
    return supabaseDataService.getPanelLineageFlags();
  },
};

export const panelLineageMutationResolvers = {
  setPanelLineageKey: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const panelComponent = String(args?.panelComponent || '').trim();
    if (!panelComponent) throw new Error('panelComponent is required');
    return supabaseDataService.setPanelLineageKey(
      panelComponent,
      Boolean(args?.isKey),
      currentUserKey(context),
    );
  },
};
