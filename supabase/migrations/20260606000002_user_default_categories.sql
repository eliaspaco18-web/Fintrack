-- =============================================================================
-- Categorías default por usuario
-- - Mantiene plantillas globales si existen, pero la app pasa a usar copias
--   propias del usuario para que pueda editarlas o eliminarlas.
-- - Permite system_key en categorías no-system para conservar la semántica
--   del formulario y módulos derivados.
-- =============================================================================

DROP INDEX IF EXISTS idx_categories_system_key;

ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_system_key_only_system;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_owner_system_key
  ON categories ((COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)), system_key)
  WHERE system_key IS NOT NULL;

CREATE OR REPLACE FUNCTION fn_seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH defaults(name, scope, icon, color, sort_order, system_key) AS (
    VALUES
      ('Cobro de préstamos', 'INCOME', 'wallet', '#06b6d4', 10, NULL),
      ('Préstamos otorgados (De terceros)', 'INCOME', 'file-minus', '#8b5cf6', 20, 'expense_payable'),
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
      ('Pago de préstamos', 'EXPENSE', 'credit-card', '#ef4444', 270, NULL),
      ('Préstamos otorgados (A terceros)', 'EXPENSE', 'wallet', '#06b6d4', 280, 'income_receivable'),
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
    AND c.system_key IS NULL
    AND lower(trim(c.name)) = lower(trim(d.name))
    AND c.scope::text = d.scope::text;

  WITH defaults(name, scope, icon, color, sort_order, system_key) AS (
    VALUES
      ('Cobro de préstamos', 'INCOME', 'wallet', '#06b6d4', 10, NULL),
      ('Préstamos otorgados (De terceros)', 'INCOME', 'file-minus', '#8b5cf6', 20, 'expense_payable'),
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
      ('Pago de préstamos', 'EXPENSE', 'credit-card', '#ef4444', 270, NULL),
      ('Préstamos otorgados (A terceros)', 'EXPENSE', 'wallet', '#06b6d4', 280, 'income_receivable'),
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

CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

  PERFORM fn_seed_default_categories(NEW.id);

  RETURN NEW;
END;
$$;

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
