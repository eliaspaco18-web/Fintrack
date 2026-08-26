# Authenticated QA Setup — Isolated Preview Only

## Purpose and current decision

This document defines the only supported target for FinTrack authenticated E2E: a disposable Vercel Preview deployment connected to a disposable, non-production Supabase project and a dedicated E2E user.

**Package decision: PARTIALLY READY.** The repository harness is ready to reject unsafe targets and run the existing authenticated suites after an owner provides that external target. It does not create a Supabase project, Vercel deployment, user, or secret. Until those inputs exist and are independently verified, authenticated evidence remains blocked and Gate 1 remains open.

## Safety contract

Authenticated tests create, edit, deactivate, resolve, and delete financial and catalog records. They must never run against production or against a shared environment whose data must be preserved.

The authenticated Playwright configuration fails before login unless all of the following are true:

- the target is explicitly declared as `preview`;
- the target is an HTTPS origin and not localhost;
- the URL host exactly matches an independently supplied expected host;
- every production host is listed and the target is not one of them;
- the login flow remains on the approved Preview origin before credentials are entered and after authentication;
- a QA Supabase project ref is declared and differs from every listed production project ref;
- isolated mutations and the disposable-QA acknowledgement are explicitly enabled;
- both dedicated E2E credentials are present in the process environment.

These values are runtime process variables only. Do not add them to a tracked file and do not place secrets in this document, GitHub issues, PR text, test output, or screenshots.

## Owner-provided infrastructure

### 1. Disposable Supabase project

Create or designate a Supabase project used only for FinTrack QA. It must not contain production users or production financial records.

Using the separately approved database deployment procedure:

1. apply the same schema and RLS contract currently approved for the app;
2. configure only fictitious reference data required by the tested flows;
3. create one dedicated E2E user in Supabase Auth;
4. record the QA project ref and every production project ref for the preflight comparison;
5. define a reset or deletion procedure for the complete disposable dataset after a run.

This package does not apply schema, migrations, or RLS and does not create the project or user.

### 2. Vercel Preview deployment

Create a Preview deployment from the branch or commit under test. Configure its Preview-only environment variables to point to the disposable Supabase project. Do not copy production Supabase values into the Preview environment.

Before running E2E, verify in the Vercel project settings that:

- `NEXT_PUBLIC_SUPABASE_URL` identifies the QA project ref;
- the Preview deployment is not promoted or aliased to a production hostname;
- production-only secrets and integrations are absent or replaced with QA-safe values;
- the deployment URL and commit are the intended QA target;
- the deployment is healthy.

The repository cannot introspect the private Vercel environment of a remote deployment, so this owner verification is mandatory.

## Runtime variables

Export these values in the current terminal session. Replace every `replace-*` value. Do not commit them.

```bash
export E2E_TARGET_ENV="preview"
export E2E_BASE_URL="https://replace-with-preview-host"
export E2E_EXPECTED_HOST="replace-with-preview-host"
export E2E_PRODUCTION_HOSTS="replace-with-prod-host-1,replace-with-prod-host-2"
export E2E_QA_SUPABASE_PROJECT_REF="replace-with-qa-project-ref"
export E2E_PRODUCTION_SUPABASE_PROJECT_REFS="replace-with-prod-ref-1,replace-with-prod-ref-2"
export E2E_ALLOW_ISOLATED_MUTATIONS="1"
export E2E_QA_CONFIRMATION="DISPOSABLE_QA_ONLY"
export E2E_USER_EMAIL="replace-with-dedicated-e2e-user"
printf "Dedicated E2E password: "
IFS= read -r -s E2E_USER_PASSWORD
printf "\n"
export E2E_USER_PASSWORD
```

`E2E_PRODUCTION_HOSTS` must include all custom production domains and production deployment aliases. `E2E_PRODUCTION_SUPABASE_PROJECT_REFS` must include every production Supabase project used by FinTrack.

## Execution order

1. Confirm the Preview commit, URL, QA Supabase ref, and dedicated user with the owner.
2. Export the variables above in an ephemeral terminal session.
3. Run the focused guard evidence:

   ```bash
   npm run test:unit -- tests/unit/authenticated-qa-target.spec.ts
   ```

4. Run authenticated smoke first:

   ```bash
   npm run test:e2e:authenticated:qa -- tests/e2e/authenticated-smoke.spec.ts
   ```

5. Run the focused Portfolio identity suite, which owns cleanup for its records:

   ```bash
   npm run test:e2e:authenticated:qa -- tests/e2e/authenticated-portfolio-identity.spec.ts
   ```

6. Run the remaining authenticated suite only after confirming the target can be reset. Some older management tests create cross-module fixtures and do not yet provide deterministic cleanup for every successful or interrupted path:

   ```bash
   npm run test:e2e:authenticated:qa
   ```

7. Capture the commit SHA, Preview deployment URL, test command, result counts, and failed trace identifiers. Do not capture credentials or private URLs returned for attachments.
8. Reset or delete the disposable QA data according to the approved target procedure.
9. Remove the sensitive variables from the terminal session:

   ```bash
   unset E2E_USER_EMAIL E2E_USER_PASSWORD
   ```

## Portfolio helper correction

The management helper was stale because it used the removed free-text `portfolio-institution-input`. Portfolio now uses the reference-data-backed `portfolio-bank-entity-select`. The helper now verifies that current selector and leaves the optional association at `Sin banco`; tests that require a bank create and select a catalog entity explicitly.

## Evidence available without external credentials

The repository can currently prove:

- unsafe or incomplete target declarations fail closed before login;
- production host and production Supabase-ref matches are rejected;
- localhost, HTTP, host mismatch, missing denylists, and absent confirmation are rejected;
- guard errors do not expose credentials;
- unauthenticated login, redirect, and API-boundary tests remain executable locally;
- authenticated specs remain skipped in the ordinary E2E suite when no credentials are present.

It cannot currently prove authenticated module loading, mutations, retries, persistence, or cross-module state against a real deployment because no approved disposable target or credentials are configured in this repository session.

## Failure and incident procedure

- If preflight fails, do not bypass or weaken the guard. Correct the target declaration or stop.
- If the Preview is discovered to use production Supabase, stop immediately without logging in and rotate any credential exposed to the wrong target.
- If a test times out after a mutation, treat its result as uncertain, preserve the trace, and reset the disposable target before retrying.
- If reset cannot be confirmed, do not run the broad management suite.

## Rollback

Rollback consists of reverting the harness commit. It changes test configuration, helpers, documentation, and scripts only; production runtime behavior and persisted data are unaffected.
