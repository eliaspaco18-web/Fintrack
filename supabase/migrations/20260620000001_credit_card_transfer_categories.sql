-- =============================================================================
-- Credit-card transfers: protected operational categories
--
-- Disposicion TC:
--   CREDIT_CARD -> debit account, consumes available credit line.
--
-- Pago TC:
--   debit account -> CREDIT_CARD, reduces used credit line.
--
-- These categories are protected through system_key and normalized for existing
-- user-created rows so historical transactions keep their category references.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_normalize_credit_card_transfer_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text := lower(trim(NEW.name));
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.scope::text = 'INCOME' AND v_name IN (
    lower('Disposición (Tarjeta de Credito)'),
    lower('Disposicion (Tarjeta de Credito)')
  ) THEN
    NEW.name := 'Disposición (Tarjeta de Credito)';
    NEW.icon := COALESCE(NULLIF(NEW.icon, ''), 'credit-card');
    NEW.color := COALESCE(NULLIF(NEW.color, ''), '#f97316');
    NEW.sort_order := COALESCE(NEW.sort_order, 160);
    NEW.system_key := 'income_credit_card_disposition';
  ELSIF NEW.scope::text = 'EXPENSE' AND v_name IN (
    lower('Disposición (Tarjeta de Credito)'),
    lower('Disposicion (Tarjeta de Credito)')
  ) THEN
    NEW.name := 'Disposición (Tarjeta de Credito)';
    NEW.icon := COALESCE(NULLIF(NEW.icon, ''), 'credit-card');
    NEW.color := COALESCE(NULLIF(NEW.color, ''), '#f97316');
    NEW.sort_order := COALESCE(NEW.sort_order, 470);
    NEW.system_key := 'expense_credit_card_disposition';
  ELSIF NEW.scope::text = 'INCOME' AND v_name IN (
    lower('Pago TC'),
    lower('Pago - Tarjeta de Credito'),
    lower('Pago de Tarjeta de Credito')
  ) THEN
    NEW.name := 'Pago TC';
    NEW.icon := COALESCE(NULLIF(NEW.icon, ''), 'credit-card');
    NEW.color := COALESCE(NULLIF(NEW.color, ''), '#ec4899');
    NEW.sort_order := COALESCE(NEW.sort_order, 145);
    NEW.system_key := 'income_credit_card_payment';
  ELSIF NEW.scope::text = 'EXPENSE' AND v_name IN (
    lower('Pago TC'),
    lower('Pago - Tarjeta de Credito'),
    lower('Pago de Tarjeta de Credito')
  ) THEN
    NEW.name := 'Pago TC';
    NEW.icon := COALESCE(NULLIF(NEW.icon, ''), 'credit-card');
    NEW.color := COALESCE(NULLIF(NEW.color, ''), '#f43f5e');
    NEW.sort_order := COALESCE(NEW.sort_order, 420);
    NEW.system_key := 'expense_credit_card_payment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_credit_card_transfer_category ON public.categories;

CREATE TRIGGER trg_normalize_credit_card_transfer_category
BEFORE INSERT OR UPDATE OF name, scope, icon, color, sort_order, system_key
ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.fn_normalize_credit_card_transfer_category();

UPDATE public.categories
SET
  name = 'Disposición (Tarjeta de Credito)',
  icon = COALESCE(NULLIF(icon, ''), 'credit-card'),
  color = COALESCE(NULLIF(color, ''), '#f97316'),
  sort_order = COALESCE(sort_order, 160),
  system_key = 'income_credit_card_disposition'
WHERE user_id IS NOT NULL
  AND scope::text = 'INCOME'
  AND lower(trim(name)) IN (
    lower('Disposición (Tarjeta de Credito)'),
    lower('Disposicion (Tarjeta de Credito)')
  );

UPDATE public.categories
SET
  name = 'Disposición (Tarjeta de Credito)',
  icon = COALESCE(NULLIF(icon, ''), 'credit-card'),
  color = COALESCE(NULLIF(color, ''), '#f97316'),
  sort_order = COALESCE(sort_order, 470),
  system_key = 'expense_credit_card_disposition'
WHERE user_id IS NOT NULL
  AND scope::text = 'EXPENSE'
  AND lower(trim(name)) IN (
    lower('Disposición (Tarjeta de Credito)'),
    lower('Disposicion (Tarjeta de Credito)')
  );

UPDATE public.categories
SET
  name = 'Pago TC',
  icon = COALESCE(NULLIF(icon, ''), 'credit-card'),
  color = COALESCE(NULLIF(color, ''), '#ec4899'),
  sort_order = COALESCE(sort_order, 145),
  system_key = 'income_credit_card_payment'
WHERE user_id IS NOT NULL
  AND scope::text = 'INCOME'
  AND lower(trim(name)) IN (
    lower('Pago TC'),
    lower('Pago - Tarjeta de Credito'),
    lower('Pago de Tarjeta de Credito')
  );

UPDATE public.categories
SET
  name = 'Pago TC',
  icon = COALESCE(NULLIF(icon, ''), 'credit-card'),
  color = COALESCE(NULLIF(color, ''), '#f43f5e'),
  sort_order = COALESCE(sort_order, 420),
  system_key = 'expense_credit_card_payment'
WHERE user_id IS NOT NULL
  AND scope::text = 'EXPENSE'
  AND lower(trim(name)) IN (
    lower('Pago TC'),
    lower('Pago - Tarjeta de Credito'),
    lower('Pago de Tarjeta de Credito')
  );

WITH defaults(name, scope, icon, color, sort_order, system_key) AS (
  VALUES
    ('Disposición (Tarjeta de Credito)', 'INCOME', 'credit-card', '#f97316', 160, 'income_credit_card_disposition'),
    ('Disposición (Tarjeta de Credito)', 'EXPENSE', 'credit-card', '#f97316', 470, 'expense_credit_card_disposition'),
    ('Pago TC', 'INCOME', 'credit-card', '#ec4899', 145, 'income_credit_card_payment'),
    ('Pago TC', 'EXPENSE', 'credit-card', '#f43f5e', 420, 'expense_credit_card_payment')
)
INSERT INTO public.categories (id, user_id, name, scope, icon, color, is_system, sort_order, system_key)
SELECT
  gen_random_uuid(),
  p.id,
  d.name,
  d.scope::category_scope,
  d.icon,
  d.color,
  false,
  d.sort_order,
  d.system_key
FROM public.profiles p
CROSS JOIN defaults d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = p.id
    AND c.system_key = d.system_key
);
