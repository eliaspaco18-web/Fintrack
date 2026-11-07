# FinTrack V3 continuous publishing R1

## Purpose and scope

This change prepares a repeatable Preview, certification, Stage, and Promotion path. It changes repository workflows and release verification scripts only. It does not change GitHub environment settings, Vercel variables, deployments, Supabase, migrations, Production data, Cron configuration, or the open PR #63.

The release process remains fail-closed: missing evidence, incomplete CI, an unreviewed or moved SHA, a mismatched Supabase project, an unprotected Preview URL, or a Vercel deployment that is not `READY` stops the workflow.

## Previous flow and new flow

| Area | Previous | R1 |
|---|---|---|
| Preview input | Dispatcher supplied a SHA and a branch-specific Vercel variable selected the environment. | Dispatcher supplies a PR number. A secretless job resolves an open, non-draft same-repository PR against `main`, its exact head/tree, and successful Release Candidate CI. Authorization accepts either a current exact-head approval by someone other than the PR author or an explicit owner action that repeats the exact SHA and comes from the registered owner account ID. The protected job revalidates after approval. |
| Preview environment | `vercel pull` selected a candidate branch override and checked only the public Supabase URL. | Vercel CLI pulls global Preview variables without a branch argument. An exact allowlist admits only the QA Supabase URL, public/secret keys, project ref, and V3 flag; inherited Cron, database, mail, exchange-rate, other API, and app URL variables fail closed. Both Supabase keys are probed against the QA Auth endpoint. Preview URLs use Vercel's deployment URL rather than `VERCEL_PROJECT_PRODUCTION_URL`; SSO and absence of the official Production alias are verified. |
| Repeated checks | Preview reran lint, typecheck, build, and the full unit suite. | Preview reuses successful CI for the exact current PR SHA. It runs `npm ci` and the Vercel Preview build needed to produce the deployment. Production preflight reuses CI only when the merged release tree exactly matches the successful reviewed PR tree; otherwise it runs the full suite. |
| Release class | Release kind and required migration IDs were manually maintained in YAML. | Release paths are classified from the exact release commit. Versioned additive SQL/config changes require the separate migration workflow; other changes require a protected, read-only full-ledger certification. Unknown or application-code paths default to elevated risk. |
| Stage / Promotion | Stage URL and migration run ID were manually supplied with limited linkage. | Stage requires an exact-SHA successful post-merge preflight artifact plus migration evidence and merged-PR provenance. Owner-only authorization is carried in the Stage manifest and must be repeated at Promotion; an independent exact-head approval remains an accepted route. Both workflows retain their protected environments, explicit gates, Cron confirmation and deployment checks. |

## Future operating flow

1. A PR to `main` runs `release-ci.yml` with read-only repository access, placeholder Supabase values, no Vercel secrets, and the full lint/typecheck/build/unit/release-guard suite.
2. After the PR is ready, dispatch `v3-preview.yml` from `main` with the PR number. If there is no independent reviewer, fill `owner_authorized_sha` with the exact current PR head SHA; the workflow checks the dispatching account's immutable GitHub actor ID against the registered owner ID. Otherwise leave it blank and an exact-head independent approval is accepted. The `preview` environment protection still runs and the workflow rechecks the PR, SHA, tree, authorization and CI afterward. Candidate code receives only the shared QA Supabase values after those checks.
3. After merge, run `production-preflight.yml` on the exact current `main` SHA before Stage. It reuses Release Candidate CI only when the final release tree exactly matches the reviewed PR tree. For a merge/squash result with a different tree it runs lint, typecheck, build, the complete unit/integration suite, and release guards on the final SHA. It stores a SHA/tree-bound evidence artifact required by Stage.
4. For a code-only release, dispatch `production-migration-certification.yml`. It compares every migration file in the exact tree with the linked Production ledger using `supabase migration list --linked`. The workflow is read-only; it contains no `db push` command.
5. For newly added, versioned migrations, dispatch `production-migrations.yml` with `apply_migrations=true`. This is a separate protected action. It rejects modified/deleted old migration files, compares the exact new IDs to both the linked ledger and `db push --dry-run`, applies only that set, then verifies the complete ledger. Supabase configuration-only changes fail closed for a separately reviewed process.
6. Dispatch Stage with exact release SHA, the successful certification/apply run ID, the successful `production-preflight.yml` run ID, and explicit confirmation that Production Cron Jobs are disabled. The protected `production-stage` environment and existing stage gate remain required. Stage deploys to the existing Production target without assigning a domain; it is not an isolated QA environment and must not be used for synthetic authenticated testing.
7. Dispatch Promotion with the exact release SHA, successful Stage run ID, and a fresh Cron-disabled confirmation. If Stage used owner authorization, repeat the exact release SHA through `owner_authorized_sha`; if Stage used an independent review, that verified Stage provenance remains acceptable. The protected `production-promotion` environment and existing promotion gate remain required. Promotion checks that the official Production alias still points at the Stage baseline, verifies and promotes only the exact staged deployment, then confirms the official alias resolves to that same READY deployment and SHA. The owner performs the existing post-release health observation and restores the previous Cron state. If health monitoring fails, use Vercel Instant Rollback to the prior deployment; preserve Stage, preflight and Promotion evidence.

The workflows keep `FINTRACK_PRODUCTION_MIGRATIONS_ENABLED`, `FINTRACK_PRODUCTION_STAGE_ENABLED`, and `FINTRACK_PRODUCTION_PROMOTION_ENABLED` as explicit gates. No gate or GitHub environment is removed or weakened by this PR. The stage and promotion dispatches require an explicit Cron-disabled confirmation; they do not alter Vercel Cron settings.

## Shared isolated Preview configuration (one-time remote setup, not performed here)

Before the first Preview dispatch, the owner must provision and independently verify a dedicated non-Production Supabase QA project. Populate the **global Preview target** in the Vercel `fintrack` project with exactly these QA-only values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (QA only; never Production)
- `NEXT_PUBLIC_FINTRACK_V3_SHELL=1`
- Do not add Production URL variables, `CRON_SECRET`, database passwords/URLs, `RESEND_*`, `EXCHANGE_RATE_*`, or other external-service credentials to the shared Preview environment. Preview intentionally fails closed if a sixth project variable appears. Email and external API integrations remain unavailable until separately designed with QA/sandbox credentials.

Configure the GitHub `preview` environment with `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `PREVIEW_SUPABASE_PROJECT_REF`; put `VERCEL_TOKEN` in that environment as a narrowly scoped secret where the Vercel plan permits. Set required reviewers on `preview` before its first use. Retain Vercel Authentication / SSO for deployment URLs.

The workflow intentionally does **not** pass `--git-branch` to `vercel pull`, so branch-specific Vercel overrides are not selected. Existing overrides remain untouched during the transition. After the common QA target has been verified in Vercel and a successful Preview demonstrates that the shared variables are used, the owner can authorize a separate cleanup of old branch overrides. This PR does not read, edit, or delete Vercel variables. The application resolves Preview auth links using `VERCEL_URL` and ignores `VERCEL_PROJECT_PRODUCTION_URL` while `VERCEL_ENV=preview`.

The Supabase guard supports project-scoped legacy JWT keys and current `sb_publishable_` / `sb_secret_` key formats. It checks JWT project/role claims when available and sends read-only GET requests to the configured Preview Auth settings endpoint. Opaque `sb_*` API keys are sent only in the `apikey` header; legacy JWT keys also receive the bearer header. Any rejected or unrecognized credential stops the build; no Supabase data query or write is performed by this check.

## Risk classification and evidence

- `code-only`: no SQL or Supabase config paths in the exact release change. The migration certification must show a complete, synchronized local/remote ledger and records `db_push_executed: false`.
- `migration`: newly added versioned SQL migrations or Supabase config changes. Existing versioned migration files cannot be edited or removed. A migration release requires the explicit protected apply workflow and a successful post-apply ledger digest.
- `standard`: documentation or static visual assets only.
- `elevated`: application, API, Supabase function, middleware, unknown, or otherwise unclassified paths. This is the default for uncertain code. Financial/auth/server paths are flagged `financial_sensitive`; the full PR CI suite, an exact-head independent approval or explicit owner SHA authorization, exact-SHA preflight, protected Stage/Promotion approvals, and release evidence remain mandatory.

The evidence artifacts contain only commit/tree IDs, migration version IDs and hashes, CI/PR run references, Vercel deployment metadata, and result states. They contain no environment values or tokens. Artifacts expire after 14 days.

## Protection verification status

The workflow code preserves all four environment names: `preview`, `production-migrations`, `production-stage`, and `production-promotion`, plus the existing three Production gate variables. Owner authorization is tied to the repository owner's immutable GitHub actor ID (`268006031`) and the exact SHA; it does not bypass environment protection. The private-repository API was unavailable for reading required-reviewer lists or branch protection, so no claim is made that the owner can approve the current remote environments. If an environment's `Prevent self-review` rule or reviewer list excludes the dispatching owner, GitHub will still block the owner-only path; resolving that requires a later, explicitly authorized remote settings change. No settings were changed. The Draft PR does not prove environment rules exist. Keep all current gate variables until required reviewers/status checks are verified and an approved end-to-end run succeeds.

Vercel project SSO was previously confirmed enabled through read-only inspection. The new Preview workflow also fails if the Vercel project API no longer reports the expected SSO protection, if the deployment is not `READY`/Preview/exact-SHA, or if an unauthenticated request reaches the generated URL.

## Deferred remote operations requiring later authorization

No remote configuration has been changed in this R1. A later approved transition must:

1. Provision and validate the isolated Supabase QA project and put only its credentials in the global Vercel Preview environment.
2. Verify GitHub required reviewers for `preview`, `production-migrations`, `production-stage`, and `production-promotion`; verify the required PR checks and private-repository token permissions.
3. Verify that the configured protected-environment reviewers allow the sole owner to complete an owner-dispatched run where that is the approved process. Do not remove the environments or their protections; any reviewer/self-review setting change requires separate authorization.
4. Add/verify the `preview` environment values and secret, then run an approved low-risk Preview canary.
5. Inspect all global Preview variables without exposing values in logs. Keep only the five allowlisted QA variables; any unknown variable blocks Preview. Compare branch-specific Vercel overrides separately and delete obsolete overrides only after explicit owner approval.
6. Keep Cron Jobs disabled only for the approved Production Stage/Promotion observation window; restore their prior state after verification.

There is no need to alter Supabase schema, RLS, data, Production environment variables, Vercel project SSO, or Vercel Ignored Build Step as part of this repository change.

## Rollback

- **Preview:** stop or cancel the dispatch; no production domain is assigned. Remove the isolated Preview deployment through the normal Vercel UI if retention cleanup is desired.
- **Code-only Production release:** use Vercel Instant Rollback to restore the previous deployment, then revert the PR through a new reviewed PR if source correction is needed.
- **Migration release:** a Vercel rollback does not reverse database changes. The migration must be additive/backward-compatible and any data/schema reversal requires a new reviewed migration and a separate protected authorization. The workflow deliberately provides no automatic SQL rollback.
- **This PR:** revert the workflow/script/doc commit through a normal PR. Since this change does not execute deployments or edit remote settings, reverting code restores the previous process; it does not require Supabase recovery.
