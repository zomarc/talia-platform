-- Guessed assignments from the October and December demo requirements onto
-- the Functionality Matrix. Safe to re-run.

INSERT INTO public.functionality_matrix_link (matrix_item_id, requirement_item_id)
SELECT matrix.id, requirement.id
FROM public.talia_requirement_item AS requirement
JOIN public.functionality_matrix_item AS matrix
  ON matrix.reference_code = CASE requirement.title
    WHEN 'GraphQL price extraction via agency impersonation' THEN 'R024'
    WHEN 'Replace static GQL pricing parameter table' THEN 'R024'
    WHEN 'Differentiated tariffs (discussion for 5 Oct)' THEN 'R024'
    WHEN 'Send tactical rate-sheet examples for Promotion Explorer' THEN 'R024'
    WHEN 'Where does the control table live first?' THEN 'R024'
    WHEN 'MVP for 5 Oct: registration only or also live GraphQL extract?' THEN 'R024'
    WHEN 'Capture price coverage' THEN 'R025'
    WHEN 'Capture core promo dates' THEN 'R025'
    WHEN 'Capture commercial scope' THEN 'R025'
    WHEN 'Register-before-load promotions' THEN 'R025'
    WHEN 'Preserve price history for efficacy analysis' THEN 'R026'
    WHEN 'RM levers as system scope' THEN 'R023'
    ELSE NULL
  END
WHERE matrix.reference_code IS NOT NULL
ON CONFLICT (matrix_item_id, requirement_item_id) DO NOTHING;
