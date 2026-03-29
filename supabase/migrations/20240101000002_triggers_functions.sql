-- =============================================================================
-- MIGRATION 002: FUNCIONES Y TRIGGERS
-- Automatizaciones a nivel de base de datos
-- =============================================================================

-- =============================================================================
-- FUNCIÓN GENÉRICA: updated_at automático
-- Se aplica a todas las tablas que tienen esta columna.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_credits_updated_at
  BEFORE UPDATE ON credits
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_installments_updated_at
  BEFORE UPDATE ON installments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_ar_updated_at
  BEFORE UPDATE ON accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_ap_updated_at
  BEFORE UPDATE ON accounts_payable
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- TRIGGER 1: affects_reports automático
-- Garantiza que las TRANSFERENCIAS nunca afecten reportes,
-- independientemente de lo que envíe la aplicación.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_affects_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- TRANSFERENCIA siempre excluida de reportes — no negociable
  IF NEW.type = 'TRANSFER' THEN
    NEW.affects_reports = false;
  ELSE
    NEW.affects_reports = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transactions_affects_reports
  BEFORE INSERT OR UPDATE OF type ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_affects_reports();

-- =============================================================================
-- TRIGGER 2: amount_pen automático
-- Calcula el equivalente en soles al momento de insertar/actualizar.
-- Si la moneda ya es PEN, amount_pen = amount.
-- Si es USD, amount_pen = amount * exchange_rate.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_amount_pen()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.currency = 'PEN' THEN
    NEW.amount_pen      = NEW.amount;
    NEW.exchange_rate   = 1.000000;
  ELSE
    -- exchange_rate debe venir de la aplicación; validar que sea > 0
    IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 THEN
      RAISE EXCEPTION 'exchange_rate debe ser positivo para moneda %', NEW.currency;
    END IF;
    NEW.amount_pen = round(NEW.amount * NEW.exchange_rate, 2);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transactions_amount_pen
  BEFORE INSERT OR UPDATE OF amount, currency, exchange_rate ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_amount_pen();

-- =============================================================================
-- TRIGGER 3: saldo de cuentas
-- Actualiza accounts.balance en tiempo real tras cada transacción.
-- Reglas de negocio:
--   INCOME  → suma en cuenta_origen
--   EXPENSE → resta en cuenta_origen
--   TRANSFER → resta en cuenta_origen, suma en cuenta_destino
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- ── INSERT ──────────────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance + NEW.amount
        WHERE id = NEW.source_account_id;

    ELSIF NEW.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance - NEW.amount
        WHERE id = NEW.source_account_id;

    ELSIF NEW.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance - NEW.amount
        WHERE id = NEW.source_account_id;
      UPDATE accounts SET balance = balance + NEW.amount
        WHERE id = NEW.destination_account_id;
    END IF;

  -- ── DELETE ──────────────────────────────────────────────────────────────────
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance - OLD.amount
        WHERE id = OLD.source_account_id;

    ELSIF OLD.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance + OLD.amount
        WHERE id = OLD.source_account_id;

    ELSIF OLD.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance + OLD.amount
        WHERE id = OLD.source_account_id;
      UPDATE accounts SET balance = balance - OLD.amount
        WHERE id = OLD.destination_account_id;
    END IF;

  -- ── UPDATE ──────────────────────────────────────────────────────────────────
  -- Revertir el efecto anterior y aplicar el nuevo
  ELSIF TG_OP = 'UPDATE' THEN
    -- Revertir OLD
    IF OLD.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.source_account_id;
    ELSIF OLD.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.source_account_id;
    ELSIF OLD.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.source_account_id;
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.destination_account_id;
    END IF;

    -- Aplicar NEW
    IF NEW.type = 'INCOME' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.source_account_id;
    ELSIF NEW.type = 'EXPENSE' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.source_account_id;
    ELSIF NEW.type = 'TRANSFER' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.source_account_id;
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.destination_account_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_transactions_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_update_account_balance();

-- =============================================================================
-- TRIGGER 4: Profile automático al registrar usuario
-- Crea el perfil del usuario cuando se registra en auth.users.
-- =============================================================================

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
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- =============================================================================
-- TRIGGER 5: Cuotas vencidas — actualización de estado automática
-- Marca como OVERDUE las cuotas cuyo due_date ya pasó y siguen PENDING.
-- Se ejecuta vía pg_cron (Supabase) diariamente, o al hacer SELECT.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_mark_overdue_installments()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE installments
  SET    status = 'OVERDUE'
  WHERE  status = 'PENDING'
    AND  due_date < CURRENT_DATE;
END;
$$;

-- =============================================================================
-- TRIGGER 6: Cuentas por cobrar/pagar — vencimiento automático
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_mark_overdue_payables_receivables()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cuentas por pagar vencidas
  UPDATE accounts_payable
  SET    status = 'DISPUTED'
  WHERE  status = 'PENDING'
    AND  due_date < CURRENT_DATE;

  -- Nota: accounts_receivable no cambia status automáticamente;
  -- solo el usuario decide escribir off una deuda.
END;
$$;

-- =============================================================================
-- FUNCIÓN UTILITARIA: tasa de cambio más reciente
-- Usada en queries del dashboard para consolidar multimoneda.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_latest_exchange_rate(
  p_from currency_code,
  p_to   currency_code
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT rate
  FROM   exchange_rates
  WHERE  from_currency = p_from
    AND  to_currency   = p_to
  ORDER  BY fetched_at DESC
  LIMIT  1;
$$;

-- =============================================================================
-- VISTA: v_net_worth
-- Patrimonio neto del usuario consolidado en PEN.
-- Excluye cuentas marcadas como include_in_net_worth = false.
-- =============================================================================

CREATE OR REPLACE VIEW v_net_worth AS
SELECT
  a.user_id,
  SUM(
    CASE
      WHEN a.currency = 'PEN' THEN a.balance
      ELSE a.balance * COALESCE(fn_latest_exchange_rate(a.currency, 'PEN'), 1)
    END
  ) AS net_worth_pen,
  COUNT(*) FILTER (WHERE a.is_active) AS active_accounts
FROM accounts a
WHERE a.include_in_net_worth = true
  AND a.is_active = true
GROUP BY a.user_id;

-- =============================================================================
-- VISTA: v_monthly_summary
-- Resumen mensual de ingresos y egresos (excluye transferencias).
-- =============================================================================

CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT
  user_id,
  date_trunc('month', transaction_date)::date AS month,
  SUM(amount_pen) FILTER (WHERE type = 'INCOME')  AS total_income_pen,
  SUM(amount_pen) FILTER (WHERE type = 'EXPENSE') AS total_expense_pen,
  SUM(amount_pen) FILTER (WHERE type = 'INCOME')
    - SUM(amount_pen) FILTER (WHERE type = 'EXPENSE') AS net_pen,
  COUNT(*) FILTER (WHERE type = 'INCOME')  AS income_count,
  COUNT(*) FILTER (WHERE type = 'EXPENSE') AS expense_count
FROM transactions
WHERE affects_reports = true
GROUP BY user_id, date_trunc('month', transaction_date);

-- =============================================================================
-- DATOS INICIALES: Categorías del sistema
-- =============================================================================

INSERT INTO categories (id, user_id, name, scope, icon, color, is_system, sort_order) VALUES
  -- Ingresos
  (gen_random_uuid(), NULL, 'Sueldo',            'INCOME',  'briefcase',   '#10b981', true, 1),
  (gen_random_uuid(), NULL, 'Freelance',          'INCOME',  'laptop',      '#3b82f6', true, 2),
  (gen_random_uuid(), NULL, 'Inversiones',        'INCOME',  'trending-up', '#8b5cf6', true, 3),
  (gen_random_uuid(), NULL, 'Alquileres',         'INCOME',  'home',        '#f59e0b', true, 4),
  (gen_random_uuid(), NULL, 'Cuenta por cobrar',  'INCOME',  'file-text',   '#06b6d4', true, 5),
  (gen_random_uuid(), NULL, 'Otros ingresos',     'INCOME',  'plus-circle', '#6b7280', true, 6),
  -- Egresos
  (gen_random_uuid(), NULL, 'Alimentación',       'EXPENSE', 'utensils',    '#ef4444', true, 10),
  (gen_random_uuid(), NULL, 'Transporte',         'EXPENSE', 'car',         '#f97316', true, 11),
  (gen_random_uuid(), NULL, 'Vivienda',           'EXPENSE', 'home',        '#eab308', true, 12),
  (gen_random_uuid(), NULL, 'Salud',              'EXPENSE', 'heart',       '#ec4899', true, 13),
  (gen_random_uuid(), NULL, 'Educación',          'EXPENSE', 'book-open',   '#8b5cf6', true, 14),
  (gen_random_uuid(), NULL, 'Entretenimiento',    'EXPENSE', 'film',        '#14b8a6', true, 15),
  (gen_random_uuid(), NULL, 'Activo',             'EXPENSE', 'package',     '#6366f1', true, 16),
  (gen_random_uuid(), NULL, 'Crédito / Préstamo', 'EXPENSE', 'credit-card', '#f43f5e', true, 17),
  (gen_random_uuid(), NULL, 'Cuenta por pagar',   'EXPENSE', 'file-minus',  '#64748b', true, 18),
  (gen_random_uuid(), NULL, 'Otros gastos',       'EXPENSE', 'minus-circle','#6b7280', true, 19);
