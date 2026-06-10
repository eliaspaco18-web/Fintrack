// =============================================================================
// app/api/dashboard/money-flow/route.ts
// GET /api/dashboard/money-flow?months=6&mode=acumulado|mensual
// Fase 11.1: serie mensual para el flujo de dinero.
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { DashboardService } from '@/modules/dashboard/dashboard.service'
import { apiOk, apiUnauthorized, fromResult, getSessionUserId } from '@/lib/api/response'
import type { MoneyFlowMode, MoneyFlowPoint } from '@/lib/dashboard/types'

function toMonthLabel(monthIso: string): string {
  const monthDate = new Date(`${monthIso}T12:00:00`)
  const label = monthDate
    .toLocaleDateString('es-PE', { month: 'short' })
    .replace('.', '')
    .trim()

  if (label.length === 0) return monthIso
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const monthsParam = req.nextUrl.searchParams.get('months')
  const modeParam = req.nextUrl.searchParams.get('mode')
  const mode: MoneyFlowMode = modeParam === 'mensual' ? 'mensual' : 'acumulado'
  const months = Math.max(1, Math.min(24, Number.parseInt(monthsParam ?? '6', 10) || 6))

  const service = new DashboardService(supabase)
  const result = await service.getCashFlow(userId, months)
  if (!result.ok) return fromResult(result)

  let saldoAcumulado = 0
  const series: MoneyFlowPoint[] = result.data.map((point) => {
    saldoAcumulado += point.netPen
    return {
      month: toMonthLabel(point.month),
      ingresos: point.incomePen,
      egresos: point.expensePen,
      saldo_acumulado: saldoAcumulado,
      saldo_mensual: point.netPen,
      valor: mode === 'mensual' ? point.netPen : saldoAcumulado,
    }
  })

  return apiOk({
    mode,
    months,
    series,
  })
}
