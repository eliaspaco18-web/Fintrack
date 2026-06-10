-- =============================================================================
-- Cache viva para tipo de cambio USD -> PEN.
-- Se usa en dashboard y equivalencias analíticas con TTL corto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.exchange_rates_live (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric(10,6) NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT exchange_rates_live_positive_rate CHECK (rate > 0),
  CONSTRAINT exchange_rates_live_different_currencies CHECK (from_currency <> to_currency)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_rates_live_pair_unique
  ON public.exchange_rates_live (from_currency, to_currency);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_live_fetched_at_desc
  ON public.exchange_rates_live (fetched_at DESC);

INSERT INTO public.exchange_rates_live (
  from_currency,
  to_currency,
  rate,
  source,
  fetched_at
)
SELECT
  er.from_currency,
  er.to_currency,
  er.rate,
  er.source,
  er.fetched_at
FROM public.exchange_rates er
WHERE er.from_currency = 'USD'
  AND er.to_currency = 'PEN'
ORDER BY er.fetched_at DESC
LIMIT 1
ON CONFLICT (from_currency, to_currency) DO UPDATE SET
  rate = EXCLUDED.rate,
  source = EXCLUDED.source,
  fetched_at = EXCLUDED.fetched_at,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.fn_touch_exchange_rates_live_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exchange_rates_live_updated_at ON public.exchange_rates_live;
CREATE TRIGGER trg_exchange_rates_live_updated_at
BEFORE UPDATE ON public.exchange_rates_live
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_exchange_rates_live_updated_at();

ALTER TABLE public.exchange_rates_live ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_rates_live: select authenticated"
  ON public.exchange_rates_live FOR SELECT
  TO authenticated
  USING (true);
