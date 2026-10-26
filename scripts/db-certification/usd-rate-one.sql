-- Diagnostic only: USD/PEN rows at the neutral numeric rate 1.
-- A source label is metadata, not independent provenance evidence.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT id, from_currency, to_currency, rate::text AS rate, source, fetched_at,
       CASE
         WHEN source IS NULL OR btrim(source) = '' THEN 'unverifiable: source missing'
         WHEN lower(btrim(source)) IN ('fallback', 'unknown', 'legacy') THEN 'unverifiable: non-provenance label'
         WHEN lower(btrim(source)) = 'manual' THEN 'manual label; supporting audit evidence still required'
         ELSE 'source label present; verify against independent source/audit evidence'
       END AS provenance_review
FROM public.exchange_rates
WHERE upper(from_currency) = 'USD'
  AND upper(to_currency) = 'PEN'
  AND rate = 1
ORDER BY fetched_at, id;
ROLLBACK;
