// =============================================================================
// app/api/dashboard/modules-summary/route.ts
// GET /api/dashboard/modules-summary
// Fase 11.1: resumen agregado por módulo.
// =============================================================================

import { createClient } from '@/lib/supabase.server'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { measureServerOperation } from '@/lib/server/observability'
import { apiOk, apiUnauthorized, fromResult, getSessionUserId } from '@/lib/api/response'
import type { ModulesSummary } from '@/lib/dashboard/types'

export async function GET() {
  return measureServerOperation('api.dashboard.modules-summary', async () => {
    const supabase = await createClient()
    const userId = await getSessionUserId(supabase)
    if (!userId) return apiUnauthorized()

    const service = new DashboardService(supabase)
    const result = await service.getSummary(userId, { includeDailyFlow: false })
    if (!result.ok) return fromResult(result)

    const summary = result.data
    const exchangeRate = summary.meta.exchangeRateUsdPen
    const liquidityAccounts = summary.accounts.filter(account => account.type !== 'CREDIT_CARD')
    const liquidityOwnPen = liquidityAccounts.some(account => account.balancePen === null)
      ? null
      : liquidityAccounts.reduce((sum, account) => sum + (account.balancePen ?? 0), 0)

    const totalLimitePen = summary.credits.some(credit => credit.currency === 'USD') && exchangeRate === null
      ? null
      : summary.credits.reduce((sum, credit) => {
      const limit = Number(credit.creditLimit ?? 0)
      const limitPen = credit.currency === 'USD' ? limit * (exchangeRate ?? 0) : limit
      return sum + limitPen
      }, 0)

    const totalUsadoPen = summary.credits.some(credit => credit.currency === 'USD') && exchangeRate === null
      ? null
      : summary.credits.reduce((sum, credit) => {
      const used = Number(credit.usedAmount ?? 0)
      const usedPen = credit.currency === 'USD' ? used * (exchangeRate ?? 0) : used
      return sum + usedPen
      }, 0)

    const creditosUsoPct = totalLimitePen !== null && totalUsadoPen !== null && totalLimitePen > 0
      ? Math.round((totalUsadoPen / totalLimitePen) * 10000) / 100
      : totalLimitePen === 0 && totalUsadoPen === 0 ? 0 : null
    const totalDisponiblePen = totalLimitePen === null || totalUsadoPen === null
      ? null
      : Math.max(totalLimitePen - totalUsadoPen, 0)

    const payload: ModulesSummary = {
      cuentas: liquidityAccounts.length,
      cuentas_total_consolidado: liquidityOwnPen,
      liquidez_propia_total: liquidityOwnPen,
      creditos: summary.credits.length,
      creditos_uso_total: totalUsadoPen,
      creditos_limite_total: totalLimitePen,
      creditos_disponible_total: totalDisponiblePen,
      disponibilidad_ampliada_total: liquidityOwnPen === null || totalDisponiblePen === null
        ? null
        : liquidityOwnPen + totalDisponiblePen,
      activos: {
        count: summary.assets.count,
        total_soles: summary.assets.totalValuePen,
      },
      por_cobrar: {
        count: summary.receivables.count,
        total_adeudado: summary.receivables.totalPendingPen,
      },
      por_pagar: {
        count: summary.payables.count,
        total_por_pagar: summary.payables.totalPendingPen,
      },
      creditos_uso_pct: creditosUsoPct,
      posicion_neta: summary.receivables.totalPendingPen === null || summary.payables.totalPendingPen === null
        ? null
        : summary.receivables.totalPendingPen - summary.payables.totalPendingPen,
    }

    return apiOk(payload)
  }, { warnAtMs: 500 })
}
