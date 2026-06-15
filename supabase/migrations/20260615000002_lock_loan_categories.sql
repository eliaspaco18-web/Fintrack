-- =============================================================================
-- PRD v3 — Categorías protegidas para cuentas por cobrar / pagar
--
-- Objetivo:
--   1. Separar formalmente las 4 categorías de préstamos por tipo de flujo.
--   2. Corregir system_key en categorías ya sembradas por usuario.
--   3. Re-sembrar categorías faltantes para perfiles existentes.
--
-- Mapa final:
--   Cuentas por Cobrar
--     INCOME  -> Cobro de préstamos
--     EXPENSE -> Préstamos otorgados (A terceros)
--
--   Cuentas por Pagar
--     INCOME  -> Préstamos otorgados (De terceros)
--     EXPENSE -> Pago de préstamos
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH defaults(name, scope, icon, color, sort_order, system_key) AS (
    VALUES
      ('Cobro de préstamos', 'INCOME', 'wallet', '#06b6d4', 10, 'income_receivable_collection'),
      ('Préstamos otorgados (De terceros)', 'INCOME', 'file-minus', '#8b5cf6', 20, 'income_payable_issue'),
      ('Salario - 5ta', 'INCOME', 'briefcase', '#10b981', 30, 'income_salary'),
      ('Negocios', 'INCOME', 'briefcase', '#14b8a6', 40, 'income_rental'),
      ('Trabajos independientes', 'INCOME', 'briefcase', '#3b82f6', 50, 'income_freelance'),
      ('Trabajos secundarios', 'INCOME', 'briefcase', '#6366f1', 60, NULL),
      ('Regalos', 'INCOME', 'tag', '#f59e0b', 70, NULL),
      ('Inversiones', 'INCOME', 'chart-line', '#8b5cf6', 80, 'income_investment'),
      ('Transferencia entre Portafolios', 'INCOME', 'bank', '#06b6d4', 90, NULL),
      ('Otros', 'INCOME', 'tag', '#64748b', 100, 'income_other'),
      ('Compensación de gastos', 'INCOME', 'file-minus', '#14b8a6', 110, NULL),
      ('Gratificaciones - 5ta', 'INCOME', 'briefcase', '#22c55e', 120, NULL),
      ('Venta de USDT', 'INCOME', 'coins', '#10b981', 130, NULL),
      ('Pago - Tarjeta de Credito', 'INCOME', 'credit-card', '#ec4899', 140, NULL),
      ('Saldo Inicial', 'INCOME', 'bank', '#64748b', 150, NULL),
      ('Disposición (Tarjeta de Credito)', 'INCOME', 'credit-card', '#f97316', 160, NULL),

      ('Comisiones', 'EXPENSE', 'credit-card', '#f97316', 210, NULL),
      ('Membresías', 'EXPENSE', 'tag', '#8b5cf6', 220, NULL),
      ('Seguros (Desgravamen)', 'EXPENSE', 'shield', '#06b6d4', 230, NULL),
      ('Intereses', 'EXPENSE', 'credit-card', '#f43f5e', 240, NULL),
      ('Donaciones y obsequios', 'EXPENSE', 'tag', '#f59e0b', 250, NULL),
      ('Impuesto ITF', 'EXPENSE', 'tag', '#64748b', 260, NULL),
      ('Pago de préstamos', 'EXPENSE', 'credit-card', '#ef4444', 270, 'expense_payable_payment'),
      ('Préstamos otorgados (A terceros)', 'EXPENSE', 'wallet', '#06b6d4', 280, 'expense_receivable_issue'),
      ('Comida', 'EXPENSE', 'utensils', '#ef4444', 290, 'expense_food'),
      ('Facturas y servicios públicos', 'EXPENSE', 'home', '#eab308', 300, 'expense_housing'),
      ('Vestimenta', 'EXPENSE', 'tag', '#8b5cf6', 310, NULL),
      ('Salud', 'EXPENSE', 'heart', '#ec4899', 320, 'expense_health'),
      ('Combustibles', 'EXPENSE', 'car', '#f97316', 330, NULL),
      ('Transporte', 'EXPENSE', 'car', '#f59e0b', 340, 'expense_transport'),
      ('Inversiones', 'EXPENSE', 'chart-line', '#8b5cf6', 350, NULL),
      ('Educación', 'EXPENSE', 'book-open', '#8b5cf6', 360, 'expense_education'),
      ('Tecnología', 'EXPENSE', 'package', '#3b82f6', 370, NULL),
      ('Mascotas', 'EXPENSE', 'tag', '#14b8a6', 380, NULL),
      ('Entretenimiento', 'EXPENSE', 'film', '#14b8a6', 390, 'expense_leisure'),
      ('Transferencia entre Portafolios', 'EXPENSE', 'bank', '#06b6d4', 400, NULL),
      ('Compra de USDT', 'EXPENSE', 'coins', '#10b981', 410, NULL),
      ('Pago TC', 'EXPENSE', 'credit-card', '#f43f5e', 420, 'expense_credit'),
      ('Transporte - Combustible', 'EXPENSE', 'car', '#f97316', 430, NULL),
      ('Compra de USD-Dolares', 'EXPENSE', 'coins', '#22c55e', 440, NULL),
      ('Otros', 'EXPENSE', 'minus-circle', '#6b7280', 450, 'expense_other'),
      ('Activos Tangibles', 'EXPENSE', 'package', '#6366f1', 460, 'expense_asset'),
      ('Disposicion (Tarjeta de Credito)', 'EXPENSE', 'credit-card', '#f97316', 470, NULL)
  ),
  normalized_defaults AS (
    SELECT
      name,
      scope::category_scope AS scope,
      icon,
      color,
      sort_order,
      system_key
    FROM defaults
  )
  UPDATE categories c
  SET
    system_key = d.system_key,
    sort_order = COALESCE(c.sort_order, d.sort_order)
  FROM normalized_defaults d
  WHERE c.user_id = p_user_id
    AND (
      c.system_key IS NULL
      OR (
        lower(trim(c.name)) IN (
          lower('Cobro de préstamos'),
          lower('Préstamos otorgados (De terceros)'),
          lower('Pago de préstamos'),
          lower('Préstamos otorgados (A terceros)')
        )
        AND c.scope::text = d.scope::text
      )
    )
    AND lower(trim(c.name)) = lower(trim(d.name))
    AND c.scope::text = d.scope::text;

  WITH defaults(name, scope, icon, color, sort_order, system_key) AS (
    VALUES
      ('Cobro de préstamos', 'INCOME', 'wallet', '#06b6d4', 10, 'income_receivable_collection'),
      ('Préstamos otorgados (De terceros)', 'INCOME', 'file-minus', '#8b5cf6', 20, 'income_payable_issue'),
      ('Salario - 5ta', 'INCOME', 'briefcase', '#10b981', 30, 'income_salary'),
      ('Negocios', 'INCOME', 'briefcase', '#14b8a6', 40, 'income_rental'),
      ('Trabajos independientes', 'INCOME', 'briefcase', '#3b82f6', 50, 'income_freelance'),
      ('Trabajos secundarios', 'INCOME', 'briefcase', '#6366f1', 60, NULL),
      ('Regalos', 'INCOME', 'tag', '#f59e0b', 70, NULL),
      ('Inversiones', 'INCOME', 'chart-line', '#8b5cf6', 80, 'income_investment'),
      ('Transferencia entre Portafolios', 'INCOME', 'bank', '#06b6d4', 90, NULL),
      ('Otros', 'INCOME', 'tag', '#64748b', 100, 'income_other'),
      ('Compensación de gastos', 'INCOME', 'file-minus', '#14b8a6', 110, NULL),
      ('Gratificaciones - 5ta', 'INCOME', 'briefcase', '#22c55e', 120, NULL),
      ('Venta de USDT', 'INCOME', 'coins', '#10b981', 130, NULL),
      ('Pago - Tarjeta de Credito', 'INCOME', 'credit-card', '#ec4899', 140, NULL),
      ('Saldo Inicial', 'INCOME', 'bank', '#64748b', 150, NULL),
      ('Disposición (Tarjeta de Credito)', 'INCOME', 'credit-card', '#f97316', 160, NULL),

      ('Comisiones', 'EXPENSE', 'credit-card', '#f97316', 210, NULL),
      ('Membresías', 'EXPENSE', 'tag', '#8b5cf6', 220, NULL),
      ('Seguros (Desgravamen)', 'EXPENSE', 'shield', '#06b6d4', 230, NULL),
      ('Intereses', 'EXPENSE', 'credit-card', '#f43f5e', 240, NULL),
      ('Donaciones y obsequios', 'EXPENSE', 'tag', '#f59e0b', 250, NULL),
      ('Impuesto ITF', 'EXPENSE', 'tag', '#64748b', 260, NULL),
      ('Pago de préstamos', 'EXPENSE', 'credit-card', '#ef4444', 270, 'expense_payable_payment'),
      ('Préstamos otorgados (A terceros)', 'EXPENSE', 'wallet', '#06b6d4', 280, 'expense_receivable_issue'),
      ('Comida', 'EXPENSE', 'utensils', '#ef4444', 290, 'expense_food'),
      ('Facturas y servicios públicos', 'EXPENSE', 'home', '#eab308', 300, 'expense_housing'),
      ('Vestimenta', 'EXPENSE', 'tag', '#8b5cf6', 310, NULL),
      ('Salud', 'EXPENSE', 'heart', '#ec4899', 320, 'expense_health'),
      ('Combustibles', 'EXPENSE', 'car', '#f97316', 330, NULL),
      ('Transporte', 'EXPENSE', 'car', '#f59e0b', 340, 'expense_transport'),
      ('Inversiones', 'EXPENSE', 'chart-line', '#8b5cf6', 350, NULL),
      ('Educación', 'EXPENSE', 'book-open', '#8b5cf6', 360, 'expense_education'),
      ('Tecnología', 'EXPENSE', 'package', '#3b82f6', 370, NULL),
      ('Mascotas', 'EXPENSE', 'tag', '#14b8a6', 380, NULL),
      ('Entretenimiento', 'EXPENSE', 'film', '#14b8a6', 390, 'expense_leisure'),
      ('Transferencia entre Portafolios', 'EXPENSE', 'bank', '#06b6d4', 400, NULL),
      ('Compra de USDT', 'EXPENSE', 'coins', '#10b981', 410, NULL),
      ('Pago TC', 'EXPENSE', 'credit-card', '#f43f5e', 420, 'expense_credit'),
      ('Transporte - Combustible', 'EXPENSE', 'car', '#f97316', 430, NULL),
      ('Compra de USD-Dolares', 'EXPENSE', 'coins', '#22c55e', 440, NULL),
      ('Otros', 'EXPENSE', 'minus-circle', '#6b7280', 450, 'expense_other'),
      ('Activos Tangibles', 'EXPENSE', 'package', '#6366f1', 460, 'expense_asset'),
      ('Disposicion (Tarjeta de Credito)', 'EXPENSE', 'credit-card', '#f97316', 470, NULL)
  )
  INSERT INTO categories (id, user_id, name, scope, icon, color, is_system, sort_order, system_key)
  SELECT
    gen_random_uuid(),
    p_user_id,
    d.name,
    d.scope::category_scope,
    d.icon,
    d.color,
    false,
    d.sort_order,
    d.system_key
  FROM defaults d
  WHERE NOT EXISTS (
    SELECT 1
    FROM categories c
    WHERE c.user_id = p_user_id
      AND lower(trim(c.name)) = lower(trim(d.name))
      AND c.scope::text = d.scope
  );
END;
$$;

UPDATE categories
SET
  system_key = CASE
    WHEN lower(trim(name)) = lower('Cobro de préstamos') AND scope::text = 'INCOME'
      THEN 'income_receivable_collection'
    WHEN lower(trim(name)) = lower('Préstamos otorgados (De terceros)') AND scope::text = 'INCOME'
      THEN 'income_payable_issue'
    WHEN lower(trim(name)) = lower('Pago de préstamos') AND scope::text = 'EXPENSE'
      THEN 'expense_payable_payment'
    WHEN lower(trim(name)) = lower('Préstamos otorgados (A terceros)') AND scope::text = 'EXPENSE'
      THEN 'expense_receivable_issue'
    ELSE system_key
  END
WHERE user_id IS NOT NULL
  AND (
    (lower(trim(name)) = lower('Cobro de préstamos') AND scope::text = 'INCOME')
    OR (lower(trim(name)) = lower('Préstamos otorgados (De terceros)') AND scope::text = 'INCOME')
    OR (lower(trim(name)) = lower('Pago de préstamos') AND scope::text = 'EXPENSE')
    OR (lower(trim(name)) = lower('Préstamos otorgados (A terceros)') AND scope::text = 'EXPENSE')
  );

DO $$
DECLARE
  profile_row record;
BEGIN
  FOR profile_row IN
    SELECT id FROM profiles
  LOOP
    PERFORM fn_seed_default_categories(profile_row.id);
  END LOOP;
END;
$$;

UPDATE transactions t
SET category_id = target.id
FROM categories current_category,
     categories target
WHERE t.category_id = current_category.id
  AND current_category.user_id = t.user_id
  AND target.user_id = t.user_id
  AND target.system_key = 'income_receivable_collection'
  AND t.type = 'INCOME'
  AND current_category.system_key = 'expense_receivable_issue';

UPDATE transactions t
SET category_id = target.id
FROM categories current_category,
     categories target
WHERE t.category_id = current_category.id
  AND current_category.user_id = t.user_id
  AND target.user_id = t.user_id
  AND target.system_key = 'expense_payable_payment'
  AND t.type = 'EXPENSE'
  AND current_category.system_key = 'income_payable_issue';
