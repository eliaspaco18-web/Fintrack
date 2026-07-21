# MASTER_DECISIONS_REQUIRED.md

## Purpose

This file lists only decisions that require owner approval. Implementation should not proceed on these items until approved.

Source of truth: `MASTER_STABILITY_AUDIT.md`.

## Decisions

### DECISION-01: Middleware auth/session optimization

- Severity: high
- Affected area: `middleware.ts`
- Decision needed: May we reorder middleware so API/static/auth-callback pass-through routes avoid Supabase `getUser()` when auth is not needed?
- Why approval is required: This changes authentication/session middleware behavior.
- Recommendation: Approve a narrow performance fix only after Phase A portfolio work, with auth redirect and authenticated smoke regression tests.

### DECISION-02: Dashboard API/bootstrap contract

- Severity: high
- Affected area: `components/dashboard/DashboardWorkspace.tsx`, dashboard widgets, `app/api/dashboard/*`
- Decision needed: Should dashboard optimization preserve all current endpoint contracts, or may it introduce a consolidated bootstrap endpoint/contract?
- Why approval is required: Endpoint response shape changes are API contract changes.
- Recommendation: First attempt internal SWR fallback/cache reuse without changing endpoint contracts.

### DECISION-03: Portfolio server/API loader unification

- Severity: high
- Affected area: `app/(dashboard)/portfolio/page.tsx`, `app/api/accounts/route.ts`
- Decision needed: If the client-loaded portfolio fix is not enough, may we unify page/API account-loading logic through a shared server helper?
- Why approval is required: It can affect server data-access behavior and API compatibility assumptions.
- Recommendation: Implement the safer client-loaded portfolio fix first; defer server/API unification unless Vercel evidence shows it is still needed.

### DECISION-04: Account PATCH response contract

- Severity: medium
- Affected area: `app/api/accounts/[id]/route.ts`
- Decision needed: Should account PATCH responses include joined `bank_entity`, or return only scalar account fields plus `bank_entity_id`?
- Why approval is required: This is an API contract decision.
- Recommendation: Return joined `bank_entity` for parity with account list/GET responses, but implement only in a focused API-contract PR.

### DECISION-05: Currency fallback behavior

- Severity: medium
- Affected area: portfolio currency selector and `user_currencies`
- Decision needed: If `user_currencies` fails to load, should portfolio creation allow only PEN/USD fallback, block saving, or show a warning while allowing fallback?
- Why approval is required: This affects financial data correctness for multi-currency users.
- Recommendation: Allow PEN/USD fallback only with a visible warning and retry; do not silently hide custom currencies.

### DECISION-06: Attachment failure policy

- Severity: medium
- Affected area: transaction, asset, and credit attachment flows
- Decision needed: Should attachment upload failure block the main record creation, or should the record save and show a warning that the file was not attached?
- Why approval is required: This is product behavior for financial records and supporting evidence.
- Recommendation: Let the financial record save, but show a persistent warning and retry path for the attachment where feasible.

### DECISION-07: Authenticated E2E test data strategy

- Severity: medium
- Affected area: Playwright tests, Supabase preview/test data
- Decision needed: Can we create or use a dedicated Supabase test user/project with resettable data for authenticated E2E?
- Why approval is required: Tests create financial data and require credentials.
- Recommendation: Use a preview/test user and document cleanup/reset steps.

### DECISION-08: Supabase read-only verification

- Severity: high
- Affected area: Supabase preview/production project
- Decision needed: Can we run read-only RLS, migration, and query-plan checks against a Supabase clone or approved production window?
- Why approval is required: It requires credentialed access and touches live data-access verification.
- Recommendation: Use a Supabase preview/clone first; production read-only only after backup and explicit approval.

### DECISION-09: Supabase schema, RLS, or index changes

- Severity: high
- Affected area: `supabase/migrations/*`, Supabase policies/indexes
- Decision needed: Approve or reject any future migration for missing indexes, schema hardening, or RLS policy corrections discovered during verification.
- Why approval is required: Schema and RLS changes are explicitly approval-gated.
- Recommendation: Review each migration separately with rollback notes and Vercel/Supabase test evidence.

### DECISION-10: Vercel environment changes

- Severity: high
- Affected area: Vercel preview/production environment variables, cron, deployment settings
- Decision needed: May we change Vercel env vars or deployment settings if preview/production parity issues are found?
- Why approval is required: Environment changes can affect production financial SaaS behavior.
- Recommendation: Compare and document first; change only one setting at a time after approval.

### DECISION-11: Release workflow and database script guardrails

- Severity: medium
- Affected area: `.github/workflows/production-release.yml`, `package.json`, release scripts
- Decision needed: Should production release defaults and database scripts require stronger branch/environment/confirmation guardrails?
- Why approval is required: This is production process policy.
- Recommendation: Add guardrails before the next production release task.

### DECISION-12: API error envelope standardization

- Severity: medium
- Affected area: `app/api/**/*/route.ts`, `lib/api/response.ts`
- Decision needed: Should API standardization preserve the current `{ ok, data/error }` shape exactly, or may status codes/detail fields be adjusted?
- Why approval is required: Any payload/status change can affect frontend consumers and tests.
- Recommendation: Preserve the current envelope shape during Phase 1; only improve message mapping and consistency.

### DECISION-13: Starting Phase 2 redesign

- Severity: high
- Affected area: all UI modules
- Decision needed: May redesign begin before Phase A-D stabilization is complete?
- Why approval is required: Repo rules say no redesign while critical bugs remain.
- Recommendation: Do not start redesign until portfolio direct-load, dashboard cold-load, module states, CTA audit, and QA readiness are signed off or explicitly accepted as known risks.
