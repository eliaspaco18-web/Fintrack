-- Run only against a disposable, fully migrated LOCAL Supabase database.
-- Never run against production or remote QA without separate write authorization.
-- All synthetic users and financial rows are rolled back at the end.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE ft_rpc_test_ids (name text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ft_rpc_test_ids (name, id)
SELECT name, gen_random_uuid()
FROM (VALUES
  ('owner'), ('other'), ('owner_account'), ('other_account'),
  ('owner_usd_account'), ('owner_category'), ('owner_income_category'),
  ('other_category'), ('other_budget'), ('owner_budget'),
  ('other_asset_type'), ('owner_asset_type'), ('other_debtor'),
  ('owner_debtor'), ('other_creditor'), ('owner_creditor')
) AS names(name);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at
)
SELECT id, '00000000-0000-0000-0000-000000000000'::uuid,
       'authenticated', 'authenticated',
       'ft-rpc-' || name || '-' || id::text || '@example.test',
       '', now(), now()
FROM ft_rpc_test_ids WHERE name IN ('owner', 'other');

INSERT INTO public.accounts (id, user_id, name, currency, balance, initial_balance)
SELECT a.id, u.id, a.name, a.currency, 1000, 1000
FROM (
  SELECT id, name, CASE WHEN name = 'owner_usd_account' THEN 'USD' ELSE 'PEN' END AS currency
  FROM ft_rpc_test_ids WHERE name IN ('owner_account', 'other_account', 'owner_usd_account')
) a
JOIN ft_rpc_test_ids u ON u.name =
  CASE WHEN a.name = 'other_account' THEN 'other' ELSE 'owner' END;

INSERT INTO public.categories (id, user_id, name, scope)
SELECT c.id, u.id, c.name,
       CASE WHEN c.name = 'owner_income_category' THEN 'INCOME' ELSE 'EXPENSE' END::public.category_scope
FROM ft_rpc_test_ids c
JOIN ft_rpc_test_ids u ON u.name =
  CASE WHEN c.name = 'other_category' THEN 'other' ELSE 'owner' END
WHERE c.name IN ('owner_category', 'owner_income_category', 'other_category');

INSERT INTO public.budgets (id, user_id, category_id, name, amount, currency, start_date)
SELECT b.id, u.id, c.id, b.name, 500, 'PEN', current_date
FROM ft_rpc_test_ids b
JOIN ft_rpc_test_ids u ON u.name =
  CASE WHEN b.name = 'other_budget' THEN 'other' ELSE 'owner' END
JOIN ft_rpc_test_ids c ON c.name =
  CASE WHEN b.name = 'other_budget' THEN 'other_category' ELSE 'owner_category' END
WHERE b.name IN ('owner_budget', 'other_budget');

INSERT INTO public.asset_types (id, user_id, name)
SELECT a.id, u.id, a.name
FROM ft_rpc_test_ids a
JOIN ft_rpc_test_ids u ON u.name =
  CASE WHEN a.name = 'other_asset_type' THEN 'other' ELSE 'owner' END
WHERE a.name IN ('owner_asset_type', 'other_asset_type');

INSERT INTO public.debtors (id, user_id, name)
SELECT d.id, u.id, d.name
FROM ft_rpc_test_ids d
JOIN ft_rpc_test_ids u ON u.name =
  CASE WHEN d.name = 'other_debtor' THEN 'other' ELSE 'owner' END
WHERE d.name IN ('owner_debtor', 'other_debtor');

INSERT INTO public.creditors (id, user_id, name)
SELECT c.id, u.id, c.name
FROM ft_rpc_test_ids c
JOIN ft_rpc_test_ids u ON u.name =
  CASE WHEN c.name = 'other_creditor' THEN 'other' ELSE 'owner' END
WHERE c.name IN ('owner_creditor', 'other_creditor');

SELECT set_config('ftqa.' || name, id::text, true)
FROM ft_rpc_test_ids;

DO $$
BEGIN
  IF to_regprocedure(
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)'
  ) IS NULL OR to_regprocedure(
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Expected both atomic RPC signatures';
  END IF;
  IF has_function_privilege(
    'anon',
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon must not execute either RPC signature';
  END IF;
  IF has_function_privilege(
    'service_role',
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'service_role',
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role must not execute either RPC signature';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.create_transaction_atomic(uuid,uuid,uuid,uuid,text,numeric,text,numeric,text,date,text,boolean,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must execute both RPC signatures';
  END IF;
  IF has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'public is not a trusted schema for the pinned RPC search_path';
  END IF;
END $$;

-- Invoke through the same authenticated database role and JWT claim used by
-- PostgREST; this is not a mock of the database function.
CREATE FUNCTION pg_temp.ft_rpc_invoke(overrides jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  RETURN public.create_transaction_atomic(
    p_user_id => coalesce((overrides->>'user_id')::uuid, current_setting('ftqa.owner')::uuid),
    p_source_account_id => coalesce((overrides->>'source_account_id')::uuid, current_setting('ftqa.owner_account')::uuid),
    p_destination_account_id => (overrides->>'destination_account_id')::uuid,
    p_category_id => coalesce((overrides->>'category_id')::uuid, current_setting('ftqa.owner_category')::uuid),
    p_budget_id => (overrides->>'budget_id')::uuid,
    p_type => coalesce(overrides->>'type', 'EXPENSE'),
    p_amount => coalesce((overrides->>'amount')::numeric, 25),
    p_currency => coalesce(overrides->>'currency', 'PEN'),
    p_exchange_rate => coalesce((overrides->>'exchange_rate')::numeric, 1),
    p_description => 'Disposable local RPC test',
    p_transaction_date => current_date,
    p_notes => NULL::text,
    p_is_recurring => false,
    p_sender => NULL::text,
    p_recipient => NULL::text,
    p_asset => overrides->'asset',
    p_credit => overrides->'credit',
    p_loan => overrides->'loan',
    p_receivable => overrides->'receivable',
    p_payable => overrides->'payable'
  );
END $$;

CREATE FUNCTION pg_temp.ft_rpc_expect_rejection(overrides jsonb, fragment text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  actual_error text;
BEGIN
  BEGIN
    PERFORM pg_temp.ft_rpc_invoke(overrides);
  EXCEPTION WHEN OTHERS THEN
    actual_error := SQLERRM;
  END;
  IF actual_error IS NULL OR position(fragment IN actual_error) = 0 THEN
    RAISE EXCEPTION 'Expected error fragment %, got %', fragment, actual_error;
  END IF;
END $$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_transaction_atomic(
      p_user_id => current_setting('ftqa.owner')::uuid,
      p_source_account_id => current_setting('ftqa.owner_account')::uuid,
      p_budget_id => NULL::uuid
    );
    RAISE EXCEPTION 'anon unexpectedly executed the RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.create_transaction_atomic(
      current_setting('ftqa.owner')::uuid,
      current_setting('ftqa.owner_account')::uuid,
      NULL::uuid, current_setting('ftqa.owner_category')::uuid,
      'EXPENSE'::text, 5::numeric, 'PEN'::text, 1::numeric,
      'Anonymous legacy test'::text, current_date, NULL::text, false,
      NULL::jsonb, NULL::jsonb, NULL::jsonb, NULL::jsonb, NULL::jsonb
    );
    RAISE EXCEPTION 'anon unexpectedly executed the legacy RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('ftqa.owner'), true);

-- No own or foreign object may be mutated by an invalid caller/reference.
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('user_id', current_setting('ftqa.other')), 'Not authorized');
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('source_account_id', current_setting('ftqa.other_account')), 'Source account is unavailable');
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('type', 'TRANSFER', 'destination_account_id', current_setting('ftqa.other_account')),
  'Destination account is unavailable');
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('category_id', current_setting('ftqa.other_category')), 'Category is unavailable');
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('budget_id', current_setting('ftqa.other_budget')), 'Budget is unavailable');
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('asset', jsonb_build_object(
    'name', 'Test asset', 'asset_type', 'EQUIPMENT', 'purchase_value', 25,
    'asset_type_id', current_setting('ftqa.other_asset_type'))),
  'Asset type is unavailable');
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('receivable', jsonb_build_object(
    'debtor_id', current_setting('ftqa.other_debtor'), 'debtor_name', 'Other',
    'due_date', current_date + 30, 'concept', 'Test')),
  'Debtor is unavailable');
SELECT pg_temp.ft_rpc_expect_rejection(
  jsonb_build_object('type', 'INCOME',
    'category_id', current_setting('ftqa.owner_income_category'),
    'payable', jsonb_build_object(
      'creditor_id', current_setting('ftqa.other_creditor'),
      'creditor_name', 'Other', 'due_date', current_date + 30,
      'concept', 'Test')),
  'Creditor is unavailable');
SELECT pg_temp.ft_rpc_expect_rejection(
  '{"currency":"EUR"}'::jsonb, 'Invalid transaction currency');
SELECT pg_temp.ft_rpc_expect_rejection(
  '{"amount":-1}'::jsonb, 'Invalid transaction amount');

-- Successful base PEN/USD operations and the deprecated wrapper.
DO $$
DECLARE
  result jsonb;
BEGIN
  result := pg_temp.ft_rpc_invoke('{}'::jsonb);
  IF result->>'transaction_id' IS NULL THEN
    RAISE EXCEPTION 'PEN transaction did not return its id';
  END IF;
  result := pg_temp.ft_rpc_invoke(jsonb_build_object(
    'source_account_id', current_setting('ftqa.owner_usd_account'),
    'currency', 'USD', 'amount', 10, 'exchange_rate', 3.7));
  IF result->>'transaction_id' IS NULL THEN
    RAISE EXCEPTION 'USD transaction did not return its id';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE id = (result->>'transaction_id')::uuid
      AND currency = 'USD' AND amount_pen = 37
  ) THEN
    RAISE EXCEPTION 'USD amount_pen differs from the persisted conversion';
  END IF;
  -- Explicit positional types distinguish this legacy overload from the
  -- 20-argument overload whose trailing parameters also have defaults.
  result := public.create_transaction_atomic(
    current_setting('ftqa.owner')::uuid,
    current_setting('ftqa.owner_account')::uuid,
    NULL::uuid, current_setting('ftqa.owner_category')::uuid,
    'EXPENSE'::text, 5::numeric, 'PEN'::text, 1::numeric,
    'Legacy wrapper test'::text, current_date, NULL::text, false,
    NULL::jsonb, NULL::jsonb, NULL::jsonb, NULL::jsonb, NULL::jsonb
  );
  IF result->>'transaction_id' IS NULL THEN
    RAISE EXCEPTION '17-argument wrapper did not return its id';
  END IF;
END $$;

-- Derived modules, owned IDs, and unchanged installment calculation.
DO $$
DECLARE
  result jsonb;
BEGIN
  result := pg_temp.ft_rpc_invoke(jsonb_build_object(
    'budget_id', current_setting('ftqa.owner_budget'),
    'asset', jsonb_build_object(
      'name', 'Test asset', 'asset_type', 'EQUIPMENT',
      'asset_type_id', current_setting('ftqa.owner_asset_type'),
      'purchase_value', 25, 'current_value', 25)));
  IF result->>'asset_id' IS NULL THEN RAISE EXCEPTION 'Asset was not created'; END IF;

  result := pg_temp.ft_rpc_invoke(jsonb_build_object(
    'credit', jsonb_build_object(
      'credit_type', 'LINE_OF_CREDIT', 'name', 'Test credit',
      'credit_limit', 500, 'interest_rate', 1),
    'loan', jsonb_build_object(
      'creditor_name', 'Test lender', 'principal_amount', 25,
      'interest_rate', 0, 'total_installments', 2,
      'start_date', current_date,
      'end_date', current_date + interval '2 months',
      'generate_schedule', true)));
  IF result->>'credit_id' IS NULL OR result->>'loan_id' IS NULL
     OR (result->>'installments_generated')::integer <> 2 THEN
    RAISE EXCEPTION 'Credit/loan/2-installment operation failed';
  END IF;

  result := pg_temp.ft_rpc_invoke(jsonb_build_object(
    'receivable', jsonb_build_object(
      'debtor_id', current_setting('ftqa.owner_debtor'),
      'debtor_name', 'Test debtor', 'due_date', current_date + 30,
      'concept', 'Test')));
  IF result->>'receivable_id' IS NULL THEN
    RAISE EXCEPTION 'Receivable was not created';
  END IF;

  result := pg_temp.ft_rpc_invoke(jsonb_build_object(
    'type', 'INCOME', 'category_id', current_setting('ftqa.owner_income_category'),
    'payable', jsonb_build_object(
      'creditor_id', current_setting('ftqa.owner_creditor'),
      'creditor_name', 'Test creditor', 'due_date', current_date + 30,
      'concept', 'Test')));
  IF result->>'payable_id' IS NULL THEN
    RAISE EXCEPTION 'Payable was not created';
  END IF;
END $$;

DO $$
DECLARE
  before_count integer;
  before_balance numeric;
  before_credits integer;
  before_loans integer;
  before_installments integer;
BEGIN
  SELECT count(*) INTO before_count FROM public.transactions
    WHERE user_id = current_setting('ftqa.owner')::uuid;
  SELECT balance INTO before_balance FROM public.accounts
    WHERE id = current_setting('ftqa.owner_account')::uuid;
  SELECT count(*) INTO before_credits FROM public.credits
    WHERE user_id = current_setting('ftqa.owner')::uuid;
  SELECT count(*) INTO before_loans FROM public.loans
    WHERE user_id = current_setting('ftqa.owner')::uuid;
  SELECT count(*) INTO before_installments FROM public.installments i
    JOIN public.loans l ON l.id = i.loan_id
    WHERE l.user_id = current_setting('ftqa.owner')::uuid;

  PERFORM pg_temp.ft_rpc_expect_rejection(jsonb_build_object(
    'credit', jsonb_build_object(
      'credit_type', 'LINE_OF_CREDIT', 'name', 'Credit before failed loan',
      'credit_limit', 500, 'interest_rate', 1),
    'loan', jsonb_build_object(
      'creditor_name', 'Invalid schedule', 'principal_amount', 25,
      'interest_rate', 0, 'total_installments', 0,
      'start_date', current_date,
      'end_date', current_date + interval '2 months',
      'generate_schedule', true)), 'create_transaction_atomic failed');

  IF (SELECT count(*) FROM public.transactions
      WHERE user_id = current_setting('ftqa.owner')::uuid) <> before_count
     OR (SELECT balance FROM public.accounts
         WHERE id = current_setting('ftqa.owner_account')::uuid) <> before_balance
     OR (SELECT count(*) FROM public.credits
         WHERE user_id = current_setting('ftqa.owner')::uuid) <> before_credits
     OR (SELECT count(*) FROM public.loans
         WHERE user_id = current_setting('ftqa.owner')::uuid) <> before_loans
     OR (SELECT count(*) FROM public.installments i
         JOIN public.loans l ON l.id = i.loan_id
         WHERE l.user_id = current_setting('ftqa.owner')::uuid) <> before_installments THEN
    RAISE EXCEPTION 'Failed derived module did not roll back every created row/balance';
  END IF;
  IF EXISTS (SELECT 1 FROM public.transactions
             WHERE user_id = current_setting('ftqa.other')::uuid) THEN
    RAISE EXCEPTION 'Cross-tenant transaction was created';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
