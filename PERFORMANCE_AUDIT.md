# PERFORMANCE_AUDIT.md

## Summary

Performance issues were found. The most likely explanation for "some modules load very slowly, but load quickly after visiting another module and returning" is a combination of cold JS chunk loading, middleware auth overhead, client-side fetch-after-hydration patterns, duplicated dashboard server work, and defensive loading states that can hide errors.

## Findings

### High

#### HIGH-PERF-01: Middleware adds Supabase auth overhead before API/static early returns

- Affected file or area: `middleware.ts:25`
- Probable cause: `supabase.auth.getUser()` runs before API/static/auth-callback pass-through checks.
- Impact: API requests made by modules can pay middleware auth overhead before the API route performs its own auth/session checks.
- Recommended solution: Reorder safe early returns before Supabase session lookup where auth is not needed.
- Risk: Medium because middleware is part of auth/session behavior.
- Requires approval: Yes.
- How to test: Compare API waterfall timings before/after and run auth redirect plus authenticated smoke tests.

#### HIGH-PERF-02: Dashboard first load is large and fetches multiple endpoints after hydration

- Affected file or area: `/dashboard`, `components/dashboard/DashboardWorkspace.tsx:57`
- Probable cause: Production build reports `/dashboard` first-load JS at 253 kB. The dashboard then fetches four bootstrap endpoints in the browser.
- Impact: Cold visits can feel slow; return visits are faster because chunks and SWR data are cached.
- Recommended solution: Introduce a single server/bootstrap payload, reduce duplicated dashboard service calls, and consider component-level code splitting for less-used dashboard tabs.
- Risk: Medium.
- Requires approval: No if API compatibility remains; yes if API contracts change.
- How to test: Record cold-load and repeat-load timings in Playwright or Chrome DevTools.

#### HIGH-PERF-03: Dashboard endpoints duplicate expensive summary computation

- Affected file or area: `app/api/dashboard/summary/route.ts`, `app/api/dashboard/modules-summary/route.ts`, `app/api/dashboard/sidebar/route.ts`
- Probable cause: Multiple endpoints instantiate `DashboardService` and call `getSummary(userId)`.
- Impact: Parallel dashboard fetches can duplicate RPC and daily-flow work for the same user/session.
- Recommended solution: Consolidate bootstrap data or cache `getSummary` per request/user/TTL.
- Risk: Medium.
- Requires approval: No unless API contracts change.
- How to test: Log/measure `api.dashboard.*` timings and count repeated RPC calls on a cold dashboard load.

### Medium

#### MEDIUM-PERF-01: Portfolio server preload retries work on the client after preload failure

- Affected file or area: `app/(dashboard)/portfolio/page.tsx:57`, `components/management/PortfolioManager.tsx:591`
- Probable cause: If any preload fails, the client makes additional fetches for accounts and banks after hydration.
- Impact: Cold `/portfolio` can show a skeleton, then refetch, while returning later feels quick due to loaded chunks and browser session state.
- Recommended solution: Surface the preload error and retry intentionally, or make server preload use API-equivalent fallback behavior.
- Risk: Low to medium.
- Requires approval: No for UI retry messaging; yes for API/schema/RLS changes.
- How to test: Simulate a server preload timeout and verify a deterministic retry/error UX.

#### MEDIUM-PERF-02: Several module pages rely on client-only workspace data loading

- Affected file or area: `/credits`, `/assets`, `/budgets`, `/recurring`, `/alerts`, and their workspace components.
- Probable cause: Pages render client workspaces that fetch their data after hydration.
- Impact: First visit waits for JS load, hydration, and API calls; second visit benefits from loaded chunks and cache.
- Recommended solution: For Phase 1, prioritize visible deterministic loading/error states and prefetch critical route chunks. Defer broad data architecture changes until after bug stabilization.
- Risk: Medium if refactored broadly.
- Requires approval: No for loading/error fixes; yes for broad data architecture changes.
- How to test: Use network throttling and verify each module reaches loading, error, empty, and success states.

### Low

#### LOW-PERF-01: Webpack cache warning during Playwright web server startup

- Affected file or area: local dev/test startup.
- Probable cause: A large string around 140 kB is serialized by webpack cache.
- Impact: Potential slower local cache deserialization, not a confirmed production runtime issue.
- Recommended solution: Investigate only if local dev/test startup becomes a bottleneck.
- Risk: Low.
- Requires approval: No.
- How to test: Compare dev server startup timing before/after cleanup.

## Build Size Notes

Selected production build output:

- `/dashboard`: 253 kB first-load JS.
- `/transactions`: 205 kB first-load JS.
- `/admin`: 195 kB first-load JS.
- `/payables` and `/receivables`: 187 kB first-load JS.
- Middleware: 75.4 kB.

The build passes, but these sizes justify performance QA before redesign.
