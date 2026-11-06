import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { DashboardSummary as ServiceDashboardSummary } from '@/modules/dashboard/dashboard.types'
import { buildDashboardSummaryPayload } from '@/lib/dashboard/summary-payload'

class NotificationCountQuery implements PromiseLike<{ count: number | null; error: null }> {
  readonly filters: Array<[string, string | boolean]> = []
  constructor(readonly count: number) {}
  select() { return this }
  eq(column: string, value: string | boolean) { this.filters.push([column, value]); return this }
  then<TResult1 = { count: number | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { count: number | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ count: this.count, error: null }).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }
}

function fixtureSupabase(count: number) {
  const query = new NotificationCountQuery(count)
  const client = {
    from(table: string) {
      expect(table).toBe('app_notifications')
      return query
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, query }
}

test('dashboard summary projection preserves financial values and scopes unread count to the session user', async () => {
  const { client, query } = fixtureSupabase(4)
  const serviceSummary = {
    accounts: [{ balancePen: 1_000 }],
    currentMonth: { incomePen: 500, expensePen: 200, incomeUsd: 120, expenseUsd: 50 },
    netWorth: { pen: 900, usd: 257.14 },
    meta: { exchangeRateUsdPen: 3.5 },
  } as unknown as ServiceDashboardSummary

  const result = await buildDashboardSummaryPayload(client, 'user-a', serviceSummary)

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data).toMatchObject({
    balance_consolidado: { pen: 1_000, usd: 285.71 },
    monthly_balance_variation: { amount_pen: 300, previous_balance_pen: 700, trend: 'up' },
    resultado_mensual: 300,
    ingresos_mes: 500,
    egresos_mes: 200,
    alertas_pendientes: 4,
    patrimonio_neto: { pen: 900, usd: 257.14 },
    balance_mes: 300,
    balance_mes_usd: 85.71,
  })
  expect(query.filters).toEqual([['user_id', 'user-a'], ['is_read', false]])
})

test('V3 initial dashboard combines summary and sidebar behind one authenticated summary RPC', () => {
  const overviewRoute = readFileSync(resolve(process.cwd(), 'app/api/dashboard/overview/route.ts'), 'utf8')
  const dashboard = readFileSync(resolve(process.cwd(), 'components/dashboard/DashboardRound07.tsx'), 'utf8')

  expect((overviewRoute.match(/service\.getSummary\(/g) ?? []).length).toBe(1)
  expect(overviewRoute).toContain('buildDashboardSummaryPayload')
  expect(overviewRoute).toContain('buildDashboardSidebarResponse')
  expect(dashboard).toContain('/api/dashboard/overview?period=')
  expect(dashboard).not.toContain('/api/dashboard/summary')
  expect(dashboard).not.toContain('/api/dashboard/sidebar?period=')
  expect(dashboard).not.toContain('void sources.sidebar.mutate(); void sources.summary.mutate()')
})
