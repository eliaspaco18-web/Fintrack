-- =============================================================================
-- MIGRATION: Budget series continuity
-- Objetivo:
-- 1) Agregar series_id a budgets
-- 2) Permitir múltiples períodos por serie sin romper continuidad
-- 3) Evitar nombres duplicados entre series y rangos solapados dentro de la misma serie
-- =============================================================================

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS series_id uuid;

UPDATE public.budgets
SET series_id = id
WHERE series_id IS NULL;

ALTER TABLE public.budgets
  ALTER COLUMN series_id SET DEFAULT gen_random_uuid();

ALTER TABLE public.budgets
  ALTER COLUMN series_id SET NOT NULL;

DROP INDEX IF EXISTS idx_budgets_user_name;

CREATE INDEX IF NOT EXISTS idx_budgets_user_series
  ON public.budgets (user_id, series_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_series_start
  ON public.budgets (user_id, series_id, start_date);

CREATE OR REPLACE FUNCTION public.fn_budgets_validate_series()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.series_id IS NULL THEN
    NEW.series_id := COALESCE(NEW.id, gen_random_uuid());
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.user_id = NEW.user_id
      AND lower(b.name) = lower(NEW.name)
      AND b.series_id <> NEW.series_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ya existe otra serie de presupuesto con ese nombre.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.budgets b
    WHERE b.user_id = NEW.user_id
      AND b.series_id = NEW.series_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND daterange(b.start_date, COALESCE(b.end_date, 'infinity'::date), '[]')
          && daterange(NEW.start_date, COALESCE(NEW.end_date, 'infinity'::date), '[]')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'El nuevo período se solapa con otro período de la misma serie.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budgets_validate_series ON public.budgets;

CREATE TRIGGER trg_budgets_validate_series
BEFORE INSERT OR UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.fn_budgets_validate_series();
