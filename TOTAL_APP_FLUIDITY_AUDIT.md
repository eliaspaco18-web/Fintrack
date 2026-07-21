# Total App Fluidity Audit

Status: diagnosis only
Date: 2026-07-05
Scope: authenticated app perceived performance after A1, A2, A3, A4, shell route prefetch, and B2.2 daily-flow optimization.

## Executive Summary

FinTrack is more stable than at the start of the stabilization plan, but it still does not feel instantly fast because several routes still wait for server preloads, the dashboard waits for multiple backend endpoints before showing real content, and some modules hide the first useful screen behind one combined client loading state.

The biggest remaining perceived-performance issue is the dashboard. `components/dashboard/DashboardWorkspace.tsx` waits for four requests to finish before rendering the dashboard seed:

- `/api/dashboard/summary`
- `/api/dashboard/money-flow?months=6&mode=acumulado`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

If any one of those endpoints is slow, the whole dashboard remains on the large skeleton. After the seed resolves, the overview tab also mounts widgets that request additional dashboard data such as `/api/dashboard`, `/api/dashboard/projection`, `/api/dashboard/alerts`, and `/api/recurring?type=EXPENSE`.

The authenticated shell route prefetch fix should stay considered complete. The current remaining slowness is no longer primarily caused by sidebar/topbar route prefetch. It is mostly a mixed dashboard endpoint, server preload, exchange-rate, and client waterfall problem.

## Readiness Answer

We are ready to continue with focused performance fixes, but not a broad redesign. The next work should be implementation-sized and measured:

1. Remove the unused dashboard page exchange-rate fetch.
2. Make the dashboard render progressively instead of waiting for every seed endpoint.
3. Prevent fallback-backed dashboard SWR hooks from immediately revalidating when seed data already exists.
4. Delay non-critical overview widgets until after first useful render.

More backend or platform changes need diagnosis and owner approval first.

## Module-by-Module Fluidity Score

Scoring:

- 5: feels immediate; shell/content appears quickly with bounded fetches and localized loading.
- 4: generally fluid; minor background or modal fetch risk.
- 3: acceptable but visible skeletons or preload waits remain.
- 2: slow or inconsistent on cold direct visits.
- 1: likely to feel stuck or block key UI.

| Module | Score | Current behavior | Main fluidity blockers | Safe now? |
| --- | ---: | --- | --- | --- |
| App shell/layout | 3 | Server layout blocks on auth, profile, and exchange-rate data before `AppShell` renders. Nav badges are now bounded and non-blocking. Route prefetch is disabled for shell links. | `app/(dashboard)/layout.tsx` still waits up to 4s for profile/exchange-rate layout data. `CurrencyProvider` then revalidates `/api/exchange-rate?mode=live`. | Partial. Shell-level auth changes are approval-gated. |
| Dashboard | 2 | Client dashboard shows large skeleton until four seed endpoints finish. Overview widgets then request additional endpoints. | Seed `Promise.all`, repeated dashboard endpoint work, stale live exchange-rate path, unused page-level exchange-rate fetch, possible SWR revalidation after fallback. | Yes for client gating and unused fetch cleanup. |
| Portfolio | 4 | A1 removed first direct visit server blocking. `PortfolioManager` loads account, bank, and currency data on client with bounded fetches. | Still has a full list skeleton while account data loads. Some mutation calls use raw `fetch`, but they are user-triggered. | Yes. |
| Movements / transactions | 3 | Page server-preloads transaction form options with 4s timeout and explicit warnings from A2. List loads client-side through `useTransactions`. | First render still waits for option preload and initial-value resolution. Form exchange-rate lookup uses raw fetch. Export metadata uses raw fetch. | Partial. Moving more option loading client-side is a behavior decision. |
| Credits | 3 | Page renders workspace quickly. List uses `useCredits` with `fetchWithTimeout`. Options for forms and bank entities are loaded separately. | First useful list waits on `/api/credits`. Form option loads use raw `fetch` in places. Bank-entity option fetch failure is silently ignored in list filter. | Yes for bounded option fetches and warnings. |
| Budgets | 3 | `BudgetsManager` fetches budgets and categories in parallel, then period rows. | Combined manager loading can hold much of the page. Period rows add a second request. Some mutations use raw fetch. | Yes for progressive manager loading and bounded raw fetch replacement. |
| Assets | 3 | Page renders workspace quickly. List uses `useAssets` with `fetchWithTimeout`; asset-type filter loads separately with raw fetch. | Asset-type option failure is silently ignored. First list still waits on `/api/assets`. | Yes. |
| Receivables | 2 | Page server-fetches live exchange rate before mounting `ReceivablesManager`, then manager fetches `/api/debtors`. | Duplicate/unnecessary exchange-rate server fetch path can block route. Manager shows module loading while `/api/debtors` resolves. Detail drawer fetches ledger/account data after selection. | Yes for exchange-rate cleanup if values can come from `CurrencyProvider`. |
| Payables | 2 | Same pattern as receivables: page server-fetches live exchange rate, then workspace fetches `/api/creditors`. | Duplicate/unnecessary exchange-rate server fetch path and full manager loading. | Yes for exchange-rate cleanup if values can come from `CurrencyProvider`. |
| Recurring | 3 | Page renders workspace quickly. Workspace fetches `/api/recurring` with `fetchWithTimeout`. | Full module loading until rows arrive. Form option loaders use raw fetch for accounts/categories. | Yes. |
| Alerts | 3 | Page renders workspace quickly. Workspace fetches `/api/alerts` with `fetchWithTimeout`. | Full module loading until alerts arrive. Generate/mark-all actions perform sequential or raw fetch operations. | Yes for non-critical action polish later. |
| Settings/configuration | 2 | A3 added explicit warnings and save protection. Page still server-preloads profile and accounts before rendering selected panel. Notifications panel fetches preferences client-side. | Server preload can block up to 4s. Notification fetch uses raw fetch and hard-coded defaults are protected by warning but still not timeout-bounded. | Partial. Sensitive saves should stay protected. |

## Route-by-Route Loading Map

### Shared authenticated layout

Route group: `app/(dashboard)/layout.tsx`

Blocking server work:

- `supabase.auth.getUser()`
- `profiles` query with 4s timeout
- `ensureAccountingUsdPenExchangeRate()`
- `resolveLiveUsdPenExchangeRate()`

Client follow-up work:

- `AppShell` SWR fetches `/api/dashboard/nav-badges` with `fetchWithTimeout`, 5s timeout, `fallbackData`, no retry.
- `CurrencyProvider` SWR fetches `/api/exchange-rate?mode=live` with `fallbackData`, no focus revalidation, reconnect revalidation, and 5 minute refresh.

Perceived risk:

- If exchange-rate cache is stale or missing, layout and client currency refresh can hit external providers and Supabase persistence paths.
- The shell cannot render until auth and layout data return.

### `/dashboard`

Server work:

- `app/(dashboard)/dashboard/page.tsx` calls `resolveLiveUsdPenExchangeRate()`.
- The returned `initialExchangeRate` is passed to `DashboardClient`, but `DashboardClient` ignores its props.

Client seed work:

- `DashboardWorkspace.fetchWorkspaceData()` waits for:
  - `/api/dashboard/summary`
  - `/api/dashboard/money-flow?months=6&mode=acumulado`
  - `/api/dashboard/modules-summary`
  - `/api/dashboard/sidebar`

Client overview widget work after seed:

- `DashboardHeader`: summary, modules-summary, money-flow, recurring expenses.
- `FinancialHealthScore`: summary, modules-summary, sidebar, full `/api/dashboard`.
- `CashFlowProjectionWidget`: `/api/dashboard/projection`.
- `OverviewRiskStrip`: `/api/dashboard/alerts`, sidebar.

Perceived risk:

- A single slow seed endpoint keeps the whole dashboard on `WorkspaceSkeleton`.
- The overview tab can still start additional endpoint work immediately after the seed.
- Full `/api/dashboard` still includes `dailyFlow` by default and is used by health/wealth widgets.

### `/portfolio`

Server work:

- Minimal page render only.

Client work:

- `PortfolioManager` loads accounts, bank entities, and currencies through bounded client fetch paths.

Perceived risk:

- The module is much improved after A1.
- First useful list still depends on `/api/accounts`; however, it now fails into controlled error state instead of indefinite server blocking.

### `/transactions`

Server work:

- `supabase.auth.getUser()`
- `getTransactionFormOptions(user.id)` with 4s timeout
- `resolveTransactionInitialValues(searchParams, user.id, options)` with 4s timeout

Client work:

- `useTransactions` fetches `/api/transactions?...` with `fetchWithTimeout`.
- Form exchange-rate lookup calls `/api/exchange-rate` with raw `fetch`.
- Export metadata/download calls use raw `fetch`.

Perceived risk:

- The route still cannot render until the server option preload and initial-value resolution settle.
- A2 makes failures visible and preserves fallback rendering, but the wait still contributes to cold route latency.

### `/settings`

Server work:

- `supabase.auth.getUser()`
- `profiles` query with 4s timeout
- `accounts` query with 4s timeout

Client work:

- `NotificationsPanel` fetches `/api/profile/notifications`.
- Profile/preference/security forms submit with raw fetch.

Perceived risk:

- The page can spend up to 4s on trusted preload before rendering.
- A3 prevents sensitive saves after preload failure, but perceived speed still suffers on slow Supabase responses.

### `/credits`

Server work:

- Minimal page render.

Client work:

- `CreditsListPanel` uses `useCredits` and `/api/credits`.
- Bank entity filter options load with raw `fetch('/api/bank-entities')`.
- Credit forms load accounts/categories/bank entities with raw fetches.

Perceived risk:

- List and stats are unavailable until `/api/credits` returns.
- Non-critical filter options can silently remain empty.

### `/budgets`

Server work:

- Minimal page render.

Client work:

- `BudgetsManager` loads `/api/budgets?include_inactive=true` and `/api/categories?include_system=true` in parallel with `fetchWithTimeout`.
- It then loads `/api/budget-periods?period=...`.

Perceived risk:

- The manager has multiple startup datasets and can feel slower than simple list modules.
- Period rows are a likely second-stage waterfall.

### `/assets`

Server work:

- Minimal page render.

Client work:

- `useAssets` loads `/api/assets`.
- Asset-type filter options load separately with raw `fetch('/api/asset-types')`.

Perceived risk:

- Main list is bounded.
- Filter metadata is best-effort and can disappear silently.

### `/receivables`

Server work:

- `resolveLiveUsdPenExchangeRate()` before rendering the workspace.

Client work:

- `ReceivablesManager` loads `/api/debtors` with `fetchWithTimeout`.
- Detail drawer loads debtor receivables, debtor ledger, and active accounts when opened.

Perceived risk:

- Server exchange-rate fetch duplicates app-level currency context and can block route render.
- The module list still uses one full loading state.

### `/payables`

Server work:

- `resolveLiveUsdPenExchangeRate()` before rendering the workspace.

Client work:

- `PayablesWorkspace` loads `/api/creditors` with `fetchWithTimeout`.
- Detail drawer loads creditor payables, creditor ledger, and active accounts when opened.

Perceived risk:

- Same as receivables.

### `/recurring`

Server work:

- Minimal page render.

Client work:

- `RecurringWorkspace` loads `/api/recurring` with `fetchWithTimeout`.
- Create/edit forms fetch accounts and categories with raw fetch.

Perceived risk:

- Main list is bounded, but full module loading remains.
- Form option failures can feel like empty options unless surfaced.

### `/alerts`

Server work:

- Minimal page render.

Client work:

- `AlertsWorkspace` loads `/api/alerts` with `fetchWithTimeout`.
- Bulk mark-all-read performs sequential per-alert PATCH requests.
- Generate alerts calls `/api/alerts/generate`.

Perceived risk:

- Main list is bounded.
- Bulk actions can feel slow with many unread alerts.

## API and Request Waterfall Risks

### Critical first-render requests

These affect first useful render:

- Authenticated layout auth/profile/exchange-rate preload.
- `/dashboard` page exchange-rate preload.
- Dashboard seed requests in `DashboardWorkspace`.
- Transactions server option preload.
- Settings server profile/account preload.
- Receivables/payables page exchange-rate preload.

### Non-critical requests that can be delayed

These are useful but should not block first useful content:

- `/api/dashboard/projection`
- `/api/dashboard/alerts`
- `/api/recurring?type=EXPENSE` in dashboard header
- Full `/api/dashboard` used by `FinancialHealthScore` and `PatrimonioComposicionWidget`
- Asset type options in assets list
- Bank entity options in credits list
- Form option loads for modal-only flows
- Export metadata for transactions

### Supabase-heavy endpoint suspects

Based on previous endpoint audit and current code:

- `/api/dashboard/sidebar`: still likely the heaviest dashboard seed endpoint because it combines summary-like data with portfolio/accounts, credit, receivable, payable, billing-cycle, transaction, and category-style data.
- `/api/dashboard`: still calls the full summary path including `dailyFlow` by default.
- `/api/dashboard/money-flow?months=6&mode=acumulado`: uses monthly cash-flow data and is dashboard-seed critical.
- `/api/exchange-rate?mode=live`: can become slow when live cache is stale because it may perform Supabase reads, external provider fetches, and persistence.
- `/api/budget-periods?period=...`: budget dashboard and budget manager can depend on period aggregation.

## Duplicate Request Risks

### Dashboard seed and widgets

`DashboardWorkspace` seeds SWR fallback for:

- `/api/dashboard/summary`
- `/api/dashboard/money-flow?months=6&mode=acumulado`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

Widgets use the same keys and SWR deduping, which reduces repeated requests. However, most widget hooks do not set `revalidateIfStale: false`, so SWR can still consider fallback data stale and revalidate depending on mount timing and global config. This should be measured in Chrome Network after each dashboard change.

### Full dashboard endpoint duplication

The overview and wealth widgets can call `/api/dashboard` even though the seed already has summary/modules/sidebar/money-flow. This is not a public API contract issue, but it is a perceived performance issue because full `/api/dashboard` does more work than many widgets need.

### Exchange-rate duplication

Exchange-rate work appears in several places:

- `app/(dashboard)/layout.tsx`
- `CurrencyProvider`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/receivables/page.tsx`
- `app/(dashboard)/payables/page.tsx`
- `TransactionForm` exchange-rate lookup

Some of this is legitimate, but page-level server exchange-rate fetches should be reviewed because the authenticated layout already provides a currency context.

## Server Preload Risks

| Route | Server preload | Timeout/fallback | User-visible warning | Risk |
| --- | --- | --- | --- | --- |
| Auth layout | auth, profile, accounting/live exchange rate | 4s layout-data timeout | No route-level warning | Shell first paint can wait. |
| Dashboard | live exchange rate | No local page timeout visible in page file | No | Unused prop makes this pure overhead. |
| Transactions | form options, initial values | 4s per preload stage | Yes, from A2 | Still blocks route render. |
| Settings | profile, accounts | 4s per query | Yes, from A3 | Still blocks route render. |
| Receivables | live exchange rate | Exchange-rate internals have timeouts/fallbacks | No | Route waits for rate before client list starts. |
| Payables | live exchange rate | Exchange-rate internals have timeouts/fallbacks | No | Same as receivables. |
| Detail routes | credit/asset/receivable/payable/transaction detail preload | Some use `withTimeout` | Varies | Detail pages can still block on server lookups. |

## SWR and Revalidation Risks

Good patterns already present:

- Shared module hooks use `fetchWithTimeout`.
- Most hooks disable `revalidateOnFocus`.
- Most list hooks use `dedupingInterval`.
- Many list hooks use `keepPreviousData`.
- Shell route prefetch is disabled for mounted authenticated links.
- Nav badges are bounded and non-blocking.

Remaining risks:

- Dashboard seed-backed widgets lack explicit `revalidateIfStale: false`.
- `CurrencyProvider` has fallback data but may revalidate `/api/exchange-rate?mode=live` on mount.
- Some raw fetches still have no timeout, especially modal-only option fetches and action flows.
- Some option loaders swallow errors into missing dropdown options.
- Several modules use full module skeletons rather than rendering controls/header immediately and localizing list loading.

## Platform and Region Risks

This audit cannot confirm Vercel and Supabase regions from code alone. Region mismatch remains a credible cause of variable 3-4s versus 9-12s cold dashboard loads because the app makes several sequential or parallel serverless-to-Supabase calls during first load.

Check these before approving platform changes:

1. Supabase project region.
2. Vercel Function region for production and preview.
3. Whether Vercel functions are defaulting to a region far from Supabase.
4. Whether cold starts align with the slow 9-12s samples.
5. Whether dashboard endpoint timing is dominated by TTFB or download time.

Owner approval required for:

- Vercel region changes.
- Supabase project migration.
- Database indexes.
- RPC/view changes.
- Persistent caching semantics that change data freshness expectations.

## Top 10 Recommended Fixes

### 1. Remove unused dashboard page exchange-rate fetch

Impact: High
Safety: High
Files likely affected:

- `app/(dashboard)/dashboard/page.tsx`
- `components/dashboard/DashboardClient.tsx`

Reason:

- `DashboardPage` fetches `resolveLiveUsdPenExchangeRate()` and passes `initialExchangeRate`, but `DashboardClient` ignores props. The layout already provides exchange-rate data through `CurrencyProvider`.

Approval required: No.

### 2. Make dashboard seed progressive instead of all-or-nothing

Impact: Very high
Safety: Medium
Files likely affected:

- `components/dashboard/DashboardWorkspace.tsx`
- possibly selected dashboard widgets if they need explicit partial-data props or guards.

Recommended approach:

- Treat summary and modules-summary as first-priority seed.
- Let sidebar and money-flow resolve progressively with localized widget skeletons.
- Preserve API contracts and dashboard calculations.

Approval required: No if UI behavior only becomes more progressive and no calculations/contracts change.

### 3. Add `revalidateIfStale: false` for dashboard seed-backed SWR hooks

Impact: High
Safety: High
Files likely affected:

- `components/dashboard/DashboardHeader.tsx`
- `components/dashboard/FinancialHealthScore.tsx`
- `components/dashboard/SavingsRateTrendChart.tsx`
- `components/dashboard/SaldosBancariosWidget.tsx`
- `components/dashboard/VencimientosWidget.tsx`
- `components/dashboard/FlujoPendienteWidget.tsx`
- `components/dashboard/CreditosUsoRapidoWidget.tsx`
- any other widget using seed keys.

Recommended approach:

- Apply only to keys present in `DashboardWorkspace` fallback.
- Keep manual refresh behavior intact.

Approval required: No.

### 4. Delay non-critical overview widget requests

Impact: High
Safety: Medium
Files likely affected:

- `components/dashboard/FinancialHealthScore.tsx`
- `components/dashboard/CashFlowProjectionWidget.tsx`
- `components/dashboard/OverviewRiskStrip.tsx`
- `components/dashboard/DashboardHeader.tsx`

Recommended approach:

- Delay `/api/dashboard/projection`, `/api/dashboard/alerts`, `/api/recurring?type=EXPENSE`, and full `/api/dashboard` until after first useful dashboard render.
- Use localized skeletons inside widgets.

Approval required: No if response shapes and calculations remain unchanged.

### 5. Fix Financial Health empty radar fallback

Impact: Medium-high
Safety: Medium
Files likely affected:

- `components/dashboard/FinancialHealthScore.tsx`
- possibly `FINANCIAL_HEALTH_WIDGET_AUDIT.md` if updating status.

Recommended approach:

- Use already available money-flow or other current-period signals to avoid showing "Sin lectura" when useful data exists.
- Do not change formulas without approval.

Approval required: Yes if scoring formula changes. No if it only uses existing equivalent data to avoid a false empty state.

### 6. Remove duplicate page-level exchange-rate fetches from receivables/payables if safe

Impact: Medium-high
Safety: Medium
Files likely affected:

- `app/(dashboard)/receivables/page.tsx`
- `components/receivables/ReceivablesManager.tsx`
- `app/(dashboard)/payables/page.tsx`
- `components/payables/PayablesWorkspace.tsx`

Recommended approach:

- Prefer `useCurrency()` inside client managers or pass no page-level exchange rate if the manager can use the provider.
- Preserve visible currency conversion behavior.

Approval required: No if calculations and displayed values remain equivalent.

### 7. Add bounded fetches and warnings for modal option loaders

Impact: Medium
Safety: High
Files likely affected:

- `components/credits/CreditCardForm.tsx`
- `components/credits/BankLoanForm.tsx`
- `components/assets/AssetsForm.tsx`
- `components/recurring/RecurringForm.tsx`
- `components/forms/TransactionForm/NestedRecordCreationModals.tsx`
- related list panels that fetch bank entities or asset types.

Recommended approach:

- Replace raw option fetches with `fetchWithTimeout`.
- Show controlled warning or retry for option failures.
- Do not infer errors from true empty arrays.

Approval required: No.

### 8. Localize module loading states

Impact: Medium
Safety: Medium
Files likely affected:

- `components/management/BudgetsManager.tsx`
- `components/receivables/ReceivablesManager.tsx`
- `components/payables/PayablesWorkspace.tsx`
- `components/recurring/RecurringWorkspace.tsx`
- `components/alerts/AlertsWorkspace.tsx`
- `components/management/PortfolioManager.tsx`

Recommended approach:

- Render headers, filters, create buttons, and static shell immediately.
- Skeleton only the list/table/body region.

Approval required: No if visible design is preserved.

### 9. Add measurement markers/logging for slow dashboard endpoints

Impact: Medium
Safety: High
Files likely affected:

- `app/api/dashboard/sidebar/route.ts`
- `app/api/dashboard/summary/route.ts`
- `app/api/dashboard/modules-summary/route.ts`
- `app/api/dashboard/money-flow/route.ts`
- `app/api/exchange-rate/route.ts`
- `modules/dashboard/dashboard.service.ts`

Recommended approach:

- Use existing `measureServerOperation` patterns to identify query groups that exceed thresholds.
- Keep logs sanitized.

Approval required: No for internal observability only.

### 10. Approval-gated backend consolidation

Impact: Very high
Safety: Low without design decision
Files likely affected:

- dashboard API routes
- `modules/dashboard/dashboard.service.ts`
- possibly Supabase views/RPC/indexes

Recommended approach:

- Consider a dedicated dashboard bootstrap endpoint or server-side shared request cache only after measurement.
- Consider indexes/RPC/view changes only after endpoint timing proves DB bottlenecks.

Approval required: Yes.

## Safe Now

These can be implemented as focused PRs without changing public API contracts, dashboard calculations, auth, middleware, RLS, schema, migrations, or redesign:

1. Remove unused dashboard page exchange-rate fetch.
2. Make dashboard seed progressive while preserving endpoint responses.
3. Add `revalidateIfStale: false` to dashboard seed-backed widgets.
4. Delay non-critical dashboard overview requests after first useful render.
5. Replace raw modal option fetches with `fetchWithTimeout`.
6. Add controlled warnings/retry for option metadata failures.
7. Localize loading skeletons inside modules.
8. Add sanitized server timing logs using existing observability helpers.

## Requires Owner Approval

These need approval before implementation:

1. Changing dashboard API response shapes.
2. Combining dashboard endpoints into a new public contract.
3. Changing dashboard formulas or financial health scoring.
4. Adding/changing database indexes.
5. Changing Supabase RPCs, views, RLS, schema, or migrations.
6. Changing auth/session/middleware behavior.
7. Changing Vercel Function region or Supabase project region.
8. Introducing persistent server caching that changes freshness expectations.
9. Changing business behavior for empty states or warnings.

## Wait for Total Redesign

These should wait until Phase 2:

1. New visual skeleton system.
2. New dashboard layout/information architecture.
3. New navigation motion system.
4. New modal and drawer visual language.
5. Chart redesign.
6. Broad responsive layout redesign.
7. Large shared component rewrites that are not required for stability.

## Suggested Next Phase Order

### Phase B3.1 - Remove unused dashboard page exchange-rate fetch

Reason:

- Very small change.
- Removes known useless server work.
- Low risk.

### Phase B3.2 - Dashboard progressive seed rendering

Reason:

- Biggest perceived speed improvement.
- Stops one slow endpoint from holding the full dashboard hostage.

### Phase B3.3 - Dashboard seed SWR revalidation control

Reason:

- Reduces duplicate network pressure after seed.
- Keeps existing dashboard data contracts.

### Phase B3.4 - Delay non-critical dashboard widgets

Reason:

- Keeps dashboard useful immediately while slower widgets fill in.

### Phase B3.5 - Exchange-rate cleanup in receivables/payables

Reason:

- Removes repeated page-level server work from non-dashboard modules.

### Phase B3.6 - Bounded option loaders in modal flows

Reason:

- Improves perceived reliability without changing core APIs.

## Local Testing Checklist

Use production-like local checks because perceived performance differs between dev and production builds.

1. Run `npm run build`.
2. Run `npm run start`.
3. Open Chrome DevTools Network.
4. Enable "Disable cache".
5. Filter by `/dashboard`, `_rsc`, and `/api/`.
6. Hard reload `/dashboard`.
7. Capture:
   - Time until shell appears.
   - Time until dashboard header/KPI content appears.
   - Time until all overview widgets finish.
   - TTFB and total duration for `/api/dashboard/sidebar`.
   - TTFB and total duration for `/api/dashboard/summary`.
   - TTFB and total duration for `/api/dashboard/modules-summary`.
   - TTFB and total duration for `/api/dashboard/money-flow?months=6&mode=acumulado`.
   - TTFB and total duration for `/api/exchange-rate?mode=live`.
8. Confirm no automatic module route `_rsc` prefetches appear on dashboard load.
9. Navigate manually to portfolio, transactions, credits, budgets, assets, receivables, payables, recurring, alerts, and settings.
10. For each module, record:
    - Whether shell appears immediately.
    - Whether header/actions appear before data.
    - Whether the list/table is the only skeleton.
    - Whether errors show retry instead of false empty state.
11. Open each create modal from topbar/FAB/module button and confirm option dropdowns load or show controlled warnings.
12. Repeat `/dashboard` hard reload three times and record best, median, and worst timings.

## Vercel Preview Testing Checklist

1. Open Vercel Preview in an incognito browser.
2. Log in with the same test account.
3. Open Chrome DevTools Network.
4. Enable "Disable cache".
5. Hard load `/dashboard`.
6. Capture the same endpoint timings as local production mode.
7. Confirm no automatic sidebar/topbar/FAB route `_rsc` prefetches appear.
8. Compare Preview timings against local:
   - If local is consistently fast and Preview is variable, suspect Vercel/Supabase region, serverless cold start, external exchange-rate provider, or Supabase query latency.
   - If both are variable, suspect endpoint implementation and client gating.
9. Test direct visits:
   - `/portfolio`
   - `/transactions`
   - `/settings`
   - `/receivables`
   - `/payables`
10. Confirm warning behavior:
    - Transactions preload warnings are visible only on explicit preload failure.
    - Settings saves remain disabled only when trusted preload failed.
    - Portfolio no longer gets stuck on first direct visit.
11. Record best, median, and worst dashboard first-load timings across at least five hard reloads.

## Metrics to Capture Before Any B3 Fix

For each hard reload:

- Browser: Chrome version.
- Environment: local start or Vercel Preview.
- Cache: disabled or normal.
- Route: exact URL.
- Total page load time.
- Time to shell visible.
- Time to first dashboard real content.
- Time to dashboard overview complete.
- Slowest API endpoint by TTFB.
- Slowest API endpoint by total duration.
- Whether `/api/exchange-rate?mode=live` refreshed or returned cached.
- Whether `/api/dashboard/sidebar` exceeds 2s, 5s, or 8s.
- Whether `/api/dashboard` fires during initial overview.

## Simple Spanish Summary

FinTrack ya esta mas estable, pero todavia no se siente instantaneo porque algunas pantallas esperan demasiados datos antes de mostrar contenido real. El dashboard es el principal problema: espera varias llamadas al servidor y, si una se demora, toda la pantalla queda en esqueleto. Tambien hay algunas cargas repetidas de tipo de cambio y opciones de formularios que pueden hacer que la app se sienta lenta.

Lo recomendado es seguir arreglando en pasos pequenos: primero quitar una carga de tipo de cambio que el dashboard ya no usa, luego hacer que el dashboard muestre partes utiles aunque otras secciones sigan cargando, y despues reducir llamadas repetidas. No hace falta redisenar todavia. Cambios grandes de base de datos, Supabase, Vercel o formulas financieras deben esperar aprobacion.
