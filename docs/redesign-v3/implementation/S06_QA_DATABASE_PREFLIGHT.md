# S06 QA database preflight — isolated link and dry-run complete

Date: 2026-09-25 (America/Lima). Branch: `codex/redisenio-total`. Base SHA: `499c70fa446b8152120314e9279145176a6ed655`. The working tree already contains uncommitted V3 implementation and proposal artifacts; this preflight changes no production code, migrations, Supabase project, Vercel configuration or data.

## Identity and CLI boundary

- The authenticated, read-only CLI project list confirms **`fintrack-qa` = `wnfuhuombgmnwqagvlcs`**, region `us-east-2`, status `ACTIVE_HEALTHY`.
- Existing `supabase/.temp/project-ref` and `supabase/.temp/linked-project.json` identify `yahocagtrxvevqhhlkln` (`Fintrack_V3.1`). `.env.local` points its public Supabase URL at the same ref. Treat this as **production**. The QA ref differs from every locally identified production ref. No key/password value was printed or copied.
- `supabase/config.toml` has local `project_id = "fintrack"` and local ports; that value is not a remote project ref. The repository-local CLI is Supabase `2.81.3` at `node_modules/.bin/supabase`. No database password was requested or passed in a command.
- The CLI list also confirms `yahocagtrxvevqhhlkln` is `Fintrack_V3.1`, region `us-east-1`, status `ACTIVE_HEALTHY`. The QA name/ref and separate production ref were checked **before linking**.
- A fresh isolated workdir `/private/tmp/fintrack-qa-cli.SJ7gwfRc` contains an exact copy of `supabase/config.toml` and all 33 migration files, with no `.env.local` or copied `.temp`. `supabase link --project-ref wnfuhuombgmnwqagvlcs --workdir /private/tmp/fintrack-qa-cli.SJ7gwfRc` succeeded. Its new `.temp/project-ref` is QA; the original repository `.temp/project-ref` remains `yahocagtrxvevqhhlkln`. No production link or configuration was modified.

## Dry-run migration inventory

The CLI dry-run explicitly listed all **33** ordered SQL migrations as pending:

1. `20240101000001_initial_schema.sql`
2. `20240101000002_triggers_functions.sql`
3. `20240101000003_rls_policies.sql`
4. `20240102000001_dashboard_views.sql`
5. `20240103000001_categories_system_key.sql`
6. `20260328223500_fix_dashboard_summary_nested_aggregate.sql`
7. `20260328225500_backfill_profiles_and_harden_auth_trigger.sql`
8. `20260328232000_create_transaction_atomic.sql`
9. `20260402123000_bank_entities_and_notifications.sql`
10. `20260405000001_profiles_notification_prefs.sql`
11. `20260430000001_v2_schema_upgrade.sql`
12. `20260518000001_update_create_transaction_atomic_prd_v3.sql`
13. `20260518000002_budgets_description_defensive.sql`
14. `20260518000003_budget_series_continuity.sql`
15. `20260521000001_create_transaction_atomic_creditor_debtor_ids.sql`
16. `20260526000001_bank_entities_notifications_hotfix.sql`
17. `20260527000001_transaction_asset_type_id_hotfix.sql`
18. `20260529000001_remove_both_from_category_scope.sql`
19. `20260603000001_import_jobs.sql`
20. `20260606000002_user_default_categories.sql`
21. `20260609000001_exchange_rates_daily.sql`
22. `20260609000002_exchange_rates_live.sql`
23. `20260610000001_app_releases.sql`
24. `20260611000001_budget_series_periods.sql`
25. `20260615000001_accounts_initial_balance_date.sql`
26. `20260615000002_lock_loan_categories.sql`
27. `20260618000003_skip_credit_card_account_balance.sql`
28. `20260618000004_credit_card_dual_currency_balances.sql`
29. `20260619000001_credit_card_initial_dual_currency_balances.sql`
30. `20260619000002_repair_credit_card_initial_balances.sql`
31. `20260620000001_credit_card_transfer_categories.sql`
32. `20260620000002_skip_credit_card_transfer_destination_balance.sql`
33. `20260920000001_add_loan_type.sql`

Static keyword review finds table, function, trigger, policy/RLS, view, index, type, storage-bucket and extension DDL across the sequence. The repository has no `supabase/seed.sql` or `supabase/roles.sql`. Migrations seed system categories, currencies and asset types; no hardcoded production project ref or personal email was found in the SQL. `supabase/functions/fn_create_transaction_atomic.sql` is outside the migration directory and is **not** automatically included in a normal migration push.

The first migration declares `pgcrypto`; later SQL depends on Supabase-managed `auth.users`, `storage.buckets` and `storage.objects`. The dry-run did not report a missing dependency, but it does not execute SQL, so dependency compatibility remains unproved until a separately approved disposable execution.

**Destructive DDL requiring explicit attention:** `20260430000001_v2_schema_upgrade.sql` drops the historical `goals` table/type, seven views and `fn_latest_exchange_rate(...) CASCADE` before recreating the modern function/views. Later migrations also replace policies/triggers, drop obsolete indexes/constraints/types and perform backfills/repairs. On a genuinely empty QA project, the historical `goals` table would be created by migration 1 and dropped by migration 11; this is a known historical sequence, not permission for a real push or proof it will succeed. The dry-run lists filenames only: it does **not** execute or validate SQL dependencies. The `CASCADE` and prior-data repair scripts still need explicit review before any separately approved real push. No destructive SQL was executed in this preflight.

## Exact dry-run result and boundary

Command: `./node_modules/.bin/supabase db push --dry-run --workdir /private/tmp/fintrack-qa-cli.SJ7gwfRc`. Exit code **0**. The CLI printed `Initialising login role...`, explicitly stated `DRY RUN: migrations will *not* be pushed to the database`, connected to the QA remote, listed the 33 names above, then printed `Finished supabase db push.` in its dry-run mode. There were **no errors or migration warnings**. The only notice was that CLI `2.118.0` is available while the installed repository version is `2.81.3`; no CLI update was attempted. The dry-run statement proves that the CLI did not push migrations; it is not an independent audit of every remote metadata side effect of CLI authentication.

The result is consistent with a new QA project's empty migration history, but it does not prove the database has no tables or that every migration will execute successfully. No real push, seed, E2E user, Vercel change, deployment or authenticated E2E was performed. **Stop here for owner review.** A future real push requires separate explicit authorization and a careful review of the historical destructive migration and runtime dependencies. Rollback of the local link is simply to stop using or remove the isolated temporary workdir; the repository's production link remains intact.
