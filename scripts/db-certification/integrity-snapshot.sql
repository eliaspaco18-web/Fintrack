-- Read-only, currency-separated baseline/after snapshot for the V3 rehearsal.
-- Run against the restored isolated clone only. Numeric sums are serialized as
-- text to avoid client-side floating-point rounding during comparison.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

WITH
account_currency AS (
  SELECT currency, count(*) AS rows,
         sum(balance)::text AS balance_sum,
         sum(initial_balance)::text AS initial_balance_sum
  FROM public.accounts GROUP BY currency
),
transaction_currency AS (
  SELECT currency, count(*) AS rows,
         sum(amount)::text AS amount_sum,
         sum(amount_pen)::text AS amount_pen_sum
  FROM public.transactions GROUP BY currency
),
asset_currency AS (
  SELECT currency, count(*) AS rows,
         sum(purchase_value)::text AS purchase_value_sum,
         sum(current_value)::text AS current_value_sum
  FROM public.assets GROUP BY currency
),
credit_currency AS (
  SELECT currency, count(*) AS rows,
         sum(credit_limit)::text AS limit_sum,
         sum(used_amount)::text AS used_sum,
         sum(credit_limit_pen)::text AS credit_limit_pen_sum,
         sum(credit_limit_usd)::text AS credit_limit_usd_sum,
         sum(used_amount_pen)::text AS used_amount_pen_sum,
         sum(used_amount_usd)::text AS used_amount_usd_sum,
         sum(initial_used_amount_pen)::text AS initial_used_amount_pen_sum,
         sum(initial_used_amount_usd)::text AS initial_used_amount_usd_sum
  FROM public.credits GROUP BY currency
),
loan_currency AS (
  SELECT currency, count(*) AS rows, sum(principal_amount)::text AS principal_sum
  FROM public.loans GROUP BY currency
),
installment_currency AS (
  SELECT l.currency, count(*) AS rows,
         sum(i.principal_amount)::text AS principal_sum,
         sum(i.interest_amount)::text AS interest_sum,
         sum(i.insurance_amount)::text AS insurance_sum,
         sum(i.other_charges)::text AS other_charges_sum,
         sum(i.total_amount)::text AS total_sum,
         sum(coalesce(i.paid_amount, 0))::text AS paid_sum
  FROM public.installments i JOIN public.loans l ON l.id = i.loan_id
  GROUP BY l.currency
),
receivable_currency AS (
  SELECT currency, count(*) AS rows,
         sum(amount)::text AS amount_sum,
         sum(collected_amount)::text AS collected_sum
  FROM public.accounts_receivable GROUP BY currency
),
payable_currency AS (
  SELECT currency, count(*) AS rows,
         sum(amount)::text AS amount_sum,
         sum(paid_amount)::text AS paid_sum
  FROM public.accounts_payable GROUP BY currency
),
budget_currency AS (
  SELECT currency, count(*) AS rows, sum(amount)::text AS amount_sum
  FROM public.budgets GROUP BY currency
),
series_currency AS (
  SELECT currency, count(*) AS rows, sum(default_amount)::text AS default_amount_sum
  FROM public.budget_series GROUP BY currency
),
period_currency AS (
  SELECT s.currency, count(*) AS rows, sum(p.amount)::text AS amount_sum
  FROM public.budget_periods p JOIN public.budget_series s ON s.id = p.budget_id
  GROUP BY s.currency
)
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'database', current_database(),
  'table_counts', jsonb_build_object(
    'auth_users', (SELECT count(*) FROM auth.users),
    'profiles', (SELECT count(*) FROM public.profiles),
    'accounts', (SELECT count(*) FROM public.accounts),
    'categories', (SELECT count(*) FROM public.categories),
    'transactions', (SELECT count(*) FROM public.transactions),
    'assets', (SELECT count(*) FROM public.assets),
    'credits', (SELECT count(*) FROM public.credits),
    'loans', (SELECT count(*) FROM public.loans),
    'installments', (SELECT count(*) FROM public.installments),
    'accounts_receivable', (SELECT count(*) FROM public.accounts_receivable),
    'accounts_payable', (SELECT count(*) FROM public.accounts_payable),
    'budgets', (SELECT count(*) FROM public.budgets),
    'budget_series', (SELECT count(*) FROM public.budget_series),
    'budget_periods', (SELECT count(*) FROM public.budget_periods),
    'debtors', (SELECT count(*) FROM public.debtors),
    'creditors', (SELECT count(*) FROM public.creditors),
    'billing_cycles', (SELECT count(*) FROM public.billing_cycles),
    'exchange_rates', (SELECT count(*) FROM public.exchange_rates),
    'exchange_rates_daily', (SELECT count(*) FROM public.exchange_rates_daily),
    'exchange_rates_live', (SELECT count(*) FROM public.exchange_rates_live)
  ),
  'amounts_by_currency', jsonb_build_object(
    'accounts', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM account_currency x), '{}'::jsonb),
    'transactions', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM transaction_currency x), '{}'::jsonb),
    'assets', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM asset_currency x), '{}'::jsonb),
    'credits', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM credit_currency x), '{}'::jsonb),
    'loans', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM loan_currency x), '{}'::jsonb),
    'installments', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM installment_currency x), '{}'::jsonb),
    'receivables', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM receivable_currency x), '{}'::jsonb),
    'payables', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM payable_currency x), '{}'::jsonb),
    'budgets', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM budget_currency x), '{}'::jsonb),
    'budget_series', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM series_currency x), '{}'::jsonb),
    'budget_periods', coalesce((SELECT jsonb_object_agg(currency, to_jsonb(x) - 'currency') FROM period_currency x), '{}'::jsonb)
  ),
  'relation_checks', jsonb_build_object(
    'auth_user_without_profile', (
      SELECT count(*) FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL
    ),
    'profile_without_auth_user', (
      SELECT count(*) FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL
    ),
    'transaction_source_account_missing_or_other_owner', (
      SELECT count(*) FROM public.transactions t
      LEFT JOIN public.accounts a ON a.id = t.source_account_id AND a.user_id = t.user_id
      WHERE a.id IS NULL
    ),
    'transaction_destination_account_missing_or_other_owner', (
      SELECT count(*) FROM public.transactions t
      LEFT JOIN public.accounts a ON a.id = t.destination_account_id AND a.user_id = t.user_id
      WHERE t.destination_account_id IS NOT NULL AND a.id IS NULL
    ),
    'transaction_category_missing_or_not_shared_or_owned', (
      SELECT count(*) FROM public.transactions t
      LEFT JOIN public.categories c ON c.id = t.category_id
      WHERE t.category_id IS NOT NULL
        AND (c.id IS NULL OR NOT (c.user_id = t.user_id OR (c.is_system = true AND c.user_id IS NULL)))
    ),
    'transaction_budget_missing_or_other_owner', (
      SELECT count(*) FROM public.transactions t
      LEFT JOIN public.budgets b ON b.id = t.budget_id AND b.user_id = t.user_id
      WHERE t.budget_id IS NOT NULL AND b.id IS NULL
    ),
    'asset_transaction_missing_or_other_owner', (
      SELECT count(*) FROM public.assets a
      LEFT JOIN public.transactions t ON t.id = a.transaction_id AND t.user_id = a.user_id
      WHERE a.transaction_id IS NOT NULL AND t.id IS NULL
    ),
    'credit_account_missing_or_other_owner', (
      SELECT count(*) FROM public.credits c
      LEFT JOIN public.accounts a ON a.id = c.account_id AND a.user_id = c.user_id
      WHERE c.account_id IS NOT NULL AND a.id IS NULL
    ),
    'credit_transaction_missing_or_other_owner', (
      SELECT count(*) FROM public.credits c
      LEFT JOIN public.transactions t ON t.id = c.transaction_id AND t.user_id = c.user_id
      WHERE c.transaction_id IS NOT NULL AND t.id IS NULL
    ),
    'loan_credit_missing_or_other_owner', (
      SELECT count(*) FROM public.loans l
      LEFT JOIN public.credits c ON c.id = l.credit_id AND c.user_id = l.user_id
      WHERE l.credit_id IS NOT NULL AND c.id IS NULL
    ),
    'loan_transaction_missing_or_other_owner', (
      SELECT count(*) FROM public.loans l
      LEFT JOIN public.transactions t ON t.id = l.transaction_id AND t.user_id = l.user_id
      WHERE l.transaction_id IS NOT NULL AND t.id IS NULL
    ),
    'installment_payment_transaction_missing_or_other_owner', (
      SELECT count(*) FROM public.installments i
      JOIN public.loans l ON l.id = i.loan_id
      LEFT JOIN public.transactions t ON t.id = i.transaction_id AND t.user_id = l.user_id
      WHERE i.transaction_id IS NOT NULL AND t.id IS NULL
    ),
    'receivable_transaction_missing_or_other_owner', (
      SELECT count(*) FROM public.accounts_receivable r
      LEFT JOIN public.transactions t ON t.id = r.transaction_id AND t.user_id = r.user_id
      WHERE r.transaction_id IS NOT NULL AND t.id IS NULL
    ),
    'receivable_debtor_missing_or_other_owner', (
      SELECT count(*) FROM public.accounts_receivable r
      LEFT JOIN public.debtors d ON d.id = r.debtor_id AND d.user_id = r.user_id
      WHERE r.debtor_id IS NOT NULL AND d.id IS NULL
    ),
    'payable_transaction_missing_or_other_owner', (
      SELECT count(*) FROM public.accounts_payable p
      LEFT JOIN public.transactions t ON t.id = p.transaction_id AND t.user_id = p.user_id
      WHERE p.transaction_id IS NOT NULL AND t.id IS NULL
    ),
    'payable_creditor_missing_or_other_owner', (
      SELECT count(*) FROM public.accounts_payable p
      LEFT JOIN public.creditors c ON c.id = p.creditor_id AND c.user_id = p.user_id
      WHERE p.creditor_id IS NOT NULL AND c.id IS NULL
    ),
    'budget_category_missing_or_not_shared_or_owned', (
      SELECT count(*) FROM public.budgets b
      LEFT JOIN public.categories c ON c.id = b.category_id
      WHERE b.category_id IS NOT NULL
        AND (c.id IS NULL OR NOT (c.user_id = b.user_id OR (c.is_system = true AND c.user_id IS NULL)))
    ),
    'budget_series_category_missing_or_not_shared_or_owned', (
      SELECT count(*) FROM public.budget_series b
      LEFT JOIN public.categories c ON c.id = b.category_id
      WHERE b.category_id IS NOT NULL
        AND (c.id IS NULL OR NOT (c.user_id = b.user_id OR (c.is_system = true AND c.user_id IS NULL)))
    ),
    'budget_period_without_series', (
      SELECT count(*) FROM public.budget_periods p
      LEFT JOIN public.budget_series s ON s.id = p.budget_id
      WHERE s.id IS NULL
    ),
    'installment_without_loan', (
      SELECT count(*) FROM public.installments i
      LEFT JOIN public.loans l ON l.id = i.loan_id
      WHERE l.id IS NULL
    )
  ),
  'unverified_currency_amounts', jsonb_build_object(
    'debtors_initial_debt_sum', (SELECT coalesce(sum(initial_debt), 0)::text FROM public.debtors),
    'creditors_initial_debt_sum', (SELECT coalesce(sum(initial_debt), 0)::text FROM public.creditors),
    'billing_cycles_total_to_pay_unclassified_sum', (SELECT coalesce(sum(total_to_pay), 0)::text FROM public.billing_cycles)
  ),
  'attachment_references', jsonb_build_object(
    'transactions', (SELECT count(*) FROM public.transactions WHERE nullif(btrim(attachment_url), '') IS NOT NULL),
    'assets', (SELECT count(*) FROM public.assets WHERE nullif(btrim(attachment_url), '') IS NOT NULL),
    'receivables', (SELECT count(*) FROM public.accounts_receivable WHERE nullif(btrim(attachment_url), '') IS NOT NULL),
    'payables', (SELECT count(*) FROM public.accounts_payable WHERE nullif(btrim(attachment_url), '') IS NOT NULL),
    'installment_payment_proofs', (SELECT count(*) FROM public.installments WHERE nullif(btrim(payment_proof_url), '') IS NOT NULL),
    'billing_cycle_statements', (SELECT count(*) FROM public.billing_cycles WHERE nullif(btrim(statement_url), '') IS NOT NULL),
    'attachment_bucket_objects', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'attachments')
  )
)) AS snapshot_json;

ROLLBACK;
