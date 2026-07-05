# Dashboard Summary Reuse Plan

## Status

- Phase: B2.2 implementation in progress
- Goal: reduce repeated `DashboardService.getSummary()` backend work without changing public API contracts
- Functional code changes made now: internal `includeDailyFlow` option and route opt-ins for endpoints that do not read or return daily flow
- Staging/commit/push: none
- Starting point: updated `origin/main`, after the authenticated shell route prefetch fix was merged and verified
- Paused B2.1 exchange-rate cleanup: intentionally not included

## Scope

This plan focuses only on reducing unnecessary `getDailyFlow(userId, 370)` work caused by repeated `DashboardService.getSummary()` calls.

This plan does not propose changing:

- dashboard UI
- dashboard calculations
- API response shapes
- Supabase schema, RLS, migrations, or RPC definitions
- auth, session, or middleware behavior
- Vercel environment variables

## Files Reviewed

- `modules/dashboard/dashboard.service.ts`
- `app/api/dashboard/summary/route.ts`
- `app/api/dashboard/modules-summary/route.ts`
- `app/api/dashboard/sidebar/route.ts`
- `app/api/dashboard/route.ts`
- `app/api/dashboard/projection/route.ts`
- `app/api/dashboard/alerts/route.ts`
- `components/dashboard/DashboardWorkspace.tsx`
- `DASHBOARD_COLD_LOAD_AUDIT.md`
- `DASHBOARD_ENDPOINT_PERFORMANCE_AUDIT.md`

## Current Behavior

`DashboardService.getSummary(userId)` currently always runs two backend operations in parallel:

1. `fn_dashboard_summary` RPC.
2. `getDailyFlow(userId, 370)`.

The returned `dailyFlow` is attached to the internal `DashboardSummary` object by `mapRpcResult(...)`.

This means every route that calls `getSummary()` also runs the 370-day `transactions` query, even when the route never reads `summary.dailyFlow` and never exposes daily-flow data in its response.

## Endpoint Map

| Endpoint | Calls `getSummary()`? | Uses `summary.dailyFlow`? | Initial dashboard seed? | Recommendation |
| --- | --- | --- | --- | --- |
| `/api/dashboard/summary` | Yes | No | Yes | Call summary without daily flow. |
| `/api/dashboard/modules-summary` | Yes | No | Yes | Call summary without daily flow. |
| `/api/dashboard/sidebar` | Yes | No | Yes | Call summary without daily flow. |
| `/api/dashboard` | Yes | Potentially yes by contract | No, but used by overview/wealth widgets | Keep daily flow for now to preserve full `DashboardSummary` contract. |
| `/api/dashboard/projection` | Yes | No | No, overview widget | Call summary without daily flow. |
| `/api/dashboard/alerts` | Yes | No | No, overview widget | Call summary without daily flow. |
| `/api/dashboard/saldos-dia` | No | It is the daily-flow endpoint | Deferred/tab or refresh path | Leave unchanged. |
| `/api/dashboard/money-flow` | No | No | Yes | Leave unchanged. |
| `/api/dashboard/nav-badges` | No | No | Shell non-blocking | Leave unchanged. |

## Answers To Required Questions

### 1. Which endpoints truly need `summary.dailyFlow`?

Only `/api/dashboard` should be treated as needing `summary.dailyFlow` in this phase, because it returns the full `DashboardSummary` result through `fromResult(result)`. Removing daily flow there could change the public response payload.

`/api/dashboard/saldos-dia` also needs daily-flow data, but it does not use `summary.dailyFlow`; it calls `DashboardService.getDailyFlow(...)` directly for period-specific chart data. That endpoint should remain unchanged.

### 2. Which endpoints can call a summary method without `getDailyFlow(370)`?

The following endpoints can safely call a no-daily-flow summary path based on static review:

- `/api/dashboard/summary`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`
- `/api/dashboard/projection`
- `/api/dashboard/alerts`

These routes use accounts, current month, net worth, credits, receivables, payables, assets, upcoming installments, and exchange-rate metadata. They do not read `summary.dailyFlow`.

### 3. What is the smallest safe implementation?

Add an internal option to `DashboardService.getSummary()`:

```ts
async getSummary(
  userId: string,
  options: { includeDailyFlow?: boolean } = {}
): Promise<Result<DashboardSummary>>
```

Behavior:

- Default `includeDailyFlow` to `true`.
- Preserve current behavior for existing callers that do not pass options.
- When `includeDailyFlow` is `false`, run only `fn_dashboard_summary` and pass an empty daily-flow array into `mapRpcResult(...)`.
- Do not change `DashboardSummary` shape.
- Do not change any API response contract.

Then update only the routes that do not use daily flow:

```ts
service.getSummary(userId, { includeDailyFlow: false })
```

Keep `/api/dashboard` unchanged for now.

### 4. Can this be done with an internal `includeDailyFlow` option without changing public API contracts?

Yes.

The option would be internal to the service call. It would not affect URL paths, request parameters, response keys, API contract names, Supabase RPC arguments, auth behavior, or dashboard calculations.

The default should remain `includeDailyFlow: true`, which keeps backward compatibility for any current or future caller that expects the full summary result.

### 5. Which files would be modified later?

Recommended future implementation files:

- `modules/dashboard/dashboard.service.ts`
- `app/api/dashboard/summary/route.ts`
- `app/api/dashboard/modules-summary/route.ts`
- `app/api/dashboard/sidebar/route.ts`
- `app/api/dashboard/projection/route.ts`
- `app/api/dashboard/alerts/route.ts`
- `DASHBOARD_SUMMARY_REUSE_PLAN.md` only if updating implementation status after approval

Files to avoid in this phase:

- `app/api/dashboard/route.ts`
- `app/api/dashboard/saldos-dia/route.ts`
- `app/api/dashboard/money-flow/route.ts`
- `components/dashboard/*`
- `modules/dashboard/dashboard.types.ts`
- Supabase schema, migrations, RLS, auth, middleware, and Vercel config

### 6. What risks are there?

Risk level: low to medium.

Main risks:

- A route may indirectly rely on `dailyFlow` in a way that was missed during static review. Current inspected route code does not show that.
- Passing `[]` as daily flow means the internal `DashboardSummary` object is incomplete for routes using `includeDailyFlow: false`. This is acceptable only where the route does not read or return `dailyFlow`.
- The fix reduces repeated 370-day transaction scans, but it does not remove repeated `fn_dashboard_summary` RPC calls. Dashboard backend work may still be slower than desired after this phase.
- TypeScript signature changes must be kept minimal so callers remain backward-compatible.

Mitigations:

- Keep `includeDailyFlow` defaulting to `true`.
- Do not change `/api/dashboard`.
- Add the option only at route call sites that transform the summary into response types that do not include daily flow.
- Run lint, typecheck, build, and manual response-shape checks before PR.

### 7. What tests should run locally and in Vercel Preview?

#### Local tests

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. Run available focused tests, including any dashboard or auth smoke tests if present.
5. Production-mode manual test:
   - `npm run build`
   - `npm run start`
   - Log in.
   - Open Chrome DevTools Network with Disable cache enabled.
   - Hard reload `/dashboard`.
   - Confirm these endpoints return 200:
     - `/api/dashboard/summary`
     - `/api/dashboard/modules-summary`
     - `/api/dashboard/sidebar`
     - `/api/dashboard/money-flow?months=6&mode=acumulado`
     - `/api/dashboard/projection`
     - `/api/dashboard/alerts`
   - Confirm the dashboard renders the same KPI/header/sidebar/projection/alert values as before.
   - Confirm `/api/dashboard` still returns a full summary payload and is not changed.
   - Confirm `/api/dashboard/saldos-dia?period=1M` still returns daily-flow chart data.

#### Vercel Preview tests

1. Deploy preview from the future implementation branch.
2. Log in with the same test user used for baseline measurements.
3. Open Chrome DevTools Network with Disable cache enabled.
4. Hard reload `/dashboard` three to five times and capture:
   - total time until dashboard skeleton is replaced,
   - duration of `/api/dashboard/summary`,
   - duration of `/api/dashboard/modules-summary`,
   - duration of `/api/dashboard/sidebar`,
   - duration of `/api/dashboard/projection`,
   - duration of `/api/dashboard/alerts`,
   - any failed or timed-out dashboard requests.
5. Compare against the current baseline, especially whether slow runs still approach 9-12 seconds.
6. Check Vercel Function logs for dashboard warnings from `measureServerOperation`.
7. Navigate to dashboard tabs that use daily-flow charts and confirm they still work.

### 8. What requires owner approval?

No additional owner approval should be required for the narrow internal `includeDailyFlow` option if:

- default behavior remains unchanged,
- public API response shapes do not change,
- calculations do not change,
- `/api/dashboard` keeps daily flow,
- Supabase schema/RLS/RPC/auth/middleware are untouched.

Owner approval is required before any of these broader changes:

- changing API response shapes or removing fields from `/api/dashboard`,
- changing dashboard calculations or financial formulas,
- changing `fn_dashboard_summary`,
- adding or changing indexes, migrations, schema, or RLS,
- changing auth/session/middleware behavior,
- introducing server-side shared caching with staleness or TTL behavior,
- redesigning dashboard UI or changing widget behavior.

## Recommended Implementation Order

1. Add the internal `includeDailyFlow` option to `DashboardService.getSummary()` with default `true`.
2. Update `/api/dashboard/summary` to call `getSummary(userId, { includeDailyFlow: false })`.
3. Update `/api/dashboard/modules-summary` to call `getSummary(userId, { includeDailyFlow: false })`.
4. Update `/api/dashboard/sidebar` to call `getSummary(userId, { includeDailyFlow: false })`.
5. Update `/api/dashboard/projection` to call `getSummary(userId, { includeDailyFlow: false })`.
6. Update `/api/dashboard/alerts` to call `getSummary(userId, { includeDailyFlow: false })`.
7. Leave `/api/dashboard` unchanged.
8. Run full validation and compare Network timings before/after.

## Expected Impact

On the initial dashboard seed, this should remove up to three duplicated 370-day `transactions` scans:

- one from `/api/dashboard/summary`,
- one from `/api/dashboard/modules-summary`,
- one from `/api/dashboard/sidebar`.

On default overview widget loading, it should also avoid unnecessary daily-flow scans from:

- `/api/dashboard/projection`,
- `/api/dashboard/alerts`.

This should reduce Supabase load and improve cold-load stability, but it will not eliminate all dashboard backend duplication because the same `fn_dashboard_summary` RPC will still be called by multiple endpoints. That broader reuse/caching work should remain a later phase.

## Rollback Plan For Future Implementation

If the future implementation causes unexpected dashboard behavior:

1. Revert the route call-site changes that pass `{ includeDailyFlow: false }`.
2. Keep or remove the service option depending on whether it remains unused.
3. Return all callers to `service.getSummary(userId)`.
4. Re-run lint, typecheck, build, and dashboard manual checks.

## Spanish Summary

El dashboard hace varias consultas parecidas al mismo tiempo. Cada una también calcula un historial diario de 370 días, aunque muchas pantallas no usan ese dato.

La solución propuesta es pequeña: permitir que algunas rutas pidan el resumen sin ese historial diario. No cambia lo que ve el usuario, no cambia la base de datos y no cambia los contratos de la API. Solo evita trabajo repetido para que la primera carga del dashboard sea más estable.
