// =============================================================================
// app/api/dashboard/summary/route.ts
// GET /api/dashboard/summary
// Fase 11.1: KPIs consolidados del dashboard en una sola llamada.
// =============================================================================

import { createClient } from '@/lib/supabase.server'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { measureServerOperation } from '@/lib/server/observability'
import {
  apiError,
  apiOk,
  apiUnauthorized,
  fromResult,
  getSessionUserId,
} from '@/lib/api/response'
import type { DashboardSummary } from '@/lib/dashboard/types'

export async function GET() {
  return measureServerOperation('api.dashboard.summary', async () => {
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const result = await service.getSummary(userId, { includeDailyFlow: false })
    if (!result.ok) return fromResult(result)

    const s = result.data
    const exchangeRate = s.meta.exchangeRateUsdPen

    const balancesPen = s.accounts.map(account => account.balancePen)
    const balancePen = balancesPen.some(value => value === null)
      ? null
      : balancesPen.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    const balanceUsd = balancePen === null
      ? null
      : DashboardService.convertCurrency(balancePen, 'PEN', 'USD', exchangeRate)

    const ingresosMes = s.currentMonth.incomePen
    const egresosMes = s.currentMonth.expensePen
    const balanceMes = ingresosMes - egresosMes
    const previousBalancePen = balancePen === null ? null : balancePen - balanceMes
    const monthlyVariationPct = previousBalancePen !== null && Math.abs(previousBalancePen) > 0
      ? Math.round((balanceMes / Math.abs(previousBalancePen)) * 1000) / 10
      : previousBalancePen !== null && balanceMes === 0
        ? 0
        : null
    const patrimonioPen = s.netWorth.pen
    const patrimonioUsd = s.netWorth.usd

    const { count, error: unreadAlertsError } = await supabase
      .from('app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (unreadAlertsError) {
      return apiError({
        code: 'DATABASE_ERROR',
        message: unreadAlertsError.message,
      })
    }

    const payload: DashboardSummary = {
      balance_consolidado: {
        pen: balancePen === null ? null : Math.round(balancePen * 100) / 100,
        usd: balanceUsd,
      },
      monthly_balance_variation: {
        amount_pen: Math.round(balanceMes * 100) / 100,
        percent: monthlyVariationPct,
        previous_balance_pen: previousBalancePen === null ? null : Math.round(previousBalancePen * 100) / 100,
        trend: balanceMes > 0 ? 'up' : balanceMes < 0 ? 'down' : 'flat',
      },
      resultado_mensual: balanceMes,
      ingresos_mes: ingresosMes,
      ingresos_mes_usd: s.currentMonth.incomeUsd,
      egresos_mes: egresosMes,
      egresos_mes_usd: s.currentMonth.expenseUsd,
      alertas_pendientes: count ?? 0,
      patrimonio_neto: {
        pen: patrimonioPen,
        usd: patrimonioUsd,
      },
      balance_mes: balanceMes,
      balance_mes_usd: DashboardService.convertCurrency(balanceMes, 'PEN', 'USD', exchangeRate),
    }

    return apiOk(payload)
  }, { warnAtMs: 500 })
}
