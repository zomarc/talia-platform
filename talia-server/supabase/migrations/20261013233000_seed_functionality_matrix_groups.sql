-- Top-level Functionality Matrix cells for delivered component groups.
-- Phase 0 (Dev) means this is in the current development build.
-- Idempotent on reference_code so a re-run does not duplicate or overwrite edits.

INSERT INTO public.functionality_matrix_item (
  reference_code, element, function_name, short_name, name,
  concept, rationale, technical_requirement,
  complexity, size_rank, phase, sort_order
) VALUES
(
  'R001', 'UI', 'Docking', 'Dock', 'Docking workspace',
  'Delivered. Reports open together in a Dockview workspace. A tab activates the panel, and one click both focuses that panel and runs the in-panel action.',
  'Several views of the same sailing need to stay open side by side.',
  'Reports are dock panels. Tab chrome carries Views, technical meta, and close. ReportShell and panel activation own the click.',
  'M', 'M', '0', 1
),
(
  'R002', 'UI', 'Persistence', 'Profile', 'User persistence',
  'Delivered. The workspace, theme, and each panel''s view choices are stored for the user. A new panel follows the header defaults until that instance sets its own.',
  'A focus should reopen with the same layout and the same view choices.',
  'User profile state stores component options per dock instance, including table fit. Header fit remains the default for instances that have not chosen one.',
  'H', 'M', '0', 2
),
(
  'R003', 'UI', 'Focus', 'Focus', 'Focus catalogue',
  'Delivered. Focuses can be starred, dragged into order, and marked legacy. The header quick switch lists starred focuses only. Reports use the same Starred, The rest, and Retired buckets.',
  'The catalogue is long. The working set has to stay at the top.',
  'public.focuses stores sort order and the legacy flag. public.user_focus_preferences stores stars. Report stars and report legacy flags are local to the browser.',
  'M', 'M', '0', 3
),
(
  'R004', 'UI', 'Shell', 'Shell', 'Report shell',
  'Delivered. Reports share one chrome: title, filters, actions, details, and provenance. Each dock instance has its own Views menu.',
  'Show and hide, and the view choices, have to behave the same way on every report.',
  'Presenters use the report shell classes. Details and provenance are gated. Non-legacy table reports expose column filters, controls, and fit where those strips exist.',
  'M', 'M', '0', 4
),
(
  'R005', 'UI', 'Tables', 'Tables', 'Operational tables',
  'Delivered. Working tables are Master Sailing Explorer, Ship × Day berths and pressure, published rates, groups and promo explorers, reservation, agency, sailing by cabin category, and port locations.',
  'Day-to-day work is a grid of a sailing, a ship, or the book.',
  'Tables use Tabulator. Fit follows the header until the panel chooses Best fit, Fit width, or Fit data. Column filters are header filters. Narrow ship-day rows follow the selected sailing.',
  'H', 'H', '0', 5
),
(
  'R006', 'UI', 'Profiles', 'Profiles', 'Booking profiles',
  'Delivered. Reservation Profile, Seasonal Trading Pack, distribution, and the target-profile editors show the live book. Commercial plan figures appear only when the header switch is on.',
  'Yield work needs the booking curve and the commercial plan on the same reports.',
  'Reservation Profile plots guests and ticket, with per-passenger-per-day on a second axis. Voyage totals sum guests and ticket and exclude passenger type A. The same totals roll up by market group and agency channel.',
  'H', 'H', '0', 6
),
(
  'R007', 'UI', 'Trading', 'Trading', 'Market and voyage views',
  'Delivered. Competitor pricing and benchmark, demand heatmaps, Google search and trends, the ship tracker, and the master voyage performance summary.',
  'Market and voyage context sits beside the book.',
  'These dashboards read the local mirrors and the trend feeds already wired into the app. Chart panels can hide axis labels from Views.',
  'M', 'H', '0', 7
),
(
  'R008', 'UI', 'Inventory', 'Inventory', 'Physical inventory',
  'Delivered. Cabin and deck inventory for the selected sailing, plus inventory memos that other reports can create.',
  'Physical capacity and the note on a sailing have to stay on the canonical ship and sail.',
  'Inventory can be read by deck or by cabin type, and cabin type group follows the header unless the panel overrides it. A memo can be created from a report, including memo-only on the RM checklist.',
  'M', 'M', '0', 8
),
(
  'R009', 'Integration', 'Sync', 'Sync', 'Synapse sync',
  'Delivered. Source tables sync into local Supabase mirrors, with date windows and a readable map of source to target.',
  'Reports read a local copy. They do not call the warehouse on each click.',
  'Data Management runs table integration. ETL Table Parameters shows the upstream source-to-target map. Sync stays on the integration framework.',
  'H', 'H', '0', 9
),
(
  'R010', 'Integration', 'Sailing', 'Sailing', 'Sailing identity',
  'Delivered. inventory_item is the only sailing identity. Master sail sync builds the voyage and ship hierarchy, and selections carry that scope.',
  'Every report has to mean the same sail and the same ship.',
  'Selections emit sail or ship events enriched with reference sail code, ship, and sail codes. Listeners filter by that scope. Physical capacity is not summed across a master and its segments.',
  'H', 'M', '0', 10
),
(
  'R011', 'Integration', 'Targets', 'Targets', 'Commercial book targets',
  'Delivered. Commercial book targets sync from the source and are pre-aggregated by sail, voyage, and week. Panels read those aggregates only when the header switch is on.',
  'The plan is large and must stay out of the way until someone asks for it.',
  'Panels use commercial_book_target_sail, commercial_book_target_voyage, and commercial_book_target_week. They do not query the base target table. The header switch defaults to off.',
  'M', 'M', '0', 11
),
(
  'R012', 'Integration', 'Direct', 'Direct', 'Direct source and availability',
  'Delivered. Direct Source Request and Direct Availability ask the source and show availability without replacing the local mirrors.',
  'Some questions are still answered from the source system.',
  'Both reports sit in the External group and use the same shell, filters, and table fit as the other tables.',
  'M', 'M', '0', 12
),
(
  'R013', 'Admin', 'Access', 'Access', 'Access, users, and themes',
  'Delivered. Admin Dashboard covers focus access, Talia users, user mappings, themes, role criteria, and activity logs.',
  'Who can open a focus, and which theme and criteria they get, is an administration task.',
  'Focus access is a user-by-focus matrix. The section is chosen from the panel Views menu. Tables and cards follow the report shell.',
  'M', 'M', '0', 13
),
(
  'R014', 'Admin', 'Data', 'Data', 'Data management',
  'Delivered. Data Management covers table, external, and internal integration, backup status, instance connection, and operations.',
  'Sync, keys, and backups are operated from the app.',
  'The section is chosen from Views. Integration tables use the shared table host and the report shell.',
  'M', 'H', '0', 14
),
(
  'R015', 'Admin', 'Requirements', 'Requirements', 'Requirements log and matrix',
  'Delivered. Requirements Log is the task board for deliverables, external actions, and questions. Functionality Matrix groups capabilities, and log items can be assigned onto a cell.',
  'What to build next has to live in Talia, apart from the operational reports.',
  'Log rows stay in talia_requirement_item. Matrix cells, discussion notes, and assignments are their own tables. Each matrix requirement exports as JSON.',
  'M', 'M', '0', 15
),
(
  'R016', 'Engine', 'Regulator', 'Regulator', 'RM checklist',
  'Delivered. The checklist shows engine findings for the selected sailing, as a table or a date heatmap, and can raise a memo from a finding.',
  'The first automated check is a review list, not a silent price change.',
  'Findings come from talia-engine. Acknowledge, dismiss, and memo-only sit on the checklist controls. Narrow context follows the sailing selected in the explorer.',
  'H', 'M', '0', 16
),
(
  'R017', 'Engine', 'Activity', 'Activity', 'Engine activity',
  'Delivered. Engine Activity shows recent regulator runs so an operator can see that a run happened and what it produced.',
  'A finding list is not enough without the run that created it.',
  'The panel reads engine run history. It does not apply a price or inventory change.',
  'L', 'M', '0', 17
)
ON CONFLICT (reference_code) DO NOTHING;

-- If R001 was already used by another UI item, still record Docking.
INSERT INTO public.functionality_matrix_item (
  reference_code, element, function_name, short_name, name,
  concept, rationale, technical_requirement,
  complexity, size_rank, phase, sort_order
)
SELECT
  'R' || lpad((
    SELECT COALESCE(MAX(substring(reference_code FROM '^R([0-9]+)$')::int), 0) + 1
    FROM public.functionality_matrix_item
  )::text, 3, '0'),
  'UI', 'Docking', 'Dock', 'Docking workspace',
  'Delivered. Reports open together in a Dockview workspace. A tab activates the panel, and one click both focuses that panel and runs the in-panel action.',
  'Several views of the same sailing need to stay open side by side.',
  'Reports are dock panels. Tab chrome carries Views, technical meta, and close. ReportShell and panel activation own the click.',
  'M', 'M', '0', 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.functionality_matrix_item
  WHERE element = 'UI' AND function_name = 'Docking'
);
