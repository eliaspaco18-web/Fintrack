# IMPLEMENTATION_PLAN.md

## Purpose

This plan is for Phase 1 stabilization only. It does not include redesign work, broad refactors, database schema changes, Supabase RLS changes, authentication changes, or API contract changes without approval.

## Phase 1 Recommended Order

### Step 1: Fix visible broken actions

- Severity: High
- Scope: Bug fixing only.
- Target issues: `HIGH-02`, `HIGH-PORT-03`.
- Recommended work: Align topbar portfolio quick-create link with `PortfolioManager` query handling.
- Files likely affected: `components/layout/Topbar.tsx` or `components/management/PortfolioManager.tsx`.
- Risk: Low.
- Requires approval: No unless product wants a new query contract.
- How to test: Click topbar "Nuevo portafolio" and verify modal opens.
- Rollback notes: Revert the single link/handler change.

### Step 2: Make portfolio loading failures visible

- Severity: High
- Scope: Bug fixing only.
- Target issues: `HIGH-01`, `HIGH-PORT-01`.
- Recommended work: Pass portfolio preload error state into the client or show server-side error UI. Do not change schema/RLS.
- Files likely affected: `app/(dashboard)/portfolio/page.tsx`, `components/management/PortfolioManager.tsx`.
- Risk: Low to medium.
- Requires approval: No for UI-only error state.
- How to test: Simulate failed preload and verify visible error/retry state.
- Rollback notes: Revert error-state props/UI changes.

### Step 3: Align portfolio preload with API fallback behavior

- Severity: High
- Scope: Bug fixing / data access consistency.
- Target issues: `HIGH-PORT-02`, `MEDIUM-PORT-03`.
- Recommended work: Share account-list loading logic between the page and `/api/accounts`, or make server preload use equivalent fallback logic.
- Files likely affected: `app/(dashboard)/portfolio/page.tsx`, `app/api/accounts/route.ts`, possibly a new server helper.
- Risk: Medium.
- Requires approval: Yes if this changes API contracts or requires confirming production schema state.
- How to test: Compare page preload data and `/api/accounts?include_inactive=true`.
- Rollback notes: Revert shared helper/preload changes.

### Step 4: Resolve the portfolio UX/test contract

- Severity: High
- Scope: Product/QA decision, then test or UX update.
- Target issues: `HIGH-05`, `HIGH-PORT-04`.
- Recommended work: Decide whether `/portfolio` should show a closed list view or auto-open create form. Update tests or UX accordingly.
- Files likely affected after approval: `tests/e2e/authenticated-smoke.spec.ts` or portfolio UI route behavior.
- Risk: Low for test update; medium for UX change.
- Requires approval: Yes.
- How to test: Run authenticated smoke suite.
- Rollback notes: Revert test/UX change.

### Step 5: Reduce slow module loading caused by middleware overhead

- Severity: High
- Scope: Performance/auth middleware bug fix.
- Target issues: `HIGH-03`, `HIGH-PERF-01`.
- Recommended work: Reorder middleware route classification and safe pass-through returns before Supabase `getUser()` where possible.
- Files likely affected: `middleware.ts`.
- Risk: Medium.
- Requires approval: Yes because this touches auth/session behavior.
- How to test: Run auth redirect E2E, authenticated smoke, and compare API request timings.
- Rollback notes: Revert middleware reorder.

### Step 6: Reduce dashboard request duplication

- Severity: High
- Scope: Performance bug fixing only; no redesign.
- Target issues: `HIGH-04`, `HIGH-PERF-02`, `HIGH-PERF-03`, `MEDIUM-01`.
- Recommended work: Remove unused dashboard exchange-rate fetch or wire it correctly; consolidate dashboard bootstrap data without changing external contracts.
- Files likely affected: `app/(dashboard)/dashboard/page.tsx`, `components/dashboard/DashboardClient.tsx`, `components/dashboard/DashboardWorkspace.tsx`, dashboard API routes.
- Risk: Medium.
- Requires approval: Yes if API contracts change; otherwise no.
- How to test: Compare cold `/dashboard` load and server logs before/after.
- Rollback notes: Revert dashboard bootstrap changes.

### Step 7: Standardize account PATCH response

- Severity: High/Medium
- Scope: API contract decision.
- Target issues: `HIGH-06`, `MEDIUM-PORT-01`.
- Recommended work: Decide whether PATCH returns joined `bank_entity`; then update implementation and tests.
- Files likely affected: `app/api/accounts/[id]/route.ts`, portfolio tests.
- Risk: Medium.
- Requires approval: Yes, API contract.
- How to test: PATCH account and assert response shape.
- Rollback notes: Revert API response selection change.

### Step 8: Production Supabase verification

- Severity: Medium/High
- Scope: Read-only verification first.
- Target issues: RLS/index/schema consistency.
- Recommended work: In a clone or approved read-only production window, verify migrations, RLS policies, and query plans for slow portfolio/dashboard/module queries.
- Files likely affected: None for verification; possible future migration files only after approval.
- Risk: Medium to high if touching production.
- Requires approval: Yes.
- How to test: Use Supabase SQL EXPLAIN and RLS test users.
- Rollback notes: No changes during read-only verification.

### Step 9: Authenticated QA coverage

- Severity: Medium
- Scope: QA infrastructure.
- Target issues: `MEDIUM-06`.
- Recommended work: Configure preview/test credentials and run authenticated smoke in CI or before release.
- Files likely affected: CI/Vercel/test env docs or Playwright config.
- Risk: Medium due to test data handling.
- Requires approval: Yes if it creates Supabase test data/projects.
- How to test: Run `npm run test:e2e:registrations` against preview.
- Rollback notes: Remove test credentials/config changes.

## Explicitly Out Of Scope

- Redesign or visual language changes.
- Broad refactors unrelated to the identified stability issues.
- Database schema changes without approval.
- Supabase RLS policy changes without approval.
- Authentication behavior changes without approval.
- API contract changes without approval.
- Deleting code without proving it is unused.
