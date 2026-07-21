# Financial Health Widget Audit

## Status

- Phase: dashboard stability diagnosis only
- Scope: Financial Health / Salud Financiera radar widget
- Functional code changes: none
- Staging/commit/push: none
- Production note: the issue is visible in current production, so it is not caused by the Phase B2.2 daily-flow optimization

## Files Reviewed

- `components/dashboard/FinancialHealthScore.tsx`
- `components/dashboard/DashboardWorkspace.tsx`
- `components/dashboard/api.ts`
- `components/dashboard/DashboardHeader.tsx`
- `components/dashboard/MoneyFlowChart.tsx`
- `components/dashboard/SavingsRateTrendChart.tsx`
- `lib/charts/radar-score.ts`
- `lib/hooks/useDashboard.tsx`
- `lib/dashboard/types.ts`
- `app/api/dashboard/summary/route.ts`
- `app/api/dashboard/modules-summary/route.ts`
- `app/api/dashboard/sidebar/route.ts`
- `app/api/dashboard/route.ts`
- `app/api/dashboard/money-flow/route.ts`
- `modules/dashboard/dashboard.service.ts`
- `modules/dashboard/dashboard.types.ts`
- `supabase/migrations/20260328223500_fix_dashboard_summary_nested_aggregate.sql`
- `supabase/migrations/20240102000001_dashboard_views.sql`

## Current Behavior

The Financial Health widget renders the empty radar when both monthly summary values are zero:

```ts
const ingresosMes = summary?.ingresos_mes ?? 0
const egresosMes = summary?.egresos_mes ?? 0

if (ingresosMes === 0 && egresosMes === 0) return <EmptyRadar />
```

`EmptyRadar` is the UI that shows:

- `Aún no hay movimientos suficientes para calcular el radar.`
- `Sin lectura`
- `Radar pendiente`

Those values come from `/api/dashboard/summary`, which maps `DashboardService.getSummary()` into the public dashboard summary contract. The service reads `current_month.income_pen` and `current_month.expense_pen` from the Supabase RPC `fn_dashboard_summary`.

The RPC calculates current-month totals only:

- `type = 'INCOME'`
- `type = 'EXPENSE'`
- `affects_reports = true`
- `date_trunc('month', transaction_date) = date_trunc('month', CURRENT_DATE)`

So the widget does not mean "no dashboard data exists." It means "the summary endpoint currently says this user has zero reportable income and zero reportable expense in the current calendar month."

## Answers

### 1. Which endpoint(s) does FinancialHealthScore use?

`FinancialHealthScore` uses four SWR requests:

| Endpoint | Used for |
| --- | --- |
| `/api/dashboard/summary` | `ingresos_mes`, `egresos_mes`, `balance_consolidado`, `alertas_pendientes` |
| `/api/dashboard/modules-summary` | credit usage, credit totals, asset count/value, receivables/payables totals |
| `/api/dashboard/sidebar` | upcoming due items and critical due count |
| `/api/dashboard` | full dashboard summary, mainly `assets.byType` for asset diversification |

The widget does not use `/api/dashboard/money-flow?months=6&mode=acumulado`, even though `DashboardWorkspace` already fetches that key and `DashboardHeader` uses it as a fallback source.

### 2. What exact data does it need to show the radar?

To pass the current render gate, it needs at least one of:

- `summary.ingresos_mes > 0`
- `summary.egresos_mes > 0`

After that gate passes, it calculates six radar factors:

| Factor | Source |
| --- | --- |
| Savings | `summary.ingresos_mes`, `summary.egresos_mes` |
| Credit | `modules.creditos_uso_pct` |
| Liquidity | `summary.balance_consolidado.pen`, `summary.egresos_mes` |
| Debt | `modules.creditos_uso_total`, `modules.activos.total_soles`, fallback `fullDashboard.assets.totalValuePen` |
| Diversification | `fullDashboard.assets.byType`, fallback `modules.activos.count` |
| Discipline | `summary.alertas_pendientes`, overdue items from `sidebar.vencimientos_proximos` |

The current gate only checks monthly movements. It does not consider whether the other five factors can be calculated from accounts, assets, credits, alerts, receivables, payables, or due items.

### 3. Which condition triggers "Aún no hay movimientos suficientes para calcular el radar"?

This exact condition:

```ts
ingresosMes === 0 && egresosMes === 0
```

Because `ingresosMes` and `egresosMes` default to zero when `summary` is missing, the empty radar can also appear if summary data is unavailable while other SWR data is present. On the normal dashboard path, initial summary failure should usually block the whole `DashboardWorkspace` seed, but the widget itself does not explicitly check `summary` errors.

### 4. Does the current user actually lack required movements/data, or is the widget failing to read available data?

Static code review cannot prove the current production user's live data without inspecting authenticated Network responses.

However, the code shows the widget is only checking current-month reportable income/expense. A user can have:

- accounts,
- credits,
- assets,
- receivables,
- payables,
- alerts,
- prior-month transactions,
- 6-month money-flow history,

and still see the empty radar if the current month has no reportable `INCOME` or `EXPENSE` transactions.

So this is likely not a total data-empty state. It is either:

1. A true current-month empty state, if `/api/dashboard/summary` returns `ingresos_mes: 0` and `egresos_mes: 0`; or
2. A widget data-read bug, if `/api/dashboard/money-flow?months=6&mode=acumulado` or other dashboard data shows usable recent activity but the widget ignores it.

The fastest way to confirm is to inspect production or Vercel Preview Network responses:

- If `/api/dashboard/summary` returns nonzero `ingresos_mes` or `egresos_mes`, but the widget still shows empty, this is a bug in widget state/SWR rendering.
- If `/api/dashboard/summary` returns both zero and `/api/dashboard/money-flow?months=6&mode=acumulado` has prior nonzero months, this is a too-strict current-month gate and misleading empty copy.
- If both summary and money-flow have zero reportable income/expense, the empty state is real.

### 5. Did any previous stabilization change affect the data source or condition?

No evidence found.

The empty condition lives in `FinancialHealthScore.tsx` and depends on `/api/dashboard/summary` current-month totals. The Phase B2.2 daily-flow optimization only skipped `getDailyFlow(userId, 370)` for endpoints that do not use daily flow. It did not change:

- `fn_dashboard_summary`
- current-month income/expense calculation
- `/api/dashboard/summary` response shape
- `FinancialHealthScore` render condition
- dashboard calculations

The route prefetch and app-shell badge fixes also do not affect this widget's data or condition.

### 6. Is this a real data-empty state or a bug?

Most likely classification: a UX/data-read bug unless the user's current-month reportable income and expense are truly both zero and the product decision is that the radar must require current-month movement.

Why:

- The widget's score can calculate meaningful non-transaction factors from existing dashboard data.
- The dashboard already fetches a 6-month money-flow series but the widget does not use it.
- `DashboardHeader` already falls back to the latest money-flow point when summary values are missing, but `FinancialHealthScore` does not.
- The copy says there are not enough "movements", but the implementation checks only current-month income/expense totals, not movement count or broader recent activity.

If product intentionally wants the health radar to be current-month-only, then the empty state is technically correct but the copy should be more precise. If product expects the radar to represent overall financial health, the current gate is too strict.

### 7. What is the smallest safe fix if it is a bug?

Smallest contract-preserving future fix:

1. Add the existing seed-backed money-flow key to `FinancialHealthScore`:
   - `/api/dashboard/money-flow?months=6&mode=acumulado`
2. Derive a fallback activity point:
   - Prefer `/api/dashboard/summary` current-month values when either is nonzero.
   - Otherwise use the latest money-flow series point with nonzero `ingresos` or `egresos`.
3. Only show `EmptyRadar` when there is no usable summary movement and no usable money-flow movement.
4. Keep all API response contracts unchanged.
5. Keep dashboard calculations unchanged except the widget's choice of already-available input data.

Optional copy-only improvement if the product wants to keep the current-month requirement:

- Change the empty copy to say there are no current-month reportable income/expense movements.
- This is lower risk but does not fix the radar being unavailable for users with older activity and meaningful portfolio/credit/asset data.

Recommended minimal implementation file:

- `components/dashboard/FinancialHealthScore.tsx`

Possible only if documenting status after approval:

- `FINANCIAL_HEALTH_WIDGET_AUDIT.md`

Avoid for the first fix:

- API route changes
- dashboard contracts
- Supabase schema/RLS/migrations
- RPC changes
- dashboard UI redesign
- middleware/auth/session changes

### 8. Which files would be modified later?

Likely:

- `components/dashboard/FinancialHealthScore.tsx`
- `FINANCIAL_HEALTH_WIDGET_AUDIT.md` only for implementation status notes

Not needed for the smallest safe fix:

- `app/api/dashboard/summary/route.ts`
- `app/api/dashboard/modules-summary/route.ts`
- `app/api/dashboard/sidebar/route.ts`
- `app/api/dashboard/route.ts`
- `app/api/dashboard/money-flow/route.ts`
- `modules/dashboard/dashboard.service.ts`
- `lib/charts/radar-score.ts`
- `lib/dashboard/types.ts`
- Supabase migrations/RLS/schema

### 9. What tests should run locally and in Vercel Preview?

#### Local manual diagnosis

1. Run `npm run dev`.
2. Log in.
3. Open `/dashboard`.
4. Open Chrome DevTools Network.
5. Inspect `/api/dashboard/summary`:
   - `data.ingresos_mes`
   - `data.egresos_mes`
   - `data.balance_consolidado.pen`
   - `data.alertas_pendientes`
6. Inspect `/api/dashboard/money-flow?months=6&mode=acumulado`:
   - `data.series`
   - latest point with nonzero `ingresos` or `egresos`
7. Inspect `/api/dashboard/modules-summary` and `/api/dashboard/sidebar` for nonzero credit/asset/due data.
8. Confirm whether the widget is empty because the summary values are both zero or because a request failed/missing data.

#### Local validation after a future fix

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run start`
5. Hard reload `/dashboard`.
6. Confirm the radar appears when:
   - current-month summary is nonzero, or
   - current-month summary is zero but money-flow has a recent nonzero month.
7. Confirm `EmptyRadar` still appears for a true no-activity user.
8. Confirm no dashboard endpoint response shape changed.

#### Vercel Preview validation after a future fix

1. Open the preview deployment.
2. Log in as the production-like test user.
3. Hard reload `/dashboard` with Disable cache enabled.
4. Confirm the Financial Health widget no longer shows "Sin lectura" if money-flow or current-month summary data is available.
5. Confirm Network responses for:
   - `/api/dashboard/summary`
   - `/api/dashboard/money-flow?months=6&mode=acumulado`
   - `/api/dashboard/modules-summary`
   - `/api/dashboard/sidebar`
   - `/api/dashboard`
6. Confirm there are no console errors.
7. Confirm dashboard header values remain unchanged.

## Recommendation

Do not change APIs, Supabase, auth, middleware, or dashboard contracts.

First confirm the production user's Network responses. If `/api/dashboard/summary` is zero for the current month but money-flow has nonzero recent history, approve a minimal widget-only fix: let `FinancialHealthScore` reuse the existing money-flow series as fallback activity input before showing the empty radar.

Owner approval is not required for that narrow widget-only fix if it preserves API contracts and calculations semantics. Owner approval is required if the intended business rule changes from "current-month health" to a formal multi-month health score definition, because that is a product/calculation decision.

## Spanish Summary

El radar de Salud Financiera se oculta cuando el ingreso y el egreso del mes actual son cero. Eso no significa necesariamente que el usuario no tenga datos; puede tener cuentas, activos, créditos o movimientos de meses anteriores.

La causa probable es que el widget mira solo el mes actual y no usa el historial de flujo de dinero que el dashboard ya carga. La solución más segura sería usar ese historial como respaldo antes de mostrar "Sin lectura", sin cambiar la base de datos ni las APIs.
