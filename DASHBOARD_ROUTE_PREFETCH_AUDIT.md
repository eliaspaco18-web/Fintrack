# Dashboard Route Prefetch Audit

## Status

- Phase: B1 follow-up diagnosis
- Scope: diagnose background authenticated module route prefetch during cold `/dashboard` load
- Functional code changes: none
- Staging/commit/push: none
- Recommendation status: approved and implemented for sidebar module links
- Implementation note: authenticated shell navigation now sets `prefetch={false}` for sidebar nav links, the Topbar alert/menu/profile links, and QuickActionsFAB links.

## Executive Summary

Chrome Network evidence shows that a cold `/dashboard` load also triggers background App Router RSC requests for other authenticated modules:

- `/assets?_rsc=...`
- `/budgets?_rsc=...`
- `/credits?_rsc=...`
- `/transactions?_rsc=...`
- `/portfolio?_rsc=...`

These requests take about 5 to 6 seconds during the first dashboard load. The most likely cause is Next.js `Link` prefetching from the authenticated app shell sidebar. The desktop sidebar renders all primary module links immediately, and `components/layout/NavItem.tsx` uses `next/link` without `prefetch={false}`. In production, Next.js can prefetch visible links by loading route and data in the background.

This is mixed frontend/server behavior:

- Frontend: visible sidebar `Link` components ask Next.js to prefetch linked routes.
- Server: each `_rsc` prefetch can execute the target route's server component tree and any server preload work in that route.
- Supabase: routes with server preload, especially `/transactions`, can perform authenticated Supabase reads during prefetch.

The smallest safe future fix is to disable prefetch for authenticated sidebar/module links, starting with `components/layout/NavItem.tsx`. This should reduce cold dashboard background work while preserving navigation behavior and API contracts.

## Evidence From Local Waterfall

Manual Chrome Network capture on a cold direct `/dashboard` visit showed:

| Request | Observed behavior | Likely reason |
| --- | --- | --- |
| `/assets?_rsc=...` | Background request during dashboard load, around 5-6s | App Router RSC prefetch for sidebar Assets link |
| `/budgets?_rsc=...` | Background request during dashboard load, around 5-6s | App Router RSC prefetch for sidebar Budgets link |
| `/credits?_rsc=...` | Background request during dashboard load, around 5-6s | App Router RSC prefetch for sidebar Credits link |
| `/transactions?_rsc=...` | Background request during dashboard load, around 5-6s | App Router RSC prefetch for sidebar Transactions link |
| `/portfolio?_rsc=...` | Background request during dashboard load, around 5-6s | App Router RSC prefetch for sidebar Portfolio link |

This pattern matches Next.js App Router route prefetching because the requests include the `_rsc` query parameter and correspond to visible `Link` hrefs in the authenticated sidebar.

Reference: Next.js documents that `Link` prefetching can load route data in the background when a link enters the viewport, and that `prefetch={false}` disables this behavior.

Source: https://nextjs.org/docs/app/api-reference/components/link

## Likely Source Files

### Primary source

`components/layout/NavItem.tsx`

- Imports `Link` from `next/link`.
- Renders sidebar navigation items using `<Link href={item.href}>`.
- Does not pass `prefetch={false}`.
- Used for both regular and collapsed sidebar modes.

### Sidebar renderer

`components/layout/Sidebar.tsx`

- Imports `NAV_MAIN` and `NAV_SECONDARY` from `lib/constants/nav.ts`.
- `SidebarNavigation` maps every item to `<NavItem />`.
- `StaticSidebar` is rendered by the app shell on desktop.
- Because the static sidebar is visible during `/dashboard`, its links are eligible for viewport-based prefetch.

### Navigation constants

`lib/constants/nav.ts`

`NAV_MAIN` contains the module hrefs that match the observed waterfall:

- `/dashboard`
- `/portfolio`
- `/transactions`
- `/credits`
- `/budgets`
- `/assets`
- `/receivables`
- `/payables`
- `/recurring`
- `/alerts`

The observed `/portfolio`, `/transactions`, `/credits`, `/budgets`, and `/assets` RSC requests line up with this list.

### Secondary shell sources

`components/layout/Topbar.tsx`

- The always-mounted alert bell uses `<Link href="/alerts">` without `prefetch={false}`.
- Quick-action links such as `/transactions?new=transaction`, `/portfolio?new=portfolio`, and `/budgets?new=budget` are conditionally mounted only when the quick menu is open.
- Profile menu links are conditionally mounted only when the profile menu is open.
- Therefore, Topbar is not the likely source of the listed first-load module prefetches, except potentially `/alerts`.

`components/layout/AppShell.tsx`

- Renders `StaticSidebar` and `Topbar`.
- It is the shell that makes sidebar links present during `/dashboard`.
- The Phase A4 badge fetch is separate from this issue.

## Route-Side Work Triggered By Prefetch

### `/transactions`

`app/(dashboard)/transactions/page.tsx` is the highest-confidence expensive prefetch target.

On server render it:

- Creates a Supabase server client.
- Calls `supabase.auth.getUser()`.
- Calls `getTransactionFormOptions(user.id)` with a 4 second timeout.
- Calls `resolveTransactionInitialValues(...)` with a 4 second timeout.
- Renders `TransactionsWorkspace` with options and preload warning metadata.

An RSC prefetch for `/transactions` can therefore trigger real authenticated server preload work before the user asks to open Transactions.

### `/portfolio`

`app/(dashboard)/portfolio/page.tsx` now renders `PortfolioManager` without server account/bank/currency preload after Phase A1.

An RSC prefetch still requests the route payload, but the page itself no longer performs the previous blocking server preload. Client-side portfolio fetch effects should not run merely because the RSC payload is prefetched; they run when the client component is mounted/hydrated through actual navigation.

### `/assets`, `/budgets`, `/credits`

Current route pages are mostly thin server components that render client workspaces:

- `app/(dashboard)/assets/page.tsx` renders `AssetsWorkspace` inside `Suspense`.
- `app/(dashboard)/budgets/page.tsx` renders `BudgetsManager` inside `Suspense`.
- `app/(dashboard)/credits/page.tsx` renders `CreditsWorkspace`.

The pages do not show direct route-level Supabase preload in the inspected files. However, the `_rsc` requests still require server route rendering and can include shared authenticated route tree work depending on what Next.js needs to produce the prefetch payload.

### Authenticated layout

`app/(dashboard)/layout.tsx` performs authenticated layout data loading:

- `supabase.auth.getUser()`
- profile query from `profiles`
- exchange-rate work through `ensureAccountingUsdPenExchangeRate()` and `resolveLiveUsdPenExchangeRate()`

The active router cache may reuse parts of the shared layout, but authenticated route prefetching can still cause server component work for linked routes. The local waterfall showing 5-6 second `_rsc` requests is enough evidence that prefetch is adding background server/network work during the dashboard's first load.

## Answers To Questions

### 1. What code is causing the module `_rsc` routes to load during `/dashboard`?

The likely cause is the authenticated sidebar:

- `components/layout/Sidebar.tsx` renders `NAV_MAIN` and `NAV_SECONDARY`.
- Each item renders through `components/layout/NavItem.tsx`.
- `NavItem` uses `next/link` without `prefetch={false}`.
- The desktop `StaticSidebar` is visible during `/dashboard`, making module links eligible for automatic prefetch.

### 2. Are these Next.js Link prefetch requests?

Yes, this is the most likely explanation.

Evidence:

- The requests include `_rsc`, which indicates App Router RSC payload loading.
- The requested paths match visible sidebar `Link` hrefs.
- The requests happen during initial `/dashboard` load, before manual navigation.
- The links do not disable prefetch.

### 3. Do these RSC prefetches trigger server-side Supabase/auth/preload work?

Yes for routes that perform server preload. `/transactions` clearly does.

For the other inspected modules, the route pages are thinner and mostly render client workspaces, so the route-specific Supabase preload appears lighter. Still, the RSC prefetch is server-side route work, and it may include authenticated route tree work.

This should be treated as mixed frontend prefetch, server render, and possible Supabase work.

### 4. Do these requests compete with dashboard API calls and make first load feel slower?

Likely yes.

Even when prefetch does not block React's first render directly, the background requests can compete for:

- browser network request slots,
- Vercel serverless execution,
- server CPU,
- Supabase auth/profile/query capacity,
- route cache and RSC payload generation.

The local symptom, slow first load followed by fast return navigation, is consistent with too much cold-load work and later warmed caches.

### 5. Would disabling prefetch for authenticated sidebar/module links reduce cold dashboard load work?

Yes.

Adding `prefetch={false}` to authenticated sidebar navigation links should stop automatic viewport and hover prefetch for those module routes. That should prevent `/assets?_rsc`, `/budgets?_rsc`, `/credits?_rsc`, `/transactions?_rsc`, and `/portfolio?_rsc` from being fetched just because the user opened `/dashboard`.

### 6. What is the smallest safe fix?

Recommended smallest future fix:

1. Add `prefetch={false}` to both `Link` usages in `components/layout/NavItem.tsx`.
2. Keep navigation hrefs, labels, badges, active states, drawer behavior, and click handlers unchanged.
3. Do not change module pages, API routes, dashboard calculations, auth, middleware, Supabase schema, or RLS.

Optional consistency-only follow-up:

1. Add `prefetch={false}` to `SidebarLogo` in `components/layout/Sidebar.tsx`.
2. Add `prefetch={false}` to the always-mounted `/alerts` link in `components/layout/Topbar.tsx`.

The first step is enough to target the observed module prefetch waterfall.

### 7. Which files would be modified?

Primary future implementation file:

- `components/layout/NavItem.tsx`

Possible optional shell-only files:

- `components/layout/Sidebar.tsx`
- `components/layout/Topbar.tsx`

Documentation file if implementation status is recorded:

- `DASHBOARD_ROUTE_PREFETCH_AUDIT.md`

No app route, API route, Supabase, middleware, auth, schema, RLS, or dashboard calculation file should be changed for this fix.

### 8. What risks are there if we disable prefetch?

Risk level: low to medium.

Risks:

- First click into a module may feel slightly slower because the route was not warmed in the background.
- Hovering a sidebar link will not warm that route if `prefetch={false}` is used.
- Mobile drawer links would also stop prefetching if the shared `NavItem` is changed.
- Users who frequently jump from dashboard to one module may trade a lighter dashboard load for a slightly colder first module navigation.

Mitigations:

- Manual navigation still works because only prefetch changes.
- API contracts remain unchanged.
- UI design remains unchanged.
- The fix is easy to rollback by removing `prefetch={false}`.
- If needed later, prefetch can be reintroduced selectively for cheap routes only after measuring route cost.

### 9. How should this be tested before and after?

## Local Test Plan

Use production-like local behavior because Next.js prefetch behavior is most relevant in production builds.

### Before the fix

1. Run `npm run build`.
2. Run `npm run start`.
3. Open Chrome DevTools Network tab.
4. Enable `Disable cache`.
5. Filter by `_rsc` or sort by Initiator/Name.
6. Hard reload `/dashboard`.
7. Record whether these requests appear automatically:
   - `/assets?_rsc=...`
   - `/budgets?_rsc=...`
   - `/credits?_rsc=...`
   - `/transactions?_rsc=...`
   - `/portfolio?_rsc=...`
8. Record duration and whether they overlap with dashboard API calls.
9. Click each sidebar module and confirm navigation still works.

### After the fix

1. Run `npm run build`.
2. Run `npm run start`.
3. Open Chrome DevTools Network tab.
4. Enable `Disable cache`.
5. Hard reload `/dashboard`.
6. Confirm the sidebar module `_rsc` routes do not fire automatically on initial dashboard load.
7. Confirm dashboard API calls still run normally.
8. Hover sidebar links and confirm no background module `_rsc` prefetch starts.
9. Click each sidebar module and confirm the route loads when clicked:
   - Portfolio
   - Movements / Transactions
   - Credits
   - Budgets
   - Assets
   - Receivables
   - Payables
   - Recurring
   - Alerts
   - Administration
   - Settings
10. Confirm badges, active sidebar state, mobile drawer, topbar, quick menu, profile menu, and logout still work.

## Vercel Preview Test Plan

1. Open the Vercel Preview deployment in Chrome.
2. Sign in with a test user.
3. Open DevTools Network tab.
4. Enable `Disable cache`.
5. Hard reload `/dashboard`.
6. Filter by `_rsc`.
7. Confirm the previous automatic module prefetches are absent or materially reduced:
   - `/assets?_rsc=...`
   - `/budgets?_rsc=...`
   - `/credits?_rsc=...`
   - `/transactions?_rsc=...`
   - `/portfolio?_rsc=...`
8. Confirm dashboard data still loads successfully.
9. Confirm no new console errors appear.
10. Click each sidebar module once and confirm it loads on demand.
11. Navigate away from `/dashboard` and return to confirm warm navigation remains acceptable.
12. Check Vercel function logs, if available, for fewer authenticated module route renders during the dashboard cold load.

## Owner Approval

Owner approval is required before implementation because this changes authenticated navigation performance behavior.

Approval should be limited to:

- disabling automatic prefetch on authenticated sidebar/module links,
- preserving all visible UI and navigation behavior,
- avoiding dashboard API, calculation, auth, middleware, Supabase, RLS, schema, and environment changes.

No additional approval should be required if the implementation stays inside `components/layout/NavItem.tsx` and, optionally, shell-only `Sidebar.tsx`/`Topbar.tsx` link prefetch props.

Approval is required again if the proposed fix expands into:

- API contract changes,
- middleware changes,
- auth/session changes,
- Supabase schema/RLS changes,
- dashboard calculation changes,
- Vercel environment changes,
- broad dashboard performance refactors.

## Recommended Safe Optimization Order

1. Disable `Link` prefetch for sidebar module navigation in `components/layout/NavItem.tsx`.
2. Measure cold `/dashboard` again in local production mode and Vercel Preview.
3. If `/alerts?_rsc` or `/dashboard?_rsc` still creates noticeable shell noise, consider disabling prefetch for always-mounted shell links in `SidebarLogo` and Topbar alerts.
4. Only after route prefetch noise is removed, return to dashboard-specific optimization from `DASHBOARD_COLD_LOAD_AUDIT.md`.

## Simple Spanish Summary

Cuando abres el dashboard, la app parece estar cargando también otras páginas en segundo plano, como Portafolio, Movimientos, Créditos, Presupuestos y Activos. Eso probablemente pasa porque los enlaces del menú lateral de Next.js intentan precargar esas páginas automáticamente.

Esa precarga puede hacer que el primer dashboard se sienta más lento, aunque después todo se sienta rápido porque ya quedó en caché. La solución más pequeña sería desactivar esa precarga automática solo en los enlaces del menú lateral autenticado. No cambia datos, permisos, base de datos ni diseño; solo evita trabajo innecesario al abrir el dashboard.
