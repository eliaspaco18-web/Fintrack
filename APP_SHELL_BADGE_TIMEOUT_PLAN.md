# App Shell Badge Timeout Plan

## Scope

Phase A4 diagnosis only. This plan covers the authenticated app shell badge refresh path for `/api/dashboard/nav-badges`. It does not cover dashboard widget performance, middleware/auth changes, database schema, Supabase RLS, API contracts, redesign, or broad refactors.

## Files Reviewed

- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/Topbar.tsx`
- `components/layout/NavItem.tsx`
- `lib/client/fetch-with-timeout.ts`
- `app/api/dashboard/nav-badges/route.ts`
- `lib/server/nav-badges.ts`
- `app/(dashboard)/layout.tsx`
- Existing SWR usage and provider references related to the shell badge path

## Current Behavior

`AppShell` uses SWR to refresh badge counts from `/api/dashboard/nav-badges` after the authenticated shell has rendered.

Current fetcher behavior in `components/layout/AppShell.tsx`:

- Uses raw `fetch(url, { cache: 'no-store' })`.
- Parses the API response as JSON.
- Throws a sanitized Spanish error when the response is non-OK or `{ ok: true }` is missing.
- Does not consume or render the SWR `error` value.
- Uses `fallbackData: navBadges`.
- Disables focus revalidation.
- Uses a 30 second deduping interval.
- Refreshes every 60 seconds.

Current fallback badge state:

- The authenticated layout currently does not pass initial `navBadges`, so `AppShell` usually defaults to `{}`.
- If `navBadges` is provided later by the server shell, SWR uses it as `fallbackData`.
- `resolvedNavBadges` falls back to `navBadges` when no live SWR data exists.
- `Sidebar` and `MobileDrawer` receive the resolved object and pass per-item badge numbers into `NavItem`.
- `Topbar` reads `navBadges.alerts ?? 0` for the alert bell.
- Missing, undefined, or zero badge values render no badge.

Server-side badge behavior:

- `/api/dashboard/nav-badges` authenticates with the existing session helper.
- `getNavBadgesForUser` runs three count queries for overdue installments, urgent receivables, and urgent payables.
- Each count query is wrapped in the existing server `withTimeout` helper with a 2.5 second timeout.
- Query errors, rejected promises, and timed-out count queries are converted to `0`.
- The endpoint returns the existing API success contract: `{ ok: true, data: Partial<Record<string, number>> }`.

## Answers To Phase A4 Questions

### 1. Does the nav badge fetch currently use raw fetch or fetchWithTimeout?

It currently uses raw client `fetch` in `components/layout/AppShell.tsx`. It does not use `fetchWithTimeout`.

### 2. Can nav badge loading/failure affect shell usability, navigation, or perceived loading?

Shell navigation is not directly blocked because SWR has fallback data and the sidebar/topbar render without waiting for the badge request.

However, the request can still affect perceived stability:

- A slow or hanging browser request can remain visible in DevTools/network activity after navigation.
- A failed request is stored by SWR but not surfaced in the UI.
- Default SWR retry behavior may keep retrying in the background after errors.
- The topbar alert count and sidebar badges can silently stay stale or empty.

The user can still navigate, open the sidebar, use topbar actions, and interact with the current module.

### 3. Does it show raw technical errors anywhere?

No raw technical error is rendered in the UI. The current fetcher throws either the API error message or the generic message `No se pudo cargar el estado del sidebar`, but `AppShell` does not display the SWR error value.

There is still a low risk of noisy development diagnostics or browser/network error visibility because the error exists inside SWR, but no raw Supabase or stack trace is shown to the user by this path.

### 4. What fallback badge state is currently used?

The fallback is an empty object unless `navBadges` is passed into `AppShell`.

Effective fallback behavior:

- Sidebar badges: hidden.
- Mobile drawer badges: hidden.
- Topbar alert bell count: `0`, so no red badge is shown.

This is acceptable for a non-critical shell enhancement, but it means failed badge loading can look the same as "no pending badges."

### 5. What is the smallest safe fix?

Use the shared client `fetchWithTimeout` helper in the `AppShell` SWR fetcher and keep badge failure non-blocking.

Recommended minimal implementation:

- Import `fetchWithTimeout` from `@/lib/client/fetch-with-timeout`.
- Replace raw `fetch` in the `/api/dashboard/nav-badges` SWR fetcher with `fetchWithTimeout`.
- Use `cache: 'no-store'`.
- Use a short shell-specific timeout, for example 4 to 5 seconds, because badges are helpful but not critical.
- Keep `fallbackData: navBadges`.
- Keep navigation rendering from `resolvedNavBadges`.
- Do not render a global shell warning for badge failure in this phase.
- Set `shouldRetryOnError: false` or otherwise keep retries bounded so a failed non-critical badge fetch does not create background noise.
- Preserve the existing API response contract.

No server route change is required for the minimal fix because the server count queries are already individually bounded.

Optional follow-up only if Vercel logs show route-level hangs:

- Add a route-level server timeout around `getNavBadgesForUser`.
- This should be a separate follow-up because the current Phase A4 scope is the non-blocking client shell fetch.

### 6. Which files would be modified later?

Expected implementation file:

- `components/layout/AppShell.tsx`

No expected changes:

- `components/layout/Sidebar.tsx`
- `components/layout/Topbar.tsx`
- `components/layout/NavItem.tsx`
- `app/api/dashboard/nav-badges/route.ts`
- `lib/server/nav-badges.ts`
- `lib/client/fetch-with-timeout.ts`

This plan file may be updated later only to mark implementation status.

### 7. Is owner approval required?

No owner approval is required for the recommended minimal fix because it only:

- Bounds a client-side non-critical fetch.
- Keeps the existing fallback badge behavior.
- Does not change authentication/session logic.
- Does not change middleware.
- Does not change database schema or Supabase RLS.
- Does not change API contracts.
- Does not redesign the shell.

Owner approval would be required if the implementation expands into middleware, auth/session, API contract changes, database/schema/RLS changes, Vercel environment changes, or dashboard performance refactors.

### 8. How should this be tested locally and in Vercel Preview?

Local test steps:

1. Start the app with `npm run dev`.
2. Sign in with a test user.
3. Open `/dashboard`, `/portfolio`, `/transactions`, and `/settings`.
4. Confirm the shell, sidebar, topbar, mobile drawer, and page content render quickly.
5. In browser DevTools, inspect `/api/dashboard/nav-badges`.
6. Block `/api/dashboard/nav-badges` in DevTools or simulate a stalled response.
7. Confirm sidebar links, mobile drawer, topbar alert button, quick menu, profile menu, and logout remain usable.
8. Confirm no visible raw technical error appears.
9. Confirm badge fallback is empty or the previous fallback values, not an infinite loading state.
10. Run `npm run lint`.
11. Run `npm run typecheck`.
12. Run `npm run build`.

Vercel Preview test steps:

1. Deploy the focused implementation branch to Vercel Preview.
2. Sign in with a preview-safe test user.
3. Hard refresh `/dashboard` with DevTools open.
4. Confirm `/api/dashboard/nav-badges` either succeeds quickly or times out without blocking the shell.
5. Navigate to `/portfolio`, `/transactions`, `/settings`, `/alerts`, `/receivables`, and `/payables`.
6. Confirm navigation remains responsive while the badge request is pending, failed, or blocked.
7. Use DevTools request blocking for `/api/dashboard/nav-badges`.
8. Confirm sidebar/topbar remain usable and no page skeleton gets stuck because of badges.
9. Confirm no raw technical error is displayed to the user.
10. Confirm browser console has no unhandled runtime errors.
11. Confirm Vercel function logs do not show new repeated badge request failures after the timeout.
12. Test a mobile viewport and confirm the mobile drawer still opens, closes, and navigates with empty or stale badges.

## Risk

Risk is low if implementation stays limited to `AppShell`.

Main risks:

- Choosing a timeout that is too short could make badges appear stale more often on slow networks.
- Disabling retry removes automatic recovery until the refresh interval, route remount, or manual navigation triggers another fetch.
- If the future implementation accidentally surfaces the SWR error globally, a non-critical badge failure could become too noisy.

Mitigation:

- Keep the timeout slightly longer than the existing server query timeout budget.
- Preserve fallback badges.
- Keep failure non-blocking and non-modal.
- Do not change the API route or badge contract in the minimal fix.

## Recommendation

Proceed with a focused Phase A4 implementation in `components/layout/AppShell.tsx` only:

1. Replace the raw `/api/dashboard/nav-badges` fetcher with `fetchWithTimeout`.
2. Add a short shell-specific timeout.
3. Keep existing fallback badge behavior.
4. Keep navigation usable when badges fail.
5. Avoid visible warning UI unless a later product decision says badge freshness must be explicit.

Ready for implementation after owner confirms Phase A4 implementation scope.

## Implementation Status

Implemented the approved minimal Phase A4 fix:

- `components/layout/AppShell.tsx` now uses `fetchWithTimeout` for `/api/dashboard/nav-badges`.
- The shell badge fetch uses a 5 second timeout and keeps `cache: 'no-store'`.
- SWR keeps `fallbackData: navBadges`, refreshes every 60 seconds, and disables retry-on-error for this non-critical badge refresh.
- Badge failures remain non-blocking and no global warning is shown.
- No API route, server badge helper, sidebar, topbar, dashboard widget, middleware, auth/session, schema, RLS, or API contract changes were made.

## Spanish Summary

Los numeros pequenos del menu lateral y la campana de alertas se cargan en segundo plano. Si esa carga se queda lenta o falla, la app no deberia bloquear la navegacion. El arreglo mas seguro es ponerle un limite de tiempo a esa carga usando la herramienta que ya existe, mantener los numeros como opcionales y dejar que el usuario siga usando la app normalmente.
