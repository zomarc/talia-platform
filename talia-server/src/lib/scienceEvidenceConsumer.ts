/**
 * Future-source helpers for prior/peerset consumers (profile_model_map, Groups MR, Probability).
 * Consumers may cite Science Evidence; they must not invent Finding scores from it.
 */
import { supabase } from '../services/supabase.js';
import {
  attachScienceCitation,
  scienceEvidenceCitationFromRow,
  type ScienceEvidenceCitation,
} from './scienceEvidenceCitation.js';

export type { ScienceEvidenceCitation };
export { attachScienceCitation, scienceEvidenceCitationFromRow };

export async function loadSourceEvidenceForSail(
  sailCode: string
): Promise<{ evidence: any | null; citation: ScienceEvidenceCitation | null }> {
  const code = String(sailCode || '').trim();
  if (!code) return { evidence: null, citation: null };

  const { data, error } = await supabase
    .from('rm_science_evidence')
    .select('*')
    .eq('subject_id', code)
    .eq('role', 'source')
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { evidence: null, citation: null };
  return {
    evidence: data.payload || data,
    citation: scienceEvidenceCitationFromRow(data),
  };
}

export async function loadAdvisoryEvidenceForSail(sailCode: string) {
  const code = String(sailCode || '').trim();
  if (!code) return null;
  const { data, error } = await supabase
    .from('rm_science_evidence')
    .select('*')
    .eq('subject_id', code)
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}
