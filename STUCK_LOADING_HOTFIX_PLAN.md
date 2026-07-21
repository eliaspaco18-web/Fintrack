# Stuck Loading Hotfix Plan

## Goal

Fix the first direct `/portfolio` stuck-loading behavior with the smallest safe change. Do not redesign, refactor broadly, change auth/middleware, change Supabase RLS/schema, or change API contracts.

## Safe Option 1: Make Portfolio Client-Loaded First

Recommended first option.

### Change

- Stop blocking `/portfolio` first render on server Supabase preload.
- Render `PortfolioManager` immediately with `preloaded={false}`.
- Move initial accounts, banks, and currencies loading to bounded client fetches.
- Replace portfolio's inline timeout helper with the shared `fetchWithTimeout`.
- Keep the same visible UI states.

### Files Likely Affected

- `app/(dashboard)/portfolio/page.tsx`
- `components/management/PortfolioManager.tsx`
- possibly an existing currency API route or a minimal client call to an existing endpoint

### Why This Is Safe

- It does not require auth, middleware, schema, RLS, or API contract changes.
- It uses the existing client loading/error/retry pattern.
- It directly addresses the bypass: the client timeout can only work after the client component mounts.

### Risk

Low to medium.

The main risk is losing server-preloaded portfolio data on first paint, but that is preferable to an indefinite skeleton and can be tested in Vercel Preview.

### Approval Needed

No, if no API contract, auth, middleware, schema, or RLS changes are included.

## Safe Option 2: Keep Server Preload But Add A Non-Blocking Escape Hatch

### Change

- Keep the existing server preload attempt.
- Ensure `/portfolio` still renders `PortfolioManager` quickly when preload fails or exceeds a strict render budget.
- Move any missing follow-up data, especially currencies, into client retry/loading.

### Files Likely Affected

- `app/(dashboard)/portfolio/page.tsx`
- `components/management/PortfolioManager.tsx`

### Why This Is Safe

- It preserves the current server-preload intent.
- It avoids changing API contracts or database behavior.

### Risk

Medium.

This is more subtle than Option 1 because the route can still be exposed to cold server preload and layout Suspense behavior.

### Approval Needed

No, if the change is UI/data-loading only.

## Defer: Middleware/Auth Optimization

### Change

- Reorder middleware safe pass-through checks before `supabase.auth.getUser()`.
- Consider a bounded auth/session timeout strategy for layout/server paths.

### Why Deferred

This touches auth/session behavior and must be approved separately.

### Risk

Medium.

### Approval Needed

Yes.

## Defer: Database, RLS, Schema, Or Index Changes

### Change

- Any RLS policy updates.
- Any schema/index changes for portfolio/account queries.
- Any production Supabase verification requiring live credentials.

### Why Deferred

These are explicitly outside the current safe hotfix scope.

### Risk

Medium to high.

### Approval Needed

Yes.

## Recommended Next PR Scope

Use Safe Option 1 only.

The PR should include:

- Portfolio page no longer blocking first render on server Supabase preload.
- Portfolio client fetches using `fetchWithTimeout`.
- Controlled portfolio error/retry state within the timeout window.
- Vercel Preview test notes proving direct `/portfolio` no longer stays on skeleton.

The PR should not include:

- middleware changes
- auth/session changes
- Supabase RLS changes
- database schema changes
- API response contract changes
- dashboard waterfall optimization
- redesign
- broad refactors

## Vercel Preview Acceptance Criteria

- Fresh direct `/portfolio` visit while signed in shows either data, empty state, or controlled error/retry.
- It does not remain on skeleton indefinitely.
- If `/api/accounts` or `/api/bank-entities` is slow, the UI exits loading within the configured timeout.
- Visiting another module first is no longer required.
- Browser console has no new uncaught errors.
- Vercel Function logs show no unbounded `/portfolio` route render.
- Existing create/edit/deactivate/delete portfolio actions still work.
