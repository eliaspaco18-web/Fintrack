-- =============================================================================
-- MIGRATION: Budget series + explicit periods
-- Objetivo:
-- 1) Separar presupuesto maestro (`budget_series`) de periodos (`budget_periods`)
-- 2) Mantener compatibilidad con `budgets` y `transactions.budget_id`
-- 3) Backfill desde el modelo legacy basado en `budgets.series_id`
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.budget_series (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  legacy_series_id uuid,
  category_id      uuid          REFERENCES public.categories(id) ON DELETE SET NULL,
  name             text          NOT NULL,
  description      text,
  default_amount   numeric(15,2) NOT NULL,
  currency         text          NOT NULL DEFAULT 'PEN',
  period_type      budget_period NOT NULL DEFAULT 'MONTHLY',
  start_date       date          NOT NULL,
  end_date         date,
  is_active        boolean       NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT budget_series_amount_positive CHECK (default_amount > 0),
  CONSTRAINT budget_series_dates_order CHECK (end_date IS NULL OR start_date <= end_date),
  CONSTRAINT budget_series_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT budget_series_currency_allowed CHECK (currency IN ('PEN', 'USD'))
);

CREATE TABLE IF NOT EXISTS public.budget_periods (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id        uuid          NOT NULL REFERENCES public.budget_series(id) ON DELETE CASCADE,
  legacy_budget_id uuid          REFERENCES public.budgets(id) ON DELETE SET NULL,
  period_start     date          NOT NULL,
  period_end       date          NOT NULL,
  amount           numeric(15,2) NOT NULL,
  status           text          NOT NULL DEFAULT 'ACTIVE',
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT budget_periods_amount_positive CHECK (amount > 0),
  CONSTRAINT budget_periods_dates_order CHECK (period_start <= period_end),
  CONSTRAINT budget_periods_status_allowed CHECK (status IN ('PLANNED', 'ACTIVE', 'CLOSED', 'SKIPPED'))
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS budget_period_id uuid REFERENCES public.budget_periods(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_series_user_legacy_series
  ON public.budget_series (user_id, legacy_series_id)
  WHERE legacy_series_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_series_user_name
  ON public.budget_series (user_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_budget_series_user_active
  ON public.budget_series (user_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_periods_legacy_budget
  ON public.budget_periods (legacy_budget_id)
  WHERE legacy_budget_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_periods_budget_start
  ON public.budget_periods (budget_id, period_start);

CREATE INDEX IF NOT EXISTS idx_budget_periods_budget_range
  ON public.budget_periods (budget_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_transactions_budget_period
  ON public.transactions (user_id, budget_period_id, transaction_date);

CREATE OR REPLACE FUNCTION public.fn_budget_periods_validate_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.budget_periods bp
    WHERE bp.budget_id = NEW.budget_id
      AND bp.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND daterange(bp.period_start, bp.period_end, '[]')
          && daterange(NEW.period_start, NEW.period_end, '[]')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'El periodo presupuestal se solapa con otro periodo de la misma serie.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_periods_validate_overlap ON public.budget_periods;
CREATE TRIGGER trg_budget_periods_validate_overlap
BEFORE INSERT OR UPDATE ON public.budget_periods
FOR EACH ROW
EXECUTE FUNCTION public.fn_budget_periods_validate_overlap();

DROP TRIGGER IF EXISTS trg_budget_series_updated_at ON public.budget_series;
CREATE TRIGGER trg_budget_series_updated_at
BEFORE UPDATE ON public.budget_series
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_budget_periods_updated_at ON public.budget_periods;
CREATE TRIGGER trg_budget_periods_updated_at
BEFORE UPDATE ON public.budget_periods
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.budget_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_series: select own" ON public.budget_series;
CREATE POLICY "budget_series: select own"
  ON public.budget_series FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "budget_series: insert own" ON public.budget_series;
CREATE POLICY "budget_series: insert own"
  ON public.budget_series FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "budget_series: update own" ON public.budget_series;
CREATE POLICY "budget_series: update own"
  ON public.budget_series FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "budget_series: delete own" ON public.budget_series;
CREATE POLICY "budget_series: delete own"
  ON public.budget_series FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "budget_periods: select own" ON public.budget_periods;
CREATE POLICY "budget_periods: select own"
  ON public.budget_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.budget_series bs
      WHERE bs.id = budget_periods.budget_id
        AND bs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "budget_periods: insert own" ON public.budget_periods;
CREATE POLICY "budget_periods: insert own"
  ON public.budget_periods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.budget_series bs
      WHERE bs.id = budget_periods.budget_id
        AND bs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "budget_periods: update own" ON public.budget_periods;
CREATE POLICY "budget_periods: update own"
  ON public.budget_periods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.budget_series bs
      WHERE bs.id = budget_periods.budget_id
        AND bs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.budget_series bs
      WHERE bs.id = budget_periods.budget_id
        AND bs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "budget_periods: delete own" ON public.budget_periods;
CREATE POLICY "budget_periods: delete own"
  ON public.budget_periods FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.budget_series bs
      WHERE bs.id = budget_periods.budget_id
        AND bs.user_id = auth.uid()
    )
  );

WITH grouped AS (
  SELECT
    b.user_id,
    b.series_id AS legacy_series_id,
    (array_agg(b.name ORDER BY COALESCE(b.end_date, b.start_date) DESC, b.start_date DESC))[1] AS name,
    (array_agg(b.description ORDER BY COALESCE(b.end_date, b.start_date) DESC, b.start_date DESC))[1] AS description,
    (array_agg(b.category_id ORDER BY COALESCE(b.end_date, b.start_date) DESC, b.start_date DESC))[1] AS category_id,
    (array_agg(b.amount ORDER BY COALESCE(b.end_date, b.start_date) DESC, b.start_date DESC))[1] AS default_amount,
    (array_agg(b.currency ORDER BY COALESCE(b.end_date, b.start_date) DESC, b.start_date DESC))[1] AS currency,
    (array_agg(b.period_type ORDER BY COALESCE(b.end_date, b.start_date) DESC, b.start_date DESC))[1] AS period_type,
    MIN(b.start_date) AS start_date,
    MAX(b.end_date) AS end_date,
    BOOL_OR(b.is_active) AS is_active,
    (array_agg(b.notes ORDER BY COALESCE(b.end_date, b.start_date) DESC, b.start_date DESC))[1] AS notes,
    MIN(b.created_at) AS created_at,
    MAX(b.updated_at) AS updated_at
  FROM public.budgets b
  WHERE b.series_id IS NOT NULL
  GROUP BY b.user_id, b.series_id
)
INSERT INTO public.budget_series (
  user_id,
  legacy_series_id,
  name,
  description,
  category_id,
  default_amount,
  currency,
  period_type,
  start_date,
  end_date,
  is_active,
  notes,
  created_at,
  updated_at
)
SELECT
  user_id,
  legacy_series_id,
  name,
  description,
  category_id,
  default_amount,
  currency,
  period_type,
  start_date,
  end_date,
  is_active,
  notes,
  created_at,
  updated_at
FROM grouped
ON CONFLICT (user_id, legacy_series_id)
WHERE legacy_series_id IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  default_amount = EXCLUDED.default_amount,
  currency = EXCLUDED.currency,
  period_type = EXCLUDED.period_type,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO public.budget_periods (
  budget_id,
  legacy_budget_id,
  period_start,
  period_end,
  amount,
  status,
  notes,
  created_at,
  updated_at
)
SELECT
  bs.id,
  b.id,
  b.start_date,
  COALESCE(b.end_date, b.start_date),
  b.amount,
  CASE WHEN b.is_active THEN 'ACTIVE' ELSE 'CLOSED' END,
  b.notes,
  b.created_at,
  b.updated_at
FROM public.budgets b
JOIN public.budget_series bs
  ON bs.user_id = b.user_id
 AND bs.legacy_series_id = b.series_id
ON CONFLICT (legacy_budget_id)
WHERE legacy_budget_id IS NOT NULL
DO UPDATE SET
  period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end,
  amount = EXCLUDED.amount,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = now();

UPDATE public.transactions t
SET budget_period_id = bp.id
FROM public.budget_periods bp
WHERE t.budget_id = bp.legacy_budget_id
  AND t.budget_period_id IS NULL;
