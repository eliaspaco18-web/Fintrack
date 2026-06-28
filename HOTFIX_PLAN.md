# Hotfix Plan

## Scope

This plan only includes narrow, low-risk stabilization candidates from the clean loading audit. It excludes redesign, broad refactors, schema changes, Supabase RLS changes, auth changes, middleware changes, API contract changes, and production environment changes unless separately approved.

## Safest First Candidates

### 1. Add a Shared Client Fetch Timeout Helper

- Status: Implemented in `hotfix/client-fetch-timeouts`.
- Candidate files: `lib/api` or `lib/client`, then client fetchers in `components/dashboard/api.ts`, `lib/hooks/useModules.ts`, `lib/hooks/useTransactions.ts`, and selected module workspaces.
- Reason: Portfolio already has timeout protection; other modules do not.
- Risk: Low if response contracts remain unchanged.
- Approval needed: No, as long as only client error handling changes.
- Test: In Vercel preview, throttle or block each module API and confirm visible error/retry within the configured timeout.
- Rollback: Revert helper usage and restore existing fetch calls.

Implemented result:

- Added `lib/client/fetch-with-timeout.ts` with a 12 second default timeout and a user-safe timeout message.
- Applied it to dashboard API fetches, shared module SWR fetchers, transaction SWR fetches, transaction filter options, and top-level raw list fetches for budgets, receivables, payables, recurring, and alerts.
- Kept API response envelopes and route contracts unchanged.
- Added a minimal retry button to the dashboard initial error state so a timeout can recover without refreshing the whole page.
- Did not change middleware, auth/session behavior, Supabase schema/RLS, API contracts, or dashboard business logic.

### 2. Surface Non-blocking Option Load Failures

- Candidate files: `components/credits/CreditsListPanel.tsx`, `components/assets/AssetsListPanel.tsx`, `components/tables/TransactionTable.tsx`, `components/assets/AssetsForm.tsx`, `components/receivables/ReceivableForm.tsx`, `components/payables/PayableForm.tsx`, `components/recurring/RecurringForm.tsx`.
- Reason: Several option fetches fail silently or with generic messages, making modules look empty/incomplete.
- Risk: Low. UI copy/state only.
- Approval needed: No.
- Test: Block option endpoints in Vercel preview and verify warnings identify the failed option group.
- Rollback: Revert the warning/retry state changes.

### 3. Separate Budgets List Errors From Category Option Errors

- Candidate file: `components/management/BudgetsManager.tsx`.
- Reason: Budget list and categories load in parallel, but category failures can surface as a main module error.
- Risk: Low.
- Approval needed: No.
- Test: Block `/api/categories?include_system=true` while `/api/budgets?include_inactive=true` succeeds. The list should render with a category warning.
- Rollback: Revert to the single error state.

### 4. Remove Or Use The Dashboard Page Exchange-rate Fetch

- Candidate files: `app/(dashboard)/dashboard/page.tsx`, `components/dashboard/DashboardClient.tsx`.
- Reason: `DashboardPage` fetches `resolveLiveUsdPenExchangeRate()`, but `DashboardClient` ignores `initialExchangeRate`.
- Risk: Low if removing unused work; medium if wiring it through currency/dashboard state.
- Approval needed: No for removing unused fetch if behavior remains equivalent.
- Test: Compare `/dashboard` first document timing before/after in Vercel preview. Confirm dashboard currency displays still work through layout `CurrencyProvider`.
- Rollback: Restore the previous page fetch.

## Candidates That Should Wait For Approval

### Middleware Auth Pass-through Optimization

- Candidate file: `middleware.ts`.
- Reason: Middleware calls Supabase `getUser()` before API/static/auth-callback pass-through checks.
- Risk: Medium because auth/session behavior can regress.
- Approval needed: Yes.
- Test after approval: Auth redirect E2E, authenticated smoke, API timing comparison, login/register/callback flows.

### Dashboard Bootstrap Consolidation

- Candidate files: `components/dashboard/DashboardWorkspace.tsx`, dashboard widgets, `app/api/dashboard/*`, possibly `modules/dashboard/dashboard.service.ts`.
- Reason: Duplicate dashboard summary calls and widget-level refetches are likely the largest waterfall.
- Risk: Medium. Dashboard KPIs and widgets are business-critical.
- Approval needed: Yes if endpoint contracts change; no only for internal SWR fallback reuse.
- Test after approval: Vercel preview waterfall, dashboard KPI parity, refresh button behavior, widget tab switching.

### Portfolio Preload/API Loader Unification

- Candidate files: `app/(dashboard)/portfolio/page.tsx`, `app/api/accounts/route.ts`, possible shared server helper.
- Reason: Server preload and API retry do not use identical fallback behavior.
- Risk: Medium if shared data-access code changes behavior.
- Approval needed: Yes if API contract, schema, or RLS changes are required.
- Test after approval: Portfolio first load, retry, bank-entity missing/disabled cases, account creation/editing.

### Supabase RLS, Schema, Index, Or Vercel Env Changes

- Reason: These may be necessary if live preview/production shows permissions or query-plan mismatches.
- Risk: High for production financial data.
- Approval needed: Yes, always.
- Test after approval: Read-only checks first in preview/clone, then migration plan with rollback.
