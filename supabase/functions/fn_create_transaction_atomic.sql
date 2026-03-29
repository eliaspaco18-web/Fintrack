-- =============================================================================
-- supabase/functions/fn_create_transaction_atomic.sql
-- Función PostgreSQL que crea una transacción y todos sus módulos derivados
-- en un único bloque atómico. Si cualquier INSERT falla, Postgres hace
-- ROLLBACK de toda la operación automáticamente.
--
-- Se llama desde TypeScript vía: supabase.rpc('create_transaction_atomic', {...})
-- =============================================================================

CREATE OR REPLACE FUNCTION create_transaction_atomic(
  p_user_id                 uuid,
  p_source_account_id       uuid,
  p_destination_account_id  uuid         DEFAULT NULL,
  p_category_id             uuid         DEFAULT NULL,
  p_type                    text         DEFAULT 'EXPENSE',
  p_amount                  numeric      DEFAULT 0,
  p_currency                text         DEFAULT 'PEN',
  p_exchange_rate           numeric      DEFAULT 1.000000,
  p_description             text         DEFAULT '',
  p_transaction_date        date         DEFAULT CURRENT_DATE,
  p_notes                   text         DEFAULT NULL,
  p_is_recurring            boolean      DEFAULT false,
  -- Módulos derivados (JSONB, NULL si no aplica)
  p_asset                   jsonb        DEFAULT NULL,
  p_credit                  jsonb        DEFAULT NULL,
  p_loan                    jsonb        DEFAULT NULL,
  p_receivable              jsonb        DEFAULT NULL,
  p_payable                 jsonb        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id    uuid;
  v_asset_id          uuid := NULL;
  v_credit_id         uuid := NULL;
  v_loan_id           uuid := NULL;
  v_receivable_id     uuid := NULL;
  v_payable_id        uuid := NULL;
  v_installments_gen  integer := 0;

  -- Variables para el cronograma de cuotas
  v_monthly_rate      numeric;
  v_fixed_payment     numeric;
  v_remaining         numeric;
  v_principal_pay     numeric;
  v_interest_pay      numeric;
  v_due_date          date;
  v_i                 integer;
BEGIN
  -- ── 1. INSERTAR TRANSACCIÓN ────────────────────────────────────────────────
  -- Los triggers fn_set_affects_reports y fn_set_amount_pen se ejecutan
  -- automáticamente; no es necesario calcularlos aquí.

  INSERT INTO transactions (
    user_id, source_account_id, destination_account_id,
    category_id, type, amount, currency, exchange_rate,
    description, transaction_date, notes, is_recurring
  )
  VALUES (
    p_user_id, p_source_account_id, p_destination_account_id,
    p_category_id, p_type::transaction_type, p_amount,
    p_currency::currency_code, p_exchange_rate,
    p_description, p_transaction_date, p_notes, p_is_recurring
  )
  RETURNING id INTO v_transaction_id;

  -- ── 2. MÓDULO: ACTIVO ──────────────────────────────────────────────────────
  IF p_asset IS NOT NULL THEN
    INSERT INTO assets (
      user_id, transaction_id, name, asset_type,
      purchase_value, currency, current_value,
      purchase_date, depreciation_rate, serial_number, location, notes
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      p_asset->>'name',
      (p_asset->>'asset_type')::asset_type,
      (p_asset->>'purchase_value')::numeric,
      p_currency::currency_code,
      COALESCE((p_asset->>'current_value')::numeric, (p_asset->>'purchase_value')::numeric),
      COALESCE((p_asset->>'purchase_date')::date, p_transaction_date),
      (p_asset->>'depreciation_rate')::numeric,
      p_asset->>'serial_number',
      p_asset->>'location',
      p_asset->>'notes'
    )
    RETURNING id INTO v_asset_id;
  END IF;

  -- ── 3. MÓDULO: CRÉDITO ────────────────────────────────────────────────────
  IF p_credit IS NOT NULL THEN
    INSERT INTO credits (
      user_id, transaction_id, credit_type, name,
      credit_limit, used_amount, interest_rate,
      closing_day, payment_day, currency, status
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      (p_credit->>'credit_type')::credit_type,
      p_credit->>'name',
      (p_credit->>'credit_limit')::numeric,
      0.00,
      COALESCE((p_credit->>'interest_rate')::numeric, 0),
      (p_credit->>'closing_day')::integer,
      (p_credit->>'payment_day')::integer,
      p_currency::currency_code,
      'ACTIVE'
    )
    RETURNING id INTO v_credit_id;
  END IF;

  -- ── 4. MÓDULO: PRÉSTAMO + CRONOGRAMA ─────────────────────────────────────
  IF p_loan IS NOT NULL THEN
    INSERT INTO loans (
      user_id, credit_id, transaction_id, creditor_name,
      principal_amount, interest_rate, total_installments,
      paid_installments, start_date, end_date, currency, status
    )
    VALUES (
      p_user_id,
      v_credit_id,  -- puede ser NULL si el préstamo no está ligado a una línea de crédito
      v_transaction_id,
      p_loan->>'creditor_name',
      (p_loan->>'principal_amount')::numeric,
      COALESCE((p_loan->>'interest_rate')::numeric, 0),
      (p_loan->>'total_installments')::integer,
      0,
      COALESCE((p_loan->>'start_date')::date, p_transaction_date),
      (p_loan->>'end_date')::date,
      p_currency::currency_code,
      'ACTIVE'
    )
    RETURNING id INTO v_loan_id;

    -- Generar cronograma si se solicitó
    IF (p_loan->>'generate_schedule')::boolean IS TRUE THEN
      v_monthly_rate := COALESCE((p_loan->>'interest_rate')::numeric, 0) / 100.0;
      v_remaining    := (p_loan->>'principal_amount')::numeric;

      IF v_monthly_rate = 0 THEN
        v_fixed_payment := v_remaining / (p_loan->>'total_installments')::integer;
      ELSE
        v_fixed_payment :=
          v_remaining * v_monthly_rate
          * POWER(1 + v_monthly_rate, (p_loan->>'total_installments')::integer)
          / (POWER(1 + v_monthly_rate, (p_loan->>'total_installments')::integer) - 1);
      END IF;

      FOR v_i IN 1..(p_loan->>'total_installments')::integer LOOP
        v_interest_pay  := ROUND(v_remaining * v_monthly_rate, 2);
        v_principal_pay := ROUND(v_fixed_payment - v_interest_pay, 2);

        -- Ajuste en última cuota para evitar centavos residuales
        IF v_i = (p_loan->>'total_installments')::integer THEN
          v_principal_pay := ROUND(v_remaining, 2);
        END IF;

        v_due_date := COALESCE(
          (p_loan->>'start_date')::date,
          p_transaction_date
        ) + (v_i || ' months')::interval;

        INSERT INTO installments (
          loan_id, installment_number, principal_amount,
          interest_amount, total_amount, due_date, status
        )
        VALUES (
          v_loan_id, v_i, v_principal_pay, v_interest_pay,
          ROUND(v_principal_pay + v_interest_pay, 2),
          v_due_date, 'PENDING'
        );

        v_remaining         := v_remaining - v_principal_pay;
        v_installments_gen  := v_installments_gen + 1;
      END LOOP;
    END IF;
  END IF;

  -- ── 5. MÓDULO: CUENTA POR COBRAR ─────────────────────────────────────────
  IF p_receivable IS NOT NULL THEN
    INSERT INTO accounts_receivable (
      user_id, transaction_id, debtor_name,
      amount, currency, issue_date, due_date,
      concept, notes, status
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      p_receivable->>'debtor_name',
      p_amount,
      p_currency::currency_code,
      p_transaction_date,
      (p_receivable->>'due_date')::date,
      p_receivable->>'concept',
      p_receivable->>'notes',
      'PENDING'
    )
    RETURNING id INTO v_receivable_id;
  END IF;

  -- ── 6. MÓDULO: CUENTA POR PAGAR ──────────────────────────────────────────
  IF p_payable IS NOT NULL THEN
    INSERT INTO accounts_payable (
      user_id, transaction_id, creditor_name,
      amount, currency, issue_date, due_date,
      concept, notes, status
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      p_payable->>'creditor_name',
      p_amount,
      p_currency::currency_code,
      p_transaction_date,
      (p_payable->>'due_date')::date,
      p_payable->>'concept',
      p_payable->>'notes',
      'PENDING'
    )
    RETURNING id INTO v_payable_id;
  END IF;

  -- ── RESULTADO ─────────────────────────────────────────────────────────────
  -- Devuelve los IDs de todos los registros creados en esta operación.
  RETURN jsonb_build_object(
    'transaction_id',         v_transaction_id,
    'asset_id',               v_asset_id,
    'credit_id',              v_credit_id,
    'loan_id',                v_loan_id,
    'receivable_id',          v_receivable_id,
    'payable_id',             v_payable_id,
    'installments_generated', v_installments_gen
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Postgres hace ROLLBACK automático de todo lo insertado en esta función.
    -- Re-lanzamos el error con contexto adicional para el cliente.
    RAISE EXCEPTION 'create_transaction_atomic failed: % (SQLSTATE: %)',
      SQLERRM, SQLSTATE;
END;
$$;

-- ── PERMISOS ──────────────────────────────────────────────────────────────────
-- Solo usuarios autenticados pueden llamar esta función.
-- SECURITY DEFINER garantiza que se ejecuta con los permisos del dueño (postgres),
-- pero las políticas RLS siguen aplicándose porque usamos p_user_id explícito.
REVOKE ALL ON FUNCTION create_transaction_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_transaction_atomic TO authenticated;
