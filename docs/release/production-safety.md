# Production release safety gates

This release path is deliberately split into preflight, database migration, staged deployment, and domain promotion. Production workflows are dispatch-only. The sole `pull_request` workflow is secret-free CI with read-only repository permission; it cannot migrate, deploy, or promote. The old `release:production` script and combined release workflow are removed; the local replacement is read-only and cannot commit, push, migrate, deploy, promote, or dispatch Actions. The generic `db:push` package shortcut is replaced with an explicitly local-only `db:push:local`.

## Required GitHub configuration (owner action)

Before merging this safeguard branch, disable the currently enabled `Production Release` workflow in GitHub Actions; its `main` copy still defaults both migrations and deploy to true. Create these environments and configure each to allow deployments from `main` only. Require an independent reviewer for each environment, prevent administrators from bypassing the protection rule, and restrict Actions write access to release maintainers:

- `production-migrations`: required reviewer; only `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`; variable `PRODUCTION_SUPABASE_PROJECT_REF` must equal the verified Production ref and `FINTRACK_PRODUCTION_MIGRATIONS_ENABLED=1`.
- `production-stage`: required reviewer; only Vercel deployment credentials/IDs; `FINTRACK_PRODUCTION_STAGE_ENABLED=1`; set `FINTRACK_PRODUCTION_CRONS_DISABLED=1` only after disabling Vercel Cron Jobs in project settings.
- `production-promotion`: a different required reviewer/approval; only the Vercel token and project/team IDs; `FINTRACK_PRODUCTION_PROMOTION_ENABLED=1`.

The code fails closed when the environment gate variables are absent or incorrect. GitHub Environment reviewers and branch restrictions are remote settings: YAML cannot create or prove them. Do not put the Supabase service-role key, Resend credentials, or database password into build/test jobs. Keep `main` protected against direct pushes, force pushes, deletion, and unreviewed merges; require the `Release Candidate CI (No Production Access) / checks` pull-request status check and owner review. The manual production preflight is an additional exact-SHA check after merge, not a pull-request check.

## Required Vercel configuration (owner action)

Git integration can create deployments directly from commits independently of GitHub Actions. Before merging even this safeguards PR, configure the FinTrack Vercel project so Git-triggered Production builds are ignored (the Ignored Build Step must return exit code 0 for `VERCEL_ENV=production`) and verify this setting in the dashboard. Keep Preview deployments connected only to the isolated QA Supabase project. Do not assume a workflow edit or `vercel.json` disables Vercel's Git integration.

The staging workflow pulls the Vercel Production build environment, then replaces the file with an allowlist of public build variables and the non-secret V3 flag before `vercel build`. It fails closed unless the pulled V3 flag is `0`/absent for the bridge or exactly `1` for V3, then writes that explicit value. Runtime-only service-role, mail, exchange-rate, and database secrets do not enter the build process. It also requires a separate GitHub gate asserting Vercel Cron Jobs are disabled. This matters because Vercel invokes configured Cron Jobs on Production-target deployments even when `--skip-domain` prevents custom-domain assignment. Keep crons disabled through stage, smoke checks, and domain promotion; enable them only after verifying the promoted deployment and schedule. The workflow deliberately uses `vercel deploy --prebuilt --prod --skip-domain`; this creates a Production-targeted deployment without assigning custom domains. A separate environment-protected workflow verifies the deployment's project, READY state, target, and Git SHA via Vercel's deployment API before `vercel promote` assigns domains. Keep Vercel deployment protection on for the unaliased staged URL.

The workflows do not edit Vercel environment variables. For the V2 bridge, keep the V3 shell production switch off. For V3, the owner must separately authorize and set `FINTRACK_V3_SHELL_PRODUCTION=1` in the Production environment before staging the reviewed V3 SHA. Confirm the result against the staged deployment before authorizing domain promotion.

## Order to release the V2 bridge, then V3

1. Owner configures the GitHub and Vercel controls above, disables Vercel Cron Jobs, and verifies that a harmless Git-triggered Production event is skipped. Stop if Vercel still builds or assigns a Production domain. Keep Preview variables isolated to QA Supabase.
2. Review and merge only the V2 FX/atomicity bridge PR to `main`. The merge must not trigger a Production deployment. Run `production-preflight.yml` for the exact merge SHA; this workflow has no Production secrets.
3. Dispatch `production-stage.yml` for the bridge SHA, approve the `production-stage` environment, inspect its exact deployment, and separately dispatch `production-promote.yml` only after the V2 smoke checks. The live database schema remains unchanged during this step.
4. Review and merge the V3 integration PR. Do not reuse the original candidate SHA as the release SHA if bridge integration changes the resulting merge tree. Keep the live V2 bridge serving traffic.
5. On an isolated restored copy, certify the migration set first. Then dispatch `production-migrations.yml` for the exact V3 migration-bearing SHA. The workflow only proceeds when the reviewed CLI dry-run contains exactly `20261025000001`, `20261025000002`, and `20261026000001`; it runs normal `db push` without `--include-all`. Stop on any additional, missing, duplicated, or unexpected migration.
6. Stage that exact V3 SHA with `production-stage.yml`, verify read-only smoke checks and the production-shell flag, then obtain the separate `production-promotion` approval. Promotion does not rebuild the artifact.

## Stop and recovery rules

- Any mismatch in SHA, project ref, migration dry-run, staged Vercel project, deployment state, or deployment Git SHA stops the workflow before its mutating step.
- If the bridge stage fails, do not promote; the old V2 deployment remains live.
- If the V3 migration fails, leave the V2 bridge deployed and stop. Do not repair migration history or retry a partial plan without inspecting the actual database state.
- If V3 staging or smoke checks fail after migrations, do not promote. Keep the V2 bridge deployment live; it is the compatibility fallback for the nullable-rate schema. Do not reverse migrations as an application rollback.
- After domain promotion, rollback is a separately authorized promotion of the last known-good deployment. Database restoration is a separate incident action based on the verified backup and restore rehearsal.

## Local preflight command

From a clean local checkout of `main` at the exact reviewed release SHA:

```sh
npm run release:preflight -- <full-40-character-sha>
```

This command only verifies branch, clean worktree, exact SHA, and local `origin/main` ancestry. It performs no release action.
