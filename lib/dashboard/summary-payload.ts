import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { Errors, ok, type Result } from '@/modules/shared/result.types'
import type { DashboardSummary as ApiDashboardSummary } from '@/lib/dashboard/types'
import type { DashboardSummary as ServiceDashboardSummary } from '@/modules/dashboard/dashboard.types'

type DbClient = SupabaseClient<Database>

/** Maps the financial summary into the stable dashboard API contract. */
export async function buildDashboardSummaryPayload(
  supabase: DbClient,
  userId: string,
  summary: ServiceDashboardSummary,
): Promise<Result<ApiDashboardSummary>> {
  const balancesPen = summary.accounts.map(account => account.balancePen)
  const balancePen = balancesPen.some(value => value === null)
    ? null
    : balancesPen.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const exchangeRate = summary.meta.exchangeRateUsdPen
  const balanceUsd = balancePen === null
    ? null
    : DashboardService.convertCurrency(balancePen, 'PEN', 'USD', exchangeRate)

  const incomePen = summary.currentMonth.incomePen
  const expensePen = summary.currentMonth.expensePen
  const monthlyBalance = incomePen - expensePen
  const previousBalancePen = balancePen === null ? null : balancePen - monthlyBalance
  const monthlyVariationPct = previousBalancePen !== null && Math.abs(previousBalancePen) > 0
    ? Math.round((monthlyBalance / Math.abs(previousBalancePen)) * 1000) / 10
    : previousBalancePen !== null && monthlyBalance === 0
      ? 0
      : null

  const { count, error } = await supabase
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) return Errors.database(error.message)
  if (count === null) return Errors.database('Unread alert count is unavailable')

  return ok({
    balance_consolidado: {
      pen: balancePen === null ? null : Math.round(balancePen * 100) / 100,
      usd: balanceUsd,
    },
    monthly_balance_variation: {
      amount_pen: Math.round(monthlyBalance * 100) / 100,
      percent: monthlyVariationPct,
      previous_balance_pen: previousBalancePen === null ? null : Math.round(previousBalancePen * 100) / 100,
      trend: monthlyBalance > 0 ? 'up' : monthlyBalance < 0 ? 'down' : 'flat',
    },
    resultado_mensual: monthlyBalance,
    ingresos_mes: incomePen,
    ingresos_mes_usd: summary.currentMonth.incomeUsd,
    egresos_mes: expensePen,
    egresos_mes_usd: summary.currentMonth.expenseUsd,
    alertas_pendientes: count,
    patrimonio_neto: {
      pen: summary.netWorth.pen,
      usd: summary.netWorth.usd,
    },
    balance_mes: monthlyBalance,
    balance_mes_usd: DashboardService.convertCurrency(monthlyBalance, 'PEN', 'USD', exchangeRate),
  })
}
