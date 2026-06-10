-- =============================================================================
-- MIGRATION: Budgets description defensive backfill
-- Objetivo: garantizar que la columna description exista en todos los entornos
-- =============================================================================

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS description text;
