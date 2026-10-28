-- Opening risks from the first project review. Scores are a proposal.
-- ON CONFLICT leaves any later edit of the same reference in place.

INSERT INTO public.risk_register_item (
  reference_code, title, statement, category,
  likelihood, impact, proximity, status, response, treatment, sort_order
) VALUES
(
  'RK001',
  'Reservation interface commitment',
  'The reservation supplier controls the interface. If they do not agree, in time, a workable way to provide the data and actions this project needs, delivery slips and the product is shaped by what the supplier will allow.',
  'supplier',
  4, 4, 'immediate', 'open', 'reduce',
  'Write the interface needs, ask the supplier for a dated response, and decide the thinnest interface that still makes the first phase useful if the full request is refused.',
  1
),
(
  'RK002',
  'Key-person dependency',
  'Design, supplier liaison, and day-to-day running sit with a few people. If one of them is unavailable, decisions stop, and the knowledge of the data, the interface, or the operating process is not held by anyone else.',
  'people',
  3, 4, 'immediate', 'open', 'reduce',
  'Name a second person for design, supplier liaison, and day-to-day running, and write down the procedures only one person currently knows.',
  2
),
(
  'RK003',
  'Operating process not redesigned',
  'The product changes how revenue work is done. If the business keeps the current process and only adds the tool beside it, staff bypass it and the control the project is meant to provide does not happen.',
  'process',
  4, 4, 'phase', 'open', 'reduce',
  'For each phase, name the work practice that has to change before that phase is called in use.',
  3
),
(
  'RK004',
  'Success measure not agreed',
  'If the business has not agreed the measure that defines a successful project, progress is judged against shifting views, and scope, phase, and "done" stay in dispute.',
  'benefits',
  4, 4, 'immediate', 'open', 'avoid',
  'Agree one primary measure of project success, plus the few measures that support it, and record them on the project.',
  4
)
ON CONFLICT (reference_code) DO NOTHING;
