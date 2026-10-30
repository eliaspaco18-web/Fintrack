-- Canonical transactional RPC for the current public schema.
-- Run only through the migration chain. The 17-argument overload below is a
-- compatibility wrapper; do not maintain a second INSERT implementation.
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
  p_user_id                 uuid,
  p_source_account_id       uuid,
  p_destination_account_id  uuid         DEFAULT NULL,
  p_category_id             uuid         DEFAULT NULL,
  p_budget_id               uuid         DEFAULT NULL,
  p_type                    text         DEFAULT 'EXPENSE',
  p_amount                  numeric      DEFAULT 0,
  p_currency                text         DEFAULT 'PEN',
  p_exchange_rate           numeric      DEFAULT 1.000000,
  p_description             text         DEFAULT '',
  p_transaction_date        date         DEFAULT CURRENT_DATE,
  p_notes                   text         DEFAULT NULL,
  p_is_recurring            boolean      DEFAULT false,
  p_sender                  text         DEFAULT NULL,
  p_recipient               text         DEFAULT NULL,
  p_asset                   jsonb        DEFAULT NULL,
  p_credit                  jsonb        DEFAULT NULL,
  p_loan                    jsonb        DEFAULT NULL,
  p_receivable              jsonb        DEFAULT NULL,
  p_payable                 jsonb        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
-- Existing invoker triggers resolve public enum types without qualification.
-- Keep pg_catalog first and pg_temp last; untrusted roles must not have CREATE
-- on public (verified in the current schema and checked by the SQL test).
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_transaction_id    uuid;
  v_asset_id          uuid := NULL;
  v_credit_id         uuid := NULL;
  v_loan_id           uuid := NULL;
  v_receivable_id     uuid := NULL;
  v_payable_id        uuid := NULL;
  v_installments_gen  integer := 0;
  v_monthly_rate      numeric;
  v_fixed_payment     numeric;
  v_remaining         numeric;
  v_principal_pay     numeric;
  v_interest_pay      numeric;
  v_due_date          date;
  v_i                 integer;
BEGIN
  -- Reject unauthenticated and impersonated requests before any INSERT or trigger.
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to create this transaction'
      USING ERRCODE = '42501';
  END IF;

  -- These checks mirror the existing HTTP/service boundary; they do not
  -- change amount conversion or installment calculations.
  IF p_type IS NULL OR p_type NOT IN ('INCOME', 'EXPENSE', 'TRANSFER') THEN
    RAISE EXCEPTION 'Invalid transaction type' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL OR p_currency NOT IN ('PEN', 'USD') THEN
    RAISE EXCEPTION 'Invalid transaction currency' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000000
     OR round(p_amount, 2) <> p_amount THEN
    RAISE EXCEPTION 'Invalid transaction amount' USING ERRCODE = '22023';
  END IF;
  IF p_currency = 'USD' AND
     (p_exchange_rate IS NULL OR p_exchange_rate < 0.01 OR p_exchange_rate > 100) THEN
    RAISE EXCEPTION 'Invalid USD exchange rate' USING ERRCODE = '22023';
  END IF;
  IF p_asset IS NOT NULL AND p_credit IS NOT NULL THEN
    RAISE EXCEPTION 'Asset and credit cannot be created together'
      USING ERRCODE = '22023';
  END IF;
  IF (p_payable IS NOT NULL AND p_type <> 'INCOME')
     OR ((p_asset IS NOT NULL OR p_credit IS NOT NULL
          OR p_loan IS NOT NULL OR p_receivable IS NOT NULL)
         AND p_type <> 'EXPENSE') THEN
    RAISE EXCEPTION 'Derived module does not match transaction type'
      USING ERRCODE = '22023';
  END IF;
  IF p_budget_id IS NOT NULL AND p_type <> 'EXPENSE' THEN
    RAISE EXCEPTION 'Budget requires an expense' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_source_account_id AND user_id = p_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Source account is unavailable'
      USING ERRCODE = '42501';
  END IF;
  IF p_type = 'TRANSFER' AND
     (p_destination_account_id IS NULL OR p_destination_account_id = p_source_account_id) THEN
    RAISE EXCEPTION 'Invalid transfer destination' USING ERRCODE = '22023';
  END IF;
  IF p_destination_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_destination_account_id AND user_id = p_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Destination account is unavailable'
      USING ERRCODE = '42501';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = p_category_id
      AND (user_id = p_user_id OR (is_system = true AND user_id IS NULL))
  ) THEN
    RAISE EXCEPTION 'Category is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_budget_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.budgets
    WHERE id = p_budget_id AND user_id = p_user_id AND is_active = true
      AND category_id = p_category_id
  ) THEN
    RAISE EXCEPTION 'Budget is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_asset IS NOT NULL
     AND nullif(btrim(p_asset->>'asset_type_id'), '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.asset_types
       WHERE id = (p_asset->>'asset_type_id')::uuid AND is_active = true
         AND (user_id = p_user_id OR (is_system = true AND user_id IS NULL))
     ) THEN
    RAISE EXCEPTION 'Asset type is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_receivable IS NOT NULL
     AND nullif(btrim(p_receivable->>'debtor_id'), '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.debtors
       WHERE id = (p_receivable->>'debtor_id')::uuid
         AND user_id = p_user_id AND is_active = true
     ) THEN
    RAISE EXCEPTION 'Debtor is unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_payable IS NOT NULL
     AND nullif(btrim(p_payable->>'creditor_id'), '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.creditors
       WHERE id = (p_payable->>'creditor_id')::uuid
         AND user_id = p_user_id AND is_active = true
     ) THEN
    RAISE EXCEPTION 'Creditor is unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transactions (
    user_id, source_account_id, destination_account_id,
    category_id, budget_id, type, amount, currency, exchange_rate,
    description, transaction_date, notes, is_recurring, sender, recipient,
    creditor_id, debtor_id
  )
  VALUES (
    p_user_id, p_source_account_id, p_destination_account_id,
    p_category_id, p_budget_id, p_type::public.transaction_type, p_amount,
    p_currency, p_exchange_rate,
    p_description, p_transaction_date, p_notes, p_is_recurring, NULLIF(trim(p_sender), ''), NULLIF(trim(p_recipient), ''),
    CASE
      WHEN p_payable IS NOT NULL AND NULLIF(trim(p_payable->>'creditor_id'), '') IS NOT NULL
        THEN (p_payable->>'creditor_id')::uuid
      ELSE NULL
    END,
    CASE
      WHEN p_receivable IS NOT NULL AND NULLIF(trim(p_receivable->>'debtor_id'), '') IS NOT NULL
        THEN (p_receivable->>'debtor_id')::uuid
      ELSE NULL
    END
  )
  RETURNING id INTO v_transaction_id;

  IF p_asset IS NOT NULL THEN
    INSERT INTO public.assets (
      user_id, transaction_id, name, asset_type, asset_type_id,
      purchase_value, currency, current_value,
      purchase_date, depreciation_rate, serial_number, location, notes, recipient
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      p_asset->>'name',
      (p_asset->>'asset_type')::public.asset_type,
      CASE
        WHEN NULLIF(trim(p_asset->>'asset_type_id'), '') IS NOT NULL
          THEN (p_asset->>'asset_type_id')::uuid
        ELSE NULL
      END,
      (p_asset->>'purchase_value')::numeric,
      p_currency,
      COALESCE((p_asset->>'current_value')::numeric, (p_asset->>'purchase_value')::numeric),
      COALESCE((p_asset->>'purchase_date')::date, p_transaction_date),
      (p_asset->>'depreciation_rate')::numeric,
      p_asset->>'serial_number',
      p_asset->>'location',
      p_asset->>'notes',
      NULLIF(trim(p_recipient), '')
    )
    RETURNING id INTO v_asset_id;
  END IF;

  IF p_credit IS NOT NULL THEN
    INSERT INTO public.credits (
      user_id, transaction_id, credit_type, name,
      credit_limit, used_amount, interest_rate,
      closing_day, payment_day, currency, status
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      (p_credit->>'credit_type')::public.credit_type,
      p_credit->>'name',
      (p_credit->>'credit_limit')::numeric,
      0.00,
      COALESCE((p_credit->>'interest_rate')::numeric, 0),
      (p_credit->>'closing_day')::integer,
      (p_credit->>'payment_day')::integer,
      p_currency,
      'ACTIVE'
    )
    RETURNING id INTO v_credit_id;
  END IF;

  IF p_loan IS NOT NULL THEN
    INSERT INTO public.loans (
      user_id, credit_id, transaction_id, creditor_name,
      principal_amount, interest_rate, total_installments,
      paid_installments, start_date, end_date, currency, status
    )
    VALUES (
      p_user_id,
      v_credit_id,
      v_transaction_id,
      p_loan->>'creditor_name',
      (p_loan->>'principal_amount')::numeric,
      COALESCE((p_loan->>'interest_rate')::numeric, 0),
      (p_loan->>'total_installments')::integer,
      0,
      COALESCE((p_loan->>'start_date')::date, p_transaction_date),
      (p_loan->>'end_date')::date,
      p_currency,
      'ACTIVE'
    )
    RETURNING id INTO v_loan_id;

    IF (p_loan->>'generate_schedule')::boolean IS TRUE THEN
      v_monthly_rate := COALESCE((p_loan->>'interest_rate')::numeric, 0) / 100.0;
      v_remaining := (p_loan->>'principal_amount')::numeric;

      IF v_monthly_rate = 0 THEN
        v_fixed_payment := v_remaining / (p_loan->>'total_installments')::integer;
      ELSE
        v_fixed_payment :=
          v_remaining * v_monthly_rate
          * POWER(1 + v_monthly_rate, (p_loan->>'total_installments')::integer)
          / (POWER(1 + v_monthly_rate, (p_loan->>'total_installments')::integer) - 1);
      END IF;

      FOR v_i IN 1..(p_loan->>'total_installments')::integer LOOP
        v_interest_pay := ROUND(v_remaining * v_monthly_rate, 2);
        v_principal_pay := ROUND(v_fixed_payment - v_interest_pay, 2);

        IF v_i = (p_loan->>'total_installments')::integer THEN
          v_principal_pay := ROUND(v_remaining, 2);
        END IF;

        v_due_date := COALESCE(
          (p_loan->>'start_date')::date,
          p_transaction_date
        ) + (v_i || ' months')::interval;

        INSERT INTO public.installments (
          loan_id, installment_number, principal_amount,
          interest_amount, total_amount, due_date, status
        )
        VALUES (
          v_loan_id, v_i, v_principal_pay, v_interest_pay,
          ROUND(v_principal_pay + v_interest_pay, 2),
          v_due_date, 'PENDING'
        );

        v_remaining := v_remaining - v_principal_pay;
        v_installments_gen := v_installments_gen + 1;
      END LOOP;
    END IF;
  END IF;

  IF p_receivable IS NOT NULL THEN
    INSERT INTO public.accounts_receivable (
      user_id, transaction_id, debtor_id, debtor_name,
      amount, currency, issue_date, due_date,
      concept, notes, status
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      CASE
        WHEN NULLIF(trim(p_receivable->>'debtor_id'), '') IS NOT NULL
          THEN (p_receivable->>'debtor_id')::uuid
        ELSE NULL
      END,
      p_receivable->>'debtor_name',
      p_amount,
      p_currency,
      p_transaction_date,
      (p_receivable->>'due_date')::date,
      p_receivable->>'concept',
      p_receivable->>'notes',
      'PENDING'
    )
    RETURNING id INTO v_receivable_id;
  END IF;

  IF p_payable IS NOT NULL THEN
    INSERT INTO public.accounts_payable (
      user_id, transaction_id, creditor_id, creditor_name,
      amount, currency, issue_date, due_date,
      concept, notes, status
    )
    VALUES (
      p_user_id,
      v_transaction_id,
      CASE
        WHEN NULLIF(trim(p_payable->>'creditor_id'), '') IS NOT NULL
          THEN (p_payable->>'creditor_id')::uuid
        ELSE NULL
      END,
      p_payable->>'creditor_name',
      p_amount,
      p_currency,
      p_transaction_date,
      (p_payable->>'due_date')::date,
      p_payable->>'concept',
      p_payable->>'notes',
      'PENDING'
    )
    RETURNING id INTO v_payable_id;
  END IF;

  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'asset_id', v_asset_id,
    'credit_id', v_credit_id,
    'loan_id', v_loan_id,
    'receivable_id', v_receivable_id,
    'payable_id', v_payable_id,
    'installments_generated', v_installments_gen
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_transaction_atomic failed: % (SQLSTATE: %)',
      SQLERRM, SQLSTATE;
END;
$$;

-- Keep the historical 17-argument contract without a second write path.
-- This overload is deprecated; a future removal needs a consumer audit.
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
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
  p_asset                   jsonb        DEFAULT NULL,
  p_credit                  jsonb        DEFAULT NULL,
  p_loan                    jsonb        DEFAULT NULL,
  p_receivable              jsonb        DEFAULT NULL,
  p_payable                 jsonb        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.create_transaction_atomic(
    p_user_id               => p_user_id,
    p_source_account_id     => p_source_account_id,
    p_destination_account_id => p_destination_account_id,
    p_category_id           => p_category_id,
    p_budget_id             => NULL::uuid,
    p_type                  => p_type,
    p_amount                => p_amount,
    p_currency              => p_currency,
    p_exchange_rate         => p_exchange_rate,
    p_description           => p_description,
    p_transaction_date      => p_transaction_date,
    p_notes                 => p_notes,
    p_is_recurring          => p_is_recurring,
    p_sender                => NULL::text,
    p_recipient             => NULL::text,
    p_asset                 => p_asset,
    p_credit                => p_credit,
    p_loan                  => p_loan,
    p_receivable            => p_receivable,
    p_payable               => p_payable
  );
$$;

-- Explicit role grants matter: revoking PUBLIC does not remove an existing
-- direct grant to anon. Neither overload is intended for service-role calls.
REVOKE ALL ON FUNCTION public.create_transaction_atomic(
  uuid, uuid, uuid, uuid, uuid, text, numeric, text, numeric, text,
  date, text, boolean, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_transaction_atomic(
  uuid, uuid, uuid, uuid, uuid, text, numeric, text, numeric, text,
  date, text, boolean, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.create_transaction_atomic(
  uuid, uuid, uuid, uuid, text, numeric, text, numeric, text,
  date, text, boolean, jsonb, jsonb, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_transaction_atomic(
  uuid, uuid, uuid, uuid, text, numeric, text, numeric, text,
  date, text, boolean, jsonb, jsonb, jsonb, jsonb, jsonb
) TO authenticated;
