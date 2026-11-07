# FinTrack V3 continuous publishing R1

## Purpose and scope

This change prepares a repeatable Preview, certification, Stage, and Promotion path. It changes repository workflows and release verification scripts only. It does not change GitHub environment settings, Vercel variables, deployments, Supabase, migrations, Production data, Cron configuration, or the open PR #63.

The release process remains fail-closed: missing evidence, incomplete CI, an unreviewed or moved SHA, a mismatched Supabase project, an unprotected Preview URL, or a Vercel deployment that is not `READY` stops the workflow.

## Previous flow and new flow

| Area | Previous | R1 |
|---|---|---|
| Preview input | Dispatcher supplied a SHA and a branch-specific Vercel variable selected the environment. | Dispatcher supplies a PR number. A secretless job resolves the open, non-draft PR against `main`, exact head/tree, an exact-head approval, and the latest successful Release Candidate CI run. The protected job revalidates all four after approval. |
| Preview environment | `vercel pull` selected a candidate branch override and checked only the public Supabase URL. | Vercel CLI pulls shared Preview variables with no branch argument. The workflow checks the URL, project ref, anon/service credentials, V3 shell, forbidden database credentials, and read-only access to a QA Auth settings endpoint. It checks project SSO before deployment and verifies the deployment is protected afterward. |
| Repeated checks | Preview reran lint, typecheck, build, and the full unit suite. | Preview reuses successful CI for the exact current PR SHA. It runs `npm ci` and the Vercel Preview build needed to produce the deployment. Production preflight reuses CI only when the merged release tree exactly matches the successful reviewed PR tree; otherwise it runs the full suite. |
| Release class | Release kind and required migration IDs were manually maintained in YAML. | Release paths are classified from the exact release commit. Versioned additive SQL/config changes require the separate migration workflow; other changes require a protected, read-only full-ledger certification. Unknown or application-code paths default to elevated risk. |
| Stage / Promotion | Stage URL and migration run ID were manually supplied with limited linkage. | Stage proves the exact merged PR approval, CI run, tree and ledger artifact, then binds them to Vercel project/deployment ID, URL, `READY` state and metadata. Promotion accepts only the artifact from a successful protected Stage run and re-verifies the Vercel deployment immediately before and after promotion. |

## Future operating flow

1. A PR to `main` runs `release-ci.yml` with read-only repository access, placeholder Supabase values, no Vercel secrets, and the full lint/typecheck/build/unit/release-guard suite.
2. After the PR is ready and an approval is recorded on its current head, dispatch `v3-preview.yml` from `main` with the PR number. The GitHub `preview` environment reviewer approves the job. It rechecks the SHA, tree, CI and review after approval. Preview code receives only the shared QA Supabase environment and a Vercel Preview deployment token.
3. After merge, run `production-preflight.yml` for the exact main SHA if a separate preflight is desired. It reuses the PR check only when the git tree is identical and the approval/CI evidence can be re-read. Otherwise it runs every check on the exact release checkout.
4. For a code-only release, dispatch `production-migration-certification.yml`. It compares every migration file in the exact tree with the linked Production ledger using `supabase migration list --linked`. The workflow is read-only; it contains no `db push` command.
5. For newly added, versioned migrations, dispatch `production-migrations.yml` with `apply_migrations=true`. This is a separate protected action. It rejects modified/deleted old migration files, compares the exact new IDs to both the linked ledger and `db push --dry-run`, applies only that set, then verifies the complete ledger. Supabase configuration-only changes fail closed for a separately reviewed process.
6. Dispatch Stage with exact release SHA, the successful certification/apply run ID, and explicit confirmation that Production Cron Jobs are disabled. The protected `production-stage` environment and existing stage gate remain required. Stage deploys to the existing Production target without assigning a domain; it is not an isolated QA environment and must not be used for synthetic authenticated testing.
7. Dispatch Promotion with the exact release SHA, successful Stage run ID, and a fresh Cron-disabled confirmation. The protected `production-promotion` environment and existing promotion gate remain required. Promotion first confirms that the official Production alias still points at the Stage baseline, then verifies the exact staged deployment, promotes it, and confirms the official alias resolves to that same READY deployment and SHA. The owner performs the existing post-release log/health observation and restores the previous Cron state. If health monitoring fails, use Vercel Instant Rollback to the prior deployment; preserve the Stage and Promotion evidence.

The workflows keep `FINTRACK_PRODUCTION_MIGRATIONS_ENABLED`, `FINTRACK_PRODUCTION_STAGE_ENABLED`, and `FINTRACK_PRODUCTION_PROMOTION_ENABLED` as explicit gates. No gate or GitHub environment is removed or weakened by this PR. The stage and promotion dispatches require an explicit Cron-disabled confirmation; they do not alter Vercel Cron settings.

## Shared isolated Preview configuration (one-time remote setup, not performed here)

Before the first Preview dispatch, the owner must provision and independently verify a dedicated non-Production Supabase QA project. Populate the **global Preview target** in the Vercel `fintrack` project with the QA-only values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (QA only; never Production)
- `NEXT_PUBLIC_FINTRACK_V3_SHELL=1`
- Any other Preview-only credentials required by existing server-rendered routes, such as QA mail or exchange-rate keys. Do not copy Production credentials.

Configure the GitHub `preview` environment with `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `PREVIEW_SUPABASE_PROJECT_REF`; put `VERCEL_TOKEN` in that environment as a narrowly scoped secret where the Vercel plan permits. Set required reviewers on `preview` before its first use. Retain Vercel Authentication / SSO for deployment URLs.

The workflow intentionally does **not** pass `--git-branch` to `vercel pull`, so branch-specific Vercel overrides are not selected. Existing overrides remain untouched during the transition. After the common QA target has been verified in Vercel and a successful Preview demonstrates that the shared variables are used, the owner can authorize a separate cleanup of old branch overrides. This PR does not read, edit, or delete Vercel variables.

The Supabase guard supports project-scoped legacy JWT keys and current `sb_publishable_` / `sb_secret_` key formats. It checks JWT project/role claims when available and sends read-only GET requests to the configured Preview Auth settings endpoint. Opaque `sb_*` API keys are sent only in the `apikey` header; legacy JWT keys also receive the bearer header. Any rejected or unrecognized credential stops the build; no Supabase data query or write is performed by this check.

## Risk classification and evidence

- `code-only`: no SQL or Supabase config paths in the exact release change. The migration certification must show a complete, synchronized local/remote ledger and records `db_push_executed: false`.
- `migration`: newly added versioned SQL migrations or Supabase config changes. Existing versioned migration files cannot be edited or removed. A migration release requires the explicit protected apply workflow and a successful post-apply ledger digest.
- `standard`: documentation or static visual assets only.
- `elevated`: application, API, Supabase function, middleware, unknown, or otherwise unclassified paths. This is the default for uncertain code. Financial/auth/server paths are flagged `financial_sensitive`; the full PR CI suite, exact-head reviewer approval, protected Stage/Promotion approvals, and exact-tree evidence remain mandatory.

The evidence artifacts contain only commit/tree IDs, migration version IDs and hashes, CI/PR run references, Vercel deployment metadata, and result states. They contain no environment values or tokens. Artifacts expire after 14 days.

## Protection verification status

The workflow code preserves all four environment names: `preview`, `production-migrations`, `production-stage`, and `production-promotion`, plus the existing three Production gate variables. The GitHub private-repository API was not reachable with the available GitHub credential in this session, so the current required-reviewer lists and required status checks could not be independently read. No settings were changed. The Draft PR must not be treated as proof that the environment rules exist; before dispatching Preview or a release workflow, the owner must verify required reviewers and branch protection in GitHub. The existing gate variables remain in place until that verification and an end-to-end approved run demonstrate the alternate approvals.

Vercel project SSO was previously confirmed enabled through read-only inspection. The new Preview workflow also fails if the Vercel project API no longer reports the expected SSO protection, if the deployment is not `READY`/Preview/exact-SHA, or if an unauthenticated request reaches the generated URL.

## Deferred remote operations requiring later authorization

No remote configuration has been changed in this R1. A later approved transition must:

1. Provision and validate the isolated Supabase QA project and put only its credentials in the global Vercel Preview environment.
2. Verify GitHub required reviewers for `preview`, `production-migrations`, `production-stage`, and `production-promotion`; verify the required PR checks and private-repository token permissions.
3. Add/verify `preview` environment values and secret, then run an approved low-risk Preview canary.
4. Compare the current branch-specific Vercel overrides to the shared QA values. Delete obsolete overrides only after explicit owner approval.
5. Keep Cron Jobs disabled only for the approved Production Stage/Promotion observation window; restore their prior state after verification.

There is no need to alter Supabase schema, RLS, data, Production environment variables, Vercel project SSO, or Vercel Ignored Build Step as part of this repository change.

## Rollback

- **Preview:** stop or cancel the dispatch; no production domain is assigned. Remove the isolated Preview deployment through the normal Vercel UI if retention cleanup is desired.
- **Code-only Production release:** use Vercel Instant Rollback to restore the previous deployment, then revert the PR through a new reviewed PR if source correction is needed.
- **Migration release:** a Vercel rollback does not reverse database changes. The migration must be additive/backward-compatible and any data/schema reversal requires a new reviewed migration and a separate protected authorization. The workflow deliberately provides no automatic SQL rollback.
- **This PR:** revert the workflow/script/doc commit through a normal PR. Since this change does not execute deployments or edit remote settings, reverting code restores the previous process; it does not require Supabase recovery.
