-- =============================================================================
-- MIGRATION: FINTRACK v1.9.119.1.1 — SCHEMA UPGRADE
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- SECCIÓN 1: ELIMINAR TABLA goals
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.goals') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "goals: select own" ON public.goals';
    EXECUTE 'DROP POLICY IF EXISTS "goals: insert own" ON public.goals';
    EXECUTE 'DROP POLICY IF EXISTS "goals: update own" ON public.goals';
    EXECUTE 'DROP POLICY IF EXISTS "goals: delete own" ON public.goals';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals';
  END IF;
END $$;

DROP INDEX IF EXISTS idx_goals_user_id;
DROP INDEX IF EXISTS idx_goals_status;
DROP TABLE IF EXISTS goals;
DROP TYPE IF EXISTS goal_status;

-- =============================================================================
-- SECCIÓN 2: CONVERTIR currency_code ENUM A TEXT
-- =============================================================================

-- Romper dependencias antes de ALTER COLUMN currency
DROP TRIGGER IF EXISTS trg_transactions_amount_pen ON public.transactions;

-- Eliminar TODAS las vistas que dependen de fn_latest_exchange_rate
DROP VIEW IF EXISTS v_monthly_summary;
DROP VIEW IF EXISTS v_net_worth;
DROP VIEW IF EXISTS v_account_balances;
DROP VIEW IF EXISTS v_credit_summary;
DROP VIEW IF EXISTS v_upcoming_installments;
DROP VIEW IF EXISTS v_receivables_summary;
DROP VIEW IF EXISTS v_payables_summary;

-- Eliminar la función con CASCADE para cubrir cualquier dependencia residual
DROP FUNCTION IF EXISTS fn_latest_exchange_rate(currency_code, currency_code) CASCADE;

ALTER TABLE profiles ALTER COLUMN default_currency TYPE text USING default_currency::text;
ALTER TABLE accounts ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE transactions ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE assets ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE credits ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE loans ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE accounts_receivable ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE accounts_payable ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE budgets ALTER COLUMN currency TYPE text USING currency::text;
ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS er_different_currencies;
ALTER TABLE exchange_rates
  ALTER COLUMN from_currency TYPE text USING from_currency::text,
  ALTER COLUMN to_currency TYPE text USING to_currency::text;
ALTER TABLE exchange_rates
  ADD CONSTRAINT er_different_currencies CHECK (from_currency <> to_currency);

-- Reescribir defaults para romper dependencia con currency_code
ALTER TABLE profiles            ALTER COLUMN default_currency SET DEFAULT 'PEN';
ALTER TABLE accounts            ALTER COLUMN currency         SET DEFAULT 'PEN';
ALTER TABLE transactions        ALTER COLUMN currency         SET DEFAULT 'PEN';
ALTER TABLE assets              ALTER COLUMN currency         SET DEFAULT 'PEN';
ALTER TABLE credits             ALTER COLUMN currency         SET DEFAULT 'PEN';
ALTER TABLE loans               ALTER COLUMN currency         SET DEFAULT 'PEN';
ALTER TABLE accounts_receivable ALTER COLUMN currency         SET DEFAULT 'PEN';
ALTER TABLE accounts_payable    ALTER COLUMN currency         SET DEFAULT 'PEN';
ALTER TABLE budgets             ALTER COLUMN currency         SET DEFAULT 'PEN';

DROP TYPE IF EXISTS currency_code;

-- Recrear función con parámetros TEXT
CREATE OR REPLACE FUNCTION fn_latest_exchange_rate(p_from text, p_to text)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT rate FROM exchange_rates
  WHERE from_currency = p_from AND to_currency = p_to
  ORDER BY fetched_at DESC LIMIT 1;
$$;

-- Recrear vista v_net_worth
CREATE OR REPLACE VIEW v_net_worth WITH (security_invoker = true) AS
SELECT
  a.user_id,
  SUM(CASE WHEN a.currency = 'PEN' THEN a.balance
       ELSE a.balance * COALESCE(fn_latest_exchange_rate(a.currency, 'PEN'), 1) END
  ) AS net_worth_pen,
  COUNT(*) FILTER (WHERE a.is_active) AS active_accounts
FROM accounts a
WHERE a.include_in_net_worth = true AND a.is_active = true
GROUP BY a.user_id;

-- Recrear vista v_monthly_summary
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
FROM transactions WHERE affects_reports = true
GROUP BY user_id, date_trunc('month', transaction_date);

-- Recrear vista v_account_balances (dependía de fn_latest_exchange_rate)
CREATE OR REPLACE VIEW v_account_balances WITH (security_invoker = true) AS
SELECT
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.balance,
  a.color,
  a.icon,
  a.institution,
  a.include_in_net_worth,
  a.is_active,
  CASE
    WHEN a.currency = 'PEN' THEN a.balance
    ELSE a.balance * COALESCE(fn_latest_exchange_rate(a.currency, 'PEN'), 1)
  END AS balance_pen
FROM accounts a
WHERE a.is_active = true;

-- =============================================================================
-- SECCIÓN 3: EXPANDIR ENUM account_type
-- =============================================================================

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'STOCKS';
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'ETF';
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'CRYPTO';

-- =============================================================================
-- SECCIÓN 4: NUEVOS ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE transaction_sub_type AS ENUM ('ASSET_PURCHASE','RECEIVABLE_LENDING','PAYABLE_PAYMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('DEBIT','CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('CRITICAL','OPERATIONAL','SUGGESTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- SECCIÓN 5: NUEVAS TABLAS
-- =============================================================================

-- user_currencies
CREATE TABLE IF NOT EXISTS user_currencies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  code        text        NOT NULL,
  name        text        NOT NULL,
  symbol      text        NOT NULL DEFAULT '$',
  country     text,
  is_default  boolean     NOT NULL DEFAULT false,
  is_system   boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uc_code_length CHECK (char_length(code) BETWEEN 2 AND 10),
  CONSTRAINT uc_name_length CHECK (char_length(name) BETWEEN 2 AND 60),
  CONSTRAINT uc_system_no_user CHECK (
    (is_system = true AND user_id IS NULL) OR (is_system = false AND user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_uc_user_code ON user_currencies (user_id, upper(code));
CREATE INDEX IF NOT EXISTS idx_uc_user_active ON user_currencies (user_id, is_active);

INSERT INTO user_currencies (user_id, code, name, symbol, country, is_default, is_system) VALUES
  (NULL, 'PEN', 'Sol peruano',     'S/', 'Perú',           true,  true),
  (NULL, 'USD', 'Dólar americano', '$',  'Estados Unidos', false, true),
  (NULL, 'EUR', 'Euro',            '€',  'Unión Europea',  false, true),
  (NULL, 'BRL', 'Real brasileño',  'R$', 'Brasil',         false, true),
  (NULL, 'CLP', 'Peso chileno',    '$',  'Chile',          false, true),
  (NULL, 'COP', 'Peso colombiano', '$',  'Colombia',       false, true),
  (NULL, 'MXN', 'Peso mexicano',   '$',  'México',         false, true),
  (NULL, 'ARS', 'Peso argentino',  '$',  'Argentina',      false, true),
  (NULL, 'BOB', 'Boliviano',       'Bs', 'Bolivia',        false, true),
  (NULL, 'GBP', 'Libra esterlina', '£',  'Reino Unido',    false, true)
ON CONFLICT DO NOTHING;

-- asset_types
CREATE TABLE IF NOT EXISTS asset_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  icon        text        NOT NULL DEFAULT 'package',
  color       text        NOT NULL DEFAULT '#6366f1',
  is_system   boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_name_length CHECK (char_length(name) BETWEEN 2 AND 80),
  CONSTRAINT at_system_no_user CHECK (
    (is_system = true AND user_id IS NULL) OR (is_system = false AND user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_at_user_name ON asset_types (user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_at_user_active ON asset_types (user_id, is_active);

INSERT INTO asset_types (user_id, name, icon, color, is_system) VALUES
  (NULL, 'Tecnología',   'cpu',         '#3b82f6', true),
  (NULL, 'Vehículo',     'car',         '#f97316', true),
  (NULL, 'Inmueble',     'home',        '#10b981', true),
  (NULL, 'Inversión',    'trending-up', '#8b5cf6', true),
  (NULL, 'Equipamiento', 'wrench',      '#eab308', true),
  (NULL, 'Otro',         'package',     '#6b7280', true)
ON CONFLICT DO NOTHING;

-- debtors
CREATE TABLE IF NOT EXISTS debtors (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  initial_debt  numeric(15,2) NOT NULL DEFAULT 0.00,
  relationship  text,
  is_active     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT debtors_name_length CHECK (char_length(name) BETWEEN 1 AND 150),
  CONSTRAINT debtors_initial_debt_nonneg CHECK (initial_debt >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtors_user_name ON debtors (user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_debtors_user_active ON debtors (user_id, is_active);

-- creditors
CREATE TABLE IF NOT EXISTS creditors (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  initial_debt  numeric(15,2) NOT NULL DEFAULT 0.00,
  relationship  text,
  is_active     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT creditors_name_length CHECK (char_length(name) BETWEEN 1 AND 150),
  CONSTRAINT creditors_initial_debt_nonneg CHECK (initial_debt >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creditors_user_name ON creditors (user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_creditors_user_active ON creditors (user_id, is_active);

-- billing_cycles
CREATE TABLE IF NOT EXISTS billing_cycles (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id         uuid          NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
  billing_month     integer       NOT NULL,
  billing_year      integer       NOT NULL,
  consumption_from  date          NOT NULL,
  consumption_to    date          NOT NULL,
  payment_date      date          NOT NULL,
  total_to_pay      numeric(15,2) NOT NULL DEFAULT 0.00,
  statement_url     text,
  notes             text,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT bc_month_range CHECK (billing_month BETWEEN 1 AND 12),
  CONSTRAINT bc_year_range CHECK (billing_year BETWEEN 2016 AND 2099),
  CONSTRAINT bc_dates_order CHECK (consumption_from <= consumption_to),
  CONSTRAINT bc_total_nonneg CHECK (total_to_pay >= 0),
  UNIQUE (credit_id, billing_month, billing_year)
);
CREATE INDEX IF NOT EXISTS idx_bc_credit_id ON billing_cycles (credit_id);
CREATE INDEX IF NOT EXISTS idx_bc_payment_date ON billing_cycles (payment_date);

-- recurring_transactions
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id                      uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid                NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                    text                NOT NULL,
  type                    transaction_type    NOT NULL,
  sub_type                transaction_sub_type,
  source_account_id       uuid                REFERENCES accounts(id) ON DELETE SET NULL,
  destination_account_id  uuid                REFERENCES accounts(id) ON DELETE SET NULL,
  category_id             uuid                REFERENCES categories(id) ON DELETE SET NULL,
  budget_id               uuid                REFERENCES budgets(id) ON DELETE SET NULL,
  debtor_id               uuid                REFERENCES debtors(id) ON DELETE SET NULL,
  creditor_id             uuid                REFERENCES creditors(id) ON DELETE SET NULL,
  amount                  numeric(15,2)       NOT NULL DEFAULT 0.00,
  currency                text                NOT NULL DEFAULT 'PEN',
  description             text,
  payment_method          payment_method_type,
  recipient               text,
  sender                  text,
  notes                   text,
  is_active               boolean             NOT NULL DEFAULT true,
  created_at              timestamptz         NOT NULL DEFAULT now(),
  updated_at              timestamptz         NOT NULL DEFAULT now(),
  CONSTRAINT rt_name_length CHECK (char_length(name) BETWEEN 1 AND 150),
  CONSTRAINT rt_amount_nonneg CHECK (amount >= 0)
);
CREATE INDEX IF NOT EXISTS idx_rt_user_id ON recurring_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_rt_user_active ON recurring_transactions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rt_user_type ON recurring_transactions (user_id, type);

-- Compatibilidad: asegurar tablas base de migraciones previas
CREATE TABLE IF NOT EXISTS bank_entities (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  short_name  text,
  code        text,
  country     text        NOT NULL DEFAULT 'PE',
  color       text        NOT NULL DEFAULT '#0ea5e9',
  icon        text        NOT NULL DEFAULT 'bank',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_entities_name_length       CHECK (char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT bank_entities_short_name_length CHECK (short_name IS NULL OR char_length(short_name) BETWEEN 2 AND 40),
  CONSTRAINT bank_entities_code_length       CHECK (code IS NULL OR char_length(code) BETWEEN 2 AND 20),
  CONSTRAINT bank_entities_country_length    CHECK (char_length(country) BETWEEN 2 AND 3)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_entities_user_name_unique
  ON bank_entities (user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_bank_entities_user_active
  ON bank_entities (user_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS app_notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category   text        NOT NULL DEFAULT 'SYSTEM',
  event      text        NOT NULL,
  title      text        NOT NULL,
  message    text,
  href       text,
  context    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  CONSTRAINT app_notifications_category_length CHECK (char_length(category) BETWEEN 2 AND 40),
  CONSTRAINT app_notifications_event_length    CHECK (char_length(event) BETWEEN 2 AND 60),
  CONSTRAINT app_notifications_title_length    CHECK (char_length(title) BETWEEN 2 AND 140)
);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON app_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
  ON app_notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

-- =============================================================================
-- SECCIÓN 6: ALTERAR TABLAS EXISTENTES
-- =============================================================================

-- transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sub_type                 transaction_sub_type,
  ADD COLUMN IF NOT EXISTS payment_method           payment_method_type,
  ADD COLUMN IF NOT EXISTS budget_id                uuid REFERENCES budgets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS debtor_id                uuid REFERENCES debtors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creditor_id              uuid REFERENCES creditors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_transaction_id uuid REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient                text,
  ADD COLUMN IF NOT EXISTS sender                   text,
  ADD COLUMN IF NOT EXISTS attachment_url           text;

CREATE INDEX IF NOT EXISTS idx_tx_budget_id ON transactions (budget_id) WHERE budget_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_debtor_id ON transactions (debtor_id) WHERE debtor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_creditor_id ON transactions (creditor_id) WHERE creditor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_sub_type ON transactions (user_id, sub_type) WHERE sub_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_recurring ON transactions (recurring_transaction_id) WHERE recurring_transaction_id IS NOT NULL;

-- installments
ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS insurance_amount  numeric(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS other_charges     numeric(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS payment_proof_url text;

ALTER TABLE installments DROP CONSTRAINT IF EXISTS installments_total_equals_sum;
ALTER TABLE installments ADD CONSTRAINT installments_total_equals_sum CHECK (
  round(total_amount, 2) = round(principal_amount + interest_amount + insurance_amount + other_charges, 2)
);

DO $$ BEGIN
  ALTER TABLE installments ADD CONSTRAINT installments_insurance_nonneg CHECK (insurance_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE installments ADD CONSTRAINT installments_other_nonneg CHECK (other_charges >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- loans
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS name                    text,
  ADD COLUMN IF NOT EXISTS disbursement_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_entity_id          uuid REFERENCES bank_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loans_disbursement ON loans (disbursement_account_id) WHERE disbursement_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loans_bank_entity ON loans (bank_entity_id) WHERE bank_entity_id IS NOT NULL;

-- assets
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS asset_type_id uuid REFERENCES asset_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS recipient     text;

CREATE INDEX IF NOT EXISTS idx_assets_type_id ON assets (asset_type_id) WHERE asset_type_id IS NOT NULL;

UPDATE assets SET asset_type_id = (SELECT id FROM asset_types WHERE name = 'Inmueble'     AND is_system = true LIMIT 1) WHERE asset_type = 'REAL_ESTATE'  AND asset_type_id IS NULL;
UPDATE assets SET asset_type_id = (SELECT id FROM asset_types WHERE name = 'Vehículo'     AND is_system = true LIMIT 1) WHERE asset_type = 'VEHICLE'      AND asset_type_id IS NULL;
UPDATE assets SET asset_type_id = (SELECT id FROM asset_types WHERE name = 'Equipamiento' AND is_system = true LIMIT 1) WHERE asset_type = 'EQUIPMENT'    AND asset_type_id IS NULL;
UPDATE assets SET asset_type_id = (SELECT id FROM asset_types WHERE name = 'Inversión'    AND is_system = true LIMIT 1) WHERE asset_type = 'INVESTMENT'   AND asset_type_id IS NULL;
UPDATE assets SET asset_type_id = (SELECT id FROM asset_types WHERE name = 'Otro'         AND is_system = true LIMIT 1) WHERE asset_type = 'OTHER'        AND asset_type_id IS NULL;

-- accounts_receivable
ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS debtor_id      uuid REFERENCES debtors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_url text;
CREATE INDEX IF NOT EXISTS idx_ar_debtor ON accounts_receivable (debtor_id) WHERE debtor_id IS NOT NULL;

-- accounts_payable
ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS creditor_id    uuid REFERENCES creditors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_url text;
CREATE INDEX IF NOT EXISTS idx_ap_creditor ON accounts_payable (creditor_id) WHERE creditor_id IS NOT NULL;

-- credits
ALTER TABLE credits
  ADD COLUMN IF NOT EXISTS bank_entity_id uuid REFERENCES bank_entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_credits_bank_entity ON credits (bank_entity_id) WHERE bank_entity_id IS NOT NULL;

-- app_notifications
ALTER TABLE app_notifications
  ADD COLUMN IF NOT EXISTS alert_type        alert_severity NOT NULL DEFAULT 'OPERATIONAL',
  ADD COLUMN IF NOT EXISTS source_module     text,
  ADD COLUMN IF NOT EXISTS source_record_id  uuid;
CREATE INDEX IF NOT EXISTS idx_notif_alert_type ON app_notifications (user_id, alert_type, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_source ON app_notifications (source_module, source_record_id) WHERE source_record_id IS NOT NULL;

-- budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS description text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_name ON budgets (user_id, lower(name));

-- =============================================================================
-- SECCIÓN 7: TRIGGERS updated_at
-- =============================================================================

DROP TRIGGER IF EXISTS trg_uc_updated_at ON user_currencies;
CREATE TRIGGER trg_uc_updated_at BEFORE UPDATE ON user_currencies FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_at_updated_at ON asset_types;
CREATE TRIGGER trg_at_updated_at BEFORE UPDATE ON asset_types FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_debtors_updated_at ON debtors;
CREATE TRIGGER trg_debtors_updated_at BEFORE UPDATE ON debtors FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_creditors_updated_at ON creditors;
CREATE TRIGGER trg_creditors_updated_at BEFORE UPDATE ON creditors FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_bc_updated_at ON billing_cycles;
CREATE TRIGGER trg_bc_updated_at BEFORE UPDATE ON billing_cycles FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_rt_updated_at ON recurring_transactions;
CREATE TRIGGER trg_rt_updated_at BEFORE UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- SECCIÓN 8: RLS + POLÍTICAS
-- =============================================================================

ALTER TABLE user_currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uc: select own and system" ON user_currencies;
CREATE POLICY "uc: select own and system" ON user_currencies FOR SELECT USING (user_id = auth.uid() OR is_system = true);
DROP POLICY IF EXISTS "uc: insert own" ON user_currencies;
CREATE POLICY "uc: insert own" ON user_currencies FOR INSERT WITH CHECK (user_id = auth.uid() AND is_system = false);
DROP POLICY IF EXISTS "uc: update own" ON user_currencies;
CREATE POLICY "uc: update own" ON user_currencies FOR UPDATE USING (user_id = auth.uid() AND is_system = false) WITH CHECK (user_id = auth.uid() AND is_system = false);
DROP POLICY IF EXISTS "uc: delete own" ON user_currencies;
CREATE POLICY "uc: delete own" ON user_currencies FOR DELETE USING (user_id = auth.uid() AND is_system = false);

ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "at: select own and system" ON asset_types;
CREATE POLICY "at: select own and system" ON asset_types FOR SELECT USING (user_id = auth.uid() OR is_system = true);
DROP POLICY IF EXISTS "at: insert own" ON asset_types;
CREATE POLICY "at: insert own" ON asset_types FOR INSERT WITH CHECK (user_id = auth.uid() AND is_system = false);
DROP POLICY IF EXISTS "at: update own" ON asset_types;
CREATE POLICY "at: update own" ON asset_types FOR UPDATE USING (user_id = auth.uid() AND is_system = false) WITH CHECK (user_id = auth.uid() AND is_system = false);
DROP POLICY IF EXISTS "at: delete own" ON asset_types;
CREATE POLICY "at: delete own" ON asset_types FOR DELETE USING (user_id = auth.uid() AND is_system = false);

ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "debtors: select own" ON debtors;
CREATE POLICY "debtors: select own" ON debtors FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "debtors: insert own" ON debtors;
CREATE POLICY "debtors: insert own" ON debtors FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "debtors: update own" ON debtors;
CREATE POLICY "debtors: update own" ON debtors FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "debtors: delete own" ON debtors;
CREATE POLICY "debtors: delete own" ON debtors FOR DELETE USING (user_id = auth.uid());

ALTER TABLE creditors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "creditors: select own" ON creditors;
CREATE POLICY "creditors: select own" ON creditors FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "creditors: insert own" ON creditors;
CREATE POLICY "creditors: insert own" ON creditors FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "creditors: update own" ON creditors;
CREATE POLICY "creditors: update own" ON creditors FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "creditors: delete own" ON creditors;
CREATE POLICY "creditors: delete own" ON creditors FOR DELETE USING (user_id = auth.uid());

ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bc: select via credit" ON billing_cycles;
CREATE POLICY "bc: select via credit" ON billing_cycles FOR SELECT USING (EXISTS (SELECT 1 FROM credits WHERE credits.id = billing_cycles.credit_id AND credits.user_id = auth.uid()));
DROP POLICY IF EXISTS "bc: insert via credit" ON billing_cycles;
CREATE POLICY "bc: insert via credit" ON billing_cycles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM credits WHERE credits.id = billing_cycles.credit_id AND credits.user_id = auth.uid()));
DROP POLICY IF EXISTS "bc: update via credit" ON billing_cycles;
CREATE POLICY "bc: update via credit" ON billing_cycles FOR UPDATE USING (EXISTS (SELECT 1 FROM credits WHERE credits.id = billing_cycles.credit_id AND credits.user_id = auth.uid()));
DROP POLICY IF EXISTS "bc: delete via credit" ON billing_cycles;
CREATE POLICY "bc: delete via credit" ON billing_cycles FOR DELETE USING (EXISTS (SELECT 1 FROM credits WHERE credits.id = billing_cycles.credit_id AND credits.user_id = auth.uid()));

ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rt: select own" ON recurring_transactions;
CREATE POLICY "rt: select own" ON recurring_transactions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "rt: insert own" ON recurring_transactions;
CREATE POLICY "rt: insert own" ON recurring_transactions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "rt: update own" ON recurring_transactions;
CREATE POLICY "rt: update own" ON recurring_transactions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "rt: delete own" ON recurring_transactions;
CREATE POLICY "rt: delete own" ON recurring_transactions FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- SECCIÓN 9: GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON user_currencies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON debtors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON creditors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_cycles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transactions TO authenticated;

-- =============================================================================
-- SECCIÓN 10: SUPABASE STORAGE
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments', 'attachments', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attachments: user upload" ON storage.objects;
CREATE POLICY "attachments: user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "attachments: user read" ON storage.objects;
CREATE POLICY "attachments: user read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "attachments: user update" ON storage.objects;
CREATE POLICY "attachments: user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "attachments: user delete" ON storage.objects;
CREATE POLICY "attachments: user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- SECCIÓN 11: RECREAR OBJETOS DEPENDIENTES DE currency (YA COMO TEXT)
-- =============================================================================

CREATE TRIGGER trg_transactions_amount_pen
  BEFORE INSERT OR UPDATE OF amount, currency, exchange_rate ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_amount_pen();

CREATE OR REPLACE VIEW v_credit_summary WITH (security_invoker = true) AS
SELECT
  c.user_id,
  c.id,
  c.name,
  c.credit_type,
  c.currency,
  c.credit_limit,
  c.used_amount,
  c.available_amount,
  c.interest_rate,
  c.closing_day,
  c.payment_day,
  ROUND(c.used_amount * 100.0 / NULLIF(c.credit_limit, 0), 2) AS utilization_pct,
  CASE
    WHEN c.closing_day IS NOT NULL THEN
      CASE
        WHEN EXTRACT(DAY FROM CURRENT_DATE) < c.closing_day
        THEN make_date(
          EXTRACT(YEAR  FROM CURRENT_DATE)::int,
          EXTRACT(MONTH FROM CURRENT_DATE)::int,
          c.closing_day
        )
        ELSE make_date(
          EXTRACT(YEAR  FROM CURRENT_DATE + INTERVAL '1 month')::int,
          EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 month')::int,
          c.closing_day
        )
      END
  END AS next_closing_date
FROM credits c
WHERE c.status = 'ACTIVE';

CREATE OR REPLACE VIEW v_upcoming_installments WITH (security_invoker = true) AS
SELECT
  i.id,
  i.loan_id,
  i.installment_number,
  i.total_amount,
  i.due_date,
  i.status,
  l.user_id,
  l.creditor_name,
  l.currency,
  l.total_installments,
  l.paid_installments,
  (i.due_date - CURRENT_DATE)           AS days_until_due,
  CASE
    WHEN i.due_date < CURRENT_DATE       THEN 'OVERDUE'
    WHEN i.due_date <= CURRENT_DATE + 7  THEN 'DUE_SOON'
    ELSE                                      'UPCOMING'
  END                                   AS urgency
FROM installments i
JOIN loans l ON l.id = i.loan_id
WHERE i.status IN ('PENDING', 'PARTIAL')
  AND i.due_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY i.due_date ASC;

CREATE OR REPLACE VIEW v_receivables_summary WITH (security_invoker = true) AS
SELECT
  ar.id,
  ar.user_id,
  ar.debtor_name,
  ar.amount,
  ar.collected_amount,
  ar.amount - ar.collected_amount                 AS pending_amount,
  ar.currency,
  ar.due_date,
  ar.status,
  ar.concept,
  ar.transaction_id,
  CASE
    WHEN ar.due_date IS NULL                       THEN NULL
    WHEN ar.due_date < CURRENT_DATE               THEN 'OVERDUE'
    WHEN ar.due_date <= CURRENT_DATE + 7          THEN 'DUE_SOON'
    ELSE                                               'UPCOMING'
  END                                             AS urgency,
  ar.due_date - CURRENT_DATE                      AS days_until_due
FROM accounts_receivable ar
WHERE ar.status IN ('PENDING', 'PARTIAL')
ORDER BY ar.due_date ASC NULLS LAST;

CREATE OR REPLACE VIEW v_payables_summary WITH (security_invoker = true) AS
SELECT
  ap.id,
  ap.user_id,
  ap.creditor_name,
  ap.amount,
  ap.paid_amount,
  ap.amount - ap.paid_amount                      AS pending_amount,
  ap.currency,
  ap.due_date,
  ap.status,
  ap.concept,
  ap.transaction_id,
  CASE
    WHEN ap.status = 'DISPUTED'                   THEN 'DISPUTED'
    WHEN ap.due_date IS NULL                       THEN NULL
    WHEN ap.due_date < CURRENT_DATE               THEN 'OVERDUE'
    WHEN ap.due_date <= CURRENT_DATE + 7          THEN 'DUE_SOON'
    ELSE                                               'UPCOMING'
  END                                             AS urgency,
  ap.due_date - CURRENT_DATE                      AS days_until_due
FROM accounts_payable ap
WHERE ap.status IN ('PENDING', 'PARTIAL')
ORDER BY ap.due_date ASC NULLS LAST;
