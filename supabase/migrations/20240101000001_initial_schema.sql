-- =============================================================================
-- MIGRATION 001: INITIAL SCHEMA
-- Fintech Personal — Schema completo de tablas, constraints e índices
-- =============================================================================

-- Extensión UUID (ya disponible en Supabase, incluida por claridad)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TIPOS ENUM
-- =============================================================================

CREATE TYPE currency_code        AS ENUM ('PEN', 'USD');
CREATE TYPE transaction_type     AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE account_type         AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'CREDIT_CARD', 'OTHER');
CREATE TYPE asset_type           AS ENUM ('REAL_ESTATE', 'VEHICLE', 'EQUIPMENT', 'INVESTMENT', 'OTHER');
CREATE TYPE asset_status         AS ENUM ('ACTIVE', 'SOLD', 'DEPRECIATED');
CREATE TYPE credit_type          AS ENUM ('CREDIT_CARD', 'LINE_OF_CREDIT');
CREATE TYPE credit_status        AS ENUM ('ACTIVE', 'CLOSED', 'BLOCKED');
CREATE TYPE loan_status          AS ENUM ('ACTIVE', 'PAID', 'DEFAULTED', 'REFINANCED');
CREATE TYPE installment_status   AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'PARTIAL');
CREATE TYPE receivable_status    AS ENUM ('PENDING', 'PARTIAL', 'COLLECTED', 'WRITTEN_OFF');
CREATE TYPE payable_status       AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'DISPUTED');
CREATE TYPE budget_period        AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE goal_status          AS ENUM ('ACTIVE', 'ACHIEVED', 'CANCELLED', 'PAUSED');
CREATE TYPE category_scope       AS ENUM ('INCOME', 'EXPENSE', 'BOTH');

-- =============================================================================
-- TABLA: profiles
-- Extiende auth.users de Supabase. Un trigger la pobla automáticamente.
-- =============================================================================

CREATE TABLE profiles (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text        NOT NULL,
  full_name         text,
  avatar_url        text,
  default_currency  currency_code NOT NULL DEFAULT 'PEN',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLA: accounts
-- Cuentas financieras del usuario (bancarias, efectivo, inversión, etc.)
-- =============================================================================

CREATE TABLE accounts (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  type          account_type  NOT NULL DEFAULT 'CHECKING',
  currency      currency_code NOT NULL DEFAULT 'PEN',
  balance       numeric(15,2) NOT NULL DEFAULT 0.00,
  initial_balance numeric(15,2) NOT NULL DEFAULT 0.00,
  color         text          NOT NULL DEFAULT '#6366f1',
  icon          text          NOT NULL DEFAULT 'wallet',
  institution   text,
  is_active     boolean       NOT NULL DEFAULT true,
  include_in_net_worth boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT accounts_name_length    CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT accounts_balance_scale  CHECK (balance = round(balance, 2))
);

-- =============================================================================
-- TABLA: categories
-- Categorías para clasificar transacciones. Admite categorías de sistema
-- (is_system = true) que no pueden eliminarse, y categorías del usuario.
-- =============================================================================

CREATE TABLE categories (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid           REFERENCES profiles(id) ON DELETE CASCADE,
  name        text           NOT NULL,
  scope       category_scope NOT NULL DEFAULT 'BOTH',
  icon        text           NOT NULL DEFAULT 'tag',
  color       text           NOT NULL DEFAULT '#6366f1',
  is_system   boolean        NOT NULL DEFAULT false,
  sort_order  integer        NOT NULL DEFAULT 0,
  created_at  timestamptz    NOT NULL DEFAULT now(),

  -- Las categorías de sistema no tienen user_id; las de usuario sí.
  CONSTRAINT categories_system_no_user CHECK (
    (is_system = true  AND user_id IS NULL) OR
    (is_system = false AND user_id IS NOT NULL)
  ),
  CONSTRAINT categories_name_length CHECK (char_length(name) BETWEEN 1 AND 80)
);

-- =============================================================================
-- TABLA: transactions
-- NÚCLEO del sistema. Registra ingresos, egresos y transferencias.
-- Las transferencias NUNCA afectan reportes (affects_reports = false).
-- amount_pen almacena el equivalente en soles al momento de la transacción.
-- =============================================================================

CREATE TABLE transactions (
  id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid             NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_account_id       uuid             NOT NULL REFERENCES accounts(id),
  destination_account_id  uuid             REFERENCES accounts(id),
  category_id             uuid             REFERENCES categories(id) ON DELETE SET NULL,
  type                    transaction_type NOT NULL,
  amount                  numeric(15,2)    NOT NULL,
  currency                currency_code    NOT NULL DEFAULT 'PEN',
  exchange_rate           numeric(10,6)    NOT NULL DEFAULT 1.000000,
  amount_pen              numeric(15,2)    NOT NULL,
  description             text             NOT NULL,
  transaction_date        date             NOT NULL DEFAULT CURRENT_DATE,
  affects_reports         boolean          NOT NULL DEFAULT true,
  is_recurring            boolean          NOT NULL DEFAULT false,
  notes                   text,
  created_at              timestamptz      NOT NULL DEFAULT now(),
  updated_at              timestamptz      NOT NULL DEFAULT now(),

  -- TRANSFERENCIA: requiere cuenta destino, distinta a la origen
  CONSTRAINT tx_transfer_needs_destination CHECK (
    (type = 'TRANSFER' AND destination_account_id IS NOT NULL) OR
    (type <> 'TRANSFER')
  ),
  CONSTRAINT tx_transfer_different_accounts CHECK (
    destination_account_id IS NULL OR
    source_account_id <> destination_account_id
  ),
  -- INGRESO/EGRESO no llevan cuenta destino obligatoria
  CONSTRAINT tx_amount_positive CHECK (amount > 0),
  CONSTRAINT tx_amount_pen_positive CHECK (amount_pen > 0),
  CONSTRAINT tx_exchange_rate_positive CHECK (exchange_rate > 0),
  CONSTRAINT tx_description_length CHECK (char_length(description) BETWEEN 1 AND 255)
);

-- =============================================================================
-- TABLA: assets
-- Activos generados a partir de un EGRESO de tipo activo.
-- Siempre referencia una transacción origen.
-- =============================================================================

CREATE TABLE assets (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id  uuid         UNIQUE REFERENCES transactions(id) ON DELETE SET NULL,
  name            text         NOT NULL,
  asset_type      asset_type   NOT NULL DEFAULT 'OTHER',
  purchase_value  numeric(15,2) NOT NULL,
  currency        currency_code NOT NULL DEFAULT 'PEN',
  current_value   numeric(15,2) NOT NULL,
  purchase_date   date         NOT NULL,
  depreciation_rate numeric(5,4) DEFAULT 0.0000,
  serial_number   text,
  location        text,
  status          asset_status NOT NULL DEFAULT 'ACTIVE',
  notes           text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT assets_purchase_value_positive CHECK (purchase_value > 0),
  CONSTRAINT assets_current_value_nonneg    CHECK (current_value >= 0),
  CONSTRAINT assets_name_length             CHECK (char_length(name) BETWEEN 1 AND 150)
);

-- =============================================================================
-- TABLA: credits
-- Líneas de crédito y tarjetas de crédito.
-- =============================================================================

CREATE TABLE credits (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id       uuid          REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_id   uuid          REFERENCES transactions(id) ON DELETE SET NULL,
  credit_type      credit_type   NOT NULL DEFAULT 'CREDIT_CARD',
  name             text          NOT NULL,
  credit_limit     numeric(15,2) NOT NULL,
  used_amount      numeric(15,2) NOT NULL DEFAULT 0.00,
  available_amount numeric(15,2) GENERATED ALWAYS AS (credit_limit - used_amount) STORED,
  interest_rate    numeric(6,4)  NOT NULL DEFAULT 0.0000,
  closing_day      integer,
  payment_day      integer,
  currency         currency_code NOT NULL DEFAULT 'PEN',
  status           credit_status NOT NULL DEFAULT 'ACTIVE',
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT credits_limit_positive         CHECK (credit_limit > 0),
  CONSTRAINT credits_used_nonneg            CHECK (used_amount >= 0),
  CONSTRAINT credits_used_lte_limit         CHECK (used_amount <= credit_limit),
  CONSTRAINT credits_interest_rate_range    CHECK (interest_rate BETWEEN 0 AND 9.9999),
  CONSTRAINT credits_closing_day_range      CHECK (closing_day  BETWEEN 1 AND 31 OR closing_day IS NULL),
  CONSTRAINT credits_payment_day_range      CHECK (payment_day  BETWEEN 1 AND 31 OR payment_day IS NULL),
  CONSTRAINT credits_name_length            CHECK (char_length(name) BETWEEN 1 AND 100)
);

-- =============================================================================
-- TABLA: loans
-- Préstamos con cronograma de pagos (cuotas).
-- Un crédito puede tener múltiples desembolsos (loans).
-- =============================================================================

CREATE TABLE loans (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credit_id           uuid         REFERENCES credits(id) ON DELETE SET NULL,
  transaction_id      uuid         REFERENCES transactions(id) ON DELETE SET NULL,
  creditor_name       text         NOT NULL,
  principal_amount    numeric(15,2) NOT NULL,
  interest_rate       numeric(6,4)  NOT NULL DEFAULT 0.0000,
  total_installments  integer       NOT NULL,
  paid_installments   integer       NOT NULL DEFAULT 0,
  start_date          date          NOT NULL,
  end_date            date          NOT NULL,
  currency            currency_code NOT NULL DEFAULT 'PEN',
  status              loan_status   NOT NULL DEFAULT 'ACTIVE',
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT loans_principal_positive         CHECK (principal_amount > 0),
  CONSTRAINT loans_total_installments_min     CHECK (total_installments >= 1),
  CONSTRAINT loans_paid_lte_total             CHECK (paid_installments <= total_installments),
  CONSTRAINT loans_paid_nonneg                CHECK (paid_installments >= 0),
  CONSTRAINT loans_dates_order                CHECK (start_date < end_date),
  CONSTRAINT loans_creditor_length            CHECK (char_length(creditor_name) BETWEEN 1 AND 150)
);

-- =============================================================================
-- TABLA: installments
-- Cuotas de un préstamo. Cada cuota pagada puede asociarse a una transacción.
-- =============================================================================

CREATE TABLE installments (
  id                  uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id             uuid               NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  transaction_id      uuid               REFERENCES transactions(id) ON DELETE SET NULL,
  installment_number  integer            NOT NULL,
  principal_amount    numeric(15,2)      NOT NULL,
  interest_amount     numeric(15,2)      NOT NULL DEFAULT 0.00,
  total_amount        numeric(15,2)      NOT NULL,
  due_date            date               NOT NULL,
  paid_date           date,
  paid_amount         numeric(15,2),
  status              installment_status NOT NULL DEFAULT 'PENDING',
  created_at          timestamptz        NOT NULL DEFAULT now(),
  updated_at          timestamptz        NOT NULL DEFAULT now(),

  CONSTRAINT installments_number_positive       CHECK (installment_number >= 1),
  CONSTRAINT installments_principal_nonneg      CHECK (principal_amount >= 0),
  CONSTRAINT installments_interest_nonneg       CHECK (interest_amount >= 0),
  CONSTRAINT installments_total_positive        CHECK (total_amount > 0),
  -- El total debe ser la suma de principal + interés
  CONSTRAINT installments_total_equals_sum      CHECK (
    round(total_amount, 2) = round(principal_amount + interest_amount, 2)
  ),
  -- paid_date obligatorio si está pagada
  CONSTRAINT installments_paid_date_when_paid   CHECK (
    (status = 'PAID' AND paid_date IS NOT NULL) OR status <> 'PAID'
  ),
  UNIQUE (loan_id, installment_number)
);

-- =============================================================================
-- TABLA: accounts_receivable
-- Cuentas por cobrar — dinero que terceros deben al usuario.
-- Generada desde un INGRESO de tipo "cuenta por cobrar".
-- =============================================================================

CREATE TABLE accounts_receivable (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id  uuid              REFERENCES transactions(id) ON DELETE SET NULL,
  debtor_name     text              NOT NULL,
  amount          numeric(15,2)     NOT NULL,
  collected_amount numeric(15,2)    NOT NULL DEFAULT 0.00,
  currency        currency_code     NOT NULL DEFAULT 'PEN',
  issue_date      date              NOT NULL DEFAULT CURRENT_DATE,
  due_date        date,
  collected_date  date,
  status          receivable_status NOT NULL DEFAULT 'PENDING',
  concept         text,
  notes           text,
  created_at      timestamptz       NOT NULL DEFAULT now(),
  updated_at      timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT ar_amount_positive             CHECK (amount > 0),
  CONSTRAINT ar_collected_nonneg            CHECK (collected_amount >= 0),
  CONSTRAINT ar_collected_lte_amount        CHECK (collected_amount <= amount),
  CONSTRAINT ar_dates_order                 CHECK (due_date IS NULL OR issue_date <= due_date),
  CONSTRAINT ar_collected_date_when_done    CHECK (
    (status = 'COLLECTED' AND collected_date IS NOT NULL) OR status <> 'COLLECTED'
  ),
  CONSTRAINT ar_debtor_length               CHECK (char_length(debtor_name) BETWEEN 1 AND 150)
);

-- =============================================================================
-- TABLA: accounts_payable
-- Cuentas por pagar — dinero que el usuario debe a terceros.
-- Generada desde un EGRESO de tipo "cuenta por pagar".
-- =============================================================================

CREATE TABLE accounts_payable (
  id            uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid            NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id uuid           REFERENCES transactions(id) ON DELETE SET NULL,
  creditor_name text            NOT NULL,
  amount        numeric(15,2)   NOT NULL,
  paid_amount   numeric(15,2)   NOT NULL DEFAULT 0.00,
  currency      currency_code   NOT NULL DEFAULT 'PEN',
  issue_date    date            NOT NULL DEFAULT CURRENT_DATE,
  due_date      date,
  paid_date     date,
  status        payable_status  NOT NULL DEFAULT 'PENDING',
  concept       text,
  notes         text,
  created_at    timestamptz     NOT NULL DEFAULT now(),
  updated_at    timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT ap_amount_positive           CHECK (amount > 0),
  CONSTRAINT ap_paid_nonneg               CHECK (paid_amount >= 0),
  CONSTRAINT ap_paid_lte_amount           CHECK (paid_amount <= amount),
  CONSTRAINT ap_dates_order               CHECK (due_date IS NULL OR issue_date <= due_date),
  CONSTRAINT ap_paid_date_when_done       CHECK (
    (status = 'PAID' AND paid_date IS NOT NULL) OR status <> 'PAID'
  ),
  CONSTRAINT ap_creditor_length           CHECK (char_length(creditor_name) BETWEEN 1 AND 150)
);

-- =============================================================================
-- TABLA: budgets
-- Presupuestos por categoría y período.
-- =============================================================================

CREATE TABLE budgets (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id  uuid          REFERENCES categories(id) ON DELETE CASCADE,
  name         text          NOT NULL,
  amount       numeric(15,2) NOT NULL,
  currency     currency_code NOT NULL DEFAULT 'PEN',
  period_type  budget_period NOT NULL DEFAULT 'MONTHLY',
  start_date   date          NOT NULL,
  end_date     date,
  is_active    boolean       NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT budgets_amount_positive    CHECK (amount > 0),
  CONSTRAINT budgets_dates_order        CHECK (end_date IS NULL OR start_date <= end_date),
  CONSTRAINT budgets_name_length        CHECK (char_length(name) BETWEEN 1 AND 100)
);

-- =============================================================================
-- TABLA: goals
-- Metas de ahorro vinculadas a una cuenta específica.
-- =============================================================================

CREATE TABLE goals (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id      uuid          REFERENCES accounts(id) ON DELETE SET NULL,
  name            text          NOT NULL,
  description     text,
  target_amount   numeric(15,2) NOT NULL,
  current_amount  numeric(15,2) NOT NULL DEFAULT 0.00,
  currency        currency_code NOT NULL DEFAULT 'PEN',
  target_date     date,
  achieved_date   date,
  status          goal_status   NOT NULL DEFAULT 'ACTIVE',
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT goals_target_positive      CHECK (target_amount > 0),
  CONSTRAINT goals_current_nonneg       CHECK (current_amount >= 0),
  CONSTRAINT goals_name_length          CHECK (char_length(name) BETWEEN 1 AND 100)
);

-- =============================================================================
-- TABLA: exchange_rates
-- Historial de tipos de cambio PEN/USD. Se cachea a nivel de app (1h).
-- =============================================================================

CREATE TABLE exchange_rates (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency currency_code NOT NULL,
  to_currency   currency_code NOT NULL,
  rate          numeric(10,6) NOT NULL,
  source        text          NOT NULL DEFAULT 'manual',
  fetched_at    timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT er_different_currencies CHECK (from_currency <> to_currency),
  CONSTRAINT er_rate_positive         CHECK (rate > 0),
  CONSTRAINT er_unique_rate_moment    UNIQUE (from_currency, to_currency, fetched_at)
);

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- profiles
CREATE INDEX idx_profiles_email ON profiles(email);

-- accounts
CREATE INDEX idx_accounts_user_id         ON accounts(user_id);
CREATE INDEX idx_accounts_user_active      ON accounts(user_id, is_active);
CREATE INDEX idx_accounts_type             ON accounts(user_id, type);

-- categories
CREATE INDEX idx_categories_user_id        ON categories(user_id);
CREATE INDEX idx_categories_scope          ON categories(scope);
CREATE INDEX idx_categories_system         ON categories(is_system) WHERE is_system = true;

-- transactions — los más críticos por volumen
CREATE INDEX idx_tx_user_id                ON transactions(user_id);
CREATE INDEX idx_tx_user_date              ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_tx_user_type              ON transactions(user_id, type);
CREATE INDEX idx_tx_source_account         ON transactions(source_account_id);
CREATE INDEX idx_tx_dest_account           ON transactions(destination_account_id) WHERE destination_account_id IS NOT NULL;
CREATE INDEX idx_tx_category               ON transactions(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_tx_affects_reports        ON transactions(user_id, affects_reports, transaction_date DESC);
-- Índice parcial: solo transacciones que afectan reportes (el caso más consultado)
CREATE INDEX idx_tx_reportable             ON transactions(user_id, type, transaction_date DESC)
  WHERE affects_reports = true;

-- assets
CREATE INDEX idx_assets_user_id            ON assets(user_id);
CREATE INDEX idx_assets_transaction_id     ON assets(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_assets_status             ON assets(user_id, status);

-- credits
CREATE INDEX idx_credits_user_id           ON credits(user_id);
CREATE INDEX idx_credits_account_id        ON credits(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_credits_status            ON credits(user_id, status);

-- loans
CREATE INDEX idx_loans_user_id             ON loans(user_id);
CREATE INDEX idx_loans_credit_id           ON loans(credit_id) WHERE credit_id IS NOT NULL;
CREATE INDEX idx_loans_status              ON loans(user_id, status);

-- installments
CREATE INDEX idx_installments_loan_id      ON installments(loan_id);
CREATE INDEX idx_installments_due_date     ON installments(loan_id, due_date);
CREATE INDEX idx_installments_status       ON installments(status, due_date);
-- Cuotas vencidas pendientes — query frecuente del dashboard
CREATE INDEX idx_installments_overdue      ON installments(due_date)
  WHERE status IN ('PENDING', 'PARTIAL');

-- accounts_receivable
CREATE INDEX idx_ar_user_id                ON accounts_receivable(user_id);
CREATE INDEX idx_ar_status                 ON accounts_receivable(user_id, status);
CREATE INDEX idx_ar_due_date               ON accounts_receivable(user_id, due_date) WHERE status NOT IN ('COLLECTED', 'WRITTEN_OFF');

-- accounts_payable
CREATE INDEX idx_ap_user_id                ON accounts_payable(user_id);
CREATE INDEX idx_ap_status                 ON accounts_payable(user_id, status);
CREATE INDEX idx_ap_due_date               ON accounts_payable(user_id, due_date) WHERE status NOT IN ('PAID', 'DISPUTED');

-- budgets
CREATE INDEX idx_budgets_user_id           ON budgets(user_id);
CREATE INDEX idx_budgets_active            ON budgets(user_id, is_active, period_type);
CREATE INDEX idx_budgets_category          ON budgets(category_id) WHERE category_id IS NOT NULL;

-- goals
CREATE INDEX idx_goals_user_id             ON goals(user_id);
CREATE INDEX idx_goals_status              ON goals(user_id, status);

-- exchange_rates
CREATE INDEX idx_er_pair_date              ON exchange_rates(from_currency, to_currency, fetched_at DESC);
