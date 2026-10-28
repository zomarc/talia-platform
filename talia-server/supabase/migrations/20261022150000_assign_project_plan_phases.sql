-- First-pass plan. Dates and element placement are a guess and can be moved.
-- Dev holds the platform already delivered. MVP is January 2026.
-- Each later phase is three months after the one before it.
-- MR is the first business outcome. Pricing follows it. Phase 2 and 3 stay open.

UPDATE public.project_phase SET target_on = DATE '2025-10-31' WHERE code = '0';
UPDATE public.project_phase SET target_on = DATE '2026-01-31' WHERE code = 'mvp';
UPDATE public.project_phase SET target_on = DATE '2026-04-30' WHERE code = '1';
UPDATE public.project_phase SET target_on = DATE '2026-07-31' WHERE code = '2';
UPDATE public.project_phase SET target_on = DATE '2026-10-31' WHERE code = '3';

UPDATE public.functionality_matrix_item SET phase = 'mvp' WHERE element = 'MR';
UPDATE public.functionality_matrix_item SET phase = '1' WHERE element = 'Pricing';

UPDATE public.project_milestone
SET phase_code = '0', target_on = DATE '2025-10-05'
WHERE lower(name) = 'oct-5-demo';

UPDATE public.project_milestone
SET phase_code = 'mvp', target_on = DATE '2025-12-05'
WHERE lower(name) = 'dec-5-demo';
