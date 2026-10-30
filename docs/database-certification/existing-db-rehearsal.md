# Existing Supabase database: isolated V3 certification rehearsal

**Candidate:** `621e094ab33597dd5736ca661f00539197f090bb` (`codex/security-dependencies`)

**Status:** preparation only. No Supabase project was contacted, no export or migration was run, and no real financial data was read or changed. This document is not authorization to copy production data.

## Decision gate

Do not start until the owner authorizes a specific isolated target and the data-handling plan. The source project must never be linked in this checkout. These prepared query scripts are for a **local disposable Supabase/PostgreSQL instance only**; a hosted isolated clone needs a separately reviewed access method and must not be passed to this runner. Use no production credentials, domain, email provider, webhook, scheduled job, or external integration. The target project reference and database hostname must be recorded in the test run evidence, but secrets must not be recorded.

The runner's loopback check is necessary but **not proof of local-server identity**: SSH forwarding, socat, a proxy, VPN software, or custom port mapping can route a loopback URL elsewhere. Before a run, verify the Docker context points to a local Unix socket; `supabase status` lists the local stack for this checkout; the Postgres listener on port `54322` maps to the expected local Supabase container; and no tunnel/proxy owns or forwards that port. Compare the `target-preflight.sql` output and container/instance identity with the run record. Create a fresh random run UUID only after the restored database is confirmed isolated, set it as a database-level custom setting on that isolated database, reconnect, then provide the same UUID as `CERT_TARGET_ID`; the runner refuses to run SQL unless the marker matches. For the local Supabase database named `postgres`, the one-time marker statement is `ALTER DATABASE postgres SET fintrack.certification_target_id = '<run-uuid>';`. **Do not run it now**; it is for the owner-authorized disposable target only. Never set that marker on the source project or Production. This marker is an additional guard, not a substitute for checking the listener and target identity.

Prefer a provider-supported restore/clone to a **new isolated project** when available, then validate what was copied. Supabase's project clone copies the database (including Auth records) but not Storage object files/settings and needs manual service reconfiguration; a DB backup also does not contain Storage object bytes. Therefore attachment checks require an approved isolated Storage copy or must be explicitly marked unavailable. A full logical backup/restore is an alternative only with an approved, encrypted transfer and explicit handling of `auth`, `storage`, and `supabase_migrations` schemas. Never restore over an existing project. [Supabase project cloning](https://supabase.com/docs/guides/platform/clone-project), [database backups](https://supabase.com/docs/guides/platform/backups), [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Phase 0 — source and target authorization

Obtain, through the owner's approved secure channel (not chat):

1. Source project ref, region, plan, PostgreSQL major/minor, extensions, backup/PITR availability and chosen restore timestamp.
2. Read-only source migration ledger export and schema inventory, or an owner-approved clone/restore. Do not use `migration repair` to make the ledger appear aligned.
3. Owner/DBA authorization to create a separate isolated target and copy/anonymize personal data. Record the target ref and prove it is not the source before any import.
4. A named operator with scoped access to create the isolated project and restore a backup. Inject credentials via a protected local secret store/environment file with restrictive permissions; never paste or log them.
5. Approval for treatment of Auth users, email addresses, phone numbers, profile values, Storage objects, attachment filenames, and any other personal data. Prefer synthetic identities while preserving user UUIDs and foreign-key relationships; do not deliver mail to real addresses.
6. The exact legacy V2 client commit/build artifact and its compatible environment, plus approval to run synthetic writes on the clone.

No Production or Vercel access is needed for this rehearsal. No service-role key is to be provided to the browser or included in the report.

## Phase 1 — capture and restore the isolated baseline

1. Freeze application writes to the selected restore point operationally, if the owner approves; otherwise restore a consistent provider backup/PITR snapshot. Record timestamp and backup identifier. No manual source export is part of this preparation.
2. Create a new isolated Supabase project or disposable local stack with separate project ref, host, JWT secrets, API keys, Auth settings and Storage bucket. Confirm the host/project ref differs from Production before restoring.
3. Disable outbound effects **before** restoring data or starting application code:
   - Do not configure production SMTP, SMS, OAuth callbacks, SMTP hooks, webhooks, Edge Function secrets, Vercel URLs, exchange-rate credentials, or other third-party credentials.
   - Route email to a local sink such as Supabase Inbucket in local development; in a hosted clone disable confirmations/recovery delivery or use a verified non-delivering test mail sink.
   - Inventory and disable scheduled jobs (`pg_cron`), `pg_net`/HTTP triggers, Database Webhooks, Supabase hooks, Edge Functions, and application cron routes on the isolated target. Preserve financial integrity triggers; disable only enumerated outbound/job integrations.
   - Do not run the app or jobs until the inventory is signed off.
4. Restore the DB to the **new target**. Preserve exact `supabase_migrations.schema_migrations` rows and names as part of the copy. Do not create a fresh empty migration ledger on an existing schema. Do not delete, edit, repair, or fabricate ledger records.
5. Handle Auth explicitly: cloned Auth records retain user ids and credential records; keep the clone isolated, prevent real email delivery, and anonymize PII only with an owner-approved deterministic mapping that preserves UUIDs and FK ownership. Do not attempt login with real user passwords.
6. Handle Storage explicitly: copy bucket configuration, object metadata and object bytes through an approved isolated method. If bytes cannot be copied, mark attachment verification blocked; do not claim DB-only restore tests attachment integrity.
7. If and only if restoring to a local disposable database, assign the isolated clone a new `fintrack.certification_target_id` database setting after confirming its identity; reconnect, then capture the baseline inventory, preflight, snapshot and ledger with the guarded runner. Keep output encrypted/restricted because aggregate and ledger metadata may still be sensitive.

Supabase notes that backups omit Storage object bytes, and restoring Auth/Storage schema customizations may need separate treatment. The exact method depends on the provider backup type and project configuration; validate the resulting schemas, policies and bucket content before migration.

## Phase 2 — migration classification and preflight

The local source snapshot `499c70fa446b8152120314e9279145176a6ed655` is the checked-in `main` baseline available in this repository; it is source evidence, **not** evidence of what was applied to any actual Supabase project.

The 33 migration files present in that baseline are historical candidates. Their applied/pending state is unknown until compared with the restored clone's preserved ledger. The eight files listed in the migration matrix below are content-modified in the V3 candidate. If their version is already recorded in the clone ledger, the CLI will not replay the changed file; never repair history to force it. Their intended V3 behavior must be delivered/verified through the forward migrations, and any drift between actual schema and ledger blocks execution.

The other 25 unchanged historical files in that checked-in baseline are: `20240101000001_initial_schema.sql`, `20240103000001_categories_system_key.sql`, `20260328225500_backfill_profiles_and_harden_auth_trigger.sql`, `20260328232000_create_transaction_atomic.sql`, `20260402123000_bank_entities_and_notifications.sql`, `20260405000001_profiles_notification_prefs.sql`, `20260518000002_budgets_description_defensive.sql`, `20260518000003_budget_series_continuity.sql`, `20260526000001_bank_entities_notifications_hotfix.sql`, `20260529000001_remove_both_from_category_scope.sql`, `20260603000001_import_jobs.sql`, `20260606000002_user_default_categories.sql`, `20260609000001_exchange_rates_daily.sql`, `20260609000002_exchange_rates_live.sql`, `20260610000001_app_releases.sql`, `20260611000001_budget_series_periods.sql`, `20260615000001_accounts_initial_balance_date.sql`, `20260615000002_lock_loan_categories.sql`, `20260618000003_skip_credit_card_account_balance.sql`, `20260618000004_credit_card_dual_currency_balances.sql`, `20260619000001_credit_card_initial_dual_currency_balances.sql`, `20260619000002_repair_credit_card_initial_balances.sql`, `20260620000001_credit_card_transfer_categories.sql`, `20260620000002_skip_credit_card_transfer_destination_balance.sql`, and `20260920000001_add_loan_type.sql`. These are not asserted as applied on the actual project.

Preflight on the clone only:

1. Export the full ledger and compare each version to the candidate's sorted filenames. Stop on missing, extra, duplicate, or unexpected names. Record baseline schema dump and object inventory.
2. Run a schema diff between the restored clone and the expected pre-migration schema without applying changes. Review every destructive/locking statement and extension. Compare function signatures, `prosecdef`, search paths, ACLs, view `security_invoker`, RLS/policies, triggers, indexes and constraints.
3. Identify the pending set using the actual preserved ledger. Expected forward-only set for a clone already at the source baseline is the three new files below. If the ledger/schema is older or drifted, produce a separately reviewed ordered plan; do not assume all files are pending.
4. Estimate table locks and backfill costs; run `EXPLAIN` for diagnostic queries on the clone. Define abort thresholds and a restore point before execution.

## Phase 3 — rehearse from zero and from existing state

### A. Empty database / installation from zero

Use a disposable local Supabase stack only. Confirm the database URL host is loopback. Run `supabase start`, then `supabase db reset` **only against that local stack**. This replays all current migration files, including edited historical migration content, and is useful for syntax/order/schema tests. Run SQL security tests, object inventory and client V2/V3 tests. This scenario does not prove safe upgrade behavior for an existing database.

### B. Existing-schema clone

1. Start from the isolated restored clone with its original `supabase_migrations.schema_migrations` preserved.
2. Store an immutable copy of the ledger and pre-migration snapshot.
3. Apply only the reviewed pending migration set to a disposable copy of that clone, never to the source or a shared staging DB. Use the migration tool only after confirming the target ref/host and pending list; never use `migration repair`, `db reset`, `db push --linked`, or a production-linked CLI profile. Supabase CLI migration workflows distinguish local reset from remote push; `db reset` is destructive, so restrict it to disposable local databases. [Supabase migration workflows](https://supabase.com/docs/guides/local-development/cli-workflows), [database migrations](https://supabase.com/docs/guides/deployment/database-migrations).
4. Confirm prior ledger rows are byte-for-byte unchanged and only intended pending versions were appended. Confirm no historical file was rerun.
5. Compare after snapshot, schema dump and object inventory to baseline; explain each delta. Unexpected deletion, changed historical balance/count, ownership mismatch, policy widening, RPC grant drift, missing object bytes or unexpected migration-history change is an automatic abort.
6. Repeat the same scenario from a fresh clone to ensure the run is reproducible.

## Migration matrix (source evidence only; actual applied status is pending)

| Class | Version(s) | V3 delta / affected objects | Existing DB treatment |
|---|---|---|---|
| Historical baseline | All 33 migration files at `499c70f` (versions `20240101000001` through `20260920000001`; exact list is in that commit) | Existing schema lineage: core tables/types/indexes; triggers and balance logic; RLS; dashboard views/RPC; V2 entities/obligations/recurring/attachments; budget series; daily/live rates; credit-card cycles/balances; loan type. | Applied status is **unknown** until restored clone ledger is read. Do not assume every file ran. Compare filenames and object definitions. |
| Historical file modified in candidate | `20240101000002_triggers_functions.sql` | `fn_latest_exchange_rate` filters nonpositive/fallback rates; `v_net_worth` no longer treats missing FX as 1. | If ledger has this version, do not replay; existing view/function remains whatever the target actually has. Verify forward convergence and schema drift. |
| Historical file modified in candidate | `20240101000003_rls_policies.sql` | View expression removes missing-rate fallback (the filename contains RLS, but this diff is a view definition). No new policy in this diff. | Same: ledger decides replay; inspect actual view and policy inventory. |
| Historical file modified in candidate | `20240102000001_dashboard_views.sql` | `v_account_balances` and `fn_dashboard_summary` remove hard-coded `1`/`3.7` FX fallback. | Same; historical edits do not run for recorded versions. |
| Historical file modified in candidate | `20260328223500_fix_dashboard_summary_nested_aggregate.sql` | Dashboard returns incomplete consolidated PEN values as `NULL` when USD is present without a verified rate; completeness flag. | Same; must verify forward dashboard migration gives the target equivalent behavior. |
| Historical file modified in candidate | `20260430000001_v2_schema_upgrade.sql` | Safely drops currency enum-dependent defaults before enum-to-text conversion; filters fallback rate and removes missing-rate `1` fallback in rebuilt views. | High-risk historical rewrite if unrecorded; do not replay on existing data without specific clone preflight. If recorded, verify actual schema and forward RPC/view state. |
| Historical file modified in candidate | `20260518000001_update_create_transaction_atomic_prd_v3.sql`, `20260521000001_create_transaction_atomic_creditor_debtor_ids.sql`, `20260527000001_transaction_asset_type_id_hotfix.sql` | RPC implementation uses text currency values rather than enum casts, preserving evolving schema compatibility. | Usually already part of source baseline; ledger status unknown. Candidate convergent RPC is forward migration. |
| New forward migration | `20260927000001_converge_transaction_atomic_security.sql` | Canonical `public.create_transaction_atomic` (20-arg) plus deprecated 17-arg wrapper; `SECURITY INVOKER`, constrained search path, ownership/auth/active account/category/budget validation, atomic derived inserts (asset/credit/loan/installments/receivable/payable); explicit EXECUTE grants to `authenticated`, revoke `PUBLIC`/`anon`/`service_role`. | Pending only if absent from preserved ledger. Test V2 and V3 RPC signatures and all rollback paths. |
| New forward migration | `20261025000001_dashboard_fx_completeness.sql` | Replaces `fn_latest_exchange_rate`, `v_account_balances`, `v_net_worth`, `fn_dashboard_summary`; no unverified fallback; incomplete PEN aggregates become NULL; `exchange_rate_verified`; dashboard function EXECUTE limited to authenticated. | Pending only if absent from preserved ledger. Verify view invoker/RLS behavior, function ACL and JSON compatibility. |
| New forward migration | `20261025000002_atomic_exchange_rate_default_null.sql` | Replaces canonical transaction RPC and 17-arg wrapper with nullable FX default; USD transaction requires explicit valid rate; repeats explicit grants. | Pending only if absent from preserved ledger. Test USD missing-rate rejection, PEN, explicit manual rates and both RPC signatures. |

The last three migrations create/replace functions/views and ACLs; they do not create new RLS policies or triggers. Other inherited migrations affect table schema, RLS policies, triggers, indexes, constraints, Storage bucket/policies, Auth trigger and data backfills. Build an exact live-clone object inventory before and after rather than inferring presence from the filenames.

### Object-level impact map

| Migration | Functions / RPC | Views | Triggers | RLS, policies, permissions |
|---|---|---|---|---|
| Modified historical files | `fn_latest_exchange_rate`, dashboard summary definitions, and the older versions of `create_transaction_atomic` are changed in their historical source files. | `v_net_worth`, `v_account_balances`, dashboard JSON/aggregates are changed to stop defaulting missing FX to 1/3.7. | No trigger definition changes appear in the candidate-vs-main diff for these files. | The file named `20240101000003_rls_policies.sql` has a view-expression change in this diff, not an RLS policy change. The migration rewrite does not itself prove the deployed policy state. |
| `20260927000001_converge_transaction_atomic_security.sql` | Canonical 20-argument RPC plus 17-argument wrapper; SECURITY INVOKER; explicit schema/search path; auth/ownership guards; derived writes in one database transaction. | None. | None. | Revokes execute from PUBLIC, anon and service_role; grants authenticated. It relies on row/table permissions and existing RLS because it is invoker-security. |
| `20261025000001_dashboard_fx_completeness.sql` | Replaces `fn_latest_exchange_rate` and SECURITY DEFINER `fn_dashboard_summary`. | Replaces `v_account_balances`, `v_net_worth`; uses security-invoker views. | None. | Restricts dashboard function execute to authenticated; views must be checked for security-invoker options and underlying RLS. No table policy is created here. |
| `20261025000002_atomic_exchange_rate_default_null.sql` | Replaces both RPC overloads; USD requires a non-null valid explicit exchange rate; PEN service supplies its neutral rate. | None. | None. | Repeats explicit execute revokes/grants; no policy changes. |

Inventory verification must include the exact identity-argument signatures, owners, `SECURITY DEFINER` flags, `search_path` config and ACL for `create_transaction_atomic`, `fn_dashboard_summary`, and `fn_latest_exchange_rate`; definitions/options for `v_account_balances` and `v_net_worth`; policies on all affected tables; and triggers on transaction/account/derived tables. Also inspect extension list and `cron.job` if present. The supplied `schema-inventory.sql` covers catalog metadata; if `cron.job` exists, separately inspect its `jobid`, schedule, command and active state on the clone, then confirm no outbound jobs are enabled.

## Integrity snapshots and USD=1 diagnostic

The read-only SQL assets in `scripts/db-certification/` cover row counts and currency-separated amounts for accounts, transactions, assets, credits (including dual-currency statement/opening balances), loans/installments, receivables, payables and budgets; relation consistency; attachment reference counts; migration ledger; and functions, definitions, views, triggers, table/view grants, constraints, indexes, RLS/policies and extensions. Legacy debtor/creditor initial debts and `billing_cycles.total_to_pay` are intentionally reported as unclassified totals because those columns do not carry their own currency. The queries do not repair, update, or delete data. Use the same read-only snapshot before and after the migration and review all deltas, rather than assuming every difference is safe.

`usd-rate-one.sql` reports historical `USD -> PEN` rows with `rate = 1`, source label, and timestamp. A `source='manual'` label alone is not proof of provenance. Compare any candidate rows to approved source records/audit evidence. No automatic rewriting of historical transaction exchange rates is authorized.

After verifying a local-only target and its marker, inject its URL and marker from a protected local secret store (not a pasted command or shell history) and save artifacts in an access-restricted directory outside the repository:

```sh
node scripts/db-certification/run-local-readonly.mjs inventory /secure/cert/run-01/inventory-before.json
node scripts/db-certification/run-local-readonly.mjs preflight /secure/cert/run-01/target-before.json
node scripts/db-certification/run-local-readonly.mjs ledger /secure/cert/run-01/ledger-before.json
node scripts/db-certification/run-local-readonly.mjs snapshot /secure/cert/run-01/snapshot-before.json
node scripts/db-certification/run-local-readonly.mjs usd-rate-one /secure/cert/run-01/usd-one.tsv
# Repeat after migration to distinct *-after paths, then inspect every delta:
node scripts/db-certification/compare-snapshots.mjs /secure/cert/run-01/snapshot-before.json /secure/cert/run-01/snapshot-after.json
```

The runner rejects non-loopback hosts, requires an RFC UUID target marker that matches `current_setting('fintrack.certification_target_id')` **before running the requested SQL**, refuses to overwrite existing outputs, writes with owner-only permissions, and sets PostgreSQL's default transaction to read-only plus statement/lock timeouts. It removes the connection URL from the `psql` child environment and does not print it. The marker can itself be copied or misapplied, so the independent Docker-context/listener/no-tunnel checks above remain mandatory.

## V2/V3 client compatibility matrix

Run V2 and V3 against the **same isolated clone**, sequentially, with two synthetic users and synthetic accounts only. Capture before/after snapshots per scenario and use a clean clone for each destructive case.

| Client | Schema phase | Test |
|---|---|---|
| V2 source at checked-in `main` baseline `499c70f` | Restored pre-forward-migration baseline | Source inspection confirms this client sends the 20-argument named RPC contract (`p_budget_id`, `p_sender`, `p_recipient`, and five derived JSON values); run basic income/expense/transfer and supported derived operations, check response shape and rollback behavior. Establish baseline compatibility. |
| Same V2 source | After three forward migrations | Repeat supported operations against the converged 20-argument overload; confirm the same result contract and one transaction/one derived record. Verify the client passes a verified USD rate and rejects unavailable/unverified rates before writes; the RPC receives a numeric rate, not its provenance. |
| Legacy V2 artifact, if still deployed | After three forward migrations | Inspect that artifact's exact argument names before testing. If it uses the historical 17-argument shape, validate the wrapper, authenticated-only ACL and response shape. Do not assume every V2 build uses the wrapper. |
| V3 candidate at `621e094` | After three forward migrations | 20-arg RPC and budget/asset/credit/loan/installment/receivable/payable derivations; ownership isolation; USD rate required; PEN neutral rate; rollback on injected failure; no duplicate transaction or derived row. |
| V2 + V3 | Migrated clone | Run reads cross-client; test V2-created rows are readable in V3 and vice versa; compare JSON/RPC shapes; no stale client silently assumes missing fields. Do not run simultaneous write tests unless separately designed for idempotency/concurrency. |

For V2, use the exact owner-approved source commit/build and record its RPC argument names. The candidate's current client sends the 20-argument named contract; the migrations retain a 17-argument compatibility wrapper. Verify the selected V2 build actually invokes that wrapper and does not depend on the removed enum-backed routine; do not infer compatibility from the shared function name.

Auth/RLS test users must have distinct UUIDs. Attempt cross-user SELECT/UPDATE/DELETE and RPC writes, including impersonated `p_user_id`; require denial/no rows. Check grants as `anon`, `authenticated`, and `service_role`; verify views are `security_invoker` where intended and RLS is enabled/forced as specified.

## Restore and recovery rehearsal

1. Retain an untouched baseline clone and encrypted backup; record restore point and checksums. The working migration target must be a second disposable clone.
2. Before migration, prove the restore artifact is readable and can be restored into a third disposable isolated project. Verify Auth users/UUID relationships, schema and migration ledger; verify Storage object bytes separately.
3. Apply migration to the working clone, record start/end, exact SQL/migration versions, logs without credentials, and snapshot diffs.
4. Recovery test: discard the migrated clone and restore the untouched baseline into a fresh isolated target. Compare baseline snapshot and migration ledger exactly. Do not attempt a down migration unless a reviewed reverse migration exists; recovery is restore-to-new-target, not ad hoc SQL rollback.
5. Keep source, baseline clone, migrated clone and recovery clone isolated from each other and from public endpoints. After sign-off, securely dispose of copies according to owner policy; preserve audit evidence without row-level PII.

## Required evidence and stop conditions

Evidence: candidate SHA; source-baseline SHA; source backup timestamp/identifier (redacted); isolated target ref (not secret); PostgreSQL/Supabase CLI versions; migration ledger before/after; schema diff; object inventory; snapshots and exact diff; Auth/Storage completeness; RLS/RPC compatibility test results; restore test evidence; approval record.

Stop immediately on: inability to prove target is isolated; missing/changed migration ledger; unexpected historical version absent from files; schema drift; required object backfill without a reviewed plan; outbound integration enabled; storage files unavailable while attachment integrity is a criterion; any cross-user access; partial financial writes; unmatched ledger/snapshot; or unreviewed lock/runtime risk.

## Current execution status

- **Done:** candidate/branch checked locally; new Git bundle created and verified; migration source diff audited; read-only SQL/scripts prepared. The runner is loopback-only and now requires a matching, per-run isolated database marker, while explicitly warning that tunnels are not detectable from the URL.
- **Not run:** no `psql`, `pg_dump`, or Supabase CLI executable is available in the current environment. Docker CLI is present, but its daemon socket returned permission denied, so no local Supabase stack could be started. No database clone, data snapshot, migration, Auth/RLS test, V2/V3 compatibility test, Storage copy, or restore rehearsal has been run.
- **Still required:** owner authorization and an isolated source backup/clone; secured toolchain/credentials; execute the plan on isolated copies only. **Production remains NO-GO.**
