-- Group & Allotment MR (phase 1, first priority) and Pricing (phase 2).
-- Digested from the session list. Size's place in the MR hierarchy is still open.
-- Idempotent on reference_code.

INSERT INTO public.functionality_matrix_item (
  reference_code, element, function_name, short_name, name,
  concept, rationale, technical_requirement,
  complexity, size_rank, phase, sort_order
) VALUES
(
  'R019', 'MR', 'Samples', 'Samples', 'Sample sailing review',
  'First step for Group and Allotment materialisation. Run the method on a few sample sailings, review the output, and refine it before widening the set.',
  'MR is the agreed first priority. The method should be checked on a small set before it is treated as settled.',
  'Choose a few sailings. Produce the initial and recommended materialisation for those sailings. Review the probability, the fallback level used, and the reasons. Adjust the dimensions and the rules from that review.',
  'M', 'M', '1', 18
),
(
  'R020', 'MR', 'Baseline', 'Baseline', 'Historical materialisation',
  'The opening probability comes from historical materialisation, split by the dimensions agreed in the session.',
  'An offer is not the same as a booked group, and conversion differs by account, product, market, and when the cruise sails.',
  'Calculate historical materialisation using Status (OF offer, BK booked), Account, Group Type, Product (itinerary and cruise length), Market, Season (departure period or month), and Group Size. Size also considers that account''s typical actual production, not only the space allocated.',
  'H', 'H', '1', 19
),
(
  'R021', 'MR', 'Fallback', 'Fallback', 'Granularity and fallback',
  'Use the most specific history that is still reliable. If the sample is too thin, drop dimensions until it is representative. A new or thin account takes the probability of comparable groups at a broader level.',
  'A probability from a handful of past groups is weaker than a broader one that has real history.',
  'Start with Status (OF/BK) and the hierarchy Account, then Market, Group Type, Season, Product, and Size. Size''s place in that order is still to be confirmed. Where history is too thin, remove dimensions in reverse: Size, Product, Season, Group Type, Market, then Account. Stop at the first level with a representative sample.',
  'H', 'M', '1', 20
),
(
  'R022', 'MR', 'Lifecycle', 'Lifecycle', 'Dynamic materialisation',
  'The probability is not fixed for the life of the group. It is recalculated as departure approaches. History carries more weight early. Actual behaviour carries more weight closer to departure.',
  'Naming, payment, and releases become the better signal as the sailing gets closer.',
  'Reassess using lead time and days to departure, status changes (especially OF to BK), naming progress against the naming expected at the same lead time, conversion pace versus comparable historical groups, deposits and payments (status, timing, and commitment), releases and cancellations of allocated space, recent account behaviour, and changes in group policy (allocation size, deposit rules, or release conditions) that would make older conversion rates misleading.',
  'H', 'H', '1', 21
),
(
  'R023', 'MR', 'Review', 'Review', 'Current versus recommended MR',
  'Show Current MR against Recommended MR. Surface only differences large enough for an inventory controller to review, and show why the recommendation moved.',
  'Controllers should see the groups that need a decision, not every group.',
  'Compare the current materialisation rate with the recommended rate. Highlight only material differences. Each highlighted case carries the reasons, drawn from the baseline, the fallback level used, and the lifecycle signals that changed the probability.',
  'M', 'M', '1', 22
),
(
  'R024', 'Pricing', 'Primary', 'Primary', 'Primary pricing triggers',
  'A pricing recommendation starts from occupancy and revenue against the target curve and the budget, including reserved demand and the forecast end position.',
  'A price change needs a gap against the plan, not a single busy week.',
  'Primary triggers are booked occupancy versus the target booking curve, reserved occupancy versus target, forecast final occupancy versus budget, reserved revenue versus the revenue budget, forecast final revenue versus budget, and reserved per-passenger-per-day versus target.',
  'H', 'H', '2', 23
),
(
  'R025', 'Pricing', 'Context', 'Context', 'Supporting pricing triggers',
  'Supporting signals explain whether a gap is pace, demand, competition, or mix, and what pace is still required to close it.',
  'The primary gap says something is off. These signals say what kind of response is plausible.',
  'Consider recent booking pace and trajectory, last year and similar sailings at the same lead time, website search demand and conversion, competitor price and position, category sell-through and remaining inventory, the time-to-close gap and the booking pace still required, the remaining per-passenger-per-day needed to reach the revenue budget, and earlier pricing actions with the performance that followed.',
  'M', 'H', '2', 24
),
(
  'R026', 'Pricing', 'Diagnosis', 'Diagnosis', 'Pricing diagnostic dimensions',
  'Break the pricing picture by market, by how the guest was booked, and by cabin category group.',
  'A ship-level gap can sit in one market, one booking type, or one category.',
  'Diagnose by market grouping, booking type (FIT, Groups, Allotments), and category type (Inside, Outside, Premium).',
  'M', 'M', '2', 25
)
ON CONFLICT (reference_code) DO NOTHING;

INSERT INTO public.functionality_matrix_note (matrix_item_id, body)
SELECT id, 'Size''s place in the hierarchy (shown last, after Product) is still to be confirmed.'
FROM public.functionality_matrix_item item
WHERE item.reference_code = 'R021'
  AND NOT EXISTS (
    SELECT 1
    FROM public.functionality_matrix_note note
    WHERE note.matrix_item_id = item.id
      AND note.body LIKE 'Size''s place in the hierarchy%'
  );
