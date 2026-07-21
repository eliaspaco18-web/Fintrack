# REGRESSION_REPORT.md

## Summary

The portfolio stability fix is still present in current `main` and was not overwritten or reverted by later merges.

Current `main`:

- `b91b0b8` - `chore: add validated transaction, dashboard, and docs updates (#3)`

Relevant merged commits:

- Portfolio stability PR: `f1166dc` - `fix: stabilize portfolio loading and new portfolio flow`
- Codex instructions PR: `66d1d67` - `chore: add Codex repository instructions (#2)`
- Validated pre-existing changes PR: `b91b0b8` - `chore: add validated transaction, dashboard, and docs updates (#3)`

## Portfolio Fix Presence

Status: present.

The current `main` branch still includes the portfolio stability changes:

- `app/(dashboard)/portfolio/page.tsx`
  - Builds `preloadFailures`.
  - Passes `preloadError` into `PortfolioManager`.
  - Keeps non-sensitive preload failure messaging.
- `components/management/PortfolioManager.tsx`
  - Includes `CLIENT_FETCH_TIMEOUT_MS = 10_000`.
  - Uses `fetchPortfolioData` with `AbortController`.
  - Opens the create modal when `new=portfolio`.
  - Uses `reloadPortfolioData` to retry accounts and bank entities together.
  - Uses `hasBlockingLoadError` so a blocking load error does not also show the empty state.
  - Renders `DataErrorBanner` with retry.
- `components/layout/Topbar.tsx`
  - The topbar quick-create link points to `/portfolio?new=portfolio`.

## Was The Fix Overwritten?

No.

`git diff f1166dc..main -- app/(dashboard)/portfolio/page.tsx components/management/PortfolioManager.tsx components/layout/Topbar.tsx` produced no changes. This means the current `main` versions of those three files match the portfolio stability merge.

## Expected Portfolio Behaviors In Current Main

These behaviors still exist in current `main`:

- `/portfolio?new=portfolio` opens the portfolio create form/modal.
- Topbar "Nuevo portafolio" points to `/portfolio?new=portfolio`.
- Loading, empty, error, and success states remain separated.
- Portfolio account and bank fetches have a 10 second timeout.
- Retry reloads both accounts and bank entities.

## Later Change Impact

The validated pre-existing changes commit `b91b0b8` touched:

- `app/actions/transaction.actions.ts`
- `components/dashboard/DashboardTabs.tsx`
- `components/forms/TransactionForm/index.tsx`
- `lib/server/transaction-form-options.ts`
- tracked legacy `docs/*` deletions

It did not touch:

- `app/(dashboard)/portfolio/page.tsx`
- `components/management/PortfolioManager.tsx`
- `components/layout/Topbar.tsx`
- `middleware.ts`
- Supabase client/server setup
- authentication/session files
- portfolio API routes
- route definitions

Possible indirect impact:

- Transaction module loading can be affected by the new payable settlement option grouping in `lib/server/transaction-form-options.ts`.
- Dashboard UI behavior can be affected by `components/dashboard/DashboardTabs.tsx`.
- Portfolio loading is unlikely to be directly affected by `b91b0b8`.

## Vercel Deployment Check

GitHub remote `main` points to:

- `b91b0b819974e669e0f16000a135b3efd459e40e`

GitHub deployment records show a Vercel `Production` deployment for:

- `b91b0b819974e669e0f16000a135b3efd459e40e`
- Status: `success`
- Created: `2026-06-28T15:04:04Z`
- Environment URL reported by GitHub: `https://fintrack-8qr87slkp-eliaspaco18-8504s-projects.vercel.app`

Note: The manual `Production Release` GitHub workflow's latest run shown by the public API was still for `f61ca86` from `2026-06-24`. However, GitHub deployment records from `vercel[bot]` show that Vercel did deploy `b91b0b8` successfully. Direct Vercel API verification was not available locally because `VERCEL_TOKEN` is not set.

## Likely Cause Of The Reported Regression

Most likely cause: not an overwritten portfolio fix.

More likely explanations:

1. Production/preview is showing a data or Supabase latency/RLS issue that the portfolio stability fix surfaces as an error or timeout rather than silently loading forever.
2. The original remaining portfolio risk still exists: server preload still directly joins `bank_entities` instead of sharing the `/api/accounts` fallback path. If production schema/RLS differs from local expectations, the preload can fail even though the client retry may recover.
3. If the symptom is broader module loading, the root cause may be the previously identified middleware/session overhead or dashboard request waterfall, neither of which was changed by the validated pre-existing PR.
4. If the symptom is in transactions rather than portfolio, `b91b0b8` is a plausible cause because it changed transaction payable settlement queries and transaction form options.

## Risk Level

- Portfolio fix overwritten: low risk, not observed.
- Portfolio production data/RLS/query mismatch: medium risk.
- Broader module loading caused by middleware/dashboard waterfall: medium risk.
- Transaction loading affected by `b91b0b8`: medium risk.

## Recommended Fix

Do not revert immediately.

Recommended next diagnostic step:

1. In Vercel Preview/Production, reproduce with DevTools open.
2. Capture the Network waterfall for `/portfolio`.
3. Check whether these requests succeed, fail, or timeout:
   - `/portfolio`
   - `/api/accounts?include_inactive=true`
   - `/api/bank-entities?include_inactive=false`
4. If `/portfolio` server preload fails but client retry succeeds, implement the previously documented safe follow-up: align portfolio server preload with the `/api/accounts` fallback behavior.
5. If API requests are slow across modules, investigate middleware/session overhead and dashboard request waterfalls as separate approved tasks.
6. If only transaction form loading regressed, inspect `lib/server/transaction-form-options.ts` and `app/actions/transaction.actions.ts` from `b91b0b8`.

## Rollback Options

No rollback is recommended yet for the portfolio stability PR because the fix is still present and appears intact.

Rollback options if production impact is confirmed:

- If only transaction/payable flows regressed, revert `b91b0b8` or make a targeted fix to the transaction/payable changes.
- If portfolio preload still fails because of `bank_entities` join behavior, do not revert; instead implement a targeted portfolio preload fallback fix.
- If Vercel deployed an unexpected build, redeploy current `main` at `b91b0b8`.

## Vercel Test Plan

In Vercel Preview and Production:

1. Confirm the deployment commit is `b91b0b8`.
2. Visit `/portfolio`.
3. Hard refresh with cache disabled.
4. Confirm the page reaches one of these states:
   - visible account list
   - true empty state
   - clear error banner with retry
5. Visit `/portfolio?new=portfolio`.
6. Confirm the create modal opens.
7. Use the topbar quick-create menu and click "Nuevo portafolio".
8. Confirm the same create modal opens.
9. In DevTools Network, confirm `/api/accounts?include_inactive=true` and `/api/bank-entities?include_inactive=false` do not hang indefinitely.
10. Click retry after forcing or observing an error and confirm both account and bank requests run again.
11. Navigate to another module and back to `/portfolio`; compare cold and warm loading times.
12. If the issue is broader, repeat the network waterfall on `/dashboard` and `/transactions/new`.
