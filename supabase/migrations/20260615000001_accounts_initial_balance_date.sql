-- =============================================================================
-- Cuenta de apertura por fecha
-- - Guarda la fecha de corte del saldo inicial para reconstrucción histórica.
-- - Backfill con created_at para no perder referencia temporal en cuentas viejas.
-- =============================================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS initial_balance_date date;

UPDATE accounts
SET initial_balance_date = COALESCE(initial_balance_date, created_at::date, CURRENT_DATE)
WHERE initial_balance_date IS NULL;

ALTER TABLE accounts
  ALTER COLUMN initial_balance_date SET DEFAULT CURRENT_DATE;

ALTER TABLE accounts
  ALTER COLUMN initial_balance_date SET NOT NULL;
