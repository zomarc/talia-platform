-- Recommended risks from the 22 Oct 2026 review. Scores are a proposal.
-- Owner is Admin until a named person is agreed. ON CONFLICT leaves later edits.

INSERT INTO public.risk_register_item (
  reference_code, title, statement, category,
  likelihood, impact, proximity, status, response, treatment, owner, sort_order
) VALUES
(
  'RK005',
  'Plan dates are not a forecast',
  'Dev, MVP, Phase 1 and Phase 2 all fall before 22 Oct 2026, Phase 3 is nine days away and has nothing assigned, and one of twenty-eight requirements is done. If the summary is read as the commitment, the project is already late. The delivered platform on Dev is a separate claim from that requirements log.',
  'benefits',
  4, 4, 'immediate', 'open', 'avoid',
  'Move the dates that are still meant to be forecasts, mark the ones that have passed, and take the empty phase off a near date. Leave Dev on 31 Oct 2025 as the elapsed home of the 5 Oct demo.',
  'Admin',
  5
),
(
  'RK006',
  'Pricing basis not decided',
  'Phase 1 is only Pricing. Two priority questions on Primary are still open: whether the first release only registers prices or also takes a live extract, and where the control table lives. The static parameter table is still being replaced.',
  'process',
  4, 4, 'immediate', 'open', 'avoid',
  'Decide registration versus a live extract, and the first home of the control table, before more of Primary is built.',
  'Admin',
  6
),
(
  'RK007',
  'No system of record',
  'A price can sit in the parameter table, in Synapse, or in a generated PDF, and the project has not said which one the business will quote. The source-of-truth requirement is in progress and not on the matrix.',
  'technical',
  4, 4, 'immediate', 'open', 'avoid',
  'For a price, and for a promotion, name the one store that is quoted. Generate the PDF from that store.',
  'Admin',
  7
),
(
  'RK008',
  'No current reservation cut',
  'Loading the latest UAT dump and opening the tunnel to the reservation database are both priority backlog, and the permission on that tunnel is still a question. MR on the MVP phase is samples, baseline, fallback, lifecycle and review. The product already shows reservation data; the gap is an agreed current cut those samples can be argued from.',
  'external',
  4, 4, 'immediate', 'open', 'reduce',
  'Load one agreed UAT cut through a read-only tunnel before those samples are used with management.',
  'Admin',
  8
),
(
  'RK009',
  'Price history starts too late',
  'Diagnosis is a Phase 1 pricing function, and keeping the price history it needs is still backlog. Rates that change before retention starts cannot be reconstructed.',
  'technical',
  3, 4, 'immediate', 'open', 'reduce',
  'Start keeping the price record now. The diagnosis screen can wait.',
  'Admin',
  9
),
(
  'RK010',
  'Approval path not chosen',
  'It is still open whether a promotion is approved in the product or by email or Slack, and the governance trail is backlog. Register-before-load, the only December item, is also backlog. A decision that lives outside the record will not match the record.',
  'process',
  3, 4, 'phase', 'open', 'reduce',
  'Choose one approval path and write the decision on the promotion before register-before-load is called done.',
  'Admin',
  10
),
(
  'RK011',
  'External site depends on one laptop',
  'The site used with people outside the project is served from this laptop. When the laptop sleeps or the tunnel fails, the meeting gets the holding page. That has already happened.',
  'technical',
  4, 3, 'immediate', 'open', 'reduce',
  'Give the next external meeting a copy that stays up without this laptop.',
  'Admin',
  11
),
(
  'RK012',
  'Access model is the preview',
  'Access is the one admin function placed on MVP rather than Dev, the role-based workspace is in progress and not on the matrix, and the shared preview signs in as an administrator.',
  'technical',
  3, 3, 'phase', 'open', 'reduce',
  'Name the roles that must differ before anyone outside the project uses a shared environment. Until then the shared site stays a preview.',
  'Admin',
  12
)
ON CONFLICT (reference_code) DO NOTHING;
