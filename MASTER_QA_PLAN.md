# MASTER_QA_PLAN.md

## Purpose

This is the manual QA plan for Phase 1 stabilization. Run it in Vercel Preview before production release. Use a dedicated authenticated test user with data in every module.

For every test:

- Open Chrome DevTools.
- Enable Network tab.
- Enable Disable cache for hard refresh tests.
- Watch Console for uncaught runtime errors.
- Record slow or failed requests.
- Confirm loading states resolve into success, empty, or controlled error/retry.
- Confirm empty states do not appear after failed requests.

## Global Setup

1. Deploy the branch to Vercel Preview.
2. Confirm the preview commit matches the branch being tested.
3. Log in with the approved test user.
4. Verify the user has at least:
   - one portfolio/account
   - transactions
   - a credit card or loan
   - budget series and at least one period
   - one asset
   - one debtor and receivable
   - one creditor and payable
   - one recurring template
   - one alert
   - admin catalog data
5. Test desktop at 1440px wide.
6. Test mobile at an iPhone-sized viewport.
7. Repeat the first-load checks once with normal network and once with throttling or request blocking.

## Auth And Routes

### Login

1. Visit `/login`.
2. Confirm email, password, submit, signup, and recovery controls render.
3. Submit empty form and verify validation is visible.
4. Submit invalid credentials and verify a user-safe error appears.
5. Submit valid credentials and verify redirect to `/dashboard`.
6. Check console for errors.

### Register

1. Visit `/register`.
2. Confirm it redirects to `/login?mode=signup`.
3. Verify signup mode fields render.
4. Validate password mismatch and required terms behavior.

### Authenticated Route Guards

1. In a logged-out/incognito session, visit `/dashboard`, `/transactions`, `/portfolio`, and `/admin`.
2. Confirm redirect to `/login?next=...`.
3. Log in and visit `/login`.
4. Confirm authenticated user redirects to `/dashboard`.
5. Log out from topbar and sidebar where available.
6. Confirm session ends and protected routes redirect.

## App Shell / Layout / Sidebar / Topbar

1. Hard refresh `/dashboard`.
2. Confirm shell, sidebar, topbar, and main content render.
3. Open and close mobile drawer on mobile viewport.
4. Click every sidebar link and verify it goes to a live module or status page.
5. Open topbar quick menu.
6. Click each quick action:
   - Nueva transaccion -> `/transactions?new=transaction`
   - Nuevo portafolio -> `/portfolio?new=portfolio`
   - Nuevo presupuesto -> `/budgets?new=budget`
   - Nuevo recurrente -> `/recurring?new=template`
7. Open profile menu and verify settings/security/logout actions.
8. Press Escape and click outside dropdowns if the current branch includes that fix.
9. Open QuickActionsFAB and verify each action.
10. Block `/api/dashboard/nav-badges` and confirm shell stays usable.

## Dashboard

1. Hard refresh `/dashboard` with cache disabled.
2. Confirm initial skeleton resolves.
3. Verify dashboard header, tabs, KPIs, widgets, and refresh button render.
4. Click every dashboard tab:
   - overview
   - transactions
   - budgets
   - credits
   - cash due
   - wealth
5. Click refresh and confirm no duplicate stuck loading.
6. Block `/api/dashboard/summary`, hard refresh, and verify controlled dashboard error with retry.
7. Unblock and retry.
8. Record all `/api/dashboard/*`, `/api/recurring`, and `/api/budget-periods` requests in the waterfall.
9. Check Vercel function logs for slow or duplicate summary calls.

## Portfolio

1. In a fresh signed-in tab, hard-open `/portfolio` directly.
2. Confirm it reaches account list, true empty state, or controlled error/retry.
3. Confirm it does not require visiting another module first.
4. Visit `/portfolio?new=portfolio`.
5. Confirm the portfolio form/modal opens.
6. Create a test account without bank entity.
7. Create a test account with bank entity if available.
8. Edit account name, opening balance, and opening balance date.
9. Deactivate account and confirm modal prevents double-submit.
10. Reactivate account.
11. Delete a deletable test account and verify it disappears.
12. Try deleting/deactivating an account with dependencies and verify a clear business-rule error.
13. Test filters:
    - all
    - active
    - inactive
    - technical
    - currency
    - type
    - bank
    - search
14. Block `/api/accounts?include_inactive=true` and verify loading exits to error/retry.
15. Block `/api/bank-entities?include_inactive=false` and verify account data and bank warning behavior.
16. Verify no console errors.

## Movements / Transactions

1. Hard refresh `/transactions`.
2. Confirm table skeleton resolves.
3. Verify search, quick filters, account filter, category filter, sort, saved views, pagination, and reset filters.
4. Open `/transactions?new=transaction`.
5. Select each operation type:
   - income
   - expense
   - transfer
   - asset purchase
   - receivable issue
   - receivable collect
   - payable issue
   - payable pay
6. Submit invalid form and verify field errors.
7. Create a small test transaction.
8. Edit transaction if available.
9. Delete transaction with cancel and confirm paths.
10. Open export modal.
11. Load export metadata, change period/year/portfolio/format, export each format if safe.
12. Block `/api/transactions` and verify table error/retry.
13. Block `/api/accounts` or `/api/categories` and verify filter/form option warning if implemented.
14. Block `/api/transactions/export?meta=true` and verify export modal error/retry.
15. Check console and network.

## Credits

1. Hard refresh `/credits`.
2. Confirm list skeleton resolves.
3. Test search, type filter, status filter, bank filter, and refresh.
4. Open new credit modal.
5. Select credit card flow.
6. Verify bank entity options load or show a clear warning.
7. Submit invalid form and verify validation.
8. Create a test card if safe.
9. Select bank loan flow.
10. Verify bank/account options load or show a clear warning.
11. Submit invalid loan and verify validation.
12. Edit a credit where available.
13. Deactivate/reactivate and delete test credit with confirmation.
14. Block `/api/credits`, `/api/bank-entities`, and `/api/accounts` separately.
15. Confirm no indefinite loading.

## Budgets

1. Hard refresh `/budgets`.
2. Confirm budget list loads.
3. Test list filters:
   - status
   - currency
   - category
   - period
   - search
4. Open create budget with `/budgets?new=budget`.
5. Submit invalid budget and verify validation.
6. Create a test budget if safe.
7. Edit budget.
8. Deactivate/reactivate budget.
9. Delete test budget with cancel and confirm paths.
10. Switch to period view.
11. Change month/year.
12. Block `/api/budgets?include_inactive=true`, `/api/categories?include_system=true`, and `/api/budget-periods` separately.
13. Confirm blocking and non-blocking error states are distinct.

## Assets

1. Hard refresh `/assets`.
2. Confirm list loads.
3. Test search, status, type/filter controls.
4. Open create asset form.
5. Verify account and asset type options.
6. Submit invalid form and verify validation.
7. Test invalid file type and oversized file.
8. Create a test asset if safe.
9. Edit asset.
10. Delete test asset with cancel and confirm paths.
11. Block `/api/assets`, `/api/accounts`, and `/api/asset-types` separately.
12. Confirm list/form warnings and no indefinite loading.

## Receivables

1. Hard refresh `/receivables`.
2. Confirm debtor list loads.
3. Create debtor with invalid and valid data.
4. Open debtor detail.
5. Confirm receivable list and ledger load.
6. Open new receivable form.
7. Verify account options load or show warning.
8. Submit invalid receivable and verify validation.
9. Create a test receivable if safe.
10. Edit/collect/delete paths where available.
11. Delete debtor with dependencies and verify business-rule error.
12. Block `/api/debtors`, `/api/receivables`, `/api/debtors/[id]/ledger`, and `/api/accounts?is_active=true` separately.
13. Confirm controlled error/retry or warning behavior.

## Payables

1. Hard refresh `/payables`.
2. Confirm creditor list loads.
3. Create creditor with invalid and valid data.
4. Open creditor detail.
5. Confirm payable list and ledger load.
6. Open new payable form.
7. Verify account options load or show warning.
8. Submit invalid payable and verify validation.
9. Create a test payable if safe.
10. Edit/pay/delete paths where available.
11. Delete creditor with dependencies and verify business-rule error.
12. Block `/api/creditors`, `/api/payables`, `/api/creditors/[id]/ledger`, and `/api/accounts?is_active=true` separately.
13. Confirm controlled error/retry or warning behavior.

## Recurring

1. Hard refresh `/recurring`.
2. Confirm recurring list loads.
3. Test search/filter/status behavior.
4. Open `/recurring?new=template`.
5. Verify accounts/categories load or show warning.
6. Create invalid template and verify validation.
7. Create a test template if safe.
8. Edit template.
9. Activate/deactivate if available.
10. Delete template with cancel and confirm.
11. Block `/api/recurring`, `/api/accounts`, and `/api/categories` separately.
12. Confirm controlled error/retry or warning behavior.

## Alerts

1. Hard refresh `/alerts`.
2. Confirm alert list loads.
3. Test filters/search if present.
4. Create manual alert if available.
5. Toggle read/resolved state.
6. Delete one alert with confirmation if present.
7. Run generate/refresh alerts.
8. Mark all read.
9. Delete read alerts.
10. Block `/api/alerts` and `/api/alerts/generate` separately.
11. Confirm no endless busy state and partial failures are clear.

## Administration

### Banks

1. Visit `/admin?tab=banks`.
2. Confirm list loads.
3. Create/edit/deactivate/delete a test bank entity if safe.
4. Verify bank appears in portfolio bank selector.
5. Block `/api/bank-entities?include_inactive=true` and confirm error/retry.

### Currencies

1. Visit `/admin?tab=currencies`.
2. Confirm list loads.
3. Create/edit/deactivate/delete a test custom currency if safe.
4. Verify custom active currency appears in portfolio currency options.
5. Confirm system currencies cannot be deleted if protected.

### Categories

1. Visit `/admin?tab=categories`.
2. Confirm list loads.
3. Create/edit/delete a test category if safe.
4. Verify category appears in transaction form/category selectors.
5. Confirm protected system categories cannot be edited/deleted.
6. Block `/api/categories?include_system=true` and confirm error/retry.

### Asset Types

1. Visit `/admin?tab=asset-types`.
2. Confirm list loads.
3. Create/edit/deactivate/delete a test asset type if safe.
4. Verify it appears in asset form.

## Configuration / Settings

1. Visit `/settings`.
2. Test tabs:
   - profile
   - security
   - preferences
   - notifications
   - accounts
   - export
   - support
3. Update profile fields with valid and invalid data.
4. Test avatar upload validation if available.
5. Test password mismatch/change/reset flows with safe credentials.
6. Test preferences save and reload.
7. Test notifications save.
8. Test accounts summary.
9. Test export/import panel flows only with approved test data.
10. Block profile/accounts preload and verify explicit warning if implemented.
11. Confirm no secrets or raw database errors appear.

## Supabase / RLS / Data Integrity Checks

These require approval before production or credentialed checks.

1. Verify migrations applied in the target Supabase project.
2. Verify RLS prevents one user from reading another user's data.
3. Verify these tables return expected data for the test user:
   - accounts
   - transactions
   - bank_entities
   - user_currencies
   - credits
   - budgets
   - assets
   - accounts_receivable
   - accounts_payable
   - recurring_transactions
   - app_notifications
4. Run EXPLAIN/query-plan checks for slow portfolio/dashboard/module queries in a clone or approved read-only window.
5. Confirm service-role routes validate authenticated user before privileged work.

## Vercel / Release Checks

1. Confirm preview build succeeds.
2. Confirm required env vars exist in preview.
3. Confirm required env vars exist in production before release.
4. Confirm `/api/cron/exchange-rate` rejects missing/invalid `CRON_SECRET`.
5. Confirm security headers are present.
6. Compare preview and production request timing for the same user.
7. Confirm release workflow is not run without explicit owner approval.

## Mobile Responsive Checks

For every module:

1. Use mobile viewport.
2. Open sidebar drawer and navigate.
3. Open topbar/profile/FAB actions.
4. Open primary modal.
5. Confirm form fields fit and submit buttons remain reachable.
6. Confirm tables become readable cards or scroll intentionally.
7. Confirm no text overlaps controls.
8. Confirm no modal traps the page without a close path.

## Completion Criteria

The app can be considered ready to continue toward release readiness when:

- Phase A blockers pass in Vercel Preview.
- Every module reaches loading, error, empty, and success states deterministically.
- Every visible action works or is clearly disabled/documented.
- Authenticated E2E is run or explicitly accepted as a release risk.
- Supabase/Vercel approval-gated checks are completed or explicitly deferred.
- No high-severity console/runtime errors remain in preview.
