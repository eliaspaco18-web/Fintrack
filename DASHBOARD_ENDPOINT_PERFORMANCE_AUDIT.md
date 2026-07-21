# Dashboard Endpoint Performance Audit

## Status

- Phase: B backend diagnosis only
- Scope: remaining `/dashboard` endpoint and backend instability after route prefetch noise was reduced
- Functional code changes: none
- Staging/commit/push: none
- Current route prefetch implementation: paused, uncommitted, and intentionally not discarded
- Paused B2.1 dashboard exchange-rate cleanup: intentionally not included

## Executive Summary

The route prefetch fix appears to reduce automatic module `_rsc` work, but cold `/dashboard` load is still unstable because the dashboard itself starts several expensive API requests at the same time.

The most important finding is that multiple dashboard endpoints call `DashboardService.getSummary()`. Each `getSummary()` call currently runs:

1. `fn_dashboard_summary` Supabase RPC.
2. `getDailyFlow(userId, 370)`, a 370-day `transactions` query.

On the initial dashboard seed alone, the app can call `getSummary()` three times in parallel:

- `/api/dashboard/summary`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

Then the default overview widgets can add more summary-like calls:

- `/api/dashboard`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`

This means a single cold dashboard load can duplicate the same Supabase RPC and 370-day daily-flow query several times. The most likely high-impact bottleneck is `/api/dashboard/sidebar`, because it calls `getSummary()` and then performs additional sidebar-specific Supabase queries.

`/api/exchange-rate?mode=live` is a separate source of instability when the live DB snapshot is stale or missing. In that path the route may try external exchange-rate providers with 3 second fetch timeouts, then attempt Supabase persistence before falling back.

## Current Local Evidence

Manual production-mode local testing used:

- `npm run build`
- `npm run start`
- Chrome DevTools Network filtered by `_rsc` and API requests

Observed behavior:

- Route prefetch changes reduced automatic module `_rsc` requests.
- Manual navigation still works.
- Dashboard first load remains variable:
  - fast runs: around 3-4 seconds
  - slow runs: around 9-12 seconds
- Slow requests now appear to be core dashboard/API requests:
  - `/api/dashboard/sidebar`
  - `/api/exchange-rate?mode=live`
  - `/api/dashboard`
  - `/api/dashboard/summary`
  - `/api/dashboard/modules-summary`
  - `/api/dashboard/money-flow?months=6&mode=acumulado`
  - `/api/dashboard/nav-badges`

No `/api/dashboard/current` route exists in the inspected repo. The closest full-current dashboard endpoint is `app/api/dashboard/route.ts`, exposed as `/api/dashboard`.

## Endpoint Map

| Endpoint | File | Service methods / backend work | Cold-load role | Notes |
| --- | --- | --- | --- | --- |
| `/api/dashboard/summary` | `app/api/dashboard/summary/route.ts` | `getSessionUserId()`, `DashboardService.getSummary(userId)`, unread `app_notifications` count | Initial seed blocker | Duplicates `fn_dashboard_summary` and `getDailyFlow(370)` with other summary-like endpoints. |
| `/api/dashboard/modules-summary` | `app/api/dashboard/modules-summary/route.ts` | `getSessionUserId()`, `DashboardService.getSummary(userId)` | Initial seed blocker | Uses summary-derived accounts, credits, assets, receivables, payables. Does not need `dailyFlow`. |
| `/api/dashboard/sidebar` | `app/api/dashboard/sidebar/route.ts` | `getSessionUserId()`, `DashboardService.getSummary(userId)`, then extra queries for credits, debtors, receivables, creditors, payables, month transactions, optional billing cycles, optional categories | Initial seed blocker | Likely heaviest initial endpoint. Does not need `dailyFlow`. |
| `/api/dashboard/money-flow?months=6&mode=acumulado` | `app/api/dashboard/money-flow/route.ts` | `getSessionUserId()`, `DashboardService.getCashFlow(userId, months)` using `v_monthly_cash_flow` | Initial seed blocker | Separate from `getSummary()`. Usually cheaper than sidebar/summary duplication unless the view is slow. |
| `/api/dashboard/nav-badges` | `app/api/dashboard/nav-badges/route.ts`, `lib/server/nav-badges.ts` | `getSessionUserId()`, three bounded count queries with 2.5s server query timeout | Shell non-blocking | Phase A4 bounded client fetch to 5s. Server helper falls back to zero badges on query failure. |
| `/api/dashboard` | `app/api/dashboard/route.ts` | `getSessionUserId()`, `DashboardService.getSummary(userId)` | Overview widget / full summary | Requested by `FinancialHealthScore` and wealth widgets. Duplicates full summary work. |
| `/api/dashboard/projection` | `app/api/dashboard/projection/route.ts` | `getSessionUserId()`, `DashboardService.getSummary(userId)`, then recurring, receivables, payables, installments, credits, billing-cycle projection work | Overview widget | Useful but not required for first KPI render. Does not appear to need 370-day `dailyFlow`. |
| `/api/dashboard/alerts` | `app/api/dashboard/alerts/route.ts` | `getSessionUserId()`, `DashboardService.getSummary(userId)`, then budget period/transaction alert work | Overview widget | Duplicates summary work and adds budget alert queries. Does not appear to need `dailyFlow`. |
| `/api/dashboard/saldos-dia?period=...` | `app/api/dashboard/saldos-dia/route.ts` | `getSessionUserId()`, `DashboardService.getDailyFlow(userId, days)` | Deferred tab / refresh | Not part of default overview until the Transactions tab or refresh mutation path needs it. |
| `/api/exchange-rate?mode=live` | `app/api/exchange-rate/route.ts`, `lib/server/exchange-rate.ts` | `getSessionUserId()`, `resolveLiveUsdPenExchangeRate()` | Shell non-blocking, but visible in waterfall | Uses layout fallback in `CurrencyProvider`, but still revalidates on mount. Can become slow if live cache is stale/missing. |

## `DashboardService.getSummary()` Fanout

`modules/dashboard/dashboard.service.ts` implements `getSummary(userId)` as:

1. `this.db.rpc('fn_dashboard_summary', { p_user_id: userId })`
2. `this.getDailyFlow(userId, 370)`
3. `mapRpcResult(raw, dailyFlow)`

The RPC already returns:

- net worth,
- current month,
- accounts,
- 6-month cash flow,
- top expense categories,
- credits,
- upcoming installments,
- receivables,
- payables,
- assets,
- exchange-rate metadata.

The extra 370-day daily-flow query selects from `transactions`:

- `transaction_date`
- `type`
- `amount_pen`

with filters:

- `user_id`
- `affects_reports = true`
- `type in ('INCOME', 'EXPENSE')`
- `transaction_date` between a 370-day range

This daily-flow data is attached to `DashboardSummary.dailyFlow`, but most summary-like endpoints do not use it.

## Repeated Supabase/RPC Work

### Initial seed duplication

`components/dashboard/DashboardWorkspace.tsx` blocks first useful dashboard content on four parallel requests:

- `/api/dashboard/summary`
- `/api/dashboard/money-flow?months=6&mode=acumulado`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

Three of those four call `DashboardService.getSummary()`:

- summary: `fn_dashboard_summary` + `getDailyFlow(370)`
- modules-summary: `fn_dashboard_summary` + `getDailyFlow(370)`
- sidebar: `fn_dashboard_summary` + `getDailyFlow(370)` + extra sidebar queries

So the initial seed can run the same RPC three times and the same 370-day transactions query three times.

### Overview widget duplication

After the seed resolves, default overview widgets mount and use SWR:

- `DashboardHeader` subscribes to `/api/dashboard/summary`, `/api/dashboard/modules-summary`, `/api/dashboard/money-flow?months=6&mode=acumulado`, and `/api/recurring?type=EXPENSE`.
- `FinancialHealthScore` subscribes to `/api/dashboard/summary`, `/api/dashboard/modules-summary`, `/api/dashboard/sidebar`, and `/api/dashboard`.
- `CashFlowProjectionWidget` subscribes to `/api/dashboard/projection`.
- `OverviewRiskStrip` subscribes to `/api/dashboard/alerts` and `/api/dashboard/sidebar`.

The workspace provides SWR fallback for the four seed keys and mutates them with `revalidate=false` after loading. However, the widget hooks do not set `revalidateIfStale: false`, so live testing should verify whether SWR still revalidates these keys on mount. The separate keys `/api/dashboard`, `/api/dashboard/projection`, `/api/dashboard/alerts`, and `/api/recurring?type=EXPENSE` are not part of the seed fallback and can add more network work.

## Answers To Requested Questions

### 1. Which dashboard endpoints call `DashboardService.getSummary()`?

Confirmed callers:

- `/api/dashboard/summary`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`
- `/api/dashboard`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`

Not direct `getSummary()` callers:

- `/api/dashboard/money-flow`
- `/api/dashboard/nav-badges`
- `/api/dashboard/saldos-dia`
- `/api/exchange-rate`

### 2. Which endpoints duplicate the same Supabase/RPC work during first load?

The first-load seed duplicates `getSummary()` work across:

- `/api/dashboard/summary`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

If overview widgets revalidate or request non-seed keys, these can duplicate summary work further:

- `/api/dashboard`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`

The repeated work is:

- repeated `fn_dashboard_summary` RPC,
- repeated 370-day `transactions` daily-flow query,
- repeated auth/session lookup through `getSessionUserId()`,
- repeated exchange-rate calculations based on summary metadata.

### 3. Which endpoint is most likely causing the 6-8 second delays?

Most likely primary bottleneck: `/api/dashboard/sidebar`.

Reasons:

- It calls `DashboardService.getSummary()`.
- That means it runs both `fn_dashboard_summary` and `getDailyFlow(370)`.
- After that it runs extra Supabase queries for active credit cards, debtors, receivables, creditors, payables, current-month transactions, optional billing cycles, and optional categories.
- It is part of the initial seed, so the dashboard skeleton waits for it.

Secondary likely bottlenecks:

- `/api/dashboard/summary` and `/api/dashboard/modules-summary`, because each repeats the same heavy `getSummary()` work.
- `/api/dashboard/projection` and `/api/dashboard/alerts`, if they are firing during the same first-load window.
- `/api/exchange-rate?mode=live`, if the live exchange-rate cache is stale or missing.

The 9-12 second slow runs are suspicious because `fetchWithTimeout` defaults to 12 seconds on the client. That means one or more API requests may be approaching the client timeout boundary rather than completing comfortably.

### 4. Is `/api/exchange-rate?mode=live` slow because of external fetch, Supabase persistence, or fallback logic?

It depends on cache state.

Fast path:

- `resolveLiveUsdPenExchangeRate()` calls `getLiveRateFromDb()`.
- If the live row is fresh within the 10-minute TTL, it returns from Supabase quickly.

Slow path:

- If the live row is missing or stale, it calls external providers.
- Each external fetch uses a 3 second timeout.
- Providers are tried sequentially:
  - configured ExchangeRate API, if env vars exist,
  - Open ER API,
  - exchangerate.host.
- If a fresh rate is found, it then attempts Supabase persistence:
  - `exchange_rates_live` upsert,
  - legacy `exchange_rates` insert,
  - daily `exchange_rates_daily` insert-if-missing.

Fallback only happens after these attempts fail or no cached rates exist. So slow `/api/exchange-rate?mode=live` is most likely external-fetch and/or persistence latency when the live cache is stale, not the fallback itself.

### 5. Is the 370-day daily-flow query necessary for every summary-like endpoint?

No.

The 370-day daily-flow query is not obviously needed by:

- `/api/dashboard/summary`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`

Those endpoints derive their responses from current-month, accounts, credits, receivables, payables, assets, upcoming installments, and related specific queries. They do not appear to read `summary.dailyFlow`.

The full `/api/dashboard` endpoint may need to preserve `dailyFlow` because it returns the full `DashboardSummary` contract. The dedicated `/api/dashboard/saldos-dia` endpoint also intentionally serves daily-flow series for selected periods.

### 6. Which optimizations can be done safely without changing API contracts?

Safe, contract-preserving options:

1. Add an internal `includeDailyFlow` option to `DashboardService.getSummary()` or split a `getSummaryBase()` helper.
   - Keep the public API responses unchanged.
   - Use `includeDailyFlow: false` for endpoints that do not expose or use dailyFlow.
   - Keep `includeDailyFlow: true` for `/api/dashboard` if that full contract needs dailyFlow.

2. Prevent overview widgets from revalidating seed-backed SWR keys immediately.
   - Use existing fallback data from `DashboardWorkspace`.
   - Add SWR options such as `revalidateIfStale: false` only for seed-backed dashboard keys.
   - Preserve API routes and response shapes.

3. Delay non-critical overview widget requests until after core seed renders.
   - Candidates: `/api/dashboard/projection`, `/api/dashboard/alerts`, `/api/recurring?type=EXPENSE`, `/api/dashboard`.
   - Preserve visual design, but render existing loading states later.

4. Avoid requesting `/api/dashboard` on the default overview if `FinancialHealthScore` can use already-seeded summary/modules/sidebar data.
   - This is a client-side data-source change, not an API contract change, if the visible calculations remain the same.

5. Add route-local server timing instrumentation around `getSummary()`, `getDailyFlow(370)`, and sidebar extra queries.
   - Logs only; no contract changes.
   - Useful before changing database or RPC behavior.

6. Tune `/api/exchange-rate?mode=live` usage from the client shell.
   - Keep using the layout-provided initial rate.
   - Delay or suppress immediate mount revalidation if not needed for first render.
   - Preserve the `/api/exchange-rate` response contract.

7. Add short client timeouts per dashboard seed request.
   - Current default is 12 seconds.
   - A dashboard-specific timeout could fail faster with the existing error state.
   - This improves control, not backend speed.

### 7. Which optimizations require owner approval?

Owner approval required:

- Any API response shape or field removal.
- Combining endpoints into a new bootstrap endpoint if it changes contracts or frontend expectations.
- Changing `fn_dashboard_summary` RPC signature or behavior.
- Adding or changing database indexes.
- Changing Supabase schema.
- Changing Supabase RLS policies.
- Changing migrations.
- Changing auth/session or middleware behavior.
- Changing Vercel environment variables or external exchange-rate provider configuration.
- Changing exchange-rate persistence semantics.
- Changing financial dashboard calculations.
- Introducing server-side shared caching that could serve stale financial data beyond an explicitly approved TTL.

## Likely Bottlenecks Ordered By Impact

### 1. Repeated `getSummary()` during initial seed

Impact: critical/high.

The dashboard blocks on three endpoints that each run the full summary path. This duplicates RPC and 370-day transaction scans before the first useful dashboard render.

### 2. `/api/dashboard/sidebar`

Impact: high.

It is part of the blocking seed and layers additional sidebar-specific Supabase queries after `getSummary()`.

### 3. Unneeded 370-day daily-flow inside most summary-like endpoints

Impact: high.

This query is repeated by every `getSummary()` caller even when the endpoint does not use dailyFlow.

### 4. Overview widget follow-up requests

Impact: medium/high.

`/api/dashboard`, `/api/dashboard/projection`, `/api/dashboard/alerts`, and `/api/recurring?type=EXPENSE` can add backend pressure immediately after seed render.

### 5. `/api/exchange-rate?mode=live`

Impact: medium/high when cache is stale; low when cache is fresh.

The live rate route is non-blocking for dashboard data because `CurrencyProvider` has a fallback rate, but it can still consume network/server time during cold load.

### 6. `/api/dashboard/nav-badges`

Impact: low/medium.

It is bounded after Phase A4 and non-blocking, but it still performs three Supabase count queries.

## Recommendation: Keep Or Pause The Prefetch Fix?

Recommendation: keep the prefetch fix as a separate focused PR, but do not mix it with dashboard backend fixes.

Reasons to keep it:

- It demonstrably reduced automatic module `_rsc` requests.
- It is shell navigation behavior only.
- It does not change API contracts, dashboard calculations, Supabase, auth, middleware, schema, or RLS.
- It removes unrelated noise from future dashboard performance measurements.

Reasons not to mix it with backend work:

- The remaining instability is in dashboard/core API endpoints, not route prefetch.
- Backend changes will touch different files and carry different risks.
- Keeping the PR focused makes rollback easy.

Recommended order:

1. Finish local validation of the prefetch fix.
2. Commit/push the prefetch fix separately after approval.
3. Start a separate dashboard backend performance PR from a clean branch.

## Recommended Safe Fix Order For Next Backend Phase

1. Add measurement first.
   - Log timings for `getSummary()`, `fn_dashboard_summary`, `getDailyFlow(370)`, and sidebar extra queries.
   - Confirm which endpoint actually takes 6-8 seconds in slow runs.

2. Remove unneeded `dailyFlow` work from summary-like endpoints.
   - Internal service option only.
   - Keep `/api/dashboard` full summary behavior intact unless explicitly approved.

3. Stop immediate SWR revalidation for seed-backed keys.
   - Preserve fallback data.
   - Do not change API contracts.

4. Delay non-critical overview widget endpoints.
   - Start with `/api/dashboard/projection`, `/api/dashboard/alerts`, `/api/recurring?type=EXPENSE`, and `/api/dashboard`.

5. Reassess `/api/exchange-rate?mode=live`.
   - If slow only on stale cache, consider delaying mount revalidation or adjusting refresh policy.
   - Keep the layout-provided initial rate for first render.

6. Only after measuring: propose RPC/index/database changes if still needed.

## Exact Before/After Metrics To Capture

Capture at least 5 hard reloads per build in Chrome DevTools with `Disable cache` enabled.

For each run, record:

- total time from hard reload to dashboard skeleton disappearing,
- document request TTFB and duration,
- endpoint request start time,
- endpoint duration,
- endpoint waiting/TTFB,
- endpoint content download time,
- HTTP status,
- response size,
- initiator,
- whether request was blocking seed or widget follow-up,
- whether duplicate endpoint requests occurred,
- whether any request hit the 12 second client timeout,
- console errors,
- server terminal warnings from `measureServerOperation`.

Endpoint-specific rows to capture:

- `/api/dashboard/summary`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`
- `/api/dashboard/money-flow?months=6&mode=acumulado`
- `/api/dashboard`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`
- `/api/dashboard/nav-badges`
- `/api/exchange-rate?mode=live`
- `/api/recurring?type=EXPENSE`

Suggested table:

| Run | Endpoint | Start ms | Duration ms | Waiting ms | Size | Status | Initiator | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |

Compare:

- min duration,
- median duration,
- max duration,
- p95 if enough runs are captured,
- number of dashboard API requests before first useful render,
- number of `getSummary()`-backed endpoints before first useful render.

## Local Test Checklist

1. Keep current prefetch changes uncommitted.
2. Run `npm run build`.
3. Run `npm run start`.
4. Open Chrome DevTools Network.
5. Enable `Disable cache`.
6. Clear previous requests.
7. Hard reload `/dashboard`.
8. Record endpoint timings listed above.
9. Repeat at least 5 times.
10. In the terminal, watch for `measureServerOperation` warnings:
    - `api.dashboard.summary`
    - `api.dashboard.modules-summary`
    - `api.dashboard.sidebar`
    - `api.dashboard.projection`
    - `api.dashboard.alerts`
    - `api.exchange-rate`
    - `dashboard.nav-badges`
11. Export a HAR if a run takes 9-12 seconds.
12. Confirm manual navigation still works after the page loads.

## Vercel Preview Checklist

1. Deploy the focused prefetch branch to Vercel Preview only after owner approval.
2. Sign in with a test user.
3. Open Chrome DevTools Network.
4. Enable `Disable cache`.
5. Hard reload `/dashboard`.
6. Capture at least 5 runs.
7. Record the same endpoint timing table.
8. Check Vercel function logs for slow route warnings.
9. Compare local production vs Vercel Preview:
   - Is `/api/dashboard/sidebar` slow in both?
   - Is `/api/exchange-rate?mode=live` slow only when deployed?
   - Are `/api/dashboard/projection` and `/api/dashboard/alerts` firing before or after the main seed?
   - Are duplicate `getSummary()` endpoints overlapping?
10. Do not merge backend performance changes until Preview confirms a stable improvement.

## Simple Spanish Summary

El problema ya no parece ser principalmente la precarga de otras páginas. Ahora el dashboard está haciendo mucho trabajo propio al abrirse.

Varios endpoints del dashboard repiten el mismo cálculo pesado: llaman al resumen general y además consultan el flujo diario de los últimos 370 días. Eso puede repetirse varias veces en una sola carga. El endpoint más sospechoso es `/api/dashboard/sidebar`, porque hace ese resumen pesado y luego hace más consultas adicionales.

La solución más segura sería medir primero con más detalle, luego evitar que endpoints que no necesitan el flujo diario de 370 días lo calculen, y después reducir recargas duplicadas del dashboard. La corrección de prefetch debería mantenerse como PR separado porque sí redujo ruido, pero no debe mezclarse con estos cambios de backend.
