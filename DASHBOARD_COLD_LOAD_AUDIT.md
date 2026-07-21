# Dashboard Cold Load Audit

## Scope

Phase B1 diagnosis only. This audit reviews the current cold direct `/dashboard` loading path before any dashboard optimization. It does not change functional code, UI, API routes, dashboard calculations, middleware, auth/session behavior, Supabase schema, Supabase RLS, Vercel environment variables, or API contracts.

## Files Reviewed

- `app/(dashboard)/dashboard/page.tsx`
- `components/dashboard/DashboardClient.tsx`
- `components/dashboard/DashboardWorkspace.tsx`
- `components/dashboard/api.ts`
- `lib/hooks/useDashboard.tsx`
- `app/api/dashboard/route.ts`
- `app/api/dashboard/summary/route.ts`
- `app/api/dashboard/modules-summary/route.ts`
- `app/api/dashboard/money-flow/route.ts`
- `app/api/dashboard/sidebar/route.ts`
- `app/api/dashboard/alerts/route.ts`
- `app/api/dashboard/projection/route.ts`
- `app/api/dashboard/saldos-dia/route.ts`
- `modules/dashboard/dashboard.service.ts`
- `app/(dashboard)/layout.tsx` as context only
- `components/layout/AppShell.tsx` as context only
- Dashboard widgets that mount on the default overview tab

## Measurement Method

This report is a static code-trace waterfall. A real authenticated browser/Vercel timing capture is still required because this environment does not have an approved production-like authenticated test session for live Supabase timing.

The static trace is still enough to identify the current request graph, blocking points, duplicate server work, and safest future optimization order.

## Cold Direct `/dashboard` Waterfall Map

### Phase 0: document request and authenticated layout

Runs on the server before the client dashboard workspace can hydrate.

| Order | Request/work | Location | Server or client | Blocks first document? | Notes |
| --- | --- | --- | --- | --- | --- |
| 0.1 | Authenticated route/session resolution | `app/(dashboard)/layout.tsx` | Server | Yes | The layout calls Supabase `auth.getUser()` before rendering authenticated content. This audit does not touch auth/session. |
| 0.2 | Profile preload | `app/(dashboard)/layout.tsx` | Server | Yes | Runs inside `getLayoutData()` with a 4 second timeout fallback. |
| 0.3 | Accounting/live exchange-rate preload | `app/(dashboard)/layout.tsx` | Server | Yes | `ensureAccountingUsdPenExchangeRate()` and `resolveLiveUsdPenExchangeRate()` run in parallel with the profile query. |
| 0.4 | Dashboard page exchange-rate fetch | `app/(dashboard)/dashboard/page.tsx` | Server | Yes | `resolveLiveUsdPenExchangeRate()` runs again in the dashboard page. The result is passed as `initialExchangeRate`, but the client ignores it. |

### Phase 1: app shell client hydration

Runs after the server document is delivered.

| Order | Request/work | Location | Server or client | Blocks dashboard workspace? | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.1 | `/api/exchange-rate?mode=live` | `CurrencyProvider` in `lib/hooks/useDashboard.tsx` via `AppShell` | Client | No | Uses fallback from the server layout exchange rate. This is useful for live refresh, but not needed for first dashboard content. |
| 1.2 | `/api/dashboard/nav-badges` | `components/layout/AppShell.tsx` | Client | No | Phase A4 made this timeout-bounded and non-blocking. |

### Phase 2: dashboard workspace seed

Runs in `DashboardWorkspace.useEffect()` after hydration. This is the first dashboard-specific client data gate. The full dashboard content does not render until all four calls resolve.

| Order | Request | Location | Server or client | Blocks first useful dashboard render? | Server work |
| --- | --- | --- | --- | --- | --- |
| 2.1 | `/api/dashboard/summary` | `DashboardWorkspace.fetchWorkspaceData()` | Client | Yes | Calls `DashboardService.getSummary()`, which calls `fn_dashboard_summary` and `getDailyFlow(userId, 370)`, then counts unread notifications. |
| 2.2 | `/api/dashboard/money-flow?months=6&mode=acumulado` | `DashboardWorkspace.fetchWorkspaceData()` | Client | Yes | Calls `DashboardService.getCashFlow(userId, 6)`. |
| 2.3 | `/api/dashboard/modules-summary` | `DashboardWorkspace.fetchWorkspaceData()` | Client | Yes | Calls `DashboardService.getSummary()` again. |
| 2.4 | `/api/dashboard/sidebar` | `DashboardWorkspace.fetchWorkspaceData()` | Client | Yes | Calls `DashboardService.getSummary()` again, then performs additional sidebar-specific Supabase queries. |

### Phase 3: default overview tab widgets

Runs after the seed exists and the overview tab mounts. These are not supposed to block the workspace shell because the seed is provided through SWR fallback, but SWR may still revalidate keys depending on cache freshness and mount behavior. Live network capture is needed to confirm actual revalidation timing.

| Widget | Requests used on overview | Critical for first useful dashboard render? | Notes |
| --- | --- | --- | --- |
| `DashboardHeader` | `/api/dashboard/summary`, `/api/dashboard/modules-summary`, `/api/dashboard/money-flow?months=6&mode=acumulado`, `/api/recurring?type=EXPENSE` | Partly | First three overlap the seed keys; recurring is extra. |
| `FinancialHealthScore` | `/api/dashboard/summary`, `/api/dashboard/modules-summary`, `/api/dashboard/sidebar`, `/api/dashboard` | Partly | The first three overlap the seed keys; `/api/dashboard` is extra and calls the heavy full summary service again. |
| `CashFlowProjectionWidget` | `/api/dashboard/projection` | No | Useful, but non-critical for initial KPI/header scan. Calls `DashboardService.getSummary()` before projection-specific queries. |
| `OverviewRiskStrip` | `/api/dashboard/alerts`, `/api/dashboard/sidebar` | No | Sidebar overlaps seed; alerts is extra and calls `DashboardService.getSummary()`. |

### Phase 4: non-default tabs

These requests are not part of the initial direct `/dashboard` overview load because inactive tab panels render `null`.

| Tab | Deferred requests |
| --- | --- |
| Transactions | `/api/dashboard/money-flow?months={n}&mode=mensual`, `/api/dashboard/saldos-dia?period={period}`, `/api/dashboard/sidebar?period={YYYY-MM}` |
| Budgets | `/api/budget-periods?period={YYYY-MM}` from two widgets |
| Credits | `/api/dashboard/modules-summary` |
| Cash due | `/api/dashboard/sidebar`, `/api/dashboard/projection` |
| Wealth | `/api/dashboard/money-flow?months=6&mode=acumulado`, `/api/dashboard`, `/api/dashboard/sidebar` |

## Answers To Phase B1 Questions

### 1. What requests run on a cold direct `/dashboard` visit?

Code-traced cold direct visit:

Server/document path:

- Supabase session lookup in authenticated layout.
- Profile preload in authenticated layout.
- Accounting/live exchange-rate preload in authenticated layout.
- A second `resolveLiveUsdPenExchangeRate()` in `app/(dashboard)/dashboard/page.tsx`.

Client shell path:

- `/api/exchange-rate?mode=live`
- `/api/dashboard/nav-badges`

Client dashboard seed path:

- `/api/dashboard/summary`
- `/api/dashboard/money-flow?months=6&mode=acumulado`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

Overview widget path after seed:

- Potential SWR reads/revalidations of `/api/dashboard/summary`
- Potential SWR reads/revalidations of `/api/dashboard/modules-summary`
- Potential SWR reads/revalidations of `/api/dashboard/money-flow?months=6&mode=acumulado`
- Potential SWR reads/revalidations of `/api/dashboard/sidebar`
- `/api/recurring?type=EXPENSE`
- `/api/dashboard`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`

### 2. Which requests are server-side and which are client-side?

Server-side:

- Layout auth/session lookup.
- Layout profile query.
- Layout exchange-rate work.
- Dashboard page exchange-rate work.
- Server work behind every API route after client requests reach the server.

Client-side browser requests:

- `/api/exchange-rate?mode=live`
- `/api/dashboard/nav-badges`
- `/api/dashboard/summary`
- `/api/dashboard/money-flow?months=6&mode=acumulado`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`
- `/api/recurring?type=EXPENSE`
- `/api/dashboard`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`
- Deferred tab requests listed in Phase 4 only after tab changes.

### 3. Are any requests duplicated between server preload, SWR fallback, widgets, sidebar, or tabs?

Yes.

Confirmed duplicate or repeated work:

- Exchange rate is loaded in the authenticated layout and again in `app/(dashboard)/dashboard/page.tsx`.
- `/api/dashboard/summary`, `/api/dashboard/modules-summary`, `/api/dashboard/money-flow?months=6&mode=acumulado`, and `/api/dashboard/sidebar` are loaded by `DashboardWorkspace.fetchWorkspaceData()` and then reused by overview widgets through SWR keys.
- Even if SWR uses fallback/cache correctly, several widgets still subscribe to the same keys and may revalidate unless explicitly told not to.
- `/api/dashboard/sidebar` is used by the seed, `FinancialHealthScore`, and `OverviewRiskStrip` on the default overview tab.
- `/api/dashboard` is requested by `FinancialHealthScore` even though the seed already fetched summary/modules/sidebar-derived data.
- Server-side `DashboardService.getSummary()` is repeated across `/api/dashboard/summary`, `/api/dashboard/modules-summary`, `/api/dashboard/sidebar`, `/api/dashboard`, `/api/dashboard/alerts`, and `/api/dashboard/projection`.
- Every `DashboardService.getSummary()` call runs both the `fn_dashboard_summary` RPC and `getDailyFlow(userId, 370)`.

Possible duplicate work that must be confirmed in live network timing:

- Immediate SWR revalidation after seed mount for keys supplied through `SWRConfig` fallback and `mutate(..., false)`.
- Deduping across multiple overview widgets subscribing to the same key in the same render window.

### 4. Is `initialExchangeRate` used or fetched unnecessarily?

`initialExchangeRate` appears to be fetched unnecessarily in `app/(dashboard)/dashboard/page.tsx`.

Evidence:

- `DashboardPage` calls `resolveLiveUsdPenExchangeRate()` and passes `exchangeRateSnapshot.rate` into `DashboardClient`.
- `DashboardClient` receives `_props` but ignores them and renders `<DashboardWorkspace />`.
- The authenticated layout already passes an exchange rate into `AppShell`, and `AppShell` passes it into `CurrencyProvider`.

Smallest future fix: remove the dashboard page exchange-rate fetch and remove the unused `DashboardClient` prop, or wire it only if there is a real dashboard-specific need. Removing it should not change API contracts.

### 5. Which dashboard requests are blocking first useful render?

Blocking before any authenticated shell:

- Layout auth/session lookup.
- Layout profile/exchange-rate preload.
- Dashboard page exchange-rate fetch.

Blocking first useful dashboard content:

- `/api/dashboard/summary`
- `/api/dashboard/money-flow?months=6&mode=acumulado`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

The current dashboard workspace shows a skeleton until all four seed requests complete. A failure in any one of the four requests can send the whole dashboard into the error state.

Non-blocking after the initial workspace appears:

- `/api/exchange-rate?mode=live`
- `/api/dashboard/nav-badges`
- `/api/recurring?type=EXPENSE`
- `/api/dashboard`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`
- Any inactive-tab request.

### 6. Which requests are non-critical and can be delayed, reused, cached, or made fallback-based later?

Good candidates for delay or fallback reuse:

- `/api/exchange-rate?mode=live`: already has layout fallback and can refresh after the first render.
- `/api/dashboard/nav-badges`: already timeout-bounded and non-blocking after Phase A4.
- `/api/recurring?type=EXPENSE`: only enriches DashboardHeader; not needed for initial KPI visibility.
- `/api/dashboard/projection`: useful but not required for first KPI/header scan.
- `/api/dashboard/alerts`: useful risk strip data; can render from sidebar/summary fallback first or load after the core dashboard.
- `/api/dashboard`: avoid on the default overview if the needed fields can come from the already loaded seed.
- Deferred tab endpoints: keep deferred until tab activation.

Good candidates for reuse:

- Reuse the initial seed values for overview widgets without immediate revalidation.
- Avoid requesting `/api/dashboard` from `FinancialHealthScore` on the overview tab if the needed `assets.byType` data can be moved into an existing seed later without changing public API contracts, or compute the score from existing summary/modules/sidebar values first.
- Use one authoritative dashboard seed/cache for summary/modules/sidebar/money-flow within the dashboard workspace.

### 7. Which files would be modified in a future Phase B2 fix?

Likely low-risk files:

- `app/(dashboard)/dashboard/page.tsx`
- `components/dashboard/DashboardClient.tsx`
- `components/dashboard/DashboardWorkspace.tsx`
- `components/dashboard/DashboardHeader.tsx`
- `components/dashboard/FinancialHealthScore.tsx`
- `components/dashboard/OverviewRiskStrip.tsx`
- `components/dashboard/CashFlowProjectionWidget.tsx`
- `components/dashboard/api.ts` if dashboard-specific timeout tuning is needed

Possible later files if a broader but still contract-compatible cache/helper is approved:

- `modules/dashboard/dashboard.service.ts`
- `app/api/dashboard/summary/route.ts`
- `app/api/dashboard/modules-summary/route.ts`
- `app/api/dashboard/sidebar/route.ts`
- `app/api/dashboard/alerts/route.ts`
- `app/api/dashboard/projection/route.ts`

Avoid in Phase B2 unless explicitly approved:

- `middleware.ts`
- auth/session helpers
- Supabase schema or RLS files
- database migrations
- API response contract files
- redesign/theme/layout files unrelated to dashboard fetching

### 8. What changes would require owner approval?

Owner approval required:

- Any API response shape change.
- Any new API endpoint or removal of an existing endpoint if external callers may depend on it.
- Any middleware or auth/session change.
- Any Supabase schema, RLS, migration, RPC, or index change.
- Any Vercel environment variable or deployment behavior change.
- Any dashboard calculation/business-rule change.
- Any redesign or visible dashboard restructuring.

Owner approval not required for the smallest safe Phase B2 optimization if it only:

- Removes the unused dashboard page exchange-rate fetch.
- Keeps existing API endpoints and response contracts.
- Reuses existing SWR fallback/cache data.
- Delays non-critical widget fetches while preserving the current visible UI and eventual data.

### 9. What is the smallest safe future optimization that preserves API contracts?

Recommended smallest safe Phase B2 sequence:

1. Remove the unused `initialExchangeRate` path from `app/(dashboard)/dashboard/page.tsx` and `DashboardClient`, because the authenticated layout already feeds `CurrencyProvider`.
2. Keep the four existing seed endpoints but make overview widgets consume the seed cache without immediate revalidation on first mount. For example, set `revalidateOnMount: false` where the seed already populates the same SWR key.
3. Keep `/api/recurring?type=EXPENSE`, `/api/dashboard/projection`, `/api/dashboard/alerts`, and `/api/dashboard` non-blocking, and consider delaying them until after the seed content paints.
4. Remove the default overview dependency on `/api/dashboard` if `FinancialHealthScore` can gracefully compute from summary/modules/sidebar seed values. If it cannot, document the missing data before changing contracts.
5. Only after live Vercel measurements, consider a server-side/shared request cache around `DashboardService.getSummary()` within a single request lifecycle or endpoint family. Do not change API contracts without owner approval.

This order reduces wasted work without changing calculations or endpoint shapes.

## Suspected Duplicate Or Unnecessary Fetches

| Item | Severity | Why it matters | Future action |
| --- | --- | --- | --- |
| Dashboard page `resolveLiveUsdPenExchangeRate()` | Medium | It blocks the server page but `DashboardClient` ignores `initialExchangeRate`. | Remove or wire only if needed. |
| `DashboardService.getSummary()` repeated by multiple endpoints | High | Each call runs the dashboard RPC plus a 370-day daily-flow query. | Reuse seed/cache first; consider server request caching later. |
| `/api/dashboard` on default overview | Medium | It calls full summary after seed endpoints already loaded much of the dashboard. | Avoid or delay if `FinancialHealthScore` can use seed data. |
| `/api/dashboard/projection` on default overview | Medium | Calls full summary plus projection-specific queries. | Delay or render non-blocking skeleton after core KPI paint. |
| `/api/dashboard/alerts` on default overview | Medium | Calls full summary plus budget-period checks. | Delay or render from fallback/risk approximation first. |
| Immediate SWR revalidation of seed keys | Medium until measured | May duplicate seed requests right after `fetchWorkspaceData()`. | Confirm in DevTools; add `revalidateOnMount: false` only for seeded keys if duplicated. |

## Recommended Safe Optimization Order

### B2.1 Remove unused dashboard page exchange-rate fetch

- Files: `app/(dashboard)/dashboard/page.tsx`, `components/dashboard/DashboardClient.tsx`
- Risk: Low.
- Approval required: No, if behavior remains unchanged and the layout exchange rate continues feeding `CurrencyProvider`.
- Test: Confirm dashboard currency toggle and exchange-rate display behavior remain correct.

Implementation status: completed. The dashboard page no longer calls `resolveLiveUsdPenExchangeRate()` or passes `initialExchangeRate` into `DashboardClient`. `DashboardClient` now renders `DashboardWorkspace` without unused props. The authenticated layout/AppShell/CurrencyProvider exchange-rate path remains unchanged.

### B2.2 Prevent immediate revalidation of seeded SWR keys

- Files: `components/dashboard/DashboardHeader.tsx`, `components/dashboard/FinancialHealthScore.tsx`, `components/dashboard/OverviewRiskStrip.tsx`, possibly widgets that use seeded keys.
- Risk: Low to medium.
- Approval required: No, if endpoint contracts and visible data are preserved.
- Test: Capture Network tab before/after and verify the four seed keys are not fetched twice on first overview mount.

### B2.3 Delay non-critical overview widget requests

- Files: `components/dashboard/CashFlowProjectionWidget.tsx`, `components/dashboard/OverviewRiskStrip.tsx`, `components/dashboard/DashboardHeader.tsx`, `components/dashboard/FinancialHealthScore.tsx`.
- Risk: Medium because it can affect perceived freshness or widget skeleton timing.
- Approval required: No if visible behavior stays equivalent; yes if changing product behavior.
- Test: Confirm first KPI/header paint improves and widgets still fill in automatically.

### B2.4 Reduce full-dashboard `/api/dashboard` usage on overview

- Files: `components/dashboard/FinancialHealthScore.tsx`, `components/dashboard/PatrimonioComposicionWidget.tsx` if applied later to wealth tab.
- Risk: Medium.
- Approval required: Yes if the required data must be added to existing API responses; no if the widget can safely use existing seed values.
- Test: Compare health score and wealth composition numbers before/after with seeded accounts/assets/transactions.

### B2.5 Consider server-side summary reuse

- Files: dashboard route handlers and/or `modules/dashboard/dashboard.service.ts`.
- Risk: Medium to high.
- Approval required: Yes if it changes endpoint behavior, caching semantics, calculations, or Supabase/RPC behavior.
- Test: Compare endpoint payloads byte-for-byte or with contract tests before/after; inspect Vercel function durations.

## Risk Level

Current risk from the cold-load issue: medium-high.

Reasons:

- First useful dashboard render is gated by four parallel client endpoints.
- Three of those four seed endpoints call `DashboardService.getSummary()`.
- Several overview widgets can add additional expensive endpoint calls immediately after seed.
- The page performs at least one unnecessary server exchange-rate fetch.

Risk of the smallest future optimization: low to medium if limited to removing unused exchange-rate work and preventing duplicate seeded SWR revalidation.

## Local Test Steps

1. Start the app with `npm run dev`.
2. Sign in with a test user.
3. Open DevTools Network tab.
4. Enable "Disable cache".
5. Hard reload `/dashboard`.
6. Record the document request timing.
7. Record all dashboard-related API calls:
   - `/api/exchange-rate?mode=live`
   - `/api/dashboard/nav-badges`
   - `/api/dashboard/summary`
   - `/api/dashboard/money-flow?months=6&mode=acumulado`
   - `/api/dashboard/modules-summary`
   - `/api/dashboard/sidebar`
   - `/api/recurring?type=EXPENSE`
   - `/api/dashboard`
   - `/api/dashboard/projection`
   - `/api/dashboard/alerts`
8. Confirm whether the four seed keys are requested once or re-requested after widgets mount.
9. Capture a screenshot or HAR of the waterfall.
10. Click each dashboard tab and record additional requests separately from the cold overview load.
11. Run `npm run lint`.
12. Run `npm run typecheck`.
13. Run `npm run build`.
14. Run `npm run start`, sign in again, and repeat the hard-refresh waterfall in production mode.

## Vercel Preview Test Steps

1. Deploy a future focused Phase B2 branch to Vercel Preview.
2. Sign in with a preview-safe test user.
3. Open `/dashboard` directly in a new tab.
4. In Chrome DevTools, enable "Disable cache" and hard reload.
5. Export or screenshot the Network waterfall.
6. Record timings for:
   - document request
   - `/api/dashboard/summary`
   - `/api/dashboard/money-flow?months=6&mode=acumulado`
   - `/api/dashboard/modules-summary`
   - `/api/dashboard/sidebar`
   - `/api/dashboard`
   - `/api/dashboard/projection`
   - `/api/dashboard/alerts`
   - `/api/recurring?type=EXPENSE`
   - `/api/exchange-rate?mode=live`
   - `/api/dashboard/nav-badges`
7. In Vercel function logs, record durations for all dashboard API routes.
8. Confirm no route shows repeated `DashboardService.getSummary()` work beyond expected calls.
9. Confirm the dashboard first useful content appears before non-critical widgets finish.
10. Confirm no dashboard calculation values changed unexpectedly.
11. Confirm browser console has no runtime errors.
12. Repeat once with a warm reload and compare cold vs warm behavior.

## Spanish Summary

El dashboard carga varias cosas al mismo tiempo. Primero el servidor revisa la sesion, perfil y tipo de cambio. Luego el navegador espera cuatro llamadas principales del dashboard antes de mostrar el contenido completo. Despues, algunos widgets vuelven a pedir datos parecidos o datos pesados adicionales. El primer arreglo seguro recomendado es quitar una carga de tipo de cambio que no se usa y evitar que los widgets repitan llamadas que ya fueron cargadas, sin cambiar calculos ni contratos de API.
