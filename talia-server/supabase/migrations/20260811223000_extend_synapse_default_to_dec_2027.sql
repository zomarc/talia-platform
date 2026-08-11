-- Extend active Synapse integration sail/departure horizon through Dec 2027.
-- Snapshot-only tables (e.g. cabin_availability) keep short lookbacks via
-- sync.config.json applyIntegrationDateRange: false — not this global range.

UPDATE talia_config.integration_date_range
SET
  date_to = '2027-12-01',
  description = 'Sail/departure horizon Sep 2025 – Dec 2027 (current bookings; not daily fact snapshots)',
  is_default = true,
  updated_at = NOW()
WHERE integration_name = 'synapse_default';

UPDATE talia_config.integration_date_range
SET
  is_default = false,
  updated_at = NOW()
WHERE integration_name <> 'synapse_default'
  AND is_default = true
  AND integration_name LIKE 'synapse%';

UPDATE talia_config.integration_date_range
SET
  date_to = '2027-12-01',
  updated_at = NOW()
WHERE integration_name IN ('synapse_q4_2025', 'synapse_recent')
  AND date_to < '2027-12-01';
