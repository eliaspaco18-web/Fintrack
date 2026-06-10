-- =============================================================================
-- Tabla diaria contable para tipo de cambio USD -> PEN.
-- Se usa en registros e importaciones para no depender de consultas externas
-- en cada operación y para congelar una sola tasa por día contable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.exchange_rates_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric(10,6) NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  effective_date date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT exchange_rates_daily_positive_rate CHECK (rate > 0),
  CONSTRAINT exchange_rates_daily_different_currencies CHECK (from_currency <> to_currency)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_rates_daily_pair_date_unique
  ON public.exchange_rates_daily (from_currency, to_currency, effective_date);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_daily_pair_date_desc
  ON public.exchange_rates_daily (from_currency, to_currency, effective_date DESC);

INSERT INTO public.exchange_rates_daily (
  from_currency,
  to_currency,
  rate,
  source,
  effective_date,
  fetched_at
)
SELECT
  ranked.from_currency,
  ranked.to_currency,
  ranked.rate,
  ranked.source,
  ranked.effective_date,
  ranked.fetched_at
FROM (
  SELECT DISTINCT ON (
    er.from_currency,
    er.to_currency,
    (er.fetched_at AT TIME ZONE 'America/Lima')::date
  )
    er.from_currency,
    er.to_currency,
    er.rate,
    er.source,
    (er.fetched_at AT TIME ZONE 'America/Lima')::date AS effective_date,
    er.fetched_at
  FROM public.exchange_rates er
  ORDER BY
    er.from_currency,
    er.to_currency,
    (er.fetched_at AT TIME ZONE 'America/Lima')::date,
    er.fetched_at DESC
) ranked
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;

ALTER TABLE public.exchange_rates_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_rates_daily: select authenticated"
  ON public.exchange_rates_daily FOR SELECT
  TO authenticated
  USING (true);
