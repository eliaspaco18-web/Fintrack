# Client Fetch Timeout Test Plan

## Scope

This plan verifies the `hotfix/client-fetch-timeouts` branch in a Vercel preview deployment. The hotfix only changes client-side fetch timeout behavior. It does not change API response contracts, database schema, Supabase RLS, auth/session logic, middleware, or dashboard business logic.

## Setup

1. Deploy this branch to Vercel Preview.
2. Log in with a test user that has data in dashboard, transactions, credits, budgets, assets, receivables, payables, recurring, and alerts.
3. Open Chrome DevTools.
4. In the Network tab, enable `Disable cache`.
5. Run each route once with normal network, then again with a throttled profile such as `Slow 3G`.
6. For failure checks, use DevTools request blocking for the API route named in each step.

## Expected Timeout Behavior

- A request that does not complete should stop waiting after about 12 seconds.
- The visible module state should move from loading to an existing error state.
- The error message should be user-safe, similar to: `La solicitud tardo demasiado. Reintenta en unos segundos.`
- Retry buttons should re-run the request where the module already supports retry.
- Empty states should not replace timeout/error states.

## Route Checks

### Dashboard

1. Visit `/dashboard` with cache disabled.
2. Confirm the dashboard loads normally.
3. Block `/api/dashboard/summary`.
4. Hard refresh `/dashboard`.
5. Confirm the initial dashboard skeleton resolves into an error box with `Reintentar`.
6. Unblock the route and click `Reintentar`.
7. Confirm dashboard data loads.

### Transactions

1. Visit `/transactions`.
2. Confirm transactions load normally.
3. Block `/api/transactions`.
4. Hard refresh `/transactions`.
5. Confirm the transaction table leaves loading and shows the existing table error state.
6. Unblock `/api/transactions` and use the table retry/refresh path.
7. Block `/api/accounts`, hard refresh, and confirm the filter options error banner appears instead of an indefinite disabled filter state.

### Credits

1. Visit `/credits`.
2. Confirm the credit list loads normally.
3. Block `/api/credits`.
4. Hard refresh `/credits`.
5. Confirm the list skeleton resolves into the existing error banner with retry.
6. Unblock `/api/credits` and retry.

### Assets

1. Visit `/assets`.
2. Confirm the asset list loads normally.
3. Block `/api/assets`.
4. Hard refresh `/assets`.
5. Confirm the list skeleton resolves into the existing error banner with retry.
6. Unblock `/api/assets` and retry.

### Budgets

1. Visit `/budgets`.
2. Confirm budget series load normally.
3. Block `/api/budgets?include_inactive=true`.
4. Hard refresh `/budgets`.
5. Confirm the budget list loading state resolves into an error banner with retry.
6. Unblock the route and retry.
7. Switch to `Por periodo`, block `/api/budget-periods`, and confirm the period loading state resolves into the period error banner.

### Receivables

1. Visit `/receivables`.
2. Confirm debtors load normally.
3. Block `/api/debtors`.
4. Hard refresh `/receivables`.
5. Confirm the top-level loading state resolves into the existing error/empty-safe state instead of spinning indefinitely.
6. Unblock `/api/debtors` and retry by refreshing the route.

### Payables

1. Visit `/payables`.
2. Confirm creditors load normally.
3. Block `/api/creditors`.
4. Hard refresh `/payables`.
5. Confirm the top-level loading state resolves into the existing error/empty-safe state instead of spinning indefinitely.
6. Unblock `/api/creditors` and retry by refreshing the route.

### Recurring

1. Visit `/recurring`.
2. Confirm recurring templates load normally.
3. Block `/api/recurring`.
4. Hard refresh `/recurring`.
5. Confirm the list loading state resolves into the existing error banner with retry.
6. Unblock `/api/recurring` and retry.

### Alerts

1. Visit `/alerts`.
2. Confirm alerts load normally.
3. Block `/api/alerts`.
4. Hard refresh `/alerts`.
5. Confirm the list loading state resolves into the existing error banner with retry.
6. Unblock `/api/alerts` and retry.

## Regression Checks

1. Confirm no module shows an empty state when the primary list request times out.
2. Confirm successful requests still render the same data as before.
3. Confirm create/edit/delete actions still call the same API routes and return the same response shapes.
4. Confirm there are no new console errors besides the expected blocked-request errors during manual failure simulation.
5. Confirm Vercel function logs do not show API contract errors caused by this client-only change.

## Rollback Check

If the hotfix causes unexpected behavior, revert:

- `lib/client/fetch-with-timeout.ts`
- Imports and `fetchWithTimeout` usage in client fetchers
- The small dashboard retry button change
- This test plan and the `HOTFIX_PLAN.md` implementation note
