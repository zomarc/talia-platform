import { supabaseDataService } from '../../services/supabase.js';

export const projectSummaryQueryResolvers = {
  projectSummaryLatest: async () => {
    try {
      const { data, error } = await supabaseDataService.client
        .from('project_summary')
        .select('*')
        .eq('is_current', true)
        .order('generated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('Error fetching project summary (table may not exist yet):', error.message);
        return null;
      }

      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return null;

      return {
        id: String(row.id),
        title: row.title || 'Project Summary',
        version: row.version || null,
        format: row.format || 'html',
        content: row.content || '',
        sourcePath: row.source_path || null,
        generatedAt: row.generated_at || null
      };
    } catch (error: any) {
      console.warn('Error in projectSummaryLatest resolver:', error?.message || error);
      return null;
    }
  }
};
