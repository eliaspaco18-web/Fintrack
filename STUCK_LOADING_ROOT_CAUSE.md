# Stuck Loading Root Cause

## Executive Summary

The most likely root cause is not the new client fetch timeout itself. The observed `/portfolio` failure can happen before the client timeout code ever runs.

`/portfolio` is an async Server Component that blocks its first render on three Supabase preload queries. It is rendered inside the dashboard layout Suspense boundary. On a cold direct Vercel visit, if the server-side page render, Supabase auth/session lookup, or portfolio preload path stalls, the user sees the layout `PageSkeleton` and `PortfolioManager` has not mounted yet. Because the client component has not mounted, the client-side timeout hotfix is bypassed.

When the user visits another module first, the authenticated layout, session cookies, Next.js route runtime, client chunks, and API/Supabase paths are warmer. Returning to `/portfolio` is then a client-side navigation/RSC fetch instead of the same cold direct document load, so the portfolio server preload is more likely to finish and the module appears to load.

## Files Involved

- `app/(dashboard)/layout.tsx`
  - Runs `supabase.auth.getUser()` with no explicit timeout.
  - Fetches profile and exchange-rate layout data with server timeouts.
  - Wraps all child pages in `<Suspense fallback={<PageSkeleton />}>`.
- `app/(dashboard)/portfolio/page.tsx`
  - Blocks first render on `accounts`, `bank_entities`, and `user_currencies` server Supabase queries.
  - Uses 4 second `withTimeout` wrappers around those queries.
  - Passes `preloaded`, `preloadError`, and initial arrays into `PortfolioManager`.
- `components/management/PortfolioManager.tsx`
  - Shows its own list skeleton when `loading === true`.
  - Runs client refetch only after mount when `preloaded === false`.
  - Uses an inline 10 second `fetchPortfolioData` timeout, not the shared 12 second `fetchWithTimeout` helper.
- `components/layout/AppShell.tsx`
  - Fetches nav badges with SWR after the shell mounts.
  - This fetch does not block the child route render, but it adds API/auth load after hydration.
- `components/layout/Topbar.tsx`
  - Does not block module loading.
  - Uses nav badge values passed from `AppShell`.
- `middleware.ts`
  - Runs `supabase.auth.getUser()` before returning API/static/auth-callback pass-throughs.
  - This can add session overhead to every API request, but changing it is auth/middleware work and needs approval.
- `lib/server/exchange-rate.ts`
  - Layout and some pages resolve exchange-rate data on the server.
  - Most exchange-rate operations have timeouts/fallbacks, but they still add cold-start work.
- `lib/client/fetch-with-timeout.ts`
  - Shared 12 second client timeout helper from the previous hotfix.
  - Not currently used by portfolio's main initial account/bank fetcher.

## Loading Classification

### Most likely stuck state: layout-level/server-side loading

If the visible skeleton is the generic dashboard `PageSkeleton` from `app/(dashboard)/layout.tsx`, the page is stuck before `PortfolioManager` mounts. This is server-side/layout-level loading.

In this case:

- Route-level `loading.tsx`: unlikely. No `app/**/loading.tsx` file was found.
- Suspense boundary: yes. The dashboard layout wraps children in Suspense.
- Server component preload: yes. `/portfolio` waits for server Supabase preload before returning the client manager.
- Client component state: not yet. The client manager has not mounted.
- SWR cache: not primary. Portfolio itself does not use SWR for its main data.
- Auth/session initialization: possible contributor because layout and middleware call `getUser()` with no timeout.
- AppShell/nav-badge fetches: not the initial blocker; they run after the shell mounts.
- Exchange-rate/profile/layout work: possible contributor to first direct dashboard load.
- Fetch not covered by `fetchWithTimeout`: yes. Server preload and auth/session calls are not client fetches.

### Secondary possible state: portfolio client skeleton

If the module header appears and only the portfolio list rows are skeletons, `PortfolioManager` has mounted and the loading is client-side.

In this case:

- The hotfix is partly bypassed because portfolio uses its own inline `fetchPortfolioData` helper with a 10 second timeout instead of `fetchWithTimeout`.
- The inline timeout should still abort `/api/accounts?include_inactive=true` and `/api/bank-entities?include_inactive=false` after 10 seconds.
- If no controlled error appears after roughly 10 seconds, the browser should be checked for a hydration/runtime error preventing the `finally { setLoading(false) }` path from running.

## Exact Likely Cause

The likely cause is a cold direct-render dead zone created by the combination of:

1. Dashboard layout auth/session work before the page renders.
2. A layout Suspense fallback that can show a skeleton while the child page is unresolved.
3. Portfolio-specific server preload queries that block first render.
4. Client timeout logic that only starts after `PortfolioManager` mounts.

This explains why opening another module first can make `/portfolio` work: the app shell and authenticated session path are warm, the client-side router is active, shared chunks are loaded, and the subsequent `/portfolio` navigation is less exposed to cold Vercel/server preload latency.

## Is The Timeout Hotfix Being Bypassed?

Yes, for the likely stuck state.

The shared 12 second `fetchWithTimeout` only protects client-side fetches that run after hydration. A direct `/portfolio` request can be sitting in layout Suspense/server render before any client fetch starts. In that state, the 12 second client timeout cannot fire.

Also, portfolio's own client fetcher has not been migrated to the shared helper. It has a separate inline 10 second timeout in `components/management/PortfolioManager.tsx`. That means `/portfolio` uses a different loading path than modules updated in the hotfix.

## Why `/portfolio` Differs From Other Modules

Several modules render a client workspace immediately and fetch data after mount:

- `app/(dashboard)/budgets/page.tsx`
- `app/(dashboard)/assets/page.tsx`

Those modules are better aligned with the client timeout hotfix because their loading state is primarily client-side.

`/portfolio` is different because it performs server Supabase preload first:

- accounts
- bank entities
- user currencies

Only when that preload resolves or times out does `PortfolioManager` render and the client-side loading/retry path become available.

## Additional Risk Signals

- Portfolio server preload relies on direct RLS-scoped Supabase queries and does not explicitly filter by `user_id`, while `/api/accounts` does filter by `user_id` and has bank-entity fallback behavior.
- `app/(dashboard)/layout.tsx` calls `supabase.auth.getUser()` without a timeout.
- `middleware.ts` calls `supabase.auth.getUser()` before skipping API routes, adding overhead to module client fetches.
- `AppShell` nav badge SWR uses raw `fetch` without the shared timeout helper, but it should not block portfolio's first render.

## Recommended Minimal Fix

Recommended first hotfix:

Make `/portfolio` render `PortfolioManager` immediately instead of blocking first render on server preload. Move the initial account, bank, and currency loading onto the client path with bounded timeout/error handling.

The safest shape is:

- Keep API response contracts unchanged.
- Keep UI design unchanged.
- Do not touch database schema, Supabase RLS, auth, middleware, or API contracts.
- Use the shared `fetchWithTimeout` for portfolio client fetches.
- Add a small client fetch for currencies if server currencies are no longer guaranteed.
- Preserve visible loading, error, empty, and success states.

Risk level: Low to medium.

Approval required: No if this is limited to portfolio page/client loading behavior and does not change API contracts, auth, middleware, schema, or RLS. Approval is required if the chosen fix changes middleware/auth behavior or introduces server/API contract changes.

## Fixes That Need Approval

These should not be implemented without explicit approval:

- Reordering `middleware.ts` to skip API/static routes before `supabase.auth.getUser()`.
- Changing dashboard layout auth/session behavior.
- Changing Supabase RLS policies.
- Changing database schema or indexes.
- Changing API response contracts.
- Changing production environment variables or Vercel/Supabase runtime settings.

## Vercel Preview Test Plan

1. Deploy the diagnostic/fix branch to Vercel Preview.
2. Open DevTools with Network tab enabled and disable cache.
3. Directly open `/portfolio` in a fresh tab while signed in.
4. Record whether the visible skeleton is:
   - the generic layout `PageSkeleton`, or
   - the portfolio list-row skeleton under the portfolio header.
5. Confirm whether client API requests fire:
   - `/api/accounts?include_inactive=true`
   - `/api/bank-entities?include_inactive=false`
   - any currency endpoint if added by the fix
6. If no client API requests fire, the page is stuck before client mount and the client timeout is bypassed.
7. If client API requests fire, confirm they resolve or show a controlled error/retry state within the configured timeout.
8. Navigate to `/dashboard`, then back to `/portfolio`, and compare:
   - document/RSC request timing
   - API request timing
   - whether the same skeleton appears
9. Check Vercel Function logs for:
   - slow `/portfolio` route render
   - slow Supabase auth/session calls
   - slow account/bank/currency preload queries
   - slow `/api/accounts` or `/api/bank-entities` calls
10. Confirm no raw Supabase errors are shown to users.

## Current Recommendation

Do not revert the client timeout hotfix. It still protects modules whose loading happens after client mount.

Treat `/portfolio` as a separate loading-path bug: its cold direct visit can be blocked by server/layout work before the hotfix is active.
