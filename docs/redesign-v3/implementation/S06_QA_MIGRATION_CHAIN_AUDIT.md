# S06 QA migration-chain safety audit — NO-GO

Date: 2026-09-27 (America/Lima). Repository branch: `codex/redisenio-total`; base SHA: `499c70fa446b8152120314e9279145176a6ed655`.

Scope: static inspection of the **33 pending migrations** listed in `S06_QA_DATABASE_PREFLIGHT.md`, in timestamp order, for a new `fintrack-qa` Supabase project (`wnfuhuombgmnwqagvlcs`). No SQL was executed in this audit. The earlier CLI `db push --dry-run` enumerated files but did not validate their SQL or the resulting RPC behavior. The repository's existing production link was not used or changed. `AUTHENTICATED_QA_SETUP.md` remains the S06 safety contract.

## Decision

**NO-GO. Do not run `supabase db push` yet.** Migration 11 removes `currency_code`, but the final `create_transaction_atomic` implementation from migration 17 still casts `p_currency::currency_code` in six branches. Migrations 12 and 15 contain the same stale casts, and none of migrations 12–33 recreates that type. PostgreSQL may accept a PL/pgSQL function body without analyzing every embedded SQL statement until its first execution; therefore even an apparently successful push could leave the transaction RPC unusable. Migration 11 also changes enum-typed columns to `text` before dropping their enum-typed defaults, a separate execution-time risk requiring validation/correction. These findings prevent certifying the chain as a safe fresh FinTrack installation.

This is not a claim that the 33 SQL files were executed or that a specific remote statement has failed. The preflight stops before any real push or authenticated write.

PostgreSQL basis for the two cautions: [`ALTER TABLE ... SET DATA TYPE` does not apply `USING` to column defaults](https://www.postgresql.org/docs/17/sql-altertable.html); [PL/pgSQL can defer analysis of individual embedded SQL statements until execution](https://www.postgresql.org/docs/17/plpgsql-implementation.html).

## Migration 11: exact teardown and reconstruction

Earlier migrations create the following objects:

- **1** creates the `currency_code` and `goal_status` enums, `goals`, currency-typed columns in the core financial tables, and the base schema.
- **2** adds `trg_goals_updated_at`, `trg_transactions_amount_pen`, `fn_latest_exchange_rate(currency_code,currency_code)`, `v_net_worth`, and `v_monthly_summary`.
- **3** creates goals RLS policies and makes the first two views security-invoker.
- **4** adds `v_account_balances`, `v_credit_summary`, `v_upcoming_installments`, `v_receivables_summary`, `v_payables_summary`, plus `v_monthly_cash_flow` and `v_expense_by_category`.
- **8** creates the original, 17-parameter `create_transaction_atomic`; its body also casts to `currency_code`.

Migration **11**, `20260430000001_v2_schema_upgrade.sql`:

1. Drops the goals policies/trigger/indexes, `goals` table and `goal_status` enum. **These are not recreated later.** On a truly empty QA project, migration 1 has created an empty goals table, so this removes historical structure rather than user data. It remains a destructive historical step, not a general permission to run it on another environment.
2. Drops `trg_transactions_amount_pen` and seven named views: `v_monthly_summary`, `v_net_worth`, `v_account_balances`, `v_credit_summary`, `v_upcoming_installments`, `v_receivables_summary`, `v_payables_summary`.
3. Drops `fn_latest_exchange_rate(currency_code,currency_code) CASCADE`. With only the preceding migrations' objects in QA, the named dependent views have already been dropped; no additional **declared view** depending on this function was found. `CASCADE` could still remove an unanticipated dependent object if the QA database is not actually pristine. The migration does not inventory what CASCADE would remove.
4. Converts the currency columns in `profiles`, `accounts`, `transactions`, `assets`, `credits`, `loans`, `accounts_receivable`, `accounts_payable`, `budgets`, and `exchange_rates` from the enum to text, resets defaults, then drops `currency_code`. The first nine columns from migration 1 have enum-typed `'PEN'` defaults. Because `USING` does not transform a default, changing the column type **before** dropping/replacing that default is an unverified failure risk. This must not be dismissed because there are zero rows.
5. Recreates `fn_latest_exchange_rate(text,text)` and the seven dropped views; later in the same file it recreates `trg_transactions_amount_pen`, and it also creates V2 catalogs/financial support tables, RLS policies and the attachments storage bucket/policies. `v_monthly_cash_flow` and `v_expense_by_category` were not dropped and remain from migration 4. Existing `fn_dashboard_summary` is a PL/pgSQL function using the rate function and views and is not explicitly recreated here; its runtime behavior needs validation after a corrected build.
6. Backfills legacy `assets.asset_type_id` with five filtered `UPDATE` statements. On empty QA these are no-ops. They do not require prior user data for the schema statements to run.

**Completeness gap:** the seven views and exchange-rate function have replacements, as does the amount trigger, but goals deliberately has no replacement and `currency_code` has no replacement. The latter removal is inconsistent with the transaction RPCs in migrations 8/12/15/17. The `CASCADE` has no apparent additional declared-view victim in the inspected preceding migrations, but the dry-run cannot prove the remote dependency graph. Nothing in this sequence requires pre-existing financial rows; the problem is DDL/default compatibility and stale RPC code, not missing input data.

### Remaining `DROP` / destructive-ALTER classification

- **11:** All table/type/view/function drops are enumerated above. Its remaining `DROP TRIGGER`/`DROP POLICY` statements are paired with new definitions on the same existing/new tables; the installment CHECK is dropped and re-added with a new expression. `currency_code` and goals are the only intentionally absent final objects, but the RPC still requires the former.
- **14:** Drops `idx_budgets_user_name` to permit the new series model; creates series-aware indexes and replaces `trg_budgets_validate_series`. The old index is not recreated by design.
- **18:** Drops `category_scope_old` only after changing the categories column to the new enum; no `BOTH` data exists in fresh QA. This is a type replacement, not an empty table deletion.
- **20:** Drops `idx_categories_system_key` and `categories_system_key_only_system`; replaces the global-key restriction with an owner-scoped unique index. The old restrictions are not recreated by design.
- **28–29 and 33:** Drop named CHECK constraints only to add revised versions in the same migration. With no card/loan rows, this cannot delete financial records.
- **Other `DROP TRIGGER`/`DROP POLICY` occurrences:** migrations 16, 19, 21–24 and 31 replace same-named trigger/policy definitions on their own tables; the corresponding CREATE statements are in the same files. Migration 32 replaces the balance function with `CREATE OR REPLACE`, not a `DROP` of its trigger. `CASCADE` elsewhere appears in `ON DELETE CASCADE` foreign-key declarations and does not run a mass deletion during an empty-schema build.
- No top-level `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM` was found. The type/column rewrites in 11 and 18 and the constraint/index rewrites above are the meaningful destructive schema operations.

## Other repairs, rewrites, and data expectations

| Migration | Operation/data expected | Empty-QA behavior and risk |
| --- | --- | --- |
| 5 `categories_system_key` | Adds keys and updates the 16 system categories inserted in migration 2. | Runs against seeded reference rows, not a no-op; bounded update. Low risk. |
| 7 `backfill_profiles_and_harden_auth_trigger` | Copies missing `auth.users` to `profiles`; replaces auth trigger. | No users means profile copy is a no-op; trigger remains for future signups. Low risk if Supabase-managed `auth.users` exists. |
| 11 `v2_schema_upgrade` | Drops/rebuilds objects as above; maps legacy asset types. | Asset updates no-op; DDL and RPC compatibility are **blocking**. |
| 14 `budget_series_continuity` | Fills null `budgets.series_id`, makes it NOT NULL, drops old name index, adds continuity trigger/indexes. | No budgets means update no-op; new default/constraint apply. Low data risk. |
| 16 `bank_entities_notifications_hotfix` | Reasserts catalog/notification tables, policies, triggers and constraints. | Predecessor 9 created them; conditional DDL/rewiring, no legacy rows. Low data risk, still unexecuted. |
| 18 `remove_both_from_category_scope` | Reclassifies `BOTH` categories from usage/system key; drops default, renames old enum, creates new enum, converts column, drops old enum. | Seeded categories use `INCOME`/`EXPENSE`; no `BOTH` user rows, so update no-op. Explicit default drop makes conversion structurally coherent. Moderate DDL risk, not identified as the blocker. |
| 20 `user_default_categories` | Drops obsolete key index/constraint; defines per-user category seeding and loops existing profiles. | No profiles means per-user seed/backfill no-op. Global categories remain. Low data risk. |
| 21 `exchange_rates_daily` | Copies historical `exchange_rates` into daily table. | No historical rates means no-op. Low data risk. |
| 22 `exchange_rates_live` | Copies latest USD/PEN rate into live cache. | No historical rate means no-op. Low data risk. |
| 24 `budget_series_periods` | Creates series/period tables and backfills from legacy `budgets`; links `transactions`. | No budgets/transactions means data portions no-op; schema/triggers/RLS still created. Low data risk. |
| 25 `accounts_initial_balance_date` | Sets dates for old accounts from `created_at`. | No accounts means no-op. Low data risk. |
| 26 `lock_loan_categories` | Replaces category seed function, normalizes existing categories and remaps historical transaction categories. | No profiles/transactions means user-data repairs no-op. Low data risk. |
| 28 `credit_card_dual_currency_balances` | Initializes PEN/USD card limits and used amounts from legacy credits; replaces check constraints. | No credits means update no-op; constraints added. Low data risk. |
| 29 `credit_card_initial_dual_currency_balances` | Copies current card used balances into opening balances; replaces checks. | No credits means no-op. Low data risk. |
| 30 `repair_credit_card_initial_balances` | Recomputes opening balances from credit-card records and linked transaction movements. | No credits/transactions means no-op. On a populated DB it is a material financial repair; **not** authorized for production here. |
| 31 `credit_card_transfer_categories` | Normalizes matching user categories and inserts missing protected categories per profile. | No profiles/user categories means updates/inserts no-op; trigger/function installed. Low data risk. |
| 33 `add_loan_type` | Adds default classification and updates any null loan types. | No loans means update no-op; default/check installed. Low data risk. |

The `UPDATE` statements inside trigger/function bodies in migrations 2, 20, 26, 27 and 32 are definitions of future operational behavior, not migration-time mass updates. `ON DELETE CASCADE` in foreign keys is referential behavior, not a migration-time `DROP ... CASCADE`. Static search found no top-level `TRUNCATE` or `DELETE FROM` and no seed containing real user data or hardcoded production project ref. This does **not** certify arbitrary future writes.

## Ordered chain (fresh Supabase → expected FinTrack schema)

| # | Migration | Chain result or dependency |
| --- | --- | --- |
| 1 | `20240101000001_initial_schema.sql` | Core enums/tables; requires Supabase `auth.users`, `pgcrypto`. |
| 2 | `20240101000002_triggers_functions.sql` | Core triggers, first views, system-category seeds. |
| 3 | `20240101000003_rls_policies.sql` | Core RLS and protected views. |
| 4 | `20240102000001_dashboard_views.sql` | Dashboard views and summary RPC. |
| 5 | `20240103000001_categories_system_key.sql` | Category keys and bounded seed update. |
| 6 | `20260328223500_fix_dashboard_summary_nested_aggregate.sql` | Summary RPC replacement. |
| 7 | `20260328225500_backfill_profiles_and_harden_auth_trigger.sql` | Empty-user no-op and auth-trigger replacement. |
| 8 | `20260328232000_create_transaction_atomic.sql` | Legacy 17-argument transaction RPC. |
| 9 | `20260402123000_bank_entities_and_notifications.sql` | Bank entities, notifications, triggers/RLS. |
| 10 | `20260405000001_profiles_notification_prefs.sql` | Profile preference column. |
| 11 | `20260430000001_v2_schema_upgrade.sql` | Major teardown/rebuild; **possible enum-default DDL failure**, removes enum still referenced by RPC. |
| 12 | `20260518000001_update_create_transaction_atomic_prd_v3.sql` | Adds 20-argument RPC overload (does not replace #8); stale enum casts. |
| 13 | `20260518000002_budgets_description_defensive.sql` | Defensive budget description column. |
| 14 | `20260518000003_budget_series_continuity.sql` | Legacy budget-series continuity. |
| 15 | `20260521000001_create_transaction_atomic_creditor_debtor_ids.sql` | Replaces #12 overload; stale enum casts. |
| 16 | `20260526000001_bank_entities_notifications_hotfix.sql` | Defensive bank/notification changes. |
| 17 | `20260527000001_transaction_asset_type_id_hotfix.sql` | Final replacement of #12/#15 overload; **stale enum casts remain**. |
| 18 | `20260529000001_remove_both_from_category_scope.sql` | Bounded scope conversion with explicit default drop. |
| 19 | `20260603000001_import_jobs.sql` | Import staging tables/functions/RLS. |
| 20 | `20260606000002_user_default_categories.sql` | Per-user category seed contract; empty-profile no-op. |
| 21 | `20260609000001_exchange_rates_daily.sql` | Daily rates/cache migration; empty-history no-op. |
| 22 | `20260609000002_exchange_rates_live.sql` | Live rate cache; empty-history no-op. |
| 23 | `20260610000001_app_releases.sql` | Release tables/triggers/RLS. |
| 24 | `20260611000001_budget_series_periods.sql` | Explicit budget series/periods, empty-history no-op. |
| 25 | `20260615000001_accounts_initial_balance_date.sql` | Account date backfill; empty-account no-op. |
| 26 | `20260615000002_lock_loan_categories.sql` | Protected loan categories, empty-user repair no-op. |
| 27 | `20260618000003_skip_credit_card_account_balance.sql` | Account-balance trigger replacement. |
| 28 | `20260618000004_credit_card_dual_currency_balances.sql` | Card currency columns/backfill; empty-credit no-op. |
| 29 | `20260619000001_credit_card_initial_dual_currency_balances.sql` | Opening-card-balance backfill; empty-credit no-op. |
| 30 | `20260619000002_repair_credit_card_initial_balances.sql` | Historical card balance repair; empty-credit no-op. |
| 31 | `20260620000001_credit_card_transfer_categories.sql` | Category normalization/seed; empty-user no-op. |
| 32 | `20260620000002_skip_credit_card_transfer_destination_balance.sql` | Account-balance trigger replacement. |
| 33 | `20260920000001_add_loan_type.sql` | Loan classification and null backfill; empty-loan no-op. |

The chronological dependencies for the repairs are present in the file order, but the final schema is **not certified**: #11's type removal and #17's final RPC body are inconsistent. The dry-run cannot settle the enum-default conversion risk or runtime function validity. A disposable execution, inspection of actual object dependencies and safe RPC validation would be necessary **after** the owner approves a correction strategy; none was performed here.

## Required intervention before reconsidering GO

Resolve the enum-to-text default conversion in migration 11 and eliminate obsolete `currency_code` references from **both** remaining RPC signatures/bodies (legacy #8 and final #17, accounting for #12/#15 history). Decide explicitly whether to preserve or retire the legacy RPC overload; do not assume `CREATE OR REPLACE FUNCTION` changed its signature. Validate the corrected historical chain in a disposable database and inspect the resulting functions/views before a separately authorized QA push. This audit neither modifies the migrations nor authorizes any schema, production, Vercel, Auth or financial-data operation.
