-- =============================================================================
-- MIGRATION 003: ROW LEVEL SECURITY (RLS)
-- Cada usuario solo puede ver y modificar sus propios datos.
-- Las categorías del sistema son visibles para todos los usuarios.
-- =============================================================================

-- =============================================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates        ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PROFILES
-- Un usuario solo puede ver y editar su propio perfil.
-- La creación la realiza el trigger fn_handle_new_user (SECURITY DEFINER).
-- =============================================================================

CREATE POLICY "profiles: select own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT lo maneja exclusivamente el trigger de auth — no se permite desde cliente.

-- =============================================================================
-- ACCOUNTS
-- =============================================================================

CREATE POLICY "accounts: select own"
  ON accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "accounts: insert own"
  ON accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "accounts: update own"
  ON accounts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "accounts: delete own"
  ON accounts FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- CATEGORIES
-- Cada usuario ve sus propias categorías + las del sistema (user_id IS NULL).
-- Solo puede modificar las suyas (is_system = false).
-- =============================================================================

CREATE POLICY "categories: select own and system"
  ON categories FOR SELECT
  USING (user_id = auth.uid() OR is_system = true);

CREATE POLICY "categories: insert own"
  ON categories FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_system = false);

CREATE POLICY "categories: update own non-system"
  ON categories FOR UPDATE
  USING (user_id = auth.uid() AND is_system = false)
  WITH CHECK (user_id = auth.uid() AND is_system = false);

CREATE POLICY "categories: delete own non-system"
  ON categories FOR DELETE
  USING (user_id = auth.uid() AND is_system = false);

-- =============================================================================
-- TRANSACTIONS
-- =============================================================================

CREATE POLICY "transactions: select own"
  ON transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "transactions: insert own"
  ON transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "transactions: update own"
  ON transactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "transactions: delete own"
  ON transactions FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- ASSETS
-- =============================================================================

CREATE POLICY "assets: select own"
  ON assets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "assets: insert own"
  ON assets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "assets: update own"
  ON assets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "assets: delete own"
  ON assets FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- CREDITS
-- =============================================================================

CREATE POLICY "credits: select own"
  ON credits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "credits: insert own"
  ON credits FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "credits: update own"
  ON credits FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "credits: delete own"
  ON credits FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- LOANS
-- =============================================================================

CREATE POLICY "loans: select own"
  ON loans FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "loans: insert own"
  ON loans FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "loans: update own"
  ON loans FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "loans: delete own"
  ON loans FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- INSTALLMENTS
-- Sin user_id directo: el acceso se verifica a través de loans.
-- =============================================================================

CREATE POLICY "installments: select via loan"
  ON installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = installments.loan_id
        AND loans.user_id = auth.uid()
    )
  );

CREATE POLICY "installments: insert via loan"
  ON installments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = installments.loan_id
        AND loans.user_id = auth.uid()
    )
  );

CREATE POLICY "installments: update via loan"
  ON installments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = installments.loan_id
        AND loans.user_id = auth.uid()
    )
  );

CREATE POLICY "installments: delete via loan"
  ON installments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = installments.loan_id
        AND loans.user_id = auth.uid()
    )
  );

-- =============================================================================
-- ACCOUNTS RECEIVABLE
-- =============================================================================

CREATE POLICY "ar: select own"
  ON accounts_receivable FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ar: insert own"
  ON accounts_receivable FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ar: update own"
  ON accounts_receivable FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ar: delete own"
  ON accounts_receivable FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- ACCOUNTS PAYABLE
-- =============================================================================

CREATE POLICY "ap: select own"
  ON accounts_payable FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ap: insert own"
  ON accounts_payable FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ap: update own"
  ON accounts_payable FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ap: delete own"
  ON accounts_payable FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- BUDGETS
-- =============================================================================

CREATE POLICY "budgets: select own"
  ON budgets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "budgets: insert own"
  ON budgets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "budgets: update own"
  ON budgets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "budgets: delete own"
  ON budgets FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- GOALS
-- =============================================================================

CREATE POLICY "goals: select own"
  ON goals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "goals: insert own"
  ON goals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "goals: update own"
  ON goals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "goals: delete own"
  ON goals FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- EXCHANGE RATES
-- Solo lectura para todos los usuarios autenticados.
-- La escritura se realiza vía service_role (backend / cron).
-- =============================================================================

CREATE POLICY "exchange_rates: select authenticated"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE solo desde service_role (no hay política pública de escritura).

-- =============================================================================
-- SEGURIDAD EN VISTAS
-- Las vistas heredan RLS de las tablas base, pero se fuerza el contexto.
-- =============================================================================

-- Proteger v_net_worth — solo muestra datos del usuario autenticado
CREATE OR REPLACE VIEW v_net_worth WITH (security_invoker = true) AS
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

-- Proteger v_monthly_summary
CREATE OR REPLACE VIEW v_monthly_summary WITH (security_invoker = true) AS
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
-- GRANT DE PERMISOS AL ROL anon Y authenticated
-- =============================================================================

-- anon: solo puede iniciar sesión (Supabase Auth lo maneja)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- authenticated: acceso a tablas con RLS activo
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
